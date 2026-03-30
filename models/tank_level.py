"""
Station-OS — TankLevel Pydantic model.
Mirrors the `tank_levels` Supabase table.
Populated by TParser from T*.TXT files.
"""
from __future__ import annotations
from typing import Literal, Optional
from decimal import Decimal
from pydantic import BaseModel, Field


TankId = Literal["TQ1", "TQ2", "TQ3", "TQ4", "TQ5"]


class TankLevel(BaseModel):
    id: str
    station_id: str
    file_name: str
    recorded_at: str                         # ISO 8601 timestamp
    tank_id: TankId
    product_code: str
    product_name: str
    level_liters: Decimal = Field(..., decimal_places=3)
    capacity_liters: Optional[Decimal] = Field(None, decimal_places=3)
    raw_line: Optional[str] = None
    ingested_at: Optional[str] = None
