"""
Station-OS Edge Agent — Parsers package.

Each parser handles one file type from the legacy VB system:
  VEParser  → VE*.TXT  (Sales detail lines)
  CParser   → C*.TXT   (Card / account payments)
  TParser   → T*.TXT   (Tank levels TQ1-TQ5)
  PParser   → P*.TXT   (Forecourt daily totals)
  SParser   → S*.TXT   (Shop daily totals)

All parsers inherit from BaseParser and return a ParseResult dataclass.
"""

from .base_parser import BaseParser, ParseResult
from .ve_parser import VEParser
from .c_parser import CParser
from .t_parser import TParser
from .p_parser import PParser
from .s_parser import SParser

__all__ = [
    "BaseParser",
    "ParseResult",
    "VEParser",
    "CParser",
    "TParser",
    "PParser",
    "SParser",
]

# File prefix → parser class mapping (used by watcher.py router)
FILE_PREFIX_MAP: dict[str, type[BaseParser]] = {
    "VE": VEParser,
    "C":  CParser,
    "T":  TParser,
    "P":  PParser,
    "S":  SParser,
}
