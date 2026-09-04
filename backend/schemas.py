from pydantic import BaseModel, field_validator
from datetime import datetime
from typing import Optional, Literal

VALID_PLANS = {"Fibre 100", "Fibre 500", "Fibre 1Gbps", "Fibre 2Gbps", "stay on current plan"}


class CustomerOut(BaseModel):
    customer_id: str
    name: str
    area: str
    current_plan: str
    speed_mbps: int
    monthly_bill_rm: int
    tenure_months: int
    days_to_contract_end: int
    avg_monthly_usage_gb: int
    usage_profile: str
    peak_hours: str
    connected_devices: int
    addons: list[str]
    complaints_last_12m: int
    last_complaint_type: Optional[str]
    payment_history: str
    auto_renew_declined: bool
    model_config = {"from_attributes": True}


class PitchRequest(BaseModel):
    customer_id: str


class PitchOut(BaseModel):
    draft_id: Optional[str] = None
    customer_id: Optional[str] = None
    recommended_plan: str
    offer_hook: str
    talking_points: list[str]
    rationale: str
    model_used: Optional[str] = None
    # Feedback status: pending (not yet acted on), used (agent read it on call),
    # dismissed (agent regenerated instead)
    status: Optional[Literal["pending", "used", "dismissed"]] = "pending"
    created_at: Optional[datetime] = None
    model_config = {"from_attributes": True, "protected_namespaces": ()}

    @field_validator("recommended_plan")
    @classmethod
    def validate_plan(cls, v):
        if v not in VALID_PLANS:
            raise ValueError(f"recommended_plan must be one of {VALID_PLANS}, got: {v}")
        return v

    @field_validator("talking_points")
    @classmethod
    def validate_talking_points(cls, v):
        if not (3 <= len(v) <= 5):
            raise ValueError(f"talking_points must have 3-5 items, got {len(v)}")
        return v


class PatchDraftStatus(BaseModel):
    """Request body for PATCH /api/v1/retention/drafts/{draft_id}/status"""
    status: Literal["pending", "used", "dismissed"]
