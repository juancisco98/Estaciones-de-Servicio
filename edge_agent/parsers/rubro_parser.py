from __future__ import annotations

import os
import re

from .base_parser import BaseParser, ParseResult


_RUBRO_LINE_RE = re.compile(
    r'^RUBRO\s+(\d+)\s+'       # rubro_id
    r'(.+?)\s{2,}'             # rubro_name (non-greedy, ends at 2+ spaces)
    r'(\d+)\s+'                # quantity
    r'([\d,\.]+)\s*$'          # amount
)


class RubroParser(BaseParser):
    """Parser for RP*.TXT (Rubro Playa) and RS*.TXT (Rubro Salon) files.

    Both file types share the same line format:
        RUBRO <id>  <name>  <qty>  <amount>

    The source_type ('RP' or 'RS') is inferred from the filename prefix.
    """

    def parse(self) -> ParseResult:
        result = self._make_result()
        lines = self._read_lines()

        shift_date = self._extract_shift_date_from_filename()
        if not shift_date:
            result.add_error(0, "", f"Cannot extract date from filename {self.file_name!r}")
            return result

        # Turno from filename (same pattern as a_parser.py:55-61)
        name_no_ext = os.path.splitext(self.file_name)[0].upper()
        digit_match = re.search(r'[A-Z]+(\d+)', name_no_ext)
        if digit_match:
            digits = digit_match.group(1)
            turno = int(digits[4:]) if len(digits) > 4 else 0
        else:
            turno = 0

        # source_type from filename prefix
        source_type = "RP" if name_no_ext.startswith("RP") else "RS"

        for line_num, raw_line in enumerate(lines, start=1):
            line = raw_line.rstrip("\r\n")
            if not line.strip():
                continue

            m = _RUBRO_LINE_RE.match(line)
            if not m:
                continue

            result.lines_parsed += 1
            rubro_id_str, rubro_name_raw, qty_str, amount_str = m.groups()

            try:
                amount = float(self._parse_decimal(amount_str))
            except ValueError as exc:
                result.add_error(line_num, line, f"Cannot parse amount: {exc}")
                continue

            try:
                quantity = int(qty_str)
            except ValueError as exc:
                result.add_error(line_num, line, f"Cannot parse quantity: {exc}")
                continue

            record = {
                "station_id":  self.station_id,
                "shift_date":  shift_date,
                "turno":       turno,
                "source_type": source_type,
                "rubro_id":    rubro_id_str.strip(),
                "rubro_name":  rubro_name_raw.strip(),
                "quantity":    quantity,
                "amount":      str(amount),
                "file_name":   self.file_name,
                "raw_line":    line,
            }

            result.records.append(record)
            result.lines_ok += 1

        if not result.records:
            result.add_error(0, "", f"No valid lines found in {source_type} file")

        return result
