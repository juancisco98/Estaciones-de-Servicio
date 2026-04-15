from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
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

_META_PREFIX = "_"

_TABLE_ROUTING: dict[str, tuple[str, str]] = {
    "VE": ("sales_transactions", "station_id,file_name,raw_line"),
    "C":  ("card_payments",      "station_id,file_name,raw_line"),
    "T":  ("tank_levels",        "station_id,file_name,tank_id,recorded_at"),
    "P":  ("daily_closings",     "station_id,shift_date,turno"),
    "S":  ("daily_closings",     "station_id,shift_date,turno"),
    "A":  ("cash_closings",      "station_id,shift_date,turno"),
}


def _strip_meta(record: dict[str, Any]) -> dict[str, Any]:
    return {k: v for k, v in record.items() if not k.startswith(_META_PREFIX)}


class SupabaseUploader:
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
        if not result.records:
            logger.info(
                "No records to upload from %s (lines_parsed=%d, errors=%d)",
                result.file_name, result.lines_parsed, len(result.errors),
            )
            return True

        routing = _TABLE_ROUTING.get(result.file_type)
        if not routing:
            logger.error("Unknown file_type %r", result.file_type)
            return False

        table, on_conflict = routing

        clean_records = [_strip_meta(r) for r in result.records]

        conflict_cols = on_conflict.split(",")
        seen = set()
        unique_records = []
        for r in clean_records:
            key = tuple(str(r.get(c, "")) for c in conflict_cols)
            if key not in seen:
                seen.add(key)
                unique_records.append(r)
        if len(unique_records) < len(clean_records):
            logger.info(
                "%s: %d duplicados removidos (%d -> %d)",
                result.file_name, len(clean_records) - len(unique_records),
                len(clean_records), len(unique_records),
            )
        clean_records = unique_records

        logger.info(
            "Uploading %d records from %s -> %s",
            len(clean_records), result.file_name, table,
        )

        success, error_detail = self._upsert_batch(table, clean_records, on_conflict, result.file_name)

        if success:
            logger.info("%s: %d records uploaded to %s", result.file_name, len(clean_records), table)
        else:
            self._write_dead_letter(result, last_error=error_detail)

        return success

    def _upsert_batch(
        self,
        table: str,
        records: list[dict],
        on_conflict: str,
        source_file: str,
    ) -> tuple[bool, str]:
        url = f"{self.base_url}/rest/v1/{table}"
        params = {"on_conflict": on_conflict}

        @retry(
            stop=stop_after_attempt(self.retry_attempts),
            wait=wait_exponential(multiplier=1, min=self.retry_wait, max=60),
            retry=retry_if_exception_type((httpx.TimeoutException, httpx.NetworkError)),
            before_sleep=before_sleep_log(logger, logging.WARNING),
        )
        def _do_post() -> httpx.Response:
            resp = httpx.post(
                url,
                json=records,
                headers=self._headers,
                params=params,
                timeout=30.0,
            )
            if resp.status_code >= 500:
                logger.warning(
                    "Supabase 5xx (%d) for %s -> %s, retrying",
                    resp.status_code, source_file, table,
                )
                raise httpx.NetworkError(f"Server error {resp.status_code}")
            return resp

        try:
            resp = _do_post()
            if resp.status_code in (200, 201):
                return True, ""
            error_msg = f"HTTP {resp.status_code}: {resp.text[:500]}"
            logger.error(
                "Supabase error %d for %s -> %s: %s",
                resp.status_code, source_file, table, resp.text[:500],
            )
            return False, error_msg
        except Exception as exc:
            error_msg = f"Exception after retries: {exc}"
            logger.error("Upload failed for %s after retries: %s", source_file, exc)
            return False, error_msg

    def _write_dead_letter(self, result: ParseResult, last_error: str = "") -> None:
        ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        dead_file = self.dead_letter_dir / f"{result.file_name}.json"
        payload = {
            "source_file":  result.raw_file,
            "file_name":    result.file_name,
            "station_id":   result.station_id,
            "file_type":    result.file_type,
            "records":      result.records,
            "errors":       result.errors,
            "failed_at":    ts,
            "last_error":   last_error,
        }
        dead_file.write_text(json.dumps(payload, indent=2, default=str), encoding="utf-8")
        logger.error("Dead letter written: %s", dead_file)

    def _http_get(self, url: str, params: dict, headers: dict | None = None) -> list | None:
        hdrs = headers or {**self._headers, "Prefer": "return=representation"}
        try:
            resp = httpx.get(url, headers=hdrs, params=params, timeout=10.0)
            if resp.status_code == 200:
                return resp.json()
            return None
        except Exception as exc:
            logger.debug("HTTP GET failed: %s", exc)
            return None

    def send_heartbeat(self, station_id: str) -> bool:
        url = f"{self.base_url}/rest/v1/stations"
        params = {"id": f"eq.{station_id}"}
        body = {"last_heartbeat": datetime.now(timezone.utc).isoformat()}
        try:
            resp = httpx.patch(
                url, json=body, headers=self._headers, params=params, timeout=10.0
            )
            return resp.status_code in (200, 204)
        except Exception as exc:
            logger.debug("Heartbeat failed: %s", exc)
            return False

    def check_scan_request(self, station_id: str) -> dict | None:
        url = f"{self.base_url}/rest/v1/scan_requests"
        params = {
            "station_id": f"eq.{station_id}",
            "status": "eq.pending",
            "order": "requested_at.asc",
            "limit": "1",
        }
        headers = {**self._headers, "Prefer": "return=representation"}
        try:
            resp = httpx.get(url, headers=headers, params=params, timeout=10.0)
            if resp.status_code == 200:
                rows = resp.json()
                return rows[0] if rows else None
            return None
        except Exception as exc:
            logger.debug("scan_requests check failed: %s", exc)
            return None

    def update_scan_status(
        self,
        request_id: str,
        status: str,
        files_processed: int = 0,
        error_message: str | None = None,
    ) -> None:
        url = f"{self.base_url}/rest/v1/scan_requests"
        params = {"id": f"eq.{request_id}"}
        body: dict[str, Any] = {"status": status}
        if status in ("completed", "failed"):
            body["completed_at"] = datetime.now(timezone.utc).isoformat()
            body["files_processed"] = files_processed
        if error_message:
            body["error_message"] = error_message
        try:
            httpx.patch(
                url, json=body, headers=self._headers, params=params, timeout=10.0
            )
        except Exception as exc:
            logger.warning("Could not update scan_request %s: %s", request_id, exc)
