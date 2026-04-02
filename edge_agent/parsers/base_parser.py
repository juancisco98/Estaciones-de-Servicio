"""
Station-OS Edge Agent — BaseParser
Abstract base class for all .TXT file parsers.

Every parser (VE, C, T, P, S) must:
  1. Inherit from BaseParser
  2. Implement the parse() method
  3. Return a ParseResult dataclass

Design decisions:
  - Encoding detection tries latin-1 → cp1252 → utf-8 (VB systems in Argentina)
  - raw_line is always stored for audit trail (non-destructive principle)
  - Negative quantity/amount values are NOT rejected here — the anomaly_detector GCF handles alerts
  - Partial failures: a file with some bad lines returns success=False but still includes
    all successfully parsed records (partial ingestion is better than none)
"""
from __future__ import annotations

import os
import re
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, date
from decimal import Decimal, InvalidOperation
from typing import Any


# Encodings to try in order for legacy VB files from Argentina.
_VB_ENCODINGS = ("latin-1", "cp1252", "utf-8")


@dataclass
class ParseResult:
    """Result returned by every parser's parse() method."""
    success: bool                       # False if any lines failed to parse
    records: list[dict[str, Any]]       # Validated records ready for Supabase upsert
    errors: list[str]                   # Human-readable error descriptions (line N: reason)
    raw_file: str                       # Absolute path to the source .TXT file
    file_name: str                      # Basename only (e.g. "VE20260330.TXT")
    station_id: str                     # Supabase UUID of the station
    file_type: str                      # "VE" | "C" | "T" | "P" | "S"
    lines_parsed: int = 0               # Total non-empty, non-header lines attempted
    lines_ok: int = 0                   # Lines successfully parsed
    ingested_at: str = field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")

    @property
    def has_errors(self) -> bool:
        return len(self.errors) > 0

    def add_error(self, line_num: int, raw_line: str, reason: str) -> None:
        self.errors.append(f"Line {line_num}: {reason!r} | raw={raw_line!r}")
        self.success = False


class BaseParser(ABC):
    """
    Abstract base class for all Station-OS file parsers.

    Subclasses must implement:
        parse() -> ParseResult

    Provides:
        _read_lines()          — encoding-safe file reader
        _is_header(line)       — detects header/separator lines to skip
        _parse_decimal(s)      — locale-safe Decimal parsing (comma → dot)
        _parse_timestamp(s)    — VB-format date/time → ISO 8601
        _parse_date(s)         — VB-format date → YYYY-MM-DD
        _extract_shift_date()  — extract date from filename (e.g. VE20260330.TXT)
    """

    def __init__(self, station_id: str, file_path: str):
        self.station_id = station_id
        self.file_path = os.path.abspath(file_path)
        self.file_name = os.path.basename(file_path)
        self.file_type = self._infer_file_type()

    def _infer_file_type(self) -> str:
        """Infer file type from filename prefix (VE, C, T, P, S)."""
        name = self.file_name.upper()
        for prefix in ("VE", "C", "T", "P", "S"):
            if name.startswith(prefix):
                return prefix
        return "UNKNOWN"

    @abstractmethod
    def parse(self) -> ParseResult:
        """Parse the file and return a ParseResult. Must not modify the source file."""
        ...

    # ─── Protected helpers ───────────────────────────────────────────────────

    def _read_lines(self) -> list[str]:
        """
        Read the .TXT file lines with encoding detection.
        Tries latin-1 → cp1252 → utf-8. Raises ValueError if none work.
        NEVER modifies the file.
        """
        for encoding in _VB_ENCODINGS:
            try:
                with open(self.file_path, "r", encoding=encoding, errors="strict") as fh:
                    return fh.readlines()
            except (UnicodeDecodeError, UnicodeError):
                continue
        raise ValueError(
            f"Cannot decode {self.file_name} with any of {_VB_ENCODINGS}. "
            "File may be corrupted or use an unexpected encoding."
        )

    def _is_header(self, line: str) -> bool:
        """
        Return True for lines that should be skipped:
        - Empty or whitespace-only
        - Separator lines (all dashes, equals, or dots)
        - Lines starting with common VB header keywords
        """
        stripped = line.strip()
        if not stripped:
            return True
        if re.match(r'^[-=\.\s]{5,}$', stripped):
            return True
        skip_prefixes = (
            "ESTACION", "FECHA", "TURNO", "PLAYA", "REPORTE",
            "TOTAL", "SUBTOTAL", "RESUMEN", "IMPRESORA",
            "=====", "-----", ".....",
        )
        upper = stripped.upper()
        return any(upper.startswith(p) for p in skip_prefixes)

    def _parse_decimal(self, value: str) -> Decimal:
        """
        Parse a decimal number from VB-formatted strings.
        Handles Argentine locale (comma as decimal separator):
          "1.234,56" → Decimal("1234.56")
          "1234.56"  → Decimal("1234.56")
          "1234,56"  → Decimal("1234.56")
        """
        s = value.strip()
        # Argentine format: dot as thousands separator, comma as decimal
        if "," in s and "." in s:
            # e.g. "1.234,56" → remove dots first, then replace comma
            s = s.replace(".", "").replace(",", ".")
        elif "," in s:
            # e.g. "1234,56" — treat comma as decimal separator
            s = s.replace(",", ".")
        # Remove any remaining whitespace or currency symbols
        s = re.sub(r'[^\d\.\-]', '', s)
        try:
            return Decimal(s)
        except InvalidOperation as exc:
            raise ValueError(f"Cannot parse {value!r} as Decimal: {exc}") from exc

    def _parse_timestamp(self, value: str) -> str:
        """
        Parse VB date/time strings to ISO 8601 (UTC assumed for Argentina ART = UTC-3).
        Tries multiple VB date formats:
          "30/03/2026 14:30:00"
          "30-03-2026 14:30:00"
          "2026/03/30 14:30"
          "20260330143000"
        Returns ISO 8601 string: "2026-03-30T14:30:00"
        """
        s = value.strip()
        formats = [
            "%d/%m/%Y %H:%M:%S",
            "%d/%m/%Y %H:%M",
            "%d-%m-%Y %H:%M:%S",
            "%d-%m-%Y %H:%M",
            "%Y/%m/%d %H:%M:%S",
            "%Y/%m/%d %H:%M",
            "%Y%m%d%H%M%S",
            "%d/%m/%Y",
            "%d-%m-%Y",
        ]
        for fmt in formats:
            try:
                dt = datetime.strptime(s, fmt)
                return dt.isoformat()
            except ValueError:
                continue
        raise ValueError(f"Cannot parse timestamp: {value!r}")

    def _parse_date(self, value: str) -> str:
        """Parse VB date string to YYYY-MM-DD."""
        ts = self._parse_timestamp(value)
        return ts[:10]  # "2026-03-30T14:30:00" → "2026-03-30"

    def _extract_shift_date_from_filename(self) -> str | None:
        """
        Try to extract a date from the filename.
        Supports multiple VB naming conventions:
          "VE20260330.TXT"  → "2026-03-30"  (YYYYMMDD)
          "VE30032026.TXT"  → "2026-03-30"  (DDMMYYYY)
          "C250374.TXT"     → "2026-03-25"  (DDMM + turno, year from file mtime)
          "P310393.TXT"     → "2026-03-31"  (DDMM + turno, year from file mtime)
        Returns None if no date found in filename.
        """
        # Try YYYYMMDD pattern in filename (8 consecutive digits)
        match = re.search(r'(\d{4})(\d{2})(\d{2})', self.file_name)
        if match:
            try:
                d = date(int(match.group(1)), int(match.group(2)), int(match.group(3)))
                return d.isoformat()
            except ValueError:
                pass
        # Try DDMMYYYY pattern (8 consecutive digits)
        match = re.search(r'(\d{2})(\d{2})(\d{4})', self.file_name)
        if match:
            try:
                d = date(int(match.group(3)), int(match.group(2)), int(match.group(1)))
                return d.isoformat()
            except ValueError:
                pass
        # Try DDMM + turno pattern (C/P/S/T files like C250374.TXT)
        # Extract first 4 digits after prefix letters as DDMM, year from file mtime
        name_no_ext = os.path.splitext(self.file_name)[0].upper()
        digits = re.sub(r'^[A-Z]+', '', name_no_ext)
        if len(digits) >= 4:
            try:
                dd, mm = int(digits[:2]), int(digits[2:4])
                year = datetime.fromtimestamp(os.path.getmtime(self.file_path)).year
                d = date(year, mm, dd)
                return d.isoformat()
            except (ValueError, OSError):
                pass
        return None

    def _make_result(self) -> ParseResult:
        """Create an empty ParseResult for this parser."""
        return ParseResult(
            success=True,
            records=[],
            errors=[],
            raw_file=self.file_path,
            file_name=self.file_name,
            station_id=self.station_id,
            file_type=self.file_type,
        )
