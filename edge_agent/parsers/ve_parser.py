"""
Station-OS Edge Agent — VEParser
Parses VE*.TXT files: detailed sales lines (fuel + shop).

Real format (from VE300326.TXT):
────────────────────────────────────────────────────────────────────────────────
30032026 00:09     9       2.3 SUPER                   2149        5001   78101  88   1  1  17     0
30032026 06:06  1029       1.0 CRAFTED KS.             3400        3400  179464  59   0 11  11     0
30032026 01:07    77       2.0 CASTROL GTX 20W-50     16700       33400   78101  88   1  2  17    12
────────────────────────────────────────────────────────────────────────────────

Column layout (space-delimited, product_name padded to fixed width):
  1.  DDMMYYYY       — date
  2.  HH:MM          — time
  3.  product_code   — integer (1-4 digits)
  4.  quantity       — decimal (liters for fuel, units for shop)
  5.  product_name   — string, right-padded with 2+ spaces before unit_price
  6.  unit_price     — integer, pesos per liter/unit (nominal)
  7.  total_amount   — integer, actual amount charged by pump/register
  8.  ticket_number  — integer, groups multiple items bought together
  9.  turno          — shift number
  10. area_code      — 1 = playa (forecourt), 0 = salon (shop)
  11. isla           — dispenser/register number
  12. employee_code  — attendant identifier
  13. payment_code   — 0=cash, 1-13=card/digital, 14+=account (maps to C*.TXT codes)

Important notes:
  - total_amount is the authoritative amount for reconciliation (not quantity × unit_price)
    because pumps measure liters with more precision than displayed in quantity column.
  - payment_code 0 = CASH, 1-13 = various cards/digital, 14+ = corporate/individual account.
  - Shop items (area_code=0) have a different turno than fuel (area_code=1).
  - Anomaly: negative quantity is logged as ParseResult.error + triggers NEGATIVE_VALUE alert.
"""
from __future__ import annotations

import re
import uuid
from datetime import datetime, date

from .base_parser import BaseParser, ParseResult


# Matches a complete VE sales line.
# Key design: product_name is captured non-greedy up to 2+ spaces before unit_price.
_VE_LINE_RE = re.compile(
    r'^(\d{8})\s+'          # [1] date: DDMMYYYY
    r'(\d{2}:\d{2})\s+'     # [2] time: HH:MM
    r'(\d+)\s+'             # [3] product_code
    r'([\d.]+)\s+'          # [4] quantity (decimal)
    r'(.+?)\s{2,}'          # [5] product_name (non-greedy, ends at 2+ spaces)
    r'(\d+)\s+'             # [6] unit_price (integer)
    r'(\d+)\s+'             # [7] total_amount (integer)
    r'(\d+)\s+'             # [8] ticket_number
    r'(\d+)\s+'             # [9] turno
    r'(\d+)\s+'             # [10] area_code (1=playa, 0=salon)
    r'(\d+)\s+'             # [11] isla/dispenser
    r'(\d+)\s+'             # [12] employee_code
    r'(\d+)\s*$'            # [13] payment_code
)

# Payment code → payment_method string (matches our DB enum)
_PAYMENT_MAP: dict[int, str] = {
    0:  "CASH",
    1:  "CARD",    # VISA
    2:  "CARD",    # VISA DEBITO
    3:  "CARD",    # MASTERCARD
    4:  "CARD",    # MASTERCARD DEBITO
    5:  "CARD",    # MAESTRO
    6:  "CARD",    # CABAL
    7:  "CARD",    # CABAL DEBITO
    8:  "CARD",    # VISA PREPAGO
    9:  "CARD",    # MASTERCARD PREPAGO
    10: "CARD",    # AMERICAN EXPRESS
    11: "CARD",    # APP PETROLERA
    12: "MERCADOPAGO",
    13: "MODO",
}

def _map_payment_code(code: int) -> str:
    if code in _PAYMENT_MAP:
        return _PAYMENT_MAP[code]
    if code >= 14:
        return "ACCOUNT"  # corporate or individual current account
    return "CASH"


def _parse_ve_date(ddmmyyyy: str, hhmm: str) -> str:
    """
    Parse VE date format DDMMYYYY + HH:MM → ISO 8601 string.
    e.g. "30032026" + "00:09" → "2026-03-30T00:09:00"
    """
    dt = datetime.strptime(f"{ddmmyyyy} {hhmm}", "%d%m%Y %H:%M")
    return dt.isoformat()


class VEParser(BaseParser):
    """
    Parser for VE*.TXT — detailed sales lines.
    One row per item sold (fuel or shop product).
    All rows go into the `sales_transactions` Supabase table.
    """

    def parse(self) -> ParseResult:
        result = self._make_result()
        lines = self._read_lines()

        for line_num, raw_line in enumerate(lines, start=1):
            line = raw_line.rstrip("\r\n")
            if not line.strip():
                continue

            m = _VE_LINE_RE.match(line)
            if not m:
                # Not a data line — skip silently (headers, separators, notes)
                continue

            result.lines_parsed += 1
            (
                ddmmyyyy, hhmm, product_code_str, quantity_str,
                product_name, unit_price_str, total_amount_str,
                ticket_number_str, turno_str, area_code_str,
                isla_str, employee_code_str, payment_code_str,
            ) = m.groups()

            try:
                transaction_ts = _parse_ve_date(ddmmyyyy, hhmm)
                shift_date = transaction_ts[:10]
                quantity = self._parse_decimal(quantity_str)
                unit_price = self._parse_decimal(unit_price_str)
                total_amount = self._parse_decimal(total_amount_str)
                payment_code = int(payment_code_str)
                area_code = int(area_code_str)   # 1=forecourt, 0=shop

            except (ValueError, Exception) as exc:
                result.add_error(line_num, line, str(exc))
                continue

            # Anomaly: negative quantity — still ingest, anomaly_detector will alert
            if quantity < 0:
                result.add_error(
                    line_num, line,
                    f"ANOMALY: negative quantity {quantity} for product {product_name.strip()!r}"
                )

            record = {
                "id":              str(uuid.uuid4()),
                "station_id":      self.station_id,
                "file_name":       self.file_name,
                "transaction_ts":  transaction_ts,
                "shift_date":      shift_date,
                "product_code":    product_code_str.strip(),
                "product_name":    product_name.strip(),
                "quantity":        str(quantity),
                "unit_price":      str(unit_price),
                "total_amount":    str(total_amount),
                "payment_method":  _map_payment_code(payment_code),
                # metadata for analytics and auditing
                "_ticket_number":  int(ticket_number_str),
                "_turno":          int(turno_str),
                "_area_code":      area_code,       # 1=playa, 0=salon
                "_isla":           int(isla_str),
                "_employee_code":  int(employee_code_str),
                "_payment_code":   payment_code,
                "raw_line":        line,
            }

            result.records.append(record)
            result.lines_ok += 1

        return result
