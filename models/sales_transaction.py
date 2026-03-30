"""
Station-OS — SalesTransaction Pydantic model.
Mirrors the `sales_transactions` Supabase table.
Populated by VEParser from VE*.TXT files.
"""
from __future__ import annotations
from typing import Literal, Optional
from decimal import Decimal
from pydantic import BaseModel, Field, field_validator


PaymentMethod = Literal["CASH", "CARD", "ACCOUNT", "MODO", "MERCADOPAGO"]


class SalesTransaction(BaseModel):
    id: str
    station_id: str
    file_name: str                           # original VE*.TXT filename (audit trail)
    transaction_ts: str                      # ISO 8601 timestamp
    product_code: str
    product_name: str                        # normalized via station_knowledge
    quantity: Decimal = Field(..., decimal_places=3)
    unit_price: Decimal = Field(..., decimal_places=4)
    total_amount: Decimal = Field(..., decimal_places=2)
    payment_method: Optional[PaymentMethod] = None
    shift_date: str                          # YYYY-MM-DD (extracted from transaction_ts)
    daily_closing_id: Optional[str] = None  # set after reconciliation
    raw_line: Optional[str] = None          # original unparsed line (audit trail)
    ingested_at: Optional[str] = None

    @field_validator("quantity")
    @classmethod
    def quantity_anomaly_flag(cls, v: Decimal) -> Decimal:
        """Negative quantity is allowed at model level (anomaly detector handles the alert)."""
        return v
