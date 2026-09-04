import json
import os
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from models import AccountRecord

async def seed_customers(session: AsyncSession) -> None:
    """Seed account_records table from customers.json if empty."""
    result = await session.execute(select(AccountRecord).limit(1))
    if result.scalar_one_or_none() is not None:
        return  # Already seeded
    
    data_path = os.path.join(os.path.dirname(__file__), "..", "data", "customers.json")
    with open(data_path, "r") as f:
        customers = json.load(f)
    
    for c in customers:
        # Clean up addons: remove "None" strings
        addons = [a for a in c.get("addons", []) if a != "None"]
        record = AccountRecord(
            customer_id=c["customer_id"],
            name=c["name"],
            area=c["area"],
            current_plan=c["current_plan"],
            speed_mbps=c["speed_mbps"],
            monthly_bill_rm=c["monthly_bill_rm"],
            tenure_months=c["tenure_months"],
            days_to_contract_end=c["days_to_contract_end"],
            avg_monthly_usage_gb=c["avg_monthly_usage_gb"],
            usage_profile=c["usage_profile"],
            peak_hours=c["peak_hours"],
            connected_devices=c["connected_devices"],
            addons=addons,
            complaints_last_12m=c["complaints_last_12m"],
            last_complaint_type=c.get("last_complaint_type"),
            payment_history=c["payment_history"],
            auto_renew_declined=c["auto_renew_declined"],
        )
        session.add(record)
    await session.commit()
    print(f"Seeded {len(customers)} customers into account_records")
