# Chicken ERP — Supplier Management System

## Project overview

A daily supplier-management / accounting ERP for a wholesale poultry (chicken) &
mutton business. The core workflow:

1. **Data entry** — record daily weighbridge entries per supplier sub-party.
   Each entry stores load weight and empty weight; `liveWeight = loadWeight − emptyWeight`.
2. **Daily dashboard** — for a chosen date, aggregate everything into a financial
   sheet: supplier weight totals, a running stock balance carried day-to-day
   ("Yesterday Stock"), deductions, a financial breakdown with per-party pricing
   formulas, special rows (RMS, ATB, Today Stock, School), and a grand total.
3. **Analytics & history** — range-based revenue/weight trends and a calendar of
   days that have entries.

The domain uses business-specific terms (PR rate, M.Iruppu, RMS, ATB, Section F,
custom per-party formulas). These are **non-obvious** — see
[.claude/docs/dashboard_calculations.md](.claude/docs/dashboard_calculations.md)
before touching any calculation, and
[.claude/docs/data_model.md](.claude/docs/data_model.md) for the glossary.

Live deployment: a DigitalOcean droplet (Nginx + systemd) — see [README.md](README.md).

## Tech stack

**Backend** (`backend/`) — Python 3.12, FastAPI, served by uvicorn (dev) / gunicorn
+ uvicorn workers (prod). Data lives in **Google Firestore** via the Firebase Admin
SDK. Auth is custom JWT (PyJWT). Also: Pydantic v2 (validation), slowapi (rate
limiting), Sentry (optional error tracking), an in-process TTL cache.

**Frontend** (`frontend-vite/`) — React 18 + Vite 7, React Router 7, Tailwind CSS 3
with Radix UI / shadcn-style primitives (`src/components/ui/`), Recharts (charts),
Sonner (toasts), react-hook-form + zod. All backend calls go through one plain
`fetch` adapter (axios is installed but unused). The Firebase JS SDK is initialised
([frontend-vite/src/firebase.js](frontend-vite/src/firebase.js)) for optional
realtime listeners.

**Data** — Firestore (NoSQL, document collections). No relational DB. See
[.claude/docs/data_model.md](.claude/docs/data_model.md).

**Deploy** — GitHub Actions → DigitalOcean droplet (Nginx static frontend + reverse
proxy to gunicorn). Railway (`backend/railway.toml`) and Vercel (`frontend-vite/vercel.json`)
configs also exist as alternates.

## Key directories

| Path | Purpose |
|---|---|
| `backend/server.py` | FastAPI app + all HTTP routes (thin layer; validates, delegates to services) |
| `backend/services.py` | **All domain logic** + Firestore access — calculations, aggregation, CRUD |
| `backend/models.py` | Pydantic request/response schemas + input validators |
| `backend/firebase_client.py` | Firebase init + generic Firestore CRUD helpers |
| `backend/auth.py` | JWT create/verify; `get_current_user` / `get_optional_user` deps |
| `backend/cache.py` | In-memory TTL cache (single-process) |
| `backend/seed_firestore.py` | Seed initial products/suppliers/sub-parties/rates |
| `backend/backup_firestore.py` | Export all collections to a JSON backup |
| `backend/firestore.rules` | Firestore security rules |
| `frontend-vite/src/pages/` | One component per route (see routing in `src/App.jsx`) |
| `frontend-vite/src/components/` | Shared components; `ui/` = Radix/shadcn primitives |
| `frontend-vite/src/utils/apiAdapter.jsx` | **Single API client** — every backend call lives here |
| `frontend-vite/src/context/AppContext.jsx` | Global state (last supplier, sidebar), persisted to localStorage |
| `deploy/` | Nginx conf, systemd unit, droplet `setup.sh` |
| `.github/workflows/deploy.yml` | CI/CD on push to `main` |

## Essential commands

**Backend** (from `backend/`):
```bash
source venv/bin/activate                          # venv already exists
uvicorn server:app --reload --port 8000           # dev server → http://localhost:8000
python seed_firestore.py                          # populate a fresh Firestore
python backup_firestore.py                        # dump collections to JSON
pytest                                            # tests (suite is currently minimal)
```

**Frontend** (from `frontend-vite/`):
```bash
npm install
npm run dev        # Vite dev server → http://localhost:3000 (auto-bumps if taken)
npm run build      # production build → build/
npm run lint       # ESLint
```

**Config** — `backend/.env` (`FIREBASE_CREDENTIALS_PATH`, `JWT_SECRET_KEY`,
`ADMIN_EMAIL`/`ADMIN_PASSWORD`, `CORS_ORIGINS`, `ENVIRONMENT`) and
`frontend-vite/.env` (`VITE_API_BASE_URL`, `VITE_FIREBASE_*`). The backend reads
Firestore creds from `backend/service-account.json` in development.
Dev login: `admin@supplier.com` / `admin123`.

> Code style is enforced by linters (ESLint / Black + isort) — this file omits
> formatting conventions intentionally.

## Additional documentation — read when relevant

| When you are working on… | Read |
|---|---|
| Firestore collections, fields, relationships, domain glossary | [.claude/docs/data_model.md](.claude/docs/data_model.md) |
| The daily dashboard math, pricing formulas, carryover, special rows | [.claude/docs/dashboard_calculations.md](.claude/docs/dashboard_calculations.md) |
| Adding/changing API endpoints, auth, caching, services | [.claude/docs/backend.md](.claude/docs/backend.md) |
| Pages, routing, global state, the API adapter, UI components | [.claude/docs/frontend.md](.claude/docs/frontend.md) |
| Conventions to follow when writing new code | [.claude/docs/architectural_patterns.md](.claude/docs/architectural_patterns.md) |
