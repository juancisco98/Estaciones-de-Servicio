"""
Station-OS Cloud Logic — Knowledge Updater
Google Cloud Function (HTTP trigger)

Triggered by: Admin UI (via classify-entity Supabase Edge Function) when an
operator or admin classifies an unknown product code or account name.

Responsibility:
  1. Fetch station_knowledge.knowledge_blob for the target station(s).
  2. Move the raw_code from unknown_product_codes / unknown_account_names
     into the products / payment_accounts dictionary with canonical_name,
     product_type, and aliases.
  3. Retro-normalize: UPDATE sales_transactions SET product_name = canonical_name
     WHERE station_id = X AND product_code = raw_code.
  4. Bump knowledge_blob.schema_version and last_updated timestamp.
  5. If propagate_globally=True (Collective Intelligence):
     apply the same normalization to ALL stations in the network,
     even if they don't have that code in their unknown list yet.

Deploy:
  gcloud functions deploy update_knowledge \
    --runtime python311 --trigger-http --allow-unauthenticated \
    --set-env-vars SUPABASE_URL=...,SUPABASE_SERVICE_KEY=...
"""

from __future__ import annotations

import copy
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Any

import functions_framework
import httpx

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

SUPABASE_URL         = os.environ.get("SUPABASE_URL", "")
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
    resp = httpx.get(_rest(table), headers=_headers(""), params=params, timeout=20.0)
    resp.raise_for_status()
    return resp.json()


def _patch(table: str, filter_params: dict, payload: dict) -> None:
    resp = httpx.patch(
        _rest(table),
        headers=_headers("return=minimal"),
        params=filter_params,
        json=payload,
        timeout=20.0,
    )
    resp.raise_for_status()


# ── Knowledge blob helpers ────────────────────────────────────────────────────

def _fetch_knowledge(station_id: str) -> tuple[str | None, dict]:
    """
    Returns (row_id, knowledge_blob) for the given station_id.
    If no row exists, returns (None, default_blob).
    """
    rows = _get("station_knowledge", {
        "station_id": f"eq.{station_id}",
        "select":     "id,knowledge_blob",
        "limit":      "1",
    })
    if rows:
        return rows[0]["id"], rows[0]["knowledge_blob"] or {}
    return None, {}


def _fetch_all_station_ids() -> list[str]:
    """Return all active station IDs for global propagation."""
    rows = _get("stations", {
        "is_active": "eq.true",
        "select":    "id",
    })
    return [r["id"] for r in rows]


def _apply_product_classification(
    blob: dict,
    raw_code: str,
    canonical_name: str,
    product_type: str,
    aliases: list[str],
) -> dict:
    """
    Immutably update the knowledge blob:
      - Remove raw_code from unknown_product_codes
      - Add/update entry in products dict
    Returns a NEW dict (does not mutate the input).
    """
    blob = copy.deepcopy(blob)

    # Ensure required keys exist
    blob.setdefault("products", {})
    blob.setdefault("unknown_product_codes", [])
    blob.setdefault("payment_accounts", {})
    blob.setdefault("unknown_account_names", [])

    # Remove from unknown list
    blob["unknown_product_codes"] = [
        c for c in blob["unknown_product_codes"] if c != raw_code
    ]

    # Add/update in products dict — preserve occurrence_count if already present
    existing = blob["products"].get(raw_code, {})
    blob["products"][raw_code] = {
        "canonical_name":   canonical_name,
        "product_type":     product_type,
        "aliases":          sorted(set(aliases)),
        "occurrence_count": existing.get("occurrence_count", 0),
    }

    return blob


def _apply_account_classification(
    blob: dict,
    raw_code: str,
    canonical_name: str,
    account_type: str,
    aliases: list[str],
) -> dict:
    """
    Immutably update the knowledge blob:
      - Remove raw_code from unknown_account_names
      - Add/update entry in payment_accounts dict
    """
    blob = copy.deepcopy(blob)

    blob.setdefault("products", {})
    blob.setdefault("unknown_product_codes", [])
    blob.setdefault("payment_accounts", {})
    blob.setdefault("unknown_account_names", [])

    blob["unknown_account_names"] = [
        c for c in blob["unknown_account_names"] if c != raw_code
    ]

    existing = blob["payment_accounts"].get(raw_code, {})
    blob["payment_accounts"][raw_code] = {
        "canonical_name":   canonical_name,
        "account_type":     account_type,
        "aliases":          sorted(set(aliases)),
        "occurrence_count": existing.get("occurrence_count", 0),
    }

    return blob


def _save_knowledge(row_id: str | None, station_id: str, blob: dict, version: int) -> None:
    """
    Upsert the station_knowledge row. If row_id is None, insert a new row.
    """
    now = datetime.now(timezone.utc).isoformat()
    payload: dict[str, Any] = {
        "station_id":     station_id,
        "knowledge_blob": blob,
        "version":        version + 1,
        "last_updated":   now,
    }

    if row_id:
        _patch("station_knowledge", {"id": f"eq.{row_id}"}, payload)
    else:
        # INSERT new row
        payload["id"] = str(uuid.uuid4())
        resp = httpx.post(
            _rest("station_knowledge"),
            headers=_headers("return=minimal"),
            json=payload,
            timeout=20.0,
        )
        resp.raise_for_status()


def _retro_normalize_transactions(station_id: str, product_code: str, canonical_name: str) -> int:
    """
    UPDATE sales_transactions SET product_name = canonical_name
    WHERE station_id = X AND product_code = code.

    Returns the approximate number of rows affected (from Content-Range header).
    """
    resp = httpx.patch(
        _rest("sales_transactions"),
        headers={**_headers("return=minimal"), "Prefer": "count=exact,return=minimal"},
        params={
            "station_id":   f"eq.{station_id}",
            "product_code": f"eq.{product_code}",
        },
        json={"product_name": canonical_name},
        timeout=30.0,
    )
    resp.raise_for_status()

    # PostgREST returns Content-Range: 0-N/total when count=exact
    content_range = resp.headers.get("content-range", "")
    try:
        total = int(content_range.split("/")[-1])
    except (ValueError, IndexError):
        total = -1

    logger.info(
        "Retro-normalized %d sales_transactions for station=%s code=%s → '%s'",
        total, station_id, product_code, canonical_name,
    )
    return total


# ── Cloud Function entry point ────────────────────────────────────────────────

@functions_framework.http
def update_knowledge(request):
    """
    Expected request body (JSON):
    {
      "station_id":         "uuid" | "ALL",
      "entity_type":        "product" | "account",
      "raw_code":           "099",
      "canonical_name":     "Gas Oil Premium",
      "product_type":       "FUEL",          // only for entity_type="product"
      "account_type":       "CORPORATE",     // only for entity_type="account"
      "aliases":            ["GO PREMIUM", "GOP"],
      "propagate_globally": false
    }

    Returns:
      200 { "status": "ok", "stations_updated": N, "rows_normalized": N }
      400 { "error": "..." }
      500 { "error": "..." }
    """
    try:
        body               = request.get_json(silent=True) or {}
        station_id_param   = body.get("station_id")
        entity_type        = body.get("entity_type", "product").lower()
        raw_code           = body.get("raw_code", "").strip()
        canonical_name     = body.get("canonical_name", "").strip()
        product_type       = body.get("product_type", "FUEL").upper()
        account_type       = body.get("account_type", "CORPORATE").upper()
        aliases            = [a.strip() for a in body.get("aliases", []) if a.strip()]
        propagate_globally = body.get("propagate_globally", False)

        # ── Validation ─────────────────────────────────────────────────────────
        if not station_id_param:
            return {"error": "Missing station_id"}, 400
        if not raw_code:
            return {"error": "Missing raw_code"}, 400
        if not canonical_name:
            return {"error": "Missing canonical_name"}, 400
        if entity_type not in ("product", "account"):
            return {"error": "entity_type must be 'product' or 'account'"}, 400
        if entity_type == "product" and product_type not in ("FUEL", "LUBRICANT", "SHOP_ITEM", "SERVICE"):
            return {"error": "product_type must be FUEL | LUBRICANT | SHOP_ITEM | SERVICE"}, 400

        logger.info(
            "Knowledge update: station=%s entity=%s code=%r → '%s' propagate=%s",
            station_id_param, entity_type, raw_code, canonical_name, propagate_globally,
        )

        # ── Determine target station IDs ────────────────────────────────────────
        if propagate_globally or station_id_param == "ALL":
            station_ids = _fetch_all_station_ids()
        else:
            station_ids = [station_id_param]

        stations_updated = 0
        total_rows_normalized = 0

        for sid in station_ids:
            try:
                row_id, blob = _fetch_knowledge(sid)
                version = blob.get("schema_version", 1)

                # Apply classification to the blob
                if entity_type == "product":
                    updated_blob = _apply_product_classification(
                        blob, raw_code, canonical_name, product_type, aliases
                    )
                else:
                    updated_blob = _apply_account_classification(
                        blob, raw_code, canonical_name, account_type, aliases
                    )

                # Persist updated knowledge blob
                _save_knowledge(row_id, sid, updated_blob, version)

                # Retro-normalize matching transactions
                rows_updated = -1
                if entity_type == "product":
                    rows_updated = _retro_normalize_transactions(sid, raw_code, canonical_name)
                    total_rows_normalized += max(rows_updated, 0)

                stations_updated += 1

            except httpx.HTTPStatusError as exc:
                logger.error(
                    "Failed to update knowledge for station=%s: %s %s",
                    sid, exc.response.status_code, exc.response.text[:200],
                )
            except Exception as exc:
                logger.error("Unexpected error for station=%s: %s", sid, exc)

        logger.info(
            "Knowledge update complete: %d stations updated, %d rows normalized",
            stations_updated, total_rows_normalized,
        )
        return {
            "status":           "ok",
            "stations_updated": stations_updated,
            "rows_normalized":  total_rows_normalized,
        }, 200

    except Exception as exc:
        logger.exception("Knowledge updater error: %s", exc)
        return {"error": str(exc)}, 500
