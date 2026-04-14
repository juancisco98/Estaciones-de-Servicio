from __future__ import annotations

import os
import re
import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, date
from decimal import Decimal, InvalidOperation
from typing import Any


_ID_NAMESPACE = uuid.UUID("6ba7b811-9dad-11d1-80b4-00c04fd430c8")  # uuid.NAMESPACE_URL


def deterministic_record_id(station_id: str, file_name: str, line_num: int) -> str:
    return str(uuid.uuid5(_ID_NAMESPACE, f"stationos://{station_id}/{file_name}/line/{line_num}"))


_VB_ENCODINGS = ("latin-1", "cp1252", "utf-8")


@dataclass
class ParseResult:
    success: bool
    records: list[dict[str, Any]]
    errors: list[str]
    raw_file: str
    file_name: str
    station_id: str
    file_type: str
    lines_parsed: int = 0
    lines_ok: int = 0
    ingested_at: str = field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")

    @property
    def has_errors(self) -> bool:
        return len(self.errors) > 0

    def add_error(self, line_num: int, raw_line: str, reason: str) -> None:
        self.errors.append(f"Line {line_num}: {reason!r} | raw={raw_line!r}")
        self.success = False


class BaseParser(ABC):
    def __init__(self, station_id: str, file_path: str):
        self.station_id = station_id
        self.file_path = os.path.abspath(file_path)
        self.file_name = os.path.basename(file_path)
        self.file_type = self._infer_file_type()

    def _infer_file_type(self) -> str:
        name = self.file_name.upper()
        for prefix in ("VE", "C", "T", "P", "S", "A"):
            if name.startswith(prefix):
                return prefix
        return "UNKNOWN"

    @abstractmethod
    def parse(self) -> ParseResult:
        ...

    def _read_lines(self) -> list[str]:
        for encoding in _VB_ENCODINGS:
            try:
                with open(self.file_path, "r", encoding=encoding, errors="strict") as fh:
                    return fh.readlines()
            except (UnicodeDecodeError, UnicodeError):
                continue
        raise ValueError(
            f"Cannot decode {self.file_name} with any of {_VB_ENCODINGS}."
        )

    def _is_header(self, line: str) -> bool:
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
        s = value.strip()
        if "," in s and "." in s:
            s = s.replace(".", "").replace(",", ".")
        elif "," in s:
            s = s.replace(",", ".")
        s = re.sub(r'[^\d\.\-]', '', s)
        try:
            return Decimal(s)
        except InvalidOperation as exc:
            raise ValueError(f"Cannot parse {value!r} as Decimal: {exc}") from exc

    def _parse_timestamp(self, value: str) -> str:
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
        ts = self._parse_timestamp(value)
        return ts[:10]

    def _extract_shift_date_from_filename(self) -> str:
        match = re.search(r'(\d{4})(\d{2})(\d{2})', self.file_name)
        if match:
            try:
                d = date(int(match.group(1)), int(match.group(2)), int(match.group(3)))
                return d.isoformat()
            except ValueError:
                pass
        match = re.search(r'(\d{2})(\d{2})(\d{4})', self.file_name)
        if match:
            try:
                d = date(int(match.group(3)), int(match.group(2)), int(match.group(1)))
                return d.isoformat()
            except ValueError:
                pass
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
        try:
            mtime = os.path.getmtime(self.file_path)
            return date.fromtimestamp(mtime).isoformat()
        except OSError:
            return date.today().isoformat()

    def _get_file_mtime_ts(self) -> str:
        from datetime import timezone, timedelta
        ar_tz = timezone(timedelta(hours=-3))
        try:
            mtime = os.path.getmtime(self.file_path)
            dt_utc = datetime.fromtimestamp(mtime, tz=timezone.utc)
            dt_ar = dt_utc.astimezone(ar_tz)
            return dt_ar.strftime("%Y-%m-%dT%H:%M:%S") + "-03:00"
        except OSError:
            dt_ar = datetime.now(ar_tz)
            return dt_ar.strftime("%Y-%m-%dT%H:%M:%S") + "-03:00"

    def _make_result(self) -> ParseResult:
        return ParseResult(
            success=True,
            records=[],
            errors=[],
            raw_file=self.file_path,
            file_name=self.file_name,
            station_id=self.station_id,
            file_type=self.file_type,
        )
