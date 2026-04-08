from __future__ import annotations

import re
import uuid
from datetime import datetime

from .base_parser import BaseParser, ParseResult


_VE_LINE_RE = re.compile(
    r'^(\d{8})\s+'
    r'(\d{2}:\d{2})\s+'
    r'(\d+)\s+'
    r'(-?[\d.]+)\s+'
    r'(.+?)\s{2,}'
    r'(-?\d+)\s+'
    r'(-?\d+)\s+'
    r'(\d+)\s+'
    r'(\d+)\s+'
    r'(\d+)\s+'
    r'(\d+)\s+'
    r'(\d+)\s+'
    r'(\d+)\s*$'
)

_PAYMENT_MAP: dict[int, str] = {
    0:  "CASH",
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
}


def _map_payment_code(code: int) -> str:
    if code in _PAYMENT_MAP:
        return _PAYMENT_MAP[code]
    if code >= 14:
        return "ACCOUNT"
    return "CASH"


def _parse_ve_date(ddmmyyyy: str, hhmm: str) -> str:
    dt = datetime.strptime(f"{ddmmyyyy} {hhmm}", "%d%m%Y %H:%M")
    return dt.isoformat() + "-03:00"


class VEParser(BaseParser):
    def parse(self) -> ParseResult:
        result = self._make_result()
        lines = self._read_lines()

        for line_num, raw_line in enumerate(lines, start=1):
            line = raw_line.rstrip("\r\n")
            if not line.strip():
                continue

            m = _VE_LINE_RE.match(line)
            if not m:
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
                area_code = int(area_code_str)
            except (ValueError, Exception) as exc:
                result.add_error(line_num, line, str(exc))
                continue

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
                "turno":           int(turno_str),
                "area_code":       area_code,
                "_ticket_number":  int(ticket_number_str),
                "_isla":           int(isla_str),
                "_employee_code":  int(employee_code_str),
                "_payment_code":   payment_code,
                "raw_line":        line,
            }

            result.records.append(record)
            result.lines_ok += 1

        return result
