"""
Station-OS Edge Agent — Alert Checker
Generates automatic alerts after successful file uploads.

Triggered by watcher.py after each upload. Routes to file-type checks:
  T files → tank level alerts (CRITICAL/WARNING)
  VE files → negative quantity alerts (CRITICAL)
  P/S files → reconciliation alerts (CRITICAL if mismatch > 0.1%)
"""
from __future__ import annotations

import logging
from decimal import Decimal

try:
    from .parsers.base_parser import ParseResult
    from .uploader import SupabaseUploader
except ImportError:
    from parsers.base_parser import ParseResult
    from uploader import SupabaseUploader

logger = logging.getLogger("station_os.alert_checker")

# ── Thresholds (defaults — station_knowledge can override) ───────────────────

TANK_WARNING_LITERS = 800
TANK_CRITICAL_LITERS = 300
RECONCILIATION_TOLERANCE = 0.001  # 0.1%
MAX_ALERTS_PER_FILE = 5


class AlertChecker:
    """
    Checks ParseResult for anomalies and inserts alerts via Supabase REST.
    Called from watcher.py after each successful upload.
    """

    def __init__(self, uploader: SupabaseUploader):
        self.uploader = uploader

    def check_alerts(self, result: ParseResult, station_id: str) -> None:
        """Route to file-type-specific checks."""
        ft = result.file_type
        if ft == "T":
            self._check_tank_levels(result, station_id)
        elif ft == "VE":
            self._check_negative_quantities(result, station_id)
        elif ft in ("P", "S"):
            self._check_reconciliation(result, station_id)

    # ── Tank level alerts ────────────────────────────────────────────────────

    def _get_owner_thresholds(self, station_id: str) -> tuple[int, int]:
        """Fetch owner-configured tank thresholds, fallback to defaults."""
        url = f"{self.uploader.base_url}/rest/v1/owner_preferences"
        params = {
            "select": "tank_warning_liters,tank_critical_liters",
            "limit": "1",
        }
        # Try station-specific first, then global
        for sid_filter in [f"eq.{station_id}", "is.null"]:
            params["station_id"] = sid_filter
            headers = {**self.uploader._headers, "Prefer": "return=representation"}
            try:
                resp = self.uploader._http_get(url, params, headers)
                if resp:
                    return (
                        int(resp[0].get("tank_warning_liters", TANK_WARNING_LITERS)),
                        int(resp[0].get("tank_critical_liters", TANK_CRITICAL_LITERS)),
                    )
            except Exception:
                pass
        return (TANK_WARNING_LITERS, TANK_CRITICAL_LITERS)

    def _is_notification_enabled(self, station_id: str, alert_type: str) -> bool:
        """Check if owner has this notification type enabled."""
        type_to_field = {
            "LOW_TANK_LEVEL": "notify_tank_low",
            "CRITICAL_TANK_LEVEL": "notify_tank_critical",
            "NEGATIVE_VALUE": "notify_negative_value",
            "RECONCILIATION_FAIL": "notify_reconciliation",
        }
        field = type_to_field.get(alert_type)
        if not field:
            return True  # Unknown type → always notify

        url = f"{self.uploader.base_url}/rest/v1/owner_preferences"
        params = {"select": field, "station_id": "is.null", "limit": "1"}
        headers = {**self.uploader._headers, "Prefer": "return=representation"}
        try:
            resp = self.uploader._http_get(url, params, headers)
            if resp:
                return bool(resp[0].get(field, True))
        except Exception:
            pass
        return True  # On error → default to enabled

    def _check_tank_levels(self, result: ParseResult, station_id: str) -> None:
        if not self._is_notification_enabled(station_id, "LOW_TANK_LEVEL"):
            return

        warning_liters, critical_liters = self._get_owner_thresholds(station_id)
        shift_date = None
        alerts_created = 0

        for record in result.records:
            tank_id = record.get("tank_id", "")
            level_str = record.get("level_liters", "0")
            level = float(Decimal(str(level_str)))
            shift_date = record.get("recorded_at", "")[:10] if not shift_date else shift_date

            if level < critical_liters:
                if alerts_created >= MAX_ALERTS_PER_FILE:
                    break
                if self._alert_exists(station_id, "CRITICAL_TANK_LEVEL", shift_date):
                    continue
                self.uploader.insert_alert(
                    station_id=station_id,
                    level="CRITICAL",
                    alert_type="CRITICAL_TANK_LEVEL",
                    title=f"{tank_id} nivel critico: {int(level)} L",
                    message=f"Tanque {tank_id} tiene {int(level)} litros. "
                            f"Umbral critico: {critical_liters} L. Pedir cisterna urgente.",
                    related_date=shift_date,
                    related_file=result.file_name,
                    metadata={"tank_id": tank_id, "level_liters": level,
                              "threshold": critical_liters,
                              "product_name": record.get("product_name", "")},
                )
                alerts_created += 1

            elif level < warning_liters:
                if alerts_created >= MAX_ALERTS_PER_FILE:
                    break
                if self._alert_exists(station_id, "LOW_TANK_LEVEL", shift_date):
                    continue
                self.uploader.insert_alert(
                    station_id=station_id,
                    level="WARNING",
                    alert_type="LOW_TANK_LEVEL",
                    title=f"{tank_id} nivel bajo: {int(level)} L",
                    message=f"Tanque {tank_id} tiene {int(level)} litros. "
                            f"Umbral: {warning_liters} L. Considerar reposicion.",
                    related_date=shift_date,
                    related_file=result.file_name,
                    metadata={"tank_id": tank_id, "level_liters": level,
                              "threshold": warning_liters,
                              "product_name": record.get("product_name", "")},
                )
                alerts_created += 1

    # ── Negative quantity alerts ─────────────────────────────────────────────

    def _check_negative_quantities(self, result: ParseResult, station_id: str) -> None:
        if not self._is_notification_enabled(station_id, "NEGATIVE_VALUE"):
            return
        alerts_created = 0

        for record in result.records:
            qty = float(Decimal(str(record.get("quantity", "0"))))
            if qty >= 0:
                continue
            if alerts_created >= MAX_ALERTS_PER_FILE:
                break

            shift_date = record.get("shift_date", "")
            product = record.get("product_name", "desconocido")
            total = record.get("total_amount", "0")

            if self._alert_exists(station_id, "NEGATIVE_VALUE", shift_date, result.file_name):
                continue

            self.uploader.insert_alert(
                station_id=station_id,
                level="CRITICAL",
                alert_type="NEGATIVE_VALUE",
                title=f"Venta negativa: {product} ({qty})",
                message=f"Cantidad negativa {qty} para {product}. "
                        f"Monto: ${total}. Archivo: {result.file_name}. "
                        f"Puede ser anulacion legitima o error.",
                related_date=shift_date,
                related_file=result.file_name,
                metadata={"product_name": product, "quantity": qty,
                          "total_amount": str(total),
                          "transaction_ts": record.get("transaction_ts", "")},
            )
            alerts_created += 1

    # ── Reconciliation alerts ────────────────────────────────────────────────

    def _check_reconciliation(self, result: ParseResult, station_id: str) -> None:
        """
        After P or S file: compare declared total against sum of VE transactions.
        Only alerts if both declared total and VE data exist for the same date.
        """
        if not self._is_notification_enabled(station_id, "RECONCILIATION_FAIL"):
            return
        if not result.records:
            return

        record = result.records[0]
        shift_date = record.get("shift_date", "")
        if not shift_date:
            return

        # Get declared total from P or S
        if result.file_type == "P":
            declared_str = record.get("forecourt_total")
        else:
            declared_str = record.get("shop_total")

        if not declared_str:
            return

        declared = float(Decimal(str(declared_str)))
        if declared == 0:
            return

        # Query VE sum for same station + date
        ve_sum = self._get_ve_sum(station_id, shift_date, result.file_type)
        if ve_sum is None:
            return  # No VE data yet — can't compare

        diff = abs(declared - ve_sum)
        pct = diff / abs(declared) if declared != 0 else 0

        if pct > RECONCILIATION_TOLERANCE:
            if self._alert_exists(station_id, "RECONCILIATION_FAIL", shift_date):
                return

            area = "Playa" if result.file_type == "P" else "Salon"
            self.uploader.insert_alert(
                station_id=station_id,
                level="CRITICAL",
                alert_type="RECONCILIATION_FAIL",
                title=f"{area}: diferencia ${int(diff)} ({pct:.1%})",
                message=f"{area} declara ${declared:,.0f} pero VE suma ${ve_sum:,.0f}. "
                        f"Diferencia: ${diff:,.0f} ({pct:.2%}). "
                        f"Tolerancia: {RECONCILIATION_TOLERANCE:.1%}.",
                related_date=shift_date,
                related_file=result.file_name,
                metadata={"declared_total": declared, "computed_total": ve_sum,
                          "difference": diff, "variance_pct": round(pct, 4),
                          "area": area},
            )

    def _get_ve_sum(self, station_id: str, shift_date: str, file_type: str) -> float | None:
        """Query Supabase for sum of VE transactions on this date."""
        url = f"{self.uploader.base_url}/rest/v1/sales_transactions"
        params = {
            "station_id": f"eq.{station_id}",
            "shift_date": f"eq.{shift_date}",
            "select": "total_amount",
        }
        # P = playa (area_code=1), S = salon (area_code=0)
        if file_type == "P":
            params["area_code"] = "eq.1"
        else:
            params["area_code"] = "eq.0"

        headers = {**self.uploader._headers, "Prefer": "return=representation"}
        try:
            resp = self.uploader._http_get(url, params, headers)
            if resp is None:
                return None
            return sum(float(r.get("total_amount", 0)) for r in resp)
        except Exception as exc:
            logger.debug("Could not fetch VE sum: %s", exc)
            return None

    # ── Idempotency ──────────────────────────────────────────────────────────

    def _alert_exists(
        self,
        station_id: str,
        alert_type: str,
        related_date: str | None = None,
        related_file: str | None = None,
    ) -> bool:
        """Check if unresolved alert already exists."""
        url = f"{self.uploader.base_url}/rest/v1/alerts"
        params: dict[str, str] = {
            "station_id": f"eq.{station_id}",
            "type": f"eq.{alert_type}",
            "resolved": "eq.false",
            "limit": "1",
            "select": "id",
        }
        if related_date:
            params["related_date"] = f"eq.{related_date}"
        if related_file:
            params["related_file"] = f"eq.{related_file}"

        headers = {**self.uploader._headers, "Prefer": "return=representation"}
        try:
            resp = self.uploader._http_get(url, params, headers)
            return bool(resp)
        except Exception:
            return False  # On error, allow insert (better to alert twice than miss)
