from __future__ import annotations

import re
import uuid

from .base_parser import BaseParser, ParseResult


_C_LINE_RE = re.compile(
    r'^\s*(\d+)\s+'
    r'(.+?)\s{2,}'
    r'(-?[\d,\.]+)\s+'
    r'TURNO\s+(\d+)\s+'
    r'PLAYA\s+(\d+)\s*$'
)

_PAYMENT_METHOD_MAP: dict[int, str] = {
    1:  "CARD",
    2:  "CARD",
    3:  "CARD",
    4:  "CARD",
    5:  "CARD",
    6:  "CARD",
    7:  "CARD",
    8:  "CARD",
    9:  "CARD",
    10: "CARD",
    11: "CARD",
    12: "MERCADOPAGO",
    13: "MODO",
    14: "CARD",
}

_INTERNAL_CODES = {100, 101, 105, 110, 156, 500, 729}


def _map_payment_type(code: int) -> str:
    if code in _PAYMENT_METHOD_MAP:
        return _PAYMENT_METHOD_MAP[code]
    if code in _INTERNAL_CODES:
        return "ACCOUNT"
    if code >= 14:
        return "ACCOUNT"
    return "CARD"


class CParser(BaseParser):
    def parse(self) -> ParseResult:
        result = self._make_result()
        lines = self._read_lines()

        shift_date = self._extract_shift_date_from_filename()
        payment_ts = self._get_file_mtime_ts()

        for line_num, raw_line in enumerate(lines, start=1):
            line = raw_line.rstrip("\r\n")
            if not line.strip():
                continue

            m = _C_LINE_RE.match(line)
            if not m:
                if line.strip() and any(c.isdigit() for c in line):
                    result.add_error(line_num, line, "Line does not match C format")
                continue

            result.lines_parsed += 1
            account_code_str, account_name, amount_str, turno_str, playa_str = m.groups()

            account_code = int(account_code_str)
            account_name = account_name.strip()

            try:
                amount = self._parse_decimal(amount_str)
            except ValueError:
                result.add_error(
                    line_num, line,
                    f"Corrupt amount field {amount_str!r} for account {account_name!r}"
                )
                continue

            if amount < 0:
                result.add_error(
                    line_num, line,
                    f"Negative balance {amount} for account {account_name!r}"
                )

            record = {
                "id":             str(uuid.uuid4()),
                "station_id":     self.station_id,
                "file_name":      self.file_name,
                "payment_ts":     payment_ts,
                "payment_type":   _map_payment_type(account_code),
                "account_name":   account_name,
                "amount":         str(amount),
                "reference_code": str(account_code),
                "shift_date":     shift_date,
                "_account_code":  account_code,
                "_turno":         int(turno_str),
                "_playa":         int(playa_str),
                "_is_internal":   account_code in _INTERNAL_CODES,
                "raw_line":       line,
            }

            result.records.append(record)
            result.lines_ok += 1

        return result
