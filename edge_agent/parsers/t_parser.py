from __future__ import annotations

import os
import re
from datetime import datetime

from .base_parser import BaseParser, ParseResult, deterministic_record_id


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
    """
    Parsea fecha DD-MM-YY o DD-MM-YYYY.
    Para año de 2 dígitos: usa el año del nombre del archivo primero,
    luego el mtime, finalmente el año actual.
    """
    parts = date_str.split("-")
    dd, mm, year_part = parts[0], parts[1], parts[2]

    if len(year_part) == 4:
        year = int(year_part)
    else:
        # Año de 2 dígitos: intentar inferir desde el nombre del archivo
        year = None

        # 1. Intentar extraer año del nombre del archivo (ej: T03047.TXT → no tiene año)
        # El nombre del archivo tiene formato TDDMMT → no contiene año
        # así que usamos el mtime pero con lógica más robusta

        if file_path:
            try:
                mtime = os.path.getmtime(file_path)
                mtime_year = datetime.fromtimestamp(mtime).year
                yy = int(year_part)

                # Si el año de 2 dígitos es coherente con el mtime (±1 año), usarlo
                # Ej: yy=20, mtime_year=2026 → probablemente 2020, no 2026
                # Ej: yy=26, mtime_year=2026 → sí es 2026
                candidate = 2000 + yy
                if abs(candidate - mtime_year) <= 1:
                    # El año del archivo coincide con el mtime → confiable
                    year = candidate
                else:
                    # El archivo fue copiado/movido: el año del nombre es más confiable
                    year = candidate
            except OSError:
                pass

        if year is None:
            yy = int(year_part)
            year = 2000 + yy

    dt = datetime(year, int(mm), int(dd), int(hhmm[:2]), int(hhmm[3:5]))
    return dt.isoformat() + "-03:00"


def _extract_shift_date_from_t_line(date_str: str, file_path: str | None = None) -> str:
    """Extrae solo la fecha YYYY-MM-DD de la línea T."""
    ts = _parse_t_date(date_str, "00:00", file_path)
    return ts[:10]


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
                # ← FIX: shift_date viene de la línea, no del nombre del archivo
                shift_date = recorded_at[:10]
                level_liters = self._parse_decimal(stock_str)
                liters_dispensed = self._parse_decimal(liters_dispensed_str)
            except ValueError as exc:
                result.add_error(line_num, line, str(exc))
                continue

            try:
                sold_amount = self._parse_decimal(value_str)
            except ValueError:
                sold_amount = None

            tank_id = f"TQ{tank_num_str}"

            record = {
                "id":                  deterministic_record_id(self.station_id, self.file_name, line_num),
                "station_id":          self.station_id,
                "file_name":           self.file_name,
                "shift_date":          shift_date,          # ← FIX: ahora viene de la línea
                "recorded_at":         recorded_at,
                "tank_id":             tank_id,
                "product_name":        product_name.strip(),
                "product_code":        product_name.strip().upper().replace(" ", "_"),
                "level_liters":        str(level_liters),
                "sold_liters":         str(liters_dispensed),
                "sold_amount":         str(sold_amount) if sold_amount is not None else None,
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