from __future__ import annotations

import os
import re

from .base_parser import BaseParser, ParseResult


_A_LINE_RE = re.compile(
    r'^([A-Za-z\s\.\-]+?)\s+'
    r'(-?[\d,\.]+)\s*$'
)


class AParser(BaseParser):
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
                if line.strip() and any(c.isdigit() for c in line):
                    result.add_error(line_num, line, "Line does not match A format")
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
        if not shift_date:
            result.add_error(0, "", f"Cannot extract date from filename {self.file_name!r}")
            return result

        name_no_ext = os.path.splitext(self.file_name)[0].upper()
        digit_match = re.search(r'[A-Z]+(\d+)', name_no_ext)
        if digit_match:
            digits = digit_match.group(1)
            turno = int(digits[4:]) if len(digits) > 4 else 0
        else:
            turno = 0

        record = {
            "station_id":     self.station_id,
            "shift_date":     shift_date,
            "turno":          turno,
            "caja_total":     str(totals.get("CAJA", 0)),
            "cheque_total":   str(totals.get("CHEQUE", 0)),
            "closing_ts":     self._get_file_mtime_ts(),
            "a_file_name":    self.file_name,
        }

        result.records.append(record)
        return result
