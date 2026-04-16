from .base_parser import BaseParser, ParseResult
from .ve_parser import VEParser
from .c_parser import CParser
from .t_parser import TParser
from .p_parser import PParser
from .s_parser import SParser
from .a_parser import AParser
from .rubro_parser import RubroParser

__all__ = [
    "BaseParser",
    "ParseResult",
    "VEParser",
    "CParser",
    "TParser",
    "PParser",
    "SParser",
    "AParser",
    "RubroParser",
]

FILE_PREFIX_MAP: dict[str, type[BaseParser]] = {
    "VE": VEParser,
    "RP": RubroParser,
    "RS": RubroParser,
    "C":  CParser,
    "TQ": TParser,
    "T":  TParser,
    "P":  PParser,
    "S":  SParser,
    "A":  AParser,
}
