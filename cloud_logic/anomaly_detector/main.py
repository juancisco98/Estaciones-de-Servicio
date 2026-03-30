"""
Station-OS Cloud Logic — Anomaly Detector
Google Cloud Function (HTTP trigger)

Triggered by: Supabase Edge Function (process-station-file) after each
VE*.TXT, T*.TXT, or C*.TXT batch insert.

Rules checked (in order of severity):
  VE / C files:
    1. Negative quantity in any sales_transaction    → CRITICAL: NEGATIVE_VALUE
    2. Unknown product code (not in station_knowledge) → INFO: UNKNOWN_PRODUCT
    3. Daily fuel volume > 3× p50 baseline           → WARNING: VOLUME_ANOMALY
    4. Zero transactions on a closed business day    → WARNING: MISSING_TRANSACTIONS

  T files:
    5. Tank level <= critical_tank_liters (300 L)    → CRITICAL: CRITICAL_TANK_LEVEL
    6. Tank level <= min_tank_alert_liters (800 L)   → WARNING:  LOW_TANK_LEVEL

All detected anomalies are inserted into the `alerts` table.
Supabase Realtime propagates them → React toast notifications.

Deploy:
  gcloud functions deploy detect_anomalies \
    --runtime python311 --trigger-http --allow-unauthenticated \
    --set-env-vars SUPABASE_URL=...,SUPABASE_SERVICE_KEY=...
"""

from __future__ import annotations

import logging
import os
import uuid
from datetime import date
from decimal import Decimal

import functions_framework
import httpx

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

SUPABASE_URL         = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

# Default thresholds — overridden per-station via station_knowledge.anomaly_baselines
DEFAULT_CRITICAL_TANK_LITERS  = 300
DEFAULT_WARNING_TANK_LITERS   = 800
DEFAULT_VOLUME_BASELINE_P50   = 4500   # liters/day
VOLUME_ANOMALY_MULTIPLIER     = Decimal("3.0")   # > 3× p50 = anomaly
MAX_ALERTS_PER_BATCH          = 5      # cap per run to prevent alert spam


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


def _insert_alert_idempotent(
    station_id: str, shift_date: str, alert_type: str, alert: dict
) -> None:
    """
    Insert alert only if one of the same type/station/date does not already exist
    (unresolved). Prevents duplicate alerts on re-runs or rapid file ingestion.
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


def _load_knowledge(station_id: str) -> dict:
    """Fetch station_knowledge blob for per-station thresholds and known products."""
    rows = _get("station_knowledge", {
        "station_id": f"eq.{station_id}",
        "select":     "knowledge_blob",
        "limit":      "1",
    })
    if rows and rows[0].get("knowledge_blob"):
        return rows[0]["knowledge_blob"]
    return {}


# ── Rule checkers ─────────────────────────────────────────────────────────────

def _check_ve_anomalies(station_id: str, shift_date: str, knowledge: dict) -> None:
    """
    Analyse VE*.TXT / C*.TXT anomalies for a given station + date:
      - negative quantities (CRITICAL)
      - unknown product codes (INFO)
      - daily fuel volume anomaly (WARNING)
      - no transactions on a closed day (WARNING)
    """
    baselines    = knowledge.get("anomaly_baselines", {})
    known_codes  = set(knowledge.get("products", {}).keys())
    fuel_codes   = {
        code
        for code, info in knowledge.get("products", {}).items()
        if info.get("product_type") == "FUEL"
    }

    txs = _get("sales_transactions", {
        "station_id": f"eq.{station_id}",
        "shift_date": f"eq.{shift_date}",
        "select":     "id,quantity,product_code,product_name,raw_line",
    })

    if not txs:
        # No transactions on a past closed day → MISSING_TRANSACTIONS
        if shift_date < date.today().isoformat():
            _insert_alert_idempotent(
                station_id, shift_date, "MISSING_TRANSACTIONS",
                {
                    "id":           str(uuid.uuid4()),
                    "station_id":   station_id,
                    "level":        "WARNING",
                    "type":         "MISSING_TRANSACTIONS",
                    "title":        "Sin Transacciones Registradas",
                    "message": (
                        f"No se encontraron transacciones para el turno del {shift_date}. "
                        f"Verificar que los archivos VE*.TXT hayan sido procesados correctamente."
                    ),
                    "related_date": shift_date,
                    "resolved":     False,
                    "metadata":     {},
                },
            )
        return

    # 1 — Negative quantities (CRITICAL) — cap alerts to avoid spam
    negative_txs = [
        t for t in txs if Decimal(str(t["quantity"])) < 0
    ][:MAX_ALERTS_PER_BATCH]

    for tx in negative_txs:
        _insert_alert_idempotent(
            station_id, shift_date, "NEGATIVE_VALUE",
            {
                "id":           str(uuid.uuid4()),
                "station_id":   station_id,
                "level":        "CRITICAL",
                "type":         "NEGATIVE_VALUE",
                "title":        "Valor Negativo Detectado",
                "message": (
                    f"Transacción con cantidad negativa: {tx['quantity']} para "
                    f"'{tx['product_name']}' (código {tx['product_code']}) "
                    f"en el turno del {shift_date}. "
                    f"Posible ajuste manual o error de ingreso."
                ),
                "related_date": shift_date,
                "resolved":     False,
                "metadata": {
                    "transaction_id": tx["id"],
                    "raw_line":       tx.get("raw_line", ""),
                },
            },
        )

    # 2 — Unknown product codes (INFO)
    unknown_codes = {
        t["product_code"] for t in txs if t["product_code"] not in known_codes
    }
    for code in list(unknown_codes)[:MAX_ALERTS_PER_BATCH]:
        _insert_alert_idempotent(
            station_id, shift_date, "UNKNOWN_PRODUCT",
            {
                "id":           str(uuid.uuid4()),
                "station_id":   station_id,
                "level":        "INFO",
                "type":         "UNKNOWN_PRODUCT",
                "title":        "Código de Producto Desconocido",
                "message": (
                    f"Código de producto '{code}' no está registrado en la base de "
                    f"conocimiento de esta estación. "
                    f"Clasificarlo en Configuración → Conocimiento de Estación."
                ),
                "related_date": shift_date,
                "resolved":     False,
                "metadata":     {"product_code": code},
            },
        )

    # 3 — Daily fuel volume anomaly (WARNING)
    if fuel_codes:
        p50       = Decimal(str(baselines.get("daily_fuel_liters_p50", DEFAULT_VOLUME_BASELINE_P50)))
        threshold = p50 * VOLUME_ANOMALY_MULTIPLIER
        fuel_liters = sum(
            Decimal(str(t["quantity"]))
            for t in txs
            if t["product_code"] in fuel_codes and Decimal(str(t["quantity"])) > 0
        )
        if fuel_liters > threshold:
            _insert_alert_idempotent(
                station_id, shift_date, "VOLUME_ANOMALY",
                {
                    "id":           str(uuid.uuid4()),
                    "station_id":   station_id,
                    "level":        "WARNING",
                    "type":         "VOLUME_ANOMALY",
                    "title":        "Anomalía de Volumen de Combustible",
                    "message": (
                        f"Volumen diario de {fuel_liters:.0f} L supera "
                        f"{VOLUME_ANOMALY_MULTIPLIER}× la línea base "
                        f"(p50={p50:.0f} L) para el turno del {shift_date}."
                    ),
                    "related_date": shift_date,
                    "resolved":     False,
                    "metadata": {
                        "fuel_liters": str(fuel_liters),
                        "p50":         str(p50),
                        "threshold":   str(threshold),
                    },
                },
            )


def _check_tank_levels(station_id: str, shift_date: str, knowledge: dict) -> None:
    """
    Analyse T*.TXT readings for a given station + date.
    Fires CRITICAL_TANK_LEVEL or LOW_TANK_LEVEL per tank where applicable.
    Uses the latest reading per tank_id within the shift.
    """
    baselines          = knowledge.get("anomaly_baselines", {})
    critical_threshold = Decimal(str(baselines.get("critical_tank_liters",  DEFAULT_CRITICAL_TANK_LITERS)))
    warning_threshold  = Decimal(str(baselines.get("min_tank_alert_liters", DEFAULT_WARNING_TANK_LITERS)))

    # Fetch all readings for this shift_date, ordered newest first
    readings = _get("tank_levels", {
        "station_id": f"eq.{station_id}",
        "shift_date": f"eq.{shift_date}",
        "select":     "tank_id,product_name,level_liters,recorded_at",
        "order":      "recorded_at.desc",
    })

    # Deduplicate: keep only the latest reading per tank_id
    latest: dict[str, dict] = {}
    for r in readings:
        tid = r["tank_id"]
        if tid not in latest:
            latest[tid] = r

    for tank_id, tank in latest.items():
        level   = Decimal(str(tank["level_liters"]))
        product = tank.get("product_name", tank_id)

        if level <= critical_threshold:
            _insert_alert_idempotent(
                station_id, shift_date, "CRITICAL_TANK_LEVEL",
                {
                    "id":           str(uuid.uuid4()),
                    "station_id":   station_id,
                    "level":        "CRITICAL",
                    "type":         "CRITICAL_TANK_LEVEL",
                    "title":        f"Nivel Crítico: {tank_id}",
                    "message": (
                        f"Tanque {tank_id} ({product}) en nivel CRÍTICO: "
                        f"{level:.0f} L (umbral: {critical_threshold:.0f} L). "
                        f"Requiere reabastecimiento urgente."
                    ),
                    "related_date": shift_date,
                    "resolved":     False,
                    "metadata": {
                        "tank_id":      tank_id,
                        "level_liters": str(level),
                        "product":      product,
                        "threshold":    str(critical_threshold),
                    },
                },
            )
        elif level <= warning_threshold:
            _insert_alert_idempotent(
                station_id, shift_date, "LOW_TANK_LEVEL",
                {
                    "id":           str(uuid.uuid4()),
                    "station_id":   station_id,
                    "level":        "WARNING",
                    "type":         "LOW_TANK_LEVEL",
                    "title":        f"Nivel Bajo: {tank_id}",
                    "message": (
                        f"Tanque {tank_id} ({product}) en nivel bajo: "
                        f"{level:.0f} L (umbral: {warning_threshold:.0f} L). "
                        f"Programar reabastecimiento."
                    ),
                    "related_date": shift_date,
                    "resolved":     False,
                    "metadata": {
                        "tank_id":      tank_id,
                        "level_liters": str(level),
                        "product":      product,
                        "threshold":    str(warning_threshold),
                    },
                },
            )


# ── Cloud Function entry point ────────────────────────────────────────────────

@functions_framework.http
def detect_anomalies(request):
    """
    Expected request body (JSON):
    {
      "station_id": "uuid",
      "shift_date": "YYYY-MM-DD",
      "file_type":  "VE" | "C" | "T"
    }

    Returns:
      200 { "status": "ok", "station_id": "...", "shift_date": "...", "file_type": "..." }
      400 { "error": "..." }
      500 { "error": "..." }
    """
    try:
        body       = request.get_json(silent=True) or {}
        station_id = body.get("station_id")
        shift_date = body.get("shift_date")
        file_type  = (body.get("file_type") or "VE").upper()

        if not station_id or not shift_date:
            return {"error": "Missing required fields: station_id, shift_date"}, 400

        logger.info(
            "Anomaly detection: station=%s date=%s file_type=%s",
            station_id, shift_date, file_type,
        )

        # Load per-station knowledge base (thresholds + known product codes)
        knowledge = _load_knowledge(station_id)

        if file_type in ("VE", "C"):
            _check_ve_anomalies(station_id, shift_date, knowledge)
        elif file_type == "T":
            _check_tank_levels(station_id, shift_date, knowledge)
        else:
            logger.warning("Unknown file_type %r — no anomaly rules defined", file_type)

        logger.info(
            "Anomaly detection complete: station=%s date=%s", station_id, shift_date
        )
        return {
            "status":     "ok",
            "station_id": station_id,
            "shift_date": shift_date,
            "file_type":  file_type,
        }, 200

    except httpx.HTTPStatusError as exc:
        logger.error(
            "Supabase HTTP error: %s — %s",
            exc.response.status_code, exc.response.text[:300],
        )
        return {"error": f"Supabase error {exc.response.status_code}"}, 502

    except Exception as exc:
        logger.exception("Unexpected anomaly detector error: %s", exc)
        return {"error": str(exc)}, 500
