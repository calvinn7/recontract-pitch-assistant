import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Boolean, JSON, DateTime, ForeignKey, Text
from database import Base

class AccountRecord(Base):
    __tablename__ = "account_records"

    customer_id = Column(String, primary_key=True)
    name = Column(String)
    area = Column(String)
    current_plan = Column(String)
    speed_mbps = Column(Integer)
    monthly_bill_rm = Column(Integer)
    tenure_months = Column(Integer)
    days_to_contract_end = Column(Integer)
    avg_monthly_usage_gb = Column(Integer)
    usage_profile = Column(String)
    peak_hours = Column(String)
    connected_devices = Column(Integer)
    addons = Column(JSON)
    complaints_last_12m = Column(Integer)
    last_complaint_type = Column(String, nullable=True)
    payment_history = Column(String)
    auto_renew_declined = Column(Boolean)

class PitchDraft(Base):
    __tablename__ = "pitch_drafts"

    draft_id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    customer_id = Column(String, ForeignKey("account_records.customer_id"))
    recommended_plan = Column(String)
    offer_hook = Column(Text)
    talking_points = Column(JSON)
    rationale = Column(Text)
    model_used = Column(String)
    # Agent feedback: pending | used | dismissed
    status = Column(String, default="pending", nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

