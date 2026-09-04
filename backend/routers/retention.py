from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import ValidationError
from datetime import datetime, timezone
from database import get_db
from models import AccountRecord, PitchDraft
from schemas import PitchRequest, PitchOut, PatchDraftStatus
from services.llm_service import generate_pitch, MODEL_NAME

router = APIRouter(prefix="/api/v1", tags=["retention"])


@router.post("/retention/drafts", response_model=PitchOut, status_code=201)
async def create_draft(
    request: PitchRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Generate a new pitch draft for the given customer.
    Endpoint name is spec-mandated: /api/v1/retention/drafts

    The backend builds the prompt, calls Gemini with a strict response_schema,
    validates the output with Pydantic, persists it to PostgreSQL, and returns
    structured JSON. The UI renders fields — never a blob of text.
    """
    # 1. Fetch customer
    result = await db.execute(
        select(AccountRecord).where(AccountRecord.customer_id == request.customer_id)
    )
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail=f"Customer {request.customer_id} not found")

    # 2. Build customer dict for LLM
    customer_dict = {
        "customer_id": customer.customer_id,
        "name": customer.name,
        "area": customer.area,
        "current_plan": customer.current_plan,
        "speed_mbps": customer.speed_mbps,
        "monthly_bill_rm": customer.monthly_bill_rm,
        "tenure_months": customer.tenure_months,
        "days_to_contract_end": customer.days_to_contract_end,
        "avg_monthly_usage_gb": customer.avg_monthly_usage_gb,
        "usage_profile": customer.usage_profile,
        "peak_hours": customer.peak_hours,
        "connected_devices": customer.connected_devices,
        "addons": customer.addons,
        "complaints_last_12m": customer.complaints_last_12m,
        "last_complaint_type": customer.last_complaint_type,
        "payment_history": customer.payment_history,
        "auto_renew_declined": customer.auto_renew_declined,
    }

    # 3. Call LLM (retry backoff built into generate_pitch)
    try:
        pitch = await generate_pitch(customer_dict)
    except TimeoutError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=502, detail=f"LLM returned an invalid response: {str(e)}")
    except RuntimeError as e:
        # Rate limit exhausted after retries
        raise HTTPException(status_code=429, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM error: {str(e)}")

    # 4. Persist draft
    draft = PitchDraft(
        customer_id=request.customer_id,
        recommended_plan=pitch.recommended_plan,
        offer_hook=pitch.offer_hook,
        talking_points=pitch.talking_points,
        rationale=pitch.rationale,
        model_used=MODEL_NAME,
        status="pending",
        created_at=datetime.now(timezone.utc),
    )
    db.add(draft)
    await db.commit()
    await db.refresh(draft)

    # 5. Return full structured response
    return PitchOut(
        draft_id=draft.draft_id,
        customer_id=draft.customer_id,
        recommended_plan=draft.recommended_plan,
        offer_hook=draft.offer_hook,
        talking_points=draft.talking_points,
        rationale=draft.rationale,
        model_used=draft.model_used,
        status=draft.status,
        created_at=draft.created_at,
    )


@router.get("/retention/drafts/{customer_id}", response_model=list[PitchOut])
async def get_drafts_for_customer(
    customer_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Return all pitch drafts for a customer, newest first."""
    result = await db.execute(
        select(AccountRecord).where(AccountRecord.customer_id == customer_id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail=f"Customer {customer_id} not found")

    drafts_result = await db.execute(
        select(PitchDraft)
        .where(PitchDraft.customer_id == customer_id)
        .order_by(PitchDraft.created_at.desc())
    )
    return drafts_result.scalars().all()


@router.patch("/retention/drafts/{draft_id}/status", response_model=PitchOut)
async def update_draft_status(
    draft_id: str,
    body: PatchDraftStatus,
    db: AsyncSession = Depends(get_db),
):
    """
    Mark a pitch draft as 'used' or 'dismissed'.

    - used: agent read this pitch during the call
    - dismissed: agent regenerated instead (signals the pitch wasn't good enough)
    - pending: reset to default

    These signals are persisted to enable future prompt tuning based on what
    agents actually found useful vs regenerated.
    """
    result = await db.execute(
        select(PitchDraft).where(PitchDraft.draft_id == draft_id)
    )
    draft = result.scalar_one_or_none()
    if not draft:
        raise HTTPException(status_code=404, detail=f"Draft {draft_id} not found")

    draft.status = body.status
    await db.commit()
    await db.refresh(draft)
    return draft
