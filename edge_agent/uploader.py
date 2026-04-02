"""
Station-OS Edge Agent — Uploader
Authenticated Supabase REST API client with idempotency and retry logic.

Design:
  - Uses service_role key (bypasses RLS for trusted backend inserts)
  - Idempotency: each batch upsert uses on_conflict to avoid duplicates on re-run
  - Retry: tenacity with exponential backoff (configured via config.yaml)
  - Dead letter: files that exhaust all retries are written to logs/dead_letter/
  - Non-destructive: NEVER touches the source .TXT files
  - Triggers reconciliation via Supabase Edge Function after P/S file uploads

Table routing:
  VE files → sales_transactions  (on_conflict: station_id,file_name,raw_line)
  C files  → card_payments       (on_conflict: station_id,file_name,raw_line)
  T files  → tank_levels         (on_conflict: station_id,file_name,tank_id,recorded_at)
  P files  → daily_closings      (on_conflict: station_id,shift_date) — UPSERT forecourt_total
  S files  → daily_closings      (on_conflict: station_id,shift_date) — UPSERT shop_total
"""
from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

import httpx
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
    before_sleep_log,
)

try:
    from .parsers.base_parser import ParseResult
except ImportError:
    from parsers.base_parser import ParseResult

logger = logging.getLogger(__name__)

# Metadata fields (prefixed with "_") are stripped before upload.
# They're used internally by the edge_agent for logging/routing but are not DB columns.
_META_PREFIX = "_"

# Table routing: file_type → (table_name, on_conflict_columns)
_TABLE_ROUTING: dict[str, tuple[str, str]] = {
    "VE": ("sales_transactions", "station_id,file_name,raw_line"),
    "C":  ("card_payments",      "station_id,file_name,raw_line"),
    "T":  ("tank_levels",        "station_id,file_name,tank_id,recorded_at"),
    "P":  ("daily_closings",     "station_id,shift_date"),
    "S":  ("daily_closings",     "station_id,shift_date"),
}


def _strip_meta(record: dict[str, Any]) -> dict[str, Any]:
    """Remove internal metadata fields (prefix _) before sending to Supabase."""
    return {k: v for k, v in record.items() if not k.startswith(_META_PREFIX)}


class SupabaseUploader:
    """
    Handles all communication with Supabase REST API.
    One instance per edge_agent run (shared across all stations).
    """

    def __init__(self, supabase_url: str, service_key: str, config: dict):
        self.base_url = supabase_url.rstrip("/")
        self.service_key = service_key
        self.retry_attempts = config.get("retry", {}).get("attempts", 3)
        self.retry_wait = config.get("retry", {}).get("wait_seconds", 5)
        dead_letter_path = config.get("retry", {}).get("dead_letter_path", "logs/dead_letter/")
        self.dead_letter_dir = Path(dead_letter_path)
        self.dead_letter_dir.mkdir(parents=True, exist_ok=True)

        self._headers = {
            "apikey":        service_key,
            "Authorization": f"Bearer {service_key}",
            "Content-Type":  "application/json",
            "Prefer":        "resolution=merge-duplicates,return=minimal",
        }

    def upload_parse_result(self, result: ParseResult) -> bool:
        """
        Upload all records from a ParseResult to the appropriate Supabase table.
        Returns True if ALL records were uploaded successfully.

        For P and S files: triggers reconciliation after upload.
        """
        if not result.records:
            logger.info(
                "No records to upload from %s (lines_parsed=%d, errors=%d)",
                result.file_name, result.lines_parsed, len(result.errors),
            )
            return True

        routing = _TABLE_ROUTING.get(result.file_type)
        if not routing:
            logger.error("Unknown file_type %r — cannot route to table", result.file_type)
            return False

        table, on_conflict = routing

        # Strip internal metadata fields
        clean_records = [_strip_meta(r) for r in result.records]

        logger.info(
            "Uploading %d records from %s → table=%s",
            len(clean_records), result.file_name, table,
        )

        success = self._upsert_batch(table, clean_records, on_conflict, result.file_name)

        if success:
            logger.info(
                "✓ %s: %d records uploaded to %s", result.file_name, len(clean_records), table
            )
            shift_date = result.records[0].get("shift_date") if result.records else None
            if shift_date:
                if result.file_type in ("P", "S"):
                    # Declared totals updated — trigger reconciliation
                    self._trigger_reconciliation(result.station_id, shift_date)
                elif result.file_type in ("VE", "C", "T"):
                    # New transactions or tank readings — trigger anomaly detection
                    self._trigger_anomaly_detection(result.station_id, shift_date, result.file_type)
        else:
            self._write_dead_letter(result)

        return success

    def _upsert_batch(
        self,
        table: str,
        records: list[dict],
        on_conflict: str,
        source_file: str,
    ) -> bool:
        """
        POST records to Supabase REST with upsert semantics.
        Retries on transient network errors with exponential backoff.
        """
        url = f"{self.base_url}/rest/v1/{table}"
        params = {"on_conflict": on_conflict}

        @retry(
            stop=stop_after_attempt(self.retry_attempts),
            wait=wait_exponential(multiplier=1, min=self.retry_wait, max=60),
            retry=retry_if_exception_type((httpx.TimeoutException, httpx.NetworkError)),
            before_sleep=before_sleep_log(logger, logging.WARNING),
        )
        def _do_post() -> httpx.Response:
            return httpx.post(
                url,
                json=records,
                headers=self._headers,
                params=params,
                timeout=30.0,
            )

        try:
            resp = _do_post()
            if resp.status_code in (200, 201):
                return True
            # 409 Conflict with merge-duplicates should not happen, but handle gracefully
            logger.error(
                "Supabase error %d for %s → %s: %s",
                resp.status_code, source_file, table, resp.text[:500],
            )
            return False
        except Exception as exc:
            logger.error("Upload failed for %s after retries: %s", source_file, exc)
            return False

    def _call_edge_function(self, payload: dict, label: str) -> None:
        """
        POST to the Supabase Edge Function (process-station-file).
        Fire-and-forget — never blocks or fails ingestion.
        """
        url = f"{self.base_url}/functions/v1/process-station-file"
        try:
            resp = httpx.post(url, json=payload, headers=self._headers, timeout=10.0)
            if resp.status_code in (200, 202):
                logger.info("%s triggered: %s", label, payload)
            else:
                logger.warning(
                    "%s trigger returned %d: %s", label, resp.status_code, resp.text[:200]
                )
        except Exception as exc:
            logger.warning("Could not trigger %s: %s", label, exc)

    def _trigger_reconciliation(self, station_id: str, shift_date: str) -> None:
        """Trigger reconciler GCF after a P*.TXT or S*.TXT upload."""
        self._call_edge_function(
            {"station_id": station_id, "shift_date": shift_date, "action": "reconcile"},
            "Reconciliation",
        )

    def _trigger_anomaly_detection(self, station_id: str, shift_date: str, file_type: str) -> None:
        """Trigger anomaly detector GCF after a VE*.TXT, C*.TXT, or T*.TXT upload."""
        self._call_edge_function(
            {"station_id": station_id, "shift_date": shift_date, "action": "detect", "file_type": file_type},
            f"AnomalyDetection({file_type})",
        )

    def _write_dead_letter(self, result: ParseResult) -> None:
        """
        Write a failed upload to the dead letter directory for manual review.
        File: logs/dead_letter/<file_name>_<timestamp>.json
        """
        from datetime import datetime
        ts = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
        dead_file = self.dead_letter_dir / f"{result.file_name}_{ts}.json"
        payload = {
            "source_file":  result.raw_file,
            "file_name":    result.file_name,
            "station_id":   result.station_id,
            "file_type":    result.file_type,
            "records":      result.records,
            "errors":       result.errors,
            "failed_at":    ts,
        }
        dead_file.write_text(json.dumps(payload, indent=2, default=str), encoding="utf-8")
        logger.error("Dead letter written: %s", dead_file)
