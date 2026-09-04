from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
from database import get_db
from models import AccountRecord
from schemas import CustomerOut

router = APIRouter(prefix="/api/v1", tags=["customers"])

@router.get("/customers", response_model=list[CustomerOut])
async def list_customers(
    sort: Optional[str] = Query(None, description="Sort field: days_to_contract_end"),
    order: str = Query("asc", description="Sort order: asc or desc"),
    db: AsyncSession = Depends(get_db),
):
    """Return all customers. Optionally sort by days_to_contract_end."""
    query = select(AccountRecord)
    if sort == "days_to_contract_end":
        if order == "desc":
            query = query.order_by(AccountRecord.days_to_contract_end.desc())
        else:
            query = query.order_by(AccountRecord.days_to_contract_end.asc())
    result = await db.execute(query)
    return result.scalars().all()

@router.get("/customers/{customer_id}", response_model=CustomerOut)
async def get_customer(
    customer_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Return a single customer by ID."""
    result = await db.execute(
        select(AccountRecord).where(AccountRecord.customer_id == customer_id)
    )
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail=f"Customer {customer_id} not found")
    return customer
