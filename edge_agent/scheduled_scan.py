from __future__ import annotations

import glob
import logging
import os
import sys
from pathlib import Path
from threading import Event, Timer

from dotenv import load_dotenv

_AGENT_DIR = Path(__file__).parent
_agent_dir_str = str(_AGENT_DIR)
if _agent_dir_str not in sys.path:
    sys.path.insert(0, _agent_dir_str)

from watcher import (
    _DEFAULT_CONFIG,
    _load_config,
    _setup_logging,
    StateManager,
    process_file,
)
from uploader import SupabaseUploader

logger = logging.getLogger("station_os.scheduled_scan")

MAX_RUNTIME_SECONDS = 600


def main() -> int:
    load_dotenv(_AGENT_DIR / ".env")

    config = _load_config(_DEFAULT_CONFIG)
    _setup_logging(config)
    logger.info("Scheduled scan starting (one-shot).")

    station_id = config["station_id"]
    watch_root = Path(config["watcher"]["watch_path"])
    max_file_bytes = int(config["watcher"].get("max_file_size_bytes", 50 * 1024 * 1024))

    supabase_url = config["supabase"]["url"]
    service_key_env = config["supabase"]["service_key_env"]
    service_key = os.environ.get(service_key_env, "")
    if not service_key:
        logger.critical("Missing Supabase service key (env var: %s)", service_key_env)
        return 1

    state = StateManager()
    uploader = SupabaseUploader(
        supabase_url=supabase_url,
        service_key=service_key,
        config=config,
    )

    stop = Event()
    Timer(MAX_RUNTIME_SECONDS, stop.set).start()

    files = sorted(set(
        glob.glob(str(watch_root / "*.TXT")) + glob.glob(str(watch_root / "*.txt"))
    ))
    logger.info("Scheduled scan: %d archivos en %s", len(files), watch_root)

    for fpath in files:
        if stop.is_set():
            logger.warning("Timeout de scan alcanzado, saliendo.")
            break
        try:
            process_file(fpath, station_id, state, uploader, max_file_bytes)
        except Exception as exc:
            logger.error("Error procesando %s: %s", fpath, exc)

    # Si el servicio principal está caído, este fallback también marca como
    # completados los scan_requests pendientes — para que el botón "Actualizar
    # Datos" del dashboard no quede colgado.
    try:
        pending = uploader.check_scan_request(station_id)
        if pending:
            req_id = pending["id"]
            logger.info("Scheduled scan: marcando scan_request %s como completado", req_id[:8])
            uploader.update_scan_status(req_id, "completed", len(files))
    except Exception as exc:
        logger.warning("No se pudo procesar scan_request pendiente: %s", exc)

    try:
        uploader.send_heartbeat(station_id)
    except Exception:
        pass

    logger.info("Scheduled scan finalizado.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
