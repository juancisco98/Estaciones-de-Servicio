"""
Station-OS Edge Agent — TParser
Parses T*.TXT files: tank stock levels (TQ1-TQ5) at shift end.

Real format (from T300388.TXT):
────────────────────────────────────────────────────────────────────────────────
30-03-20 05:53 TQ  1 LTS.:     48  $           0.00 QUANTIUM DIESEL   STOCK:    11332 TURNO  88  PLAYA   1 NRO.BOCA      0
30-03-20 05:53 TQ  2 LTS.:    330  $           0.00 DIESEL X 10       STOCK:     9504 TURNO  88  PLAYA   1 NRO.BOCA      0
30-03-20 05:53 TQ  3 LTS.:     21  $           0.00 QUANTIUM NAFTA    STOCK:     9295 TURNO  88  PLAYA   1 NRO.BOCA      0
30-03-20 05:53 TQ  4 LTS.:    109  $           0.00 SUPER             STOCK:     6109 TURNO  88  PLAYA   1 NRO.BOCA      0
30-03-20 05:53 TQ  5 LTS.:    243  $           0.00 SUPER             STOCK:     8190 TURNO  88  PLAYA   1 NRO.BOCA      0
────────────────────────────────────────────────────────────────────────────────

Column layout:
  1. DD-MM-YY     — date (2-digit year, Python %y interprets 00-68 as 2000-2068)
  2. HH:MM        — time
  3. TQ N         — tank identifier (TQ 1 through TQ 5)
  4. LTS.: NNN    — liters dispensed this shift (delta, not stock)
  5. $ 0.00       — monetary value of dispensed liters (may be 0)
  6. PRODUCT_NAME — free-form product name (e.g. QUANTIUM DIESEL, DIESEL X 10)
  7. STOCK: NNNNN — CURRENT STOCK in liters ← KEY FIELD for inventory alerting
  8. TURNO N      — shift number
  9. PLAYA N      — forecourt number
  10. NRO.BOCA N  — nozzle/gun number

Tank ID mapping: TQ 1 → "TQ1", TQ 2 → "TQ2", etc.

Anomaly thresholds (from station_knowledge):
  - STOCK < 800 liters  → WARNING: LOW_TANK_LEVEL
  - STOCK < 300 liters  → CRITICAL: CRITICAL_TANK_LEVEL
"""
from __future__ import annotations

import os
import re
import uuid
from datetime import datetime

from .base_parser import BaseParser, ParseResult


_T_LINE_RE = re.compile(
    r'^(\d{2}-\d{2}-\d{2,4})\s+'        # [1] date DD-MM-YY or DD-MM-YYYY
    r'(\d{2}:\d{2})\s+'                  # [2] time HH:MM
    r'TQ\s*(\d+)\s+'                     # [3] tank number (espacio opcional después de TQ)
    r'LTS[\.:]+\s*([\d.,\-]+)\s+'        # [4] liters dispensed (acepta LTS. LTS: LTS.:)
    r'\$?\s*([\d.,\-]+)\s+'              # [5] value dispensed (símbolo $ opcional)
    r'(.+?)\s+'                          # [6] product_name (non-greedy)
    r'STOCK[\.:]+\s*([\d.,\-]+)\s+'      # [7] current stock (acepta STOCK. STOCK: STOCK.:)
    r'TURNO\s+(\d+)\s+'                  # [8] turno
    r'PLAYA\s+(\d+)'                     # [9] playa
    r'(?:\s+(?:NRO\.BOCA|NR\.BCA)\s+%?(\d+))?'  # [10] nozzle (entirely optional)
    r'\s*$'
)


# No hardcoded limit — accept any tank number (1-99)


def _parse_t_date(date_str: str, hhmm: str, file_path: str | None = None) -> str:
    """
    Parse DD-MM-YY or DD-MM-YYYY + HH:MM → ISO 8601 with Argentina timezone.
    The times in the files are local Argentina time (UTC-3).

    For 2-digit years: VB systems may write truncated years (e.g. "20" for 2026).
    We use the file's modification time year as the correct year, since the file
    was just created by the VB system.
    """
    parts = date_str.split("-")
    dd, mm, year_part = parts[0], parts[1], parts[2]

    if len(year_part) == 4:
        year = int(year_part)
    else:
        # 2-digit year: use file mtime year (more reliable than Python's %y pivot)
        year = None
        if file_path:
            try:
                mtime = os.path.getmtime(file_path)
                year = datetime.fromtimestamp(mtime).year
            except OSError:
                pass
        if year is None:
            year = datetime.now().year

    dt = datetime(year, int(mm), int(dd),
                  int(hhmm[:2]), int(hhmm[3:5]))
    return dt.isoformat() + "-03:00"


class TParser(BaseParser):
    """
    Parser for T*.TXT — tank level readings.
    One row per tank (TQ1, TQ2, ... TQN — dynamic). Goes into `tank_levels` Supabase table.
    The STOCK field is used by skill_inventory_alert() to detect critical levels.
    """

    def parse(self) -> ParseResult:
        result = self._make_result()
        lines = self._read_lines()

        for line_num, raw_line in enumerate(lines, start=1):
            line = raw_line.rstrip("\r\n")
            if not line.strip():
                continue

            m = _T_LINE_RE.match(line)
            if not m:
                # Log lines that look like data but don't match (helps diagnose VB format changes)
                if line.strip() and ('TQ' in line.upper() or 'STOCK' in line.upper()):
                    result.add_error(line_num, line, "Line does not match T format — possible VB format change")
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
                # metadata for inventory alerting
                "_liters_dispensed":   str(liters_dispensed),
                "_turno":              int(turno_str),
                "_playa":              int(playa_str),
                "_nozzle":             int(nozzle_str) if nozzle_str else 0,
                "raw_line":            line,
            }

            result.records.append(record)
            result.lines_ok += 1

        # Force visible error if file produced 0 records (likely regex mismatch)
        if result.lines_ok == 0 and len(lines) > 0:
            result.add_error(
                0, "",
                f"T file produced 0 records from {len(lines)} lines — regex may not match VB format"
            )

        return result
