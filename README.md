# TIME Recontract Pitch Assistant

An internal tool for TIME dotcom retention agents. Select a customer nearing contract end, generate a personalised AI-written pitch, and deliver it during the recontract call.

---

## What's built

**Customer list** — 20 customers seeded from JSON into PostgreSQL on startup. The table is sortable by contract-end urgency and searchable by name, area, or ID. Urgency is colour-coded: red for expired or ≤14 days remaining, amber for ≤30 days, green for everything else.

**Pitch generation** — Clicking a customer opens their profile and a Generate Pitch button. The frontend calls `POST /api/v1/retention/drafts`; the backend builds a prompt, calls Google Gemini with a strict `response_schema`, validates the output with Pydantic, persists it to PostgreSQL, and returns structured JSON. The UI renders discrete fields — recommended plan, offer hook, numbered talking points, rationale — never a blob of text.

**Regenerate + history** — Every pitch is stored. Agents can regenerate as many times as they like. Previous pitches collapse into a history panel below the current one.

**Pitch feedback** — Each pitch card shows a **👍 Used on call** / **👎 Dismiss** button while the pitch is pending. Clicking either fires `PATCH /api/v1/retention/drafts/{draft_id}/status` and persists the signal. Status renders as a badge. The intention is to build a ground-truth dataset over time — high dismiss rates on a particular customer profile signal a prompt that needs work.

**Retry with exponential backoff** — The Gemini call retries automatically on rate-limit (429) errors: immediately, then after 2 s, then after 4 s. If all three attempts fail the client gets a 429. Timeouts (>30 s) are not retried and surface as 503 immediately.

---

## Architecture

```
Next.js 14 App Router  ──────────────────────────────────────  Vercel
        │
        │  HTTP / JSON
        ▼
FastAPI (Python)  ───────────────────────────────────────────  Railway
  GET  /api/v1/customers
  GET  /api/v1/customers/{id}
  POST /api/v1/retention/drafts           ← spec-mandated name
  GET  /api/v1/retention/drafts/{customer_id}
  PATCH /api/v1/retention/drafts/{draft_id}/status
        │
        ├── PostgreSQL (Supabase)         ← table: account_records (spec-mandated)
        └── Google Gemini 2.5 Flash       ← native JSON schema mode
```

**Key decisions**

| Decision | Choice | Why |
|---|---|---|
| LLM output format | `response_schema` (native JSON) | Eliminates malformed-JSON retries entirely; Pydantic validates the result before any DB write |
| DB driver | SQLAlchemy async + asyncpg | Non-blocking; I/O-bound Gemini calls don't block the event loop |
| Retry strategy | Backoff on 429 only | Timeouts and auth errors are not retryable — don't waste time on them |
| Pitch status | Stored on `pitch_drafts` | Creates a feedback signal without any separate table or schema change |
| CORS | Open (`*`) in dev | Tighten to the Vercel domain before production |

---

## Running locally

### Prerequisites

- Python 3.11+
- Node.js 18+
- A [Supabase](https://supabase.com) project (free tier is fine)
- A [Google AI Studio](https://aistudio.google.com/app/apikey) API key

### 1. Clone and configure

```bash
git clone <your-repo-url>
cd recontract-pitch-assistant
```

Create `.env` in the project root — this file is gitignored:

```env
GOOGLE_API_KEY=your_gemini_api_key
GOOGLE_MODEL=gemini-2.5-flash
DATABASE_URL=postgresql+asyncpg://postgres:<password>@db.<ref>.supabase.co:5432/postgres
```

### 2. Start the backend

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000
```

On first run the app creates both tables (`account_records`, `pitch_drafts`) and seeds all 20 customers. Nothing else to do.

Auto-generated API docs: `http://localhost:8000/docs`

### 3. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`. The frontend reads `NEXT_PUBLIC_API_URL` from `frontend/.env.local` — it defaults to `http://localhost:8000` so no change is needed locally.

---

## Deployment

### Backend → Railway

1. Connect your repo to [railway.app](https://railway.app) and point the service root at `backend/`
2. Set env vars: `GOOGLE_API_KEY`, `GOOGLE_MODEL`, `DATABASE_URL`
3. Railway reads the `Procfile`: `uvicorn main:app --host 0.0.0.0 --port $PORT`

### Frontend → Vercel

1. Connect your repo to [vercel.com](https://vercel.com) and set root directory to `frontend/`
2. Add env var: `NEXT_PUBLIC_API_URL=https://your-backend.railway.app`
3. Deploy

---

## Error handling

| Failure | HTTP status | What the UI sees |
|---|---|---|
| Customer ID not found | 404 | Inline error message |
| LLM timeout (>30 s) | 503 | "Please try again" |
| Gemini rate limit (429) | Retried 3× with backoff → 429 | Rate limit message |
| LLM returns invalid/missing fields | 502 | Pydantic validation detail |
| LLM invents a plan name | Caught by `field_validator` — never reaches the DB | — |
| DB write failure | 500 | Error surfaced to UI |

---

## What I'd add next

- **Streaming output** — show the pitch appearing word-by-word rather than waiting 3–5 s for the full response. Requires replacing `response_schema` mode with structured-prompt + post-parse validation; tradeoff is a slightly higher chance of malformed JSON on a bad generation.
- **Agent authentication** — JWT so each agent has a named session; pitch history becomes agent-scoped rather than just customer-scoped; team leads can view aggregate feedback across the whole team.
- **Feedback analytics** — aggregate the used/dismissed signals by customer profile and plan type into a simple admin view to guide prompt iteration.

## What changes at 200 agents

- **Connection pooling** — add Supabase's built-in Supavisor (pgBouncer) to handle concurrent connections without hitting Postgres limits.
- **Horizontal scaling** — the FastAPI app is stateless, so running multiple Railway replicas behind a load balancer is a config change, not a code change.
- **Pitch caching** — cache the most recent pitch per customer in Redis for ~5 minutes; 200 agents opening the same customer simultaneously shouldn't each fire a Gemini call.
- **RBAC** — retention agents see their own history; team leads see everyone's; pitch approval before it reaches the agent.
- **Tighter CORS** — restrict `allow_origins` to the specific Vercel production domain.

---

## How I used AI tools

This project was built with **Google Antigravity** (AI coding assistant).

**What I delegated to the AI:** generating boilerplate (FastAPI router structure, SQLAlchemy model definitions, Next.js component scaffolding, Tailwind layout), running dependency installs, executing smoke-test commands against the live API.

**What I did myself / directed precisely:** all architecture decisions — async SQLAlchemy over sync, Supabase over SQLite, native `response_schema` mode over prompt-only JSON (and understanding the tradeoff: no streaming, but zero malformed-JSON retries), the system-prompt design (role framing, exact plan strings, per-field rules, churn signal interpretation), error categorisation (which codes go where, what to retry vs not), and all naming conventions required by the spec (`account_records`, `POST /api/v1/retention/drafts`).

**How I verified:** read every generated file before approving it; manually tested all five endpoints with real payloads; confirmed Pydantic rejects invalid plan names before any DB write; confirmed Supabase persistence end-to-end by calling the history endpoint immediately after pitch generation.