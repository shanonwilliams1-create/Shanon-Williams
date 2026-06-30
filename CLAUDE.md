# LeadForge — AI Assistant Reference

LeadForge is a lead-generation SaaS for contractors and tradespeople. It scrapes construction and renovation opportunities from social media, classifieds, job boards, and permit filings, then provides a dashboard for outreach, follow-up, appointment scheduling, review requests, and referral management.

## Project Structure

```
/
├── main.py                  # Render entry point — sets path, runs uvicorn on $PORT
├── requirements.txt         # Root-level deps (used by Render build step)
├── render.yaml              # Render.com service config
├── start.sh                 # Shell wrapper for main.py
├── backend/
│   ├── requirements.txt     # Backend-only deps
│   ├── alembic.ini
│   ├── migrations/
│   │   └── versions/adccd1bb0637_complete_schema.py
│   └── app/
│       ├── main.py          # FastAPI app, CORS, router registration, SPA fallback
│       ├── config.py        # Pydantic Settings from environment variables
│       ├── database.py      # Async engine, session factory, BaseModel
│       ├── middleware/
│       │   └── auth_middleware.py   # get_current_user, check_tier dependencies
│       ├── models/
│       │   ├── __init__.py  # All enums + imports all model classes
│       │   ├── user.py
│       │   ├── lead.py
│       │   ├── user_lead.py
│       │   ├── outreach.py
│       │   ├── appointment.py
│       │   ├── followup.py
│       │   ├── review.py
│       │   ├── referral.py
│       │   ├── subscription.py
│       │   └── scraping.py
│       ├── routers/
│       │   ├── auth.py        # /api/auth — signup, login, refresh, reset-password
│       │   ├── users.py       # /api/users — me, zip-codes, trades, upgrade
│       │   ├── leads.py       # /api/leads — list, get, create, patch, trial-status, SSE
│       │   ├── outreach.py    # /api/outreach
│       │   ├── appointments.py
│       │   ├── followups.py
│       │   ├── reviews.py
│       │   └── referrals.py
│       ├── schemas/
│       │   └── auth.py        # Pydantic request/response schemas
│       └── services/
│           └── auth_service.py  # bcrypt hashing, JWT create/decode
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── dist/                  # Built output — committed to repo, served by FastAPI
│   └── src/
│       ├── App.jsx            # Router tree
│       ├── main.jsx
│       ├── index.css
│       ├── services/
│       │   └── api.js         # Axios instance + all API call functions
│       └── pages/
│           ├── LandingPage.jsx
│           ├── SubscriptionManager.jsx
│           ├── auth/
│           │   ├── LoginForm.jsx
│           │   ├── SignUpForm.jsx
│           │   ├── ForgotPassword.jsx
│           │   └── ResetPassword.jsx
│           └── dashboard/
│               ├── DashboardLayout.jsx
│               ├── LeadList.jsx
│               ├── LeadDetail.jsx
│               ├── OutreachHub.jsx
│               ├── OperationsGuide.jsx
│               ├── CalendarView.jsx
│               ├── FollowUpTimeline.jsx
│               ├── ReviewManagement.jsx
│               ├── ReferralProgram.jsx
│               └── SettingsPanel.jsx
└── scraping/
    ├── config.py              # ScraperConfig (pydantic-settings)
    ├── models.py              # RawLead, EnrichedLead (Pydantic), SourceType enum
    ├── pipeline.py            # ScraperPipeline class, normalize/dedup/process helpers
    ├── dispatcher.py          # dispatch_lead(), run_pipeline()
    ├── utils.py               # extract_phone, extract_email, geocode_address, classify_trade
    └── scrapers/
        ├── base.py            # BaseScraper ABC
        ├── facebook.py
        ├── instagram.py
        ├── tiktok.py
        ├── snapchat.py
        ├── nextdoor.py
        ├── local_listings.py
        ├── classifieds.py
        ├── job_boards.py
        ├── permits.py
        └── property_records.py
```

## Tech Stack

| Layer | Technology |
|---|---|
| Backend API | FastAPI 0.111+, Uvicorn |
| ORM | SQLAlchemy 2.0 async (Mapped + mapped_column style) |
| Database | SQLite + aiosqlite (dev), asyncpg / PostgreSQL (prod) |
| Migrations | Alembic |
| Validation | Pydantic v2, pydantic-settings |
| Auth | python-jose (JWT), bcrypt |
| HTTP client | httpx (async) |
| Frontend | React 18, Vite 5 |
| Styling | Tailwind CSS 4 (alpha) via `@tailwindcss/vite` plugin |
| Routing | React Router v6 |
| HTTP | Axios |
| Icons | lucide-react |
| Deployment | Render.com (free tier) |
| Payments | Stripe (stubs only — not yet integrated) |
| Email | SendGrid (stubs only) |
| SMS | Twilio (stubs only) |
| Calendar | Google Calendar (stubs only) |

## Development Setup

### Backend

```bash
cd backend
pip install -r requirements.txt
# Create a .env file (see Environment Variables below)
alembic upgrade head          # Run migrations
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev     # Runs on :5173, proxies /api → localhost:8000
```

### Scraping Engine (standalone)

```bash
pip install -r scraping/requirements.txt
python -m scraping.pipeline    # Runs every 15 minutes
```

### Production Build (Render)

Render executes:
```
cd frontend && npm install && npm run build && cd .. && pip install -r requirements.txt
python main.py    # Binds to $PORT (default 10000)
```

The built frontend (`frontend/dist/`) is **committed to the repo** so Render can serve it. Always rebuild and commit `dist/` before pushing a frontend change to production.

## Environment Variables

All settings are loaded by `backend/app/config.py` via pydantic-settings. Create `backend/.env`:

```
ENVIRONMENT=development          # or production
DEBUG=true
DATABASE_URL=sqlite+aiosqlite:///./leadforge.db
JWT_SECRET_KEY=change-me-in-production
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7
CORS_ORIGINS=["http://localhost:5173"]

# Stripe (not yet wired up)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# SendGrid
SENDGRID_API_KEY=
FROM_EMAIL=noreply@leadforge.app

# Twilio
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=

# Google Calendar
GOOGLE_CREDENTIALS_PATH=
GOOGLE_CALENDAR_ID=primary
```

## Key Conventions

### Backend

**SQLAlchemy models** — always use SQLAlchemy 2.0 style:
```python
class MyModel(BaseModel):        # BaseModel from app.database
    __tablename__ = "my_table"
    id: Mapped[str] = mapped_column(primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str]
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
```

**Register every new model** — import it at the bottom of `backend/app/models/__init__.py`. Alembic and the lifespan startup both rely on all models being imported before `metadata.create_all` runs.

**Async throughout** — every database operation uses `AsyncSession`, `await`, and `async with`. Never mix sync SQLAlchemy with async.

**Session management** — use the `get_db` FastAPI dependency. It commits on success and rolls back on exception automatically.

**Auth dependency** — protect routes with `Depends(get_current_user)`. For tier gating, use `Depends(check_tier("pro"))`. Tier hierarchy: `starter < pro < elite`.

**Adding a new router:**
1. Create `backend/app/routers/myrouter.py` with `router = APIRouter(prefix="/myroutes", tags=["mytag"])`
2. Import and register in `backend/app/main.py`: `app.include_router(myrouter.router, prefix="/api")`

**Subscription tiers and limits:**
- `starter`: free trial — 1 lead view total (`trial_leads_used` tracks this), 1 service zip code
- `pro`: paid — 5 service zip codes
- `elite`: paid — unlimited zip codes

**Trial gate** — `check_trial_access()` in `leads.py` raises HTTP 402 with `code: "trial_exhausted"` when a starter user has used their free lead. Viewing the lead list does not consume the trial; viewing a lead detail does.

### Frontend

**All API calls go through `frontend/src/services/api.js`** — never call `fetch()` or create a new axios instance in a component. Add new endpoint functions to the appropriate exported object (`leadsAPI`, `authAPI`, etc.).

**API base URL** — uses `VITE_API_URL` env var, falls back to `/api` (relative). The Vite dev server proxies `/api` to `http://localhost:8000`.

**Auth tokens** — the Axios interceptor in `api.js` attaches the JWT from `localStorage.access_token` automatically. On 401, it clears the token and redirects to `/auth/login`.

**Routing** — React Router v6 with nested routes. Dashboard pages are children of `/dashboard` which renders `DashboardLayout`. Add new dashboard pages inside that `<Route>` block in `App.jsx`.

**Styling** — Tailwind CSS 4 alpha. Uses `@tailwindcss/vite` plugin (not PostCSS). Do not add PostCSS config — it is not used.

**Icons** — use `lucide-react`. Do not add other icon libraries.

### Scraping Engine

**New scrapers** — extend `BaseScraper` from `scraping/scrapers/base.py` and implement `async def scrape(self, zip_codes=None) -> List[RawLead]`. Return `RawLead` Pydantic objects.

**Enabling a scraper** — add it to the `source_configs` dict in `scraping/config.py` with `"enabled": True` and a cadence. Also add it to the `source_map` dict in `ScraperPipeline.__init__()` in `pipeline.py`.

**Note on ports** — `scraping/pipeline.py` and `scraping/dispatcher.py` hardcode `BACKEND_API_URL = "http://localhost:3000/api/leads"`. The actual backend runs on port 8000 in dev and $PORT (10000) on Render. This URL needs to be updated before the scraping engine is used in production.

## Current State (as of 2026-06-30)

Most routers use **in-memory mock data** — the database models exist and the schema is complete, but the majority of routers (`leads`, `outreach`, `appointments`, `followups`, `reviews`, `referrals`) serve static mock arrays rather than querying the database. Only `auth` and `users` routes perform real DB operations.

**What is wired up:**
- Full auth flow: signup, login, token refresh, direct password reset
- User profile: read, update zip codes (tier-limited), update trades, upgrade tier
- Trial lead gate: `check_trial_access()` enforces the 1-free-lead limit for starter users

**What is stubbed:**
- Lead storage and retrieval from DB
- Outreach sending (Twilio/SendGrid)
- Appointment sync (Google Calendar)
- Follow-up automation
- Review request delivery
- Referral tracking
- Stripe payment integration

## Database Migrations

Alembic is configured at `backend/alembic.ini`. Migrations live in `backend/migrations/versions/`.

```bash
cd backend

# Apply all pending migrations
alembic upgrade head

# Generate a new migration after changing models
alembic revision --autogenerate -m "describe change"

# Rollback one migration
alembic downgrade -1
```

The single existing migration (`adccd1bb0637_complete_schema.py`) creates the full schema from scratch. The lifespan handler in `backend/app/main.py` also calls `metadata.create_all` on startup, which acts as a safety net in development but migrations are the correct mechanism for schema changes.

## API Reference

All routes are prefixed with `/api`.

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/signup` | — | Register; returns JWT pair |
| POST | `/auth/login` | — | Authenticate; returns JWT pair |
| POST | `/auth/refresh` | — | Refresh access token |
| POST | `/auth/reset-password` | — | Direct password reset by email |
| GET | `/users/me` | JWT | Current user profile |
| PUT | `/users/zip-codes` | JWT | Update service zip codes |
| PUT | `/users/trades` | JWT | Update target trades |
| POST | `/users/upgrade` | JWT | Upgrade subscription tier |
| GET | `/leads` | JWT | List leads (filter by zip/trade/status) |
| GET | `/leads/trial-status` | JWT | Trial usage info |
| GET | `/leads/stream` | — | SSE keepalive stream |
| GET | `/leads/{id}` | JWT | Lead detail (consumes trial for starter) |
| POST | `/leads` | — | Create lead |
| PATCH | `/leads/{id}` | — | Update lead |
| GET | `/outreach` | — | List outreach messages |
| POST | `/outreach` | — | Create outreach message |
| POST | `/outreach/{id}/send` | — | Send pending outreach |
| GET | `/appointments` | — | List appointments |
| POST | `/appointments` | — | Create appointment |
| DELETE | `/appointments/{id}` | — | Cancel appointment |
| GET | `/followups` | — | List follow-ups |
| POST | `/followups/{id}/trigger` | — | Trigger follow-up immediately |
| GET | `/reviews` | — | List review requests |
| POST | `/reviews/request` | — | Request a review |
| GET | `/referrals` | — | List referrals |
| POST | `/referrals` | — | Create referral invite |
| GET | `/health` | — | Health check |

## Deployment (Render)

- **Build**: `cd frontend && npm install && npm run build && cd .. && pip install -r requirements.txt`
- **Start**: `python main.py` (reads `$PORT`, defaults to 10000)
- **Frontend serving**: FastAPI mounts `frontend/dist/assets/` as a static directory and serves `index.html` as a catch-all for all non-`/api` paths
- **`frontend/dist/` is committed** — rebuild and commit it locally before pushing any frontend change

Valid `trade` values: `electrician`, `plumber`, `carpenter`, `roofer`, `landscaper`, `painter`, `general`, `hvac`, `demolition`, `cabinets`, `countertops`, `other`

Valid lead `source` values (backend `LeadSource` enum): `facebook`, `job_board`, `classifieds`, `newspaper`, `permit`, `property_record`, `manual`

Valid lead `status` values (`LeadStatus` enum): `new`, `read`, `contacted`, `qualified`, `not_interested`, `booked`, `lost`, `closed`
