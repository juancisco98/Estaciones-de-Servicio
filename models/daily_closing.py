"""
Station-OS — DailyClosing Pydantic model.
Mirrors the `daily_closings` Supabase table.
Populated by PParser (forecourt_total) and SParser (shop_total).
Status is updated by the Reconciler Cloud Function.
"""
from __future__ import annotations
from typing import Literal, Optional
from decimal import Decimal
from pydantic import BaseModel, Field


ClosingStatus = Literal["PENDING", "RECONCILED", "DISCREPANCY"]


class DailyClosing(BaseModel):
    id: str
    station_id: str
    shift_date: str                              # YYYY-MM-DD
    forecourt_total: Optional[Decimal] = None   # from P*.TXT
    shop_total: Optional[Decimal] = None        # from S*.TXT
    transactions_total: Optional[Decimal] = None  # SUM of sales_transactions
    reconciliation_diff: Optional[Decimal] = None
    reconciliation_ok: bool = False
    p_file_name: Optional[str] = None
    s_file_name: Optional[str] = None
    status: ClosingStatus = "PENDING"
    notes: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
