from __future__ import annotations

import re

from .base_parser import BaseParser, ParseResult


_S_LINE_RE = re.compile(
    r'^(.+?)\s{2,}'
    r'(-?[\d,\.]+)\s+'
    r'TURNO\s+(\d+)\s+'
    r'SALON\s+(\d+)\s+'
    r'(?:NR\.BCA\s+%?\d+)?\s*$'
)

_TOTAL_SALE_LABEL = "TOTAL SALE"


class SParser(BaseParser):
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
            result.add_error(0, "", "No valid lines found in S file")
            return result

        shop_total = totals.get(_TOTAL_SALE_LABEL)
        if shop_total is None:
            result.add_error(
                0, "",
                f"'TOTAL SALE' label not found in S file {self.file_name!r}. "
                f"Found labels: {list(totals.keys())}"
            )

        shift_date = self._extract_shift_date_from_filename()
        if not shift_date:
            result.add_error(0, "", f"Cannot extract date from filename {self.file_name!r}")
            return result

        record = {
            "station_id":        self.station_id,
            "shift_date":        shift_date,
            "shop_total":        str(shop_total) if shop_total is not None else None,
            "s_closing_ts":      self._get_file_mtime_ts(),
            "s_file_name":       self.file_name,
            "status":            "PENDING",
            "turno":             turno,
            "s_totals_snapshot": totals,
            "_salon":            salon,
        }

        result.records.append(record)
        return result
