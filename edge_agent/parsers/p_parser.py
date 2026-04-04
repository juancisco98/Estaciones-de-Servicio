"""
Station-OS Edge Agent — PParser
Parses P*.TXT files: forecourt (playa) daily totals per shift.

Real format (from P300388.TXT):
────────────────────────────────────────────────────────────────────────────────
CAMBIO EN TURNO PLAYA         60000.00 TURNO  88 PLAYA 1 NR.BCA   0
TARJ.DE CREDITO              453477.86 TURNO  88 PLAYA 1 NR.BCA   0
VENTAS DE COMBUSTIBLES      1683032.61 TURNO  88 PLAYA 1 NR.BCA   0
TOTAL COMBUSTIBLES          1683032.61 TURNO  88 PLAYA 1 NR.BCA   0
VENTAS DE VARIOS              37600.00 TURNO  88 PLAYA 1 NR.BCA   0
TOTAL ENTRA                 1780632.61 TURNO  88 PLAYA 1 NR.BCA   0
TOTAL SALE                  1778804.43 TURNO  88 PLAYA 1 NR.BCA   0
────────────────────────────────────────────────────────────────────────────────

Column layout: LABEL (left-aligned, padded) | AMOUNT | TURNO N | PLAYA N | NR.BCA N

KEY FIELD for reconciliation: "TOTAL SALE" → stored in daily_closings.forecourt_total
The reconciler GCF will compare: forecourt_total + shop_total vs SUM(sales_transactions)

All labels and amounts are stored in the daily_closing record as a flat dict
to preserve the full audit trail without extra tables.

Important labels:
  TOTAL SALE           — THE reconciliation total for this forecourt shift
  TOTAL ENTRA          — total income declared (before discounts/adjustments)
  VENTAS DE COMBUSTIBLES — fuel sales subtotal
  VENTAS DE VARIOS     — miscellaneous/shop sales from forecourt register
  TARJ.DE CREDITO      — total card payments declared
  TIRADAS EFECTIVO     — cash disbursed from register
  CAMBIO EN TURNO PLAYA — opening float
"""
from __future__ import annotations

import re
import uuid

from .base_parser import BaseParser, ParseResult


# Each line: LABEL (padded) | AMOUNT | TURNO N | PLAYA N | NR.BCA N
_P_LINE_RE = re.compile(
    r'^(.+?)\s{2,}'             # [1] label (non-greedy, stops at 2+ spaces)
    r'(-?[\d,\.]+)\s+'          # [2] amount (decimal, can be negative)
    r'TURNO\s+(\d+)\s+'         # [3] turno
    r'PLAYA\s+(\d+)\s+'         # [4] playa
    r'(?:NR\.BCA\s+%?\d+)?\s*$'  # trailing NR.BCA field (optional, may have %)
)

# The authoritative reconciliation label
_TOTAL_SALE_LABEL = "TOTAL SALE"


class PParser(BaseParser):
    """
    Parser for P*.TXT — forecourt daily totals.
    Upserts into `daily_closings` (station_id, shift_date) with forecourt_total.
    The full label→amount dict is stored in the record's metadata for audit.
    """

    def parse(self) -> ParseResult:
        result = self._make_result()
        lines = self._read_lines()

        totals: dict[str, float] = {}
        turno: int | None = None
        playa: int | None = None

        for line_num, raw_line in enumerate(lines, start=1):
            line = raw_line.rstrip("\r\n")
            if not line.strip():
                continue

            m = _P_LINE_RE.match(line)
            if not m:
                continue

            result.lines_parsed += 1
            label_raw, amount_str, turno_str, playa_str = m.groups()
            label = label_raw.strip()

            try:
                amount = float(self._parse_decimal(amount_str))
            except ValueError as exc:
                result.add_error(line_num, line, f"Cannot parse amount: {exc}")
                continue

            totals[label] = amount
            turno = int(turno_str)
            playa = int(playa_str)
            result.lines_ok += 1

        if not totals:
            result.add_error(0, "", "No valid lines found in P file — file may be empty or corrupt")
            return result

        # Extract the key reconciliation total
        forecourt_total = totals.get(_TOTAL_SALE_LABEL)
        if forecourt_total is None:
            result.add_error(
                0, "",
                f"'TOTAL SALE' label not found in P file {self.file_name!r}. "
                f"Found labels: {list(totals.keys())}"
            )

        shift_date = self._extract_shift_date_from_filename()

        record = {
            "id":                str(uuid.uuid4()),
            "station_id":        self.station_id,
            "shift_date":        shift_date,
            "forecourt_total":   str(forecourt_total) if forecourt_total is not None else None,
            "p_closing_ts":      self._get_file_mtime_ts(),
            "p_file_name":       self.file_name,
            "status":            "PENDING",
            # Full label dict stored for audit — reconciler will use forecourt_total
            "turno":             turno,
            "p_totals_snapshot":  totals,
            "_playa":            playa,
        }

        result.records.append(record)
        return result
