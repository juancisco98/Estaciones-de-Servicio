"""
Station-OS Cloud Logic — Reconciler
Google Cloud Function (HTTP trigger)

Triggered by: Supabase Edge Function (process-station-file) after a P*.TXT or
S*.TXT file is ingested and daily_closings row has forecourt_total / shop_total set.

Responsibility:
  Compare declared totals (forecourt_total + shop_total from P/S files) against
  the aggregate sum of individual sales_transactions for the same station + date.

  Tolerance: ABS(diff / declared_total) <= 0.001  (0.1%)

  If within tolerance:
    → SET daily_closings.status = 'RECONCILED', reconciliation_ok = TRUE
  Else:
    → SET daily_closings.status = 'DISCREPANCY', reconciliation_ok = FALSE
    → INSERT into alerts (level='CRITICAL', type='RECONCILIATION_FAIL')

Deploy:
  gcloud functions deploy reconcile \
    --runtime python311 --trigger-http --allow-unauthenticated \
    --set-env-vars SUPABASE_URL=...,SUPABASE_SERVICE_KEY=...
"""

from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP

import functions_framework
import httpx

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

TOLERANCE         = Decimal("0.001")   # 0.1%
SUPABASE_URL      = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")


# ── Supabase helpers ──────────────────────────────────────────────────────────

def _headers(prefer: str = "return=representation") -> dict:
    h = {
        "apikey":        SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type":  "application/json",
    }
    if prefer:
        h["Prefer"] = prefer
    return h


def _rest(table: str) -> str:
    return f"{SUPABASE_URL.rstrip('/')}/rest/v1/{table}"


def _get(table: str, params: dict) -> list:
    resp = httpx.get(_rest(table), headers=_headers(""), params=params, timeout=15.0)
    resp.raise_for_status()
    return resp.json()


def _patch(table: str, filter_params: dict, payload: dict) -> None:
    resp = httpx.patch(
        _rest(table),
        headers=_headers("return=minimal"),
        params=filter_params,
        json=payload,
        timeout=15.0,
    )
    resp.raise_for_status()


def _insert_alert_idempotent(
    station_id: str, shift_date: str, alert_type: str, alert: dict
) -> None:
    """
    Insert alert only if one of the same type/station/date does not already exist
    (unresolved). Prevents duplicate CRITICAL alerts on repeated reconciliation runs.
    """
    existing = _get("alerts", {
        "station_id":   f"eq.{station_id}",
        "type":         f"eq.{alert_type}",
        "related_date": f"eq.{shift_date}",
        "resolved":     "eq.false",
        "select":       "id",
        "limit":        "1",
    })
    if existing:
        logger.info(
            "Alert %s already exists for station=%s date=%s — skipping",
            alert_type, station_id, shift_date,
        )
        return

    resp = httpx.post(_rest("alerts"), headers=_headers(), json=alert, timeout=15.0)
    if not resp.is_success:
        logger.error(
            "Failed to insert alert %s for station=%s: %s",
            alert_type, station_id, resp.text[:500],
        )
    else:
        logger.info("Alert %s inserted for station=%s date=%s", alert_type, station_id, shift_date)


# ── Cloud Function entry point ────────────────────────────────────────────────

@functions_framework.http
def reconcile(request):
    """
    Expected request body (JSON):
    {
      "station_id":       "uuid",
      "shift_date":       "YYYY-MM-DD",
      "daily_closing_id": "uuid"     (optional — if already known)
    }

    Returns:
      200 { "status": "RECONCILED"|"DISCREPANCY"|"no_closing_found",
            "diff": "string", "tx_total": "string" }
      400 { "error": "..." }
      500 { "error": "..." }
    """
    try:
        body       = request.get_json(silent=True) or {}
        station_id = body.get("station_id")
        shift_date = body.get("shift_date")

        if not station_id or not shift_date:
            return {"error": "Missing required fields: station_id, shift_date"}, 400

        logger.info("Reconciling station=%s date=%s", station_id, shift_date)

        # ── Step 1: fetch daily_closing row ──────────────────────────────────
        rows = _get("daily_closings", {
            "station_id": f"eq.{station_id}",
            "shift_date": f"eq.{shift_date}",
            "select":     "id,forecourt_total,shop_total",
            "limit":      "1",
        })

        if not rows:
            logger.info(
                "No daily_closing for station=%s date=%s — nothing to reconcile",
                station_id, shift_date,
            )
            return {"status": "no_closing_found"}, 200

        closing         = rows[0]
        closing_id      = closing["id"]
        forecourt_raw   = closing.get("forecourt_total")
        shop_raw        = closing.get("shop_total")

        # If neither P nor S total is available yet, wait for the other file
        if forecourt_raw is None and shop_raw is None:
            logger.info(
                "Both totals are NULL for station=%s date=%s — waiting for P/S files",
                station_id, shift_date,
            )
            return {"status": "waiting_for_files"}, 200

        forecourt_total = Decimal(str(forecourt_raw or 0))
        shop_total      = Decimal(str(shop_raw or 0))
        declared_total  = forecourt_total + shop_total

        # ── Step 2: SUM(total_amount) FROM sales_transactions ─────────────────
        # PostgREST aggregate: ?select=total_amount.sum()
        sum_rows = _get("sales_transactions", {
            "station_id": f"eq.{station_id}",
            "shift_date": f"eq.{shift_date}",
            "select":     "total_amount.sum()",
        })
        raw_sum   = sum_rows[0].get("sum") if sum_rows else None
        tx_total  = Decimal(str(raw_sum or 0))

        logger.info(
            "station=%s date=%s declared=%.2f tx_total=%.2f",
            station_id, shift_date, declared_total, tx_total,
        )

        # ── Step 3: compute reconciliation diff and status ────────────────────
        diff = declared_total - tx_total

        is_discrepancy = False
        if declared_total > 0:
            ratio = abs(diff) / declared_total
            is_discrepancy = ratio > TOLERANCE
        elif tx_total > 0:
            # Declared total is zero but transactions exist → discrepancy
            is_discrepancy = True

        new_status = "DISCREPANCY" if is_discrepancy else "RECONCILED"

        # ── Step 4: UPDATE daily_closing ──────────────────────────────────────
        _patch(
            "daily_closings",
            {"id": f"eq.{closing_id}"},
            {
                "status":             new_status,
                "reconciliation_ok":  not is_discrepancy,
                "reconciliation_diff": str(
                    diff.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
                ),
                "transactions_total": str(
                    tx_total.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
                ),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            },
        )
        logger.info(
            "daily_closing %s updated: status=%s diff=%.2f",
            closing_id, new_status, diff,
        )

        # ── Step 5: insert CRITICAL alert if discrepancy ──────────────────────
        if is_discrepancy:
            pct = (
                float(abs(diff) / declared_total * 100)
                if declared_total > 0
                else 100.0
            )
            _insert_alert_idempotent(
                station_id, shift_date, "RECONCILIATION_FAIL",
                {
                    "id":           str(uuid.uuid4()),
                    "station_id":   station_id,
                    "level":        "CRITICAL",
                    "type":         "RECONCILIATION_FAIL",
                    "title":        "Discrepancia de Reconciliación",
                    "message": (
                        f"Diferencia de ${abs(diff):.2f} ({pct:.2f}%) entre totales "
                        f"declarados (${declared_total:.2f}) y suma de transacciones "
                        f"(${tx_total:.2f}) para el turno del {shift_date}."
                    ),
                    "related_date": shift_date,
                    "resolved":     False,
                    "metadata": {
                        "daily_closing_id": closing_id,
                        "declared_total":   str(declared_total),
                        "tx_total":         str(tx_total),
                        "diff":             str(diff),
                        "diff_pct":         round(pct, 4),
                        "forecourt_total":  str(forecourt_total),
                        "shop_total":       str(shop_total),
                    },
                },
            )

        logger.info(
            "Reconciliation done: station=%s date=%s status=%s",
            station_id, shift_date, new_status,
        )
        return {
            "status":   new_status,
            "diff":     str(diff.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
            "tx_total": str(tx_total.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
        }, 200

    except httpx.HTTPStatusError as exc:
        logger.error("Supabase HTTP error: %s — %s", exc.response.status_code, exc.response.text[:300])
        return {"error": f"Supabase error {exc.response.status_code}"}, 502

    except Exception as exc:
        logger.exception("Unexpected reconciler error: %s", exc)
        return {"error": str(exc)}, 500
