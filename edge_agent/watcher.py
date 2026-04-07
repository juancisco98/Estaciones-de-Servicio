"""
Station-OS Edge Agent — Watcher
Main entry point. Monitors D:\\SVAPP\\<station_code>\\ for new/modified .TXT files
and orchestrates the parse → upload pipeline.

Usage:
    python edge_agent/watcher.py [--config path/to/config.yaml]

Architecture:
    watchdog FileSystemEventHandler
        ↓ (on_created / on_modified event for *.TXT)
    _debounce_queue (deduplication + 2s delay for VB write completion)
        ↓
    _process_file(file_path, station_id)
        ↓
    MD5 check against state.json (idempotency — skip if unchanged)
        ↓
    _route_to_parser(file_path) → BaseParser subclass
        ↓
    parser.parse() → ParseResult
        ↓
    uploader.upload_parse_result(result)
        ↓
    state.json updated with MD5 + timestamp + records_inserted

File routing by prefix (case-insensitive):
    VE*.TXT → VEParser → sales_transactions
    C*.TXT  → CParser  → card_payments
    T*.TXT  → TParser  → tank_levels
    P*.TXT  → PParser  → daily_closings (forecourt_total)
    S*.TXT  → SParser  → daily_closings (shop_total)

Non-destructive guarantee:
    The watcher ONLY reads from D:\\SVAPP. It NEVER writes to that directory.
    state.json lives in edge_agent/ (this directory), not in D:\\SVAPP.

Windows Service:
    To run as a Windows service, use:
        python edge_agent/watcher.py --install-service
    (requires pywin32)
"""
from __future__ import annotations

import argparse
import hashlib
import json
import logging
import logging.handlers
import os
import sys
import time
from datetime import datetime
from pathlib import Path
from threading import Event, Lock, Timer
from typing import Any

import yaml
from dotenv import load_dotenv
from watchdog.events import FileSystemEventHandler, FileSystemEvent
from watchdog.observers import Observer

try:
    from .parsers import FILE_PREFIX_MAP, BaseParser
    from .uploader import SupabaseUploader
except ImportError:
    from parsers import FILE_PREFIX_MAP, BaseParser
    from uploader import SupabaseUploader


# ─── Constants ───────────────────────────────────────────────────────────────

_AGENT_DIR = Path(__file__).parent
_STATE_FILE = _AGENT_DIR / "state.json"
_DEFAULT_CONFIG = _AGENT_DIR / "config.yaml"

logger = logging.getLogger("station_os.watcher")


# ─── State management (idempotency) ──────────────────────────────────────────

class StateManager:
    """
    Thread-safe manager for state.json.
    Tracks MD5 hashes of processed files to prevent duplicate uploads.
    """

    def __init__(self, state_file: Path = _STATE_FILE):
        self._path = state_file
        self._lock = Lock()
        self._state: dict[str, Any] = self._load()

    def _load(self) -> dict:
        if self._path.exists():
            try:
                data = json.loads(self._path.read_text(encoding="utf-8"))
                return data.get("processed_files", {})
            except (json.JSONDecodeError, OSError):
                return {}
        return {}

    def _save(self) -> None:
        tmp = {
            "_comment": "Station-OS state file. Tracks processed files by MD5.",
            "_schema_version": 1,
            "processed_files": self._state,
        }
        self._path.write_text(json.dumps(tmp, indent=2), encoding="utf-8")

    def is_processed(self, file_path: str, md5: str) -> bool:
        with self._lock:
            entry = self._state.get(file_path)
            if entry is None:
                return False
            if entry.get("md5") == md5:
                return True
            # File content changed — allow reprocessing
            return False

    def mark_processed(
        self,
        file_path: str,
        md5: str,
        records_inserted: int,
        errors: list[str],
    ) -> None:
        with self._lock:
            self._state[file_path] = {
                "md5":              md5,
                "processed_at":     datetime.utcnow().isoformat() + "Z",
                "records_inserted": records_inserted,
                "error_count":      len(errors),
            }
            self._save()

    def mark_failed(self, file_path: str, md5: str, error: str) -> None:
        """Track upload failure. File will be retried on next scan — never discarded."""
        with self._lock:
            entry = self._state.get(file_path, {})
            prev_count = entry.get("fail_count", 0) if entry.get("md5") == md5 else 0
            self._state[file_path] = {
                "md5":          md5,
                "fail_count":   prev_count + 1,
                "last_error":   error,
                "last_failed":  datetime.utcnow().isoformat() + "Z",
            }
            self._save()


def _md5(file_path: str) -> str:
    """Compute MD5 of a file in chunks. Never modifies the file."""
    h = hashlib.md5()
    with open(file_path, "rb") as fh:
        for chunk in iter(lambda: fh.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


# ─── File routing ─────────────────────────────────────────────────────────────

def _get_parser(file_path: str, station_id: str) -> BaseParser | None:
    """
    Route a .TXT file to the correct parser by filename prefix.
    Returns None if the file type is not recognized.
    """
    name = os.path.basename(file_path).upper()
    for prefix, parser_class in FILE_PREFIX_MAP.items():
        if name.startswith(prefix):
            return parser_class(station_id=station_id, file_path=file_path)
    return None


# ─── Core processing ──────────────────────────────────────────────────────────

def process_file(
    file_path: str,
    station_id: str,
    state: StateManager,
    uploader: SupabaseUploader,
    max_file_bytes: int = 50 * 1024 * 1024,
) -> None:
    """
    Full pipeline for a single .TXT file:
      1. Check file size (reject oversized/corrupt files)
      2. Compute MD5 (non-destructive read)
      3. Skip if already processed with same MD5 (idempotency)
      4. Route to parser
      5. Parse
      6. Log any parse errors
      7. Upload to Supabase
      8. Update state.json
    """
    # Size guard: reject files larger than configured max
    try:
        file_size = os.path.getsize(file_path)
        if file_size > max_file_bytes:
            logger.error(
                "Skipping %s: file too large (%d bytes, max %d)",
                os.path.basename(file_path), file_size, max_file_bytes,
            )
            return
    except OSError as exc:
        logger.warning("Cannot stat %s: %s — will retry on next event", os.path.basename(file_path), exc)
        return

    try:
        file_md5 = _md5(file_path)
    except OSError as exc:
        logger.error("Cannot read %s: %s", file_path, exc)
        return

    if state.is_processed(file_path, file_md5):
        logger.debug("Skipping %s (already processed, MD5=%s)", file_path, file_md5[:8])
        return

    parser = _get_parser(file_path, station_id)
    if parser is None:
        logger.debug("No parser for %s — skipping", os.path.basename(file_path))
        return

    logger.info("Processing %s (station=%s)", os.path.basename(file_path), station_id[:8])

    try:
        result = parser.parse()
    except Exception as exc:
        logger.error("Parser crashed on %s: %s", file_path, exc, exc_info=True)
        # NO marcar como procesado — se reintentara en el proximo scan
        return

    # Log parse errors (anomalies, corrupt lines) — do not abort upload
    if result.errors:
        for err in result.errors:
            logger.warning("[%s] %s", result.file_name, err)

    # Upload (retries handled internally by uploader)
    success = uploader.upload_parse_result(result)

    if success:
        # Check for alerts (tank levels, negative values, reconciliation)
        try:
            from alert_checker import AlertChecker
            AlertChecker(uploader).check_alerts(result, station_id)
        except Exception as exc:
            logger.warning("Alert check failed: %s", exc)

        # Solo marcar como procesado si el upload fue exitoso
        state.mark_processed(
            file_path=file_path,
            md5=file_md5,
            records_inserted=result.lines_ok,
            errors=result.errors,
        )
        # EXTRA visible logging for T and A files (the ones we're debugging)
        prefix = result.file_name[0].upper() if result.file_name else ""
        if prefix in ("T", "A"):
            logger.info(
                ">>> %s FILE OK: %s | records=%d lines=%d/%d errors=%d",
                prefix, result.file_name, len(result.records),
                result.lines_ok, result.lines_parsed, len(result.errors),
            )
        else:
            logger.info(
                "%s: %d/%d lines -> Supabase (%d errors)",
                result.file_name, result.lines_ok, result.lines_parsed, len(result.errors),
            )
    else:
        # Marcar fallo — se reintentará en el próximo escaneo (nunca se descarta)
        state.mark_failed(file_path, file_md5, f"Upload failed for {result.file_name}")
        prefix = result.file_name[0].upper() if result.file_name else ""
        if prefix in ("T", "A"):
            logger.error(
                ">>> %s FILE FAIL: %s | UPLOAD FAILED — ver dead_letter para detalles",
                prefix, result.file_name,
            )
        else:
            logger.error("FAIL %s: upload failed — se reintentará en el próximo escaneo", result.file_name)


# ─── Watchdog event handler ───────────────────────────────────────────────────

class TxtFileHandler(FileSystemEventHandler):
    """
    Handles filesystem events for a single station directory.
    Debounces events so that VB files written in multiple chunks are fully
    written before processing begins.
    """

    def __init__(
        self,
        station_id: str,
        state: StateManager,
        uploader: SupabaseUploader,
        debounce_seconds: float = 2.0,
        max_file_bytes: int = 50 * 1024 * 1024,
    ):
        self.station_id = station_id
        self.state = state
        self.uploader = uploader
        self.debounce_seconds = debounce_seconds
        self.max_file_bytes = max_file_bytes
        self._pending: dict[str, Timer] = {}
        self._lock = Lock()

    def _is_txt(self, path: str) -> bool:
        return path.upper().endswith(".TXT")

    def _schedule(self, file_path: str) -> None:
        """Debounce: cancel any pending timer for this file and restart."""
        with self._lock:
            existing = self._pending.pop(file_path, None)
            if existing:
                existing.cancel()
            timer = Timer(
                self.debounce_seconds,
                process_file,
                args=(file_path, self.station_id, self.state, self.uploader, self.max_file_bytes),
            )
            self._pending[file_path] = timer
            timer.start()

    def on_created(self, event: FileSystemEvent) -> None:
        if not event.is_directory and self._is_txt(event.src_path):
            logger.debug("FILE CREATED: %s", event.src_path)
            self._schedule(event.src_path)

    def on_modified(self, event: FileSystemEvent) -> None:
        if not event.is_directory and self._is_txt(event.src_path):
            logger.debug("FILE MODIFIED: %s", event.src_path)
            self._schedule(event.src_path)


# ─── Bootstrap ───────────────────────────────────────────────────────────────

def _setup_logging(config: dict) -> None:
    log_cfg = config.get("logging", {})
    level_name = log_cfg.get("level", "INFO")
    level = getattr(logging, level_name, logging.INFO)
    log_file = log_cfg.get("log_file", "logs/edge_agent.log")
    max_bytes = log_cfg.get("max_bytes", 10_485_760)
    backup_count = log_cfg.get("backup_count", 5)

    Path(log_file).parent.mkdir(parents=True, exist_ok=True)

    formatter = logging.Formatter(
        "%(asctime)s %(levelname)-8s %(name)s — %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S",
    )

    handlers: list[logging.Handler] = [
        logging.StreamHandler(sys.stdout),
        logging.handlers.RotatingFileHandler(
            log_file, maxBytes=max_bytes, backupCount=backup_count, encoding="utf-8"
        ),
    ]
    for h in handlers:
        h.setFormatter(formatter)
    logging.basicConfig(level=level, handlers=handlers)


def _load_config(config_path: Path) -> dict:
    with open(config_path, encoding="utf-8") as fh:
        return yaml.safe_load(fh)


def main(config_path: Path = _DEFAULT_CONFIG, stop_event: Event | None = None) -> None:
    load_dotenv()

    config = _load_config(config_path)
    _setup_logging(config)

    logger.info("Station-OS Edge Agent starting...")

    # Supabase credentials
    supabase_url = config["supabase"]["url"]
    service_key_env = config["supabase"]["service_key_env"]
    service_key = os.environ.get(service_key_env, "")
    if not service_key:
        logger.critical("Missing Supabase service key (env var: %s)", service_key_env)
        sys.exit(1)

    watch_root = Path(config["watcher"]["watch_path"])
    station_id: str = config.get("station_id", "")
    debounce = config["watcher"].get("debounce_seconds", 2.0)
    max_file_bytes: int = config["watcher"].get("max_file_size_bytes", 50 * 1024 * 1024)

    if not watch_root.exists():
        logger.critical("Watch path does not exist: %s", watch_root)
        sys.exit(1)

    if not station_id:
        logger.critical("No station_id configured in config.yaml")
        sys.exit(1)

    state = StateManager()
    uploader = SupabaseUploader(supabase_url, service_key, config)
    observer = Observer()

    handler = TxtFileHandler(
        station_id=station_id,
        state=state,
        uploader=uploader,
        debounce_seconds=debounce,
        max_file_bytes=max_file_bytes,
    )
    observer.schedule(handler, str(watch_root), recursive=False)

    # Escaneo inicial: procesar archivos .TXT existentes que no fueron procesados
    import glob
    existing = list(set(glob.glob(str(watch_root / "*.TXT")) + glob.glob(str(watch_root / "*.txt"))))
    if existing:
        logger.info("Escaneo inicial: %d archivos TXT encontrados en %s", len(existing), watch_root)
        for fpath in sorted(existing):
            process_file(fpath, station_id, state, uploader, max_file_bytes)
        logger.info("Escaneo inicial completo.")
    else:
        logger.info("No hay archivos TXT existentes en %s", watch_root)

    observer.start()
    logger.info("Watching %s for station %s", watch_root, station_id[:8])
    logger.info("Press Ctrl+C to stop.")

    try:
        poll_counter = 0
        while stop_event is None or not stop_event.is_set():
            time.sleep(1)
            poll_counter += 1
            # Every 15 seconds, check for dashboard refresh requests
            if poll_counter >= 15:
                poll_counter = 0
                try:
                    pending = uploader.check_scan_request(station_id)
                    if pending:
                        req_id = pending["id"]
                        logger.info("Scan request %s received, processing...", req_id[:8])
                        uploader.update_scan_status(req_id, "processing")
                        scan_files = list(set(
                            glob.glob(str(watch_root / "*.TXT")) +
                            glob.glob(str(watch_root / "*.txt"))
                        ))
                        for fpath in sorted(scan_files):
                            process_file(fpath, station_id, state, uploader, max_file_bytes)
                        uploader.update_scan_status(req_id, "completed", len(scan_files))
                        logger.info("Scan request %s completed: %d files scanned", req_id[:8], len(scan_files))
                except Exception as exc:
                    logger.warning("Scan request poll error: %s", exc)
    except KeyboardInterrupt:
        logger.info("Shutdown requested...")
    finally:
        observer.stop()
        observer.join()
        logger.info("Station-OS Edge Agent stopped.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Station-OS Edge Agent")
    parser.add_argument(
        "--config",
        type=Path,
        default=_DEFAULT_CONFIG,
        help="Path to config.yaml",
    )
    args = parser.parse_args()
    main(config_path=args.config)
