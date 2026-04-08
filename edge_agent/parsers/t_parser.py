from __future__ import annotations

import os
import re
import uuid
from datetime import datetime

from .base_parser import BaseParser, ParseResult


_T_LINE_RE = re.compile(
    r'^(\d{2}-\d{2}-\d{2,4})\s+'
    r'(\d{2}:\d{2})\s+'
    r'TQ\s*(\d+)\s+'
    r'LTS[\.:]+\s*([\d.,\-]+)\s+'
    r'\$?\s*([\d.,\-]+)\s+'
    r'(.+?)\s+'
    r'STOCK[\.:]+\s*([\d.,\-]+)\s+'
    r'TURNO\s+(\d+)\s+'
    r'PLAYA\s+(\d+)'
    r'(?:\s+(?:NRO\.BOCA|NR\.BCA)\s+%?(\d+))?'
    r'\s*$'
)


def _parse_t_date(date_str: str, hhmm: str, file_path: str | None = None) -> str:
    parts = date_str.split("-")
    dd, mm, year_part = parts[0], parts[1], parts[2]

    if len(year_part) == 4:
        year = int(year_part)
    else:
        year = None
        if file_path:
            try:
                mtime = os.path.getmtime(file_path)
                year = datetime.fromtimestamp(mtime).year
            except OSError:
                pass
        if year is None:
            year = datetime.now().year

    dt = datetime(year, int(mm), int(dd), int(hhmm[:2]), int(hhmm[3:5]))
    return dt.isoformat() + "-03:00"


class TParser(BaseParser):
    def parse(self) -> ParseResult:
        result = self._make_result()
        lines = self._read_lines()

        for line_num, raw_line in enumerate(lines, start=1):
            line = raw_line.rstrip("\r\n")
            if not line.strip():
                continue

            m = _T_LINE_RE.match(line)
            if not m:
                if line.strip() and ('TQ' in line.upper() or 'STOCK' in line.upper()):
                    result.add_error(line_num, line, "Line does not match T format")
                continue

            result.lines_parsed += 1
            (
                ddmmyy, hhmm, tank_num_str,
                liters_dispensed_str, value_str,
                product_name, stock_str,
                turno_str, playa_str, nozzle_str,
            ) = m.groups()

            if not tank_num_str.isdigit():
                result.add_error(line_num, line, f"Invalid tank number: {tank_num_str!r}")
                continue

            try:
                recorded_at = _parse_t_date(ddmmyy, hhmm, self.file_path)
                level_liters = self._parse_decimal(stock_str)
                liters_dispensed = self._parse_decimal(liters_dispensed_str)
            except ValueError as exc:
                result.add_error(line_num, line, str(exc))
                continue

            tank_id = f"TQ{tank_num_str}"

            record = {
                "id":                  str(uuid.uuid4()),
                "station_id":          self.station_id,
                "file_name":           self.file_name,
                "shift_date":          self._extract_shift_date_from_filename(),
                "recorded_at":         recorded_at,
                "tank_id":             tank_id,
                "product_name":        product_name.strip(),
                "product_code":        product_name.strip().upper().replace(" ", "_"),
                "level_liters":        str(level_liters),
                "_liters_dispensed":   str(liters_dispensed),
                "_turno":              int(turno_str),
                "_playa":              int(playa_str),
                "_nozzle":             int(nozzle_str) if nozzle_str else 0,
                "raw_line":            line,
            }

            result.records.append(record)
            result.lines_ok += 1

        if result.lines_ok == 0 and len(lines) > 0:
            result.add_error(
                0, "",
                f"T file produced 0 records from {len(lines)} lines"
            )

        return result
