"""
Station-OS Edge Agent — AParser
Parses A*.TXT files: cash register totals (CAJA + CHEQUE) per shift.

Real format (from A02040.TXT):
────────────────────────────────────────────────────────────────────────────────
CAJA     5454620578.54
CHEQUE        51171.10
────────────────────────────────────────────────────────────────────────────────

Simple two-column format: LABEL (padded) + AMOUNT.
3 files per day (one per turno closing).
"""
from __future__ import annotations

import re
import uuid

from .base_parser import BaseParser, ParseResult


_A_LINE_RE = re.compile(
    r'^(.+?)\s{2,}'        # [1] label (non-greedy, stops at 2+ spaces)
    r'(-?[\d,\.]+)\s*$'    # [2] amount (decimal, can be negative)
)


class AParser(BaseParser):
    """
    Parser for A*.TXT — cash register totals.
    One row per file. Goes into `cash_closings` Supabase table.
    """

    def parse(self) -> ParseResult:
        result = self._make_result()
        lines = self._read_lines()

        totals: dict[str, float] = {}

        for line_num, raw_line in enumerate(lines, start=1):
            line = raw_line.rstrip("\r\n")
            if not line.strip():
                continue

            m = _A_LINE_RE.match(line)
            if not m:
                continue

            result.lines_parsed += 1
            label_raw, amount_str = m.groups()
            label = label_raw.strip()

            try:
                amount = float(self._parse_decimal(amount_str))
            except ValueError as exc:
                result.add_error(line_num, line, f"Cannot parse amount: {exc}")
                continue

            totals[label] = amount
            result.lines_ok += 1

        if not totals:
            result.add_error(0, "", "No valid lines found in A file")
            return result

        shift_date = self._extract_shift_date_from_filename()

        record = {
            "id":             str(uuid.uuid4()),
            "station_id":     self.station_id,
            "shift_date":     shift_date,
            "caja_total":     str(totals.get("CAJA", 0)),
            "cheque_total":   str(totals.get("CHEQUE", 0)),
            "closing_ts":     self._get_file_mtime_ts(),
            "a_file_name":    self.file_name,
        }

        result.records.append(record)
        return result
