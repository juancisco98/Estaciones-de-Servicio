"""
Station-OS Edge Agent — SParser
Parses S*.TXT files: shop (salon) daily totals per shift.

Real format (from S290358.TXT):
────────────────────────────────────────────────────────────────────────────────
CAMBIO EN TURNO SALON         59950.00 TURNO  58 SALON 0 NR.BCA   0
TARJ.DE CREDITO              394700.00 TURNO  58 SALON 0 NR.BCA   0
VENTAS SALON                 782500.00 TURNO  58 SALON 0 NR.BCA   0
TOTAL ENTRA                  866200.00 TURNO  58 SALON 0 NR.BCA   0
TOTAL SALE                   865650.00 TURNO  58 SALON 0 NR.BCA   0
────────────────────────────────────────────────────────────────────────────────

Identical format to P*.TXT but uses "SALON" instead of "PLAYA" in the tail.
KEY FIELD: "TOTAL SALE" → stored in daily_closings.shop_total.

Reconciliation:
  daily_closings.forecourt_total  (from P*.TXT)
+ daily_closings.shop_total       (from S*.TXT)
= declared_total
vs SUM(sales_transactions.total_amount WHERE station + date)
= computed_total

If |declared_total - computed_total| / declared_total > 0.001 → DISCREPANCY
"""
from __future__ import annotations

import re
import uuid

from .base_parser import BaseParser, ParseResult


# Same structure as P file but SALON instead of PLAYA
_S_LINE_RE = re.compile(
    r'^(.+?)\s{2,}'             # [1] label
    r'(-?[\d,\.]+)\s+'          # [2] amount
    r'TURNO\s+(\d+)\s+'         # [3] turno
    r'SALON\s+(\d+)\s+'         # [4] salon number (usually 0)
    r'NR\.BCA\s+\d+\s*$'        # trailing
)

_TOTAL_SALE_LABEL = "TOTAL SALE"


class SParser(BaseParser):
    """
    Parser for S*.TXT — shop/salon daily totals.
    Upserts into `daily_closings` (station_id, shift_date) with shop_total.
    Designed to merge with the PParser record (same station_id + shift_date key).
    """

    def parse(self) -> ParseResult:
        result = self._make_result()
        lines = self._read_lines()

        totals: dict[str, float] = {}
        turno: int | None = None
        salon: int | None = None

        for line_num, raw_line in enumerate(lines, start=1):
            line = raw_line.rstrip("\r\n")
            if not line.strip():
                continue

            m = _S_LINE_RE.match(line)
            if not m:
                continue

            result.lines_parsed += 1
            label_raw, amount_str, turno_str, salon_str = m.groups()
            label = label_raw.strip()

            try:
                amount = float(self._parse_decimal(amount_str))
            except ValueError as exc:
                result.add_error(line_num, line, f"Cannot parse amount: {exc}")
                continue

            totals[label] = amount
            turno = int(turno_str)
            salon = int(salon_str)
            result.lines_ok += 1

        if not totals:
            result.add_error(0, "", "No valid lines found in S file — file may be empty or corrupt")
            return result

        shop_total = totals.get(_TOTAL_SALE_LABEL)
        if shop_total is None:
            result.add_error(
                0, "",
                f"'TOTAL SALE' label not found in S file {self.file_name!r}. "
                f"Found labels: {list(totals.keys())}"
            )

        shift_date = self._extract_shift_date_from_filename()

        record = {
            "id":              str(uuid.uuid4()),
            "station_id":      self.station_id,
            "shift_date":      shift_date,
            "shop_total":      str(shop_total) if shop_total is not None else None,
            "s_file_name":     self.file_name,
            "status":          "PENDING",
            "turno":           turno,
            "_totals_snapshot": totals,
            "_salon":          salon,
        }

        result.records.append(record)
        return result
