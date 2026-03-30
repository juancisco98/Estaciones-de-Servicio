"""
Station-OS — Alert Pydantic model.
Mirrors the `alerts` Supabase table.
Created by the Anomaly Detector and Reconciler Cloud Functions.
Read in real-time by the React frontend via Supabase postgres_changes channel.
"""
from __future__ import annotations
from typing import Any, Literal, Optional
from pydantic import BaseModel


AlertLevel = Literal["CRITICAL", "WARNING", "INFO"]

AlertType = Literal[
    "CASH_DISCREPANCY",
    "NEGATIVE_VALUE",
    "MISSING_FILE",
    "LOW_TANK_LEVEL",
    "CRITICAL_TANK_LEVEL",
    "RECONCILIATION_FAIL",
    "UNKNOWN_PRODUCT",
    "VOLUME_ANOMALY",
    "MISSING_TRANSACTIONS",
]


class Alert(BaseModel):
    id: str
    station_id: Optional[str] = None
    level: AlertLevel
    type: AlertType
    title: str
    message: str
    related_date: Optional[str] = None   # YYYY-MM-DD
    related_file: Optional[str] = None
    resolved: bool = False
    resolved_at: Optional[str] = None
    resolved_by: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None
    created_at: Optional[str] = None
