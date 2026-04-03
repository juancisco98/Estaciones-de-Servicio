"""
Station-OS Edge Agent — CParser
Parses C*.TXT files: current accounts and card payment balances per shift.

Real format (from C300389.TXT):
────────────────────────────────────────────────────────────────────────────────
   1 VISA                     1247286678.76 TURNO  89 PLAYA 1
   2 VISA DEBITO                  379701.00 TURNO  89 PLAYA 1
  12 MERCADO PAGO             1010589628.60 TURNO  89 PLAYA 1
  32 LOPEZ ALAN SEBASTIAN         131062.72 TURNO  89 PLAYA 1
  44 ZONIS S.A. - CONCRET N       -20527.17 TURNO  89 PLAYA 1
 110 COMBUSTIBLE INTERNO        43156110.62 TURNO  89 PLAYA 1
────────────────────────────────────────────────────────────────────────────────

Column layout:
  1. account_code  — integer, right-aligned in ~5 chars
                     1-13   = standard payment methods (VISA, MERCADO PAGO, etc.)
                     14-99  = individual/company accounts
                     100+   = internal codes (CORTESIA, COMBUSTIBLE INTERNO, etc.)
  2. account_name  — string, padded to fixed width before amount
  3. amount        — decimal with 2 places; NEGATIVE = outstanding debt/adjustment
  4. TURNO         — shift number
  5. PLAYA         — 1 = forecourt, 0 = salon

Known internal codes:
  100 DESAYUNO GRATIS JUMBO+ — promotional discount
  101 CORTESIA                — courtesy fuel
  105 GRUPO ELECTROGENO       — generator fuel consumption
  110 COMBUSTIBLE INTERNO     — internal vehicle fueling
  156 LA BARBA ROBERTO        — ?

Known VB corruption patterns in amount field:
  "% 95179928312.37D+%5" → garbled number — must be caught and flagged as ANOMALY.

Negative amounts are valid (credit balances, adjustments) — logged as anomaly WARNING
but still ingested. Zero amounts (0.00, -0.00) are ingested normally.
"""
from __future__ import annotations

import re
import uuid
from datetime import date as _date

from .base_parser import BaseParser, ParseResult


# Standard line format. account_name is non-greedy up to 2+ spaces before amount.
# Amount can be negative and may have commas (Argentine locale) or dots.
_C_LINE_RE = re.compile(
    r'^\s*(\d+)\s+'          # [1] account_code (right-aligned, any width)
    r'(.+?)\s{2,}'           # [2] account_name (non-greedy, stops at 2+ spaces)
    r'(-?[\d,\.]+)\s+'       # [3] amount (decimal, possibly negative)
    r'TURNO\s+(\d+)\s+'      # [4] turno
    r'PLAYA\s+(\d+)\s*$'     # [5] playa
)

# Payment methods mapped from account_code (matches VE parser payment_code values)
_PAYMENT_METHOD_MAP: dict[int, str] = {
    1:  "CARD",         # VISA
    2:  "CARD",         # VISA DEBITO
    3:  "CARD",         # MASTERCARD
    4:  "CARD",         # MASTERCARD DEBITO
    5:  "CARD",         # MAESTRO
    6:  "CARD",         # CABAL
    7:  "CARD",         # CABAL DEBITO
    8:  "CARD",         # VISA PREPAGO
    9:  "CARD",         # MASTERCARD PREPAGO
    10: "CARD",         # AMERICAN EXPRESS
    11: "CARD",         # APP PETROLERA
    12: "MERCADOPAGO",
    13: "MODO",
    14: "CARD",         # PEDIDOS YA
}

# Internal/special codes — not real payment methods, tracked for behavior_mapping
_INTERNAL_CODES = {100, 101, 105, 110, 156, 500, 729}

def _map_payment_type(code: int) -> str:
    if code in _PAYMENT_METHOD_MAP:
        return _PAYMENT_METHOD_MAP[code]
    if code in _INTERNAL_CODES:
        return "ACCOUNT"  # internal use tracked separately
    if code >= 14:
        return "ACCOUNT"
    return "CARD"


class CParser(BaseParser):
    """
    Parser for C*.TXT — current accounts and payment method totals per shift.
    One row per account/method. Goes into the `card_payments` Supabase table.

    The C file is the financial companion to P/S files:
    - Standard codes (1-13): payment method totals used in reconciliation
    - Account codes (14+):   individual/company running balances
    - Negative amounts:      outstanding debits or manual corrections → anomaly
    - Internal codes (100+): special behavior tracking (COMBUSTIBLE INTERNO, etc.)
    """

    def parse(self) -> ParseResult:
        result = self._make_result()
        lines = self._read_lines()

        for line_num, raw_line in enumerate(lines, start=1):
            line = raw_line.rstrip("\r\n")
            if not line.strip():
                continue

            m = _C_LINE_RE.match(line)
            if not m:
                continue

            result.lines_parsed += 1
            account_code_str, account_name, amount_str, turno_str, playa_str = m.groups()

            account_code = int(account_code_str)
            account_name = account_name.strip()

            # Handle VB corruption in amount field (e.g. "% 95179928312.37D+%5")
            try:
                amount = self._parse_decimal(amount_str)
            except ValueError:
                result.add_error(
                    line_num, line,
                    f"ANOMALY: corrupt amount field {amount_str!r} for account {account_name!r} "
                    f"(code {account_code}) — VB formatting bug detected"
                )
                continue

            # Negative amounts: anomaly detection flag (valid data, just suspicious)
            if amount < 0:
                result.add_error(
                    line_num, line,
                    f"ANOMALY: negative balance {amount} for account {account_name!r} "
                    f"(code {account_code})"
                )

            # Shift date extracted from filename (C300389 -> date 30/03, shift 89)
            shift_date = self._extract_shift_date_from_filename()
            if not shift_date:
                shift_date = _date.today().isoformat()

            record = {
                "id":             str(uuid.uuid4()),
                "station_id":     self.station_id,
                "file_name":      self.file_name,
                "payment_ts":     shift_date + "T00:00:00-03:00" if shift_date else None,
                "payment_type":   _map_payment_type(account_code),
                "account_name":   account_name,
                "amount":         str(amount),
                "reference_code": str(account_code),
                "shift_date":     shift_date,
                # metadata
                "_account_code":  account_code,
                "_turno":         int(turno_str),
                "_playa":         int(playa_str),
                "_is_internal":   account_code in _INTERNAL_CODES,
                "raw_line":       line,
            }

            result.records.append(record)
            result.lines_ok += 1

        return result
