# TIME Recontract Pitch Assistant

TIME sells fibre broadband on 24-month contracts, and today recontract calls run off a spreadsheet and improvisation. This is an internal tool for retention agents: select a customer nearing contract end, generate a personalised AI-written pitch, and deliver it during the call.

**Live Demo:** [https://recontract-pitch-assistant.vercel.app/](https://recontract-pitch-assistant.vercel.app/)

---

## What's built

**Customer list** — 20 customers seeded from JSON into PostgreSQL on startup. The table is sortable by contract-end urgency and searchable by name, area, or ID. Urgency is colour-coded: red for expired or ≤14 days remaining, amber for ≤30 days, green for everything else.

**Pitch generation** — Clicking a customer opens their profile and a Generate Pitch button. The frontend calls `POST /api/v1/retention/drafts`; the backend builds a prompt, calls Google Gemini with a strict `response_schema`, validates the output with Pydantic, persists it to PostgreSQL, and returns structured JSON. The UI renders discrete fields — recommended plan, offer hook, numbered talking points, rationale — never a blob of text.

**Regenerate + history** — Every pitch is stored. Agents can regenerate as many times as they like. Previous pitches collapse into a history panel below the current one.

**Pitch feedback** — Each pitch card shows a **👍 Used on call** / **👎 Dismiss** button while the pitch is pending. Clicking either fires `PATCH /api/v1/retention/drafts/{draft_id}/status` and persists the signal. Status renders as a badge. The intention is to build a ground-truth dataset over time — high dismiss rates on a particular customer profile signal a prompt that needs work.

**Retry with exponential backoff** — The Gemini call retries automatically on rate-limit (429) errors: immediately, then after 2 s, then after 4 s. If all three attempts fail the client gets a 429. Timeouts (>30 s) are not retried and surface as 503 immediately.

---

## Assumptions
 
The brief invites a reasonable call on anything ambiguous, noted here rather than left implicit:
 
- **No agent authentication.** Single shared view for now — scoped out deliberately to keep the take-home focused on the generation pipeline, not a login system. See "What I'd add next."
- **Gemini's free tier is acceptable.** The brief says a free tier or small local model is fine since the model itself isn't being graded.
- **`pitch_drafts.status` is an addition beyond the spec's schema.** `customers.json` and the `account_records` fields it maps to are untouched.
- **Seeding is one-time and idempotent.** The backend checks for existing rows before inserting, so restarting or redeploying never duplicates the 20 customers.

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
 
# Option A — Supabase Postgres (what the deployed version uses)
# Supabase requires SSL — the ?ssl=require suffix matters, the app will
# fail to connect without it.
DATABASE_URL=postgresql+asyncpg://postgres:<password>@db.<ref>.supabase.co:5432/postgres?ssl=require
 
# Option B — SQLite (zero setup, no Supabase account needed)
# DATABASE_URL=sqlite+aiosqlite:///./app.db
```

The async engine handles both drivers transparently — switching is this one line, no code changes. If you use SQLite, add `aiosqlite` to `requirements.txt` (already listed there as an optional dependency).


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

As requested in the brief, here is an honest, detailed breakdown of how I used AI to build this project. I used Gemini through Google's Antigravity agentic coding environment. I operated as the **architect and reviewer**, while treating the AI as a **junior developer** writing the boilerplate.

### What I did (The Human / Architect)

- **System Design & Tradeoffs:** I made the core architectural decisions. I chose FastAPI with `asyncio` to prevent I/O blocking during long LLM calls. I chose PostgreSQL on Supabase over SQLite so it would survive ephemeral deployments on Railway. 
- **LLM Engineering Strategy:** I explicitly decided to use Gemini's `response_schema` feature to force native JSON output. I weighed the tradeoff: losing streaming UI capability, but gaining a 100% guarantee against malformed JSON (which eliminates complex regex parsing and retry logic). 
- **Error Handling & Resilience:** I designed the failure modes. I instructed the AI *how* to handle specific exceptions: mapping timeouts to 503s, Pydantic validation errors to 502s, and building the exponential backoff retry loop specifically for 429 Rate Limits.
- **Prompt Engineering:** I designed the system prompt, identifying the specific rules (e.g., negative days meaning out of contract, auto-renew declines as churn flags) and forcing exact strings for plan names.
- **Debugging & Deployment:** I handled the environment configuration, solved the Supabase SSL requirement (`?ssl=require`) for the Railway deployment, fixed a Pydantic `model_` namespace conflict the AI introduced, and corrected the SQLAlchemy metadata import order so tables would actually create on startup.

### What the AI did (The Assistant)

- **Boilerplate & Scaffolding:** Generated the initial Next.js App Router folder structure, the FastAPI file layout, and the `requirements.txt` / `package.json` dependencies.
- **Data Translation:** Converted the Python SQLAlchemy/Pydantic schemas into matching TypeScript interfaces (`types/index.ts`).
- **UI & Tailwind CSS:** Wrote the tedious Tailwind utility classes for the React components (like the `CustomerCard` grid, urgency badges, and history panel layout) based on my wireframe descriptions.
- **CRUD Operations:** Generated the standard `select()` queries for SQLAlchemy based on the data models.
- **Seeding Script:** Wrote the JSON file parser (`seed.py`) to inject `customers.json` into the database, handling edge cases like stripping out `"None"` string artifacts.

**Verification:** I read every file the AI generated, manually tested all five API endpoints with Edge cases (like invalid plans), and confirmed the database persistence end-to-end. Nothing was merged blindly.