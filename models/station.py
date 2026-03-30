"""
Station-OS — Station Pydantic model.
Mirrors the `stations` Supabase table (snake_case).
"""
from __future__ import annotations
from typing import Optional
from pydantic import BaseModel, Field


class Station(BaseModel):
    id: str
    name: str
    address: str
    coordinates: list[float] = Field(..., min_length=2, max_length=2)  # [lat, lng]
    city: Optional[str] = None
    province: Optional[str] = None
    phone: Optional[str] = None
    manager_name: Optional[str] = None
    is_active: bool = True
    station_code: Optional[str] = None   # e.g. "EST_001", matches D:\SVAPP subfolder
    watch_path: Optional[str] = None     # e.g. "D:\SVAPP\EST_001"
    notes: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
