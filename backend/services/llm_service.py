import os
import asyncio
from dotenv import load_dotenv
import google.generativeai as genai
from schemas import PitchOut
from pathlib import Path

load_dotenv(dotenv_path=Path(__file__).parent.parent.parent / '.env')

genai.configure(api_key=os.environ.get("GOOGLE_API_KEY"))
MODEL_NAME = os.getenv("GOOGLE_MODEL", "gemini-2.5-flash")

SYSTEM_PROMPT = """You are a retention advisor for TIME dotcom, a Malaysian fibre broadband ISP.
A retention agent is about to call the customer below to recontract them.
Your job is to produce a personalised pitch the agent can read during the call.

Valid plans (ONLY use these exact strings for recommended_plan):
- "Fibre 100" — RM 99/month, 100 Mbps
- "Fibre 500" — RM 139/month, 500 Mbps
- "Fibre 1Gbps" — RM 199/month, 1 Gbps
- "Fibre 2Gbps" — RM 249/month, 2 Gbps
- "stay on current plan" — if no upgrade is warranted

Rules:
- recommended_plan must be EXACTLY one of the 5 strings above, nothing else
- talking_points: 3 to 5 strings the agent can say out loud naturally, specific to this customer
- rationale: ONE sentence explaining why this plan fits this customer
- offer_hook: ONE compelling sentence with a specific deal or retention hook
- Consider usage, complaints, payment history, and churn signals (auto_renew_declined=true is a red flag)
- Negative days_to_contract_end means they are already out of contract (month-to-month)"""


async def generate_pitch(customer_data: dict) -> PitchOut:
    """
    Call Gemini to generate a structured pitch for the given customer.

    Uses response_schema (native JSON mode) so the model is constrained to
    output valid JSON — no regex parsing, no retry for malformed JSON.

    Retries up to 3 times with exponential backoff on 429 rate-limit errors.
    Timeouts (>30s) surface immediately as TimeoutError.
    """
    import json

    # Schema passed to Gemini — only the 4 fields the LLM should fill in.
    # Optional DB fields (draft_id, customer_id, status, etc.) are excluded
    # so the model never tries to invent them.
    from pydantic import BaseModel

    class GeminiPitchSchema(BaseModel):
        recommended_plan: str
        offer_hook: str
        talking_points: list[str]
        rationale: str

    model = genai.GenerativeModel(
        model_name=MODEL_NAME,
        system_instruction=SYSTEM_PROMPT,
    )

    user_message = f"Customer profile:\n{json.dumps(customer_data, indent=2)}"

    # Retry with exponential backoff on 429 rate-limit errors.
    # Attempts: immediately → +2s → +4s.
    max_attempts = 3
    backoff_seconds = [0, 2, 4]
    last_error: Exception = RuntimeError("No attempt made")

    for attempt in range(max_attempts):
        if backoff_seconds[attempt] > 0:
            await asyncio.sleep(backoff_seconds[attempt])

        try:
            response = await asyncio.wait_for(
                asyncio.to_thread(
                    model.generate_content,
                    user_message,
                    generation_config=genai.GenerationConfig(
                        response_mime_type="application/json",
                        response_schema=GeminiPitchSchema,
                    ),
                ),
                timeout=30.0,
            )
            # Parse and validate with Pydantic.
            # ValidationError here means the model returned JSON that doesn't
            # match our schema — the router catches this and returns 502.
            pitch = PitchOut.model_validate_json(response.text)
            return pitch

        except asyncio.TimeoutError:
            # Timeout is not retryable — surface immediately.
            raise TimeoutError("LLM request timed out after 30 seconds")

        except Exception as e:
            err_str = str(e).lower()
            if "429" in err_str or "resource_exhausted" in err_str or "quota" in err_str:
                # Rate limited — retry with backoff.
                last_error = e
                continue
            # Any other error (network, auth, bad schema) — don't retry.
            raise

    # All retries exhausted due to rate limiting.
    raise RuntimeError(
        f"Gemini rate limit hit after {max_attempts} attempts: {last_error}"
    )
