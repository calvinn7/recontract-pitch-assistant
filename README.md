# AI Customer Retention Assistant

A full-stack application designed to help customer success and retention teams generate personalized, data-driven recontracting pitches using Large Language Models (LLMs).

**Live Demo:** [https://recontract-pitch-assistant.vercel.app/](https://recontract-pitch-assistant.vercel.app/)

---

## What's built

**Customer list** — 20 customers seeded from JSON into PostgreSQL on startup. The table is sortable by contract-end urgency and searchable by name, area, or ID. Urgency is colour-coded: red for expired or ≤14 days remaining, amber for ≤30 days, green for everything else.

**AI Pitch Generation** — Clicking a customer opens their profile and a Generate Pitch button. The frontend calls `POST /api/v1/retention/drafts`; the backend builds a prompt, calls Google Gemini with a strict `response_schema`, validates the output with Pydantic, persists it to PostgreSQL, and returns structured JSON. The UI renders discrete fields — recommended plan, offer hook, numbered talking points, rationale — never a blob of text.

**Regenerate + history** — Every pitch is stored. Agents can regenerate as many times as they like. Previous pitches collapse into a history panel below the current one.

**Pitch feedback** — Each pitch card shows a **👍 Used on call** / **👎 Dismiss** button while the pitch is pending. Clicking either fires `PATCH /api/v1/retention/drafts/{draft_id}/status` and persists the signal. Status renders as a badge. The intention is to build a ground-truth dataset over time — high dismiss rates on a particular customer profile signal a prompt that needs work.

**Resilient AI Backend** — The LLM integration is wrapped in custom retry logic with exponential backoff to handle transient rate-limit (429) errors. Timeouts (>30 s) fail fast to prevent locking up the agent's UI.

---
## Architecture

```text
Next.js 14 App Router  ──────────────────────────────────────  Vercel
        │
        │  HTTP / JSON
        ▼
FastAPI (Python)  ───────────────────────────────────────────  Railway
  GET  /api/v1/customers
  GET  /api/v1/customers/{id}
  POST /api/v1/retention/drafts
  GET  /api/v1/retention/drafts/{customer_id}
  PATCH /api/v1/retention/drafts/{draft_id}/status
        │
        ├── PostgreSQL (Supabase)
        └── Google Gemini 2.5 Flash       ← native JSON schema mode
```

### Key Engineering Decisions

| Decision | Choice | Why |
|---|---|---|
| **LLM Output Format** | `response_schema` (native JSON) | Eliminates malformed-JSON retries entirely; Pydantic validates the exact data types and constraints before any DB write. |
| **Database Architecture** | Supabase (PostgreSQL) | Used a managed cloud Postgres instance rather than SQLite to ensure data persistence across ephemeral cloud deployments (like Railway), enabling long-term pitch history and feedback analytics. |
| **Database Driver** | SQLAlchemy async + asyncpg | Non-blocking; I/O-bound Gemini calls (which can take 3-5s) do not block the Python event loop, allowing the server to handle high concurrency. |
| **Retry Strategy** | Backoff on 429 only | Timeouts and auth errors are not retryable—failing fast is better for UX than making a user wait 60+ seconds for doomed retries. |
| **CORS** | Open (`*`) in dev | Restricted to the Vercel production domain upon deployment for security. |

---

## Running Locally

### Prerequisites

- Python 3.11+
- Node.js 18+
- A [Supabase](https://supabase.com) project (free tier)
- A [Google AI Studio](https://aistudio.google.com/app/apikey) API key

### 1. Clone and Configure

```bash
git clone <your-repo-url>
cd recontract-pitch-assistant
```

Create `.env` in the project root:

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

### 2. Start the Backend

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000
```

On first run, the app automatically creates tables and seeds the database.
API docs available at: `http://localhost:8000/docs`

### 3. Start the Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`. The frontend reads `NEXT_PUBLIC_API_URL` from `frontend/.env.local` (defaults to `http://localhost:8000`).

---

## Deployment Configuration

- **Backend (Railway):** Connected to GitHub repo, service root set at `backend/`. Uses standard Nixpacks Python builder.
- **Frontend (Vercel):** Connected to GitHub repo, root directory set to `frontend/`. Environment variable `NEXT_PUBLIC_API_URL` mapped to the Railway backend URL.

---

## Error Handling

| Failure | HTTP status | What the UI sees |
|---|---|---|
| Customer ID not found | 404 | Inline error message |
| LLM timeout (>30 s) | 503 | "Please try again" |
| Gemini rate limit (429) | Retried 3× with backoff → 429 | Rate limit message |
| LLM returns invalid/missing fields | 502 | Pydantic validation detail |
| LLM invents a plan name | Caught by `field_validator` — never reaches the DB | Validation Error |
| DB write failure | 500 | Error surfaced to UI |

---

## Future Roadmap & Scalability

- **Streaming Output:** Replace `response_schema` mode with structured-prompt + post-parse validation to stream tokens to the UI (tradeoff: slightly higher chance of malformed JSON).
- **Connection Pooling:** For scaling to 200+ concurrent agents, introduce Supabase Supavisor (pgBouncer) to prevent database connection limits from being exhausted by serverless functions.
- **Caching:** Cache the most recent pitch per customer in Redis (TTL ~5 min) to prevent duplicate LLM generation costs if multiple agents view the same profile.
- **Agent Authentication:** Implement JWT so each agent has a named session, making pitch history agent-scoped rather than just customer-scoped.

---

## AI-Assisted Development Workflow

To accelerate development while maintaining strict architectural control, I utilized an agentic AI coding assistant. I operated as the **architect and reviewer**, delegating boilerplate to the AI while manually dictating all system design, error handling, and prompt engineering.

### What I Designed & Directed
- **System Design:** Directed the use of FastAPI with `asyncio` to prevent I/O blocking during long LLM calls, and chose PostgreSQL on Supabase over SQLite for persistent state in cloud deployments.
- **LLM Engineering Strategy:** Specifically implemented Gemini's `response_schema` to force native JSON output, prioritizing data integrity and eliminating malformed-JSON retry loops over streaming UX.
- **Error Handling:** Designed the failure modes, manually mapping timeouts to 503s, Pydantic validation errors to 502s, and engineering the exponential backoff retry loop for 429 Rate Limits.
- **Debugging:** Solved deployment configuration issues, such as the Supabase SSL requirement (`?ssl=require`) for Railway, fixed Pydantic namespace conflicts, and corrected SQLAlchemy metadata import order for dynamic table creation.

### What I Delegated
- **Boilerplate & Scaffolding:** Initial Next.js folder structure, FastAPI file layout, and package management.
- **Data Translation:** Converting Python SQLAlchemy/Pydantic schemas into matching TypeScript interfaces.
- **UI Styling:** Writing Tailwind utility classes based on wireframe requirements.
- **Seeding Scripts:** Writing the parser to inject JSON seed data into the database.