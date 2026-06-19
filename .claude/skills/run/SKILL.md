---
name: run
description: Launch and drive the Chicken ERP app locally — FastAPI backend (:8000) + Vite/React frontend (:3000), backed by Supabase Postgres. Use when asked to run/start the app or verify a change in the real app.
---

# Run Chicken ERP locally

Full-stack app: **FastAPI backend** (`backend/`, Python 3.12 venv) on port **8000**, and a
**Vite/React frontend** (`frontend-vite/`) on port **3000**. Data lives in **Supabase
Postgres** (region ap-south-1 / Mumbai) — there is no local DB to start.

## Prerequisites (one-time)

1. **Backend env** — `backend/.env` must contain a working Supabase connection string:
   ```
   DATABASE_URL=postgresql://postgres.<ref>:<password>@aws-1-ap-south-1.pooler.supabase.com:5432/postgres
   ```
   (Supabase dashboard → **Connect → Direct → Session pooler** URI; `sslmode=require` is
   added automatically by `db.py`.)
2. **Frontend env** — `frontend-vite/.env` has `VITE_API_BASE_URL=http://localhost:8000`.
3. **Python deps** (venv already exists):
   ```bash
   cd backend && ./venv/bin/pip install -r requirements.txt
   ```
4. **Schema + seed** (only on a fresh database):
   ```bash
   cd backend && ./venv/bin/python init_db.py && ./venv/bin/python seed_db.py
   ```
5. **Frontend deps**: `cd frontend-vite && npm install`

## Launch

Run both (each in its own background process):

```bash
# Backend  → http://localhost:8000
cd backend && ./venv/bin/uvicorn server:app --host 0.0.0.0 --port 8000

# Frontend → http://localhost:3000  (Vite auto-bumps the port if 3000 is taken)
cd frontend-vite && npm run dev
```

If a port is occupied by a stale process, free it first:
`lsof -nP -tiTCP:8000 -sTCP:LISTEN | xargs kill` (repeat for 3000).

## Drive / verify it works

```bash
curl -s http://localhost:8000/api/health                       # {"status":"healthy",...}
curl -s -X POST http://localhost:8000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@supplier.com","password":"admin123"}'    # returns a JWT
curl -s "http://localhost:8000/api/suppliers?productType=chicken"   # seeded suppliers
```

Then open **http://localhost:3000**, log in with **admin@supplier.com / admin123**, pick a
product → open a supplier → add weight entries → open the **Dashboard** (supplier totals,
deductions, financial breakdown, RMS/ATB, Today Stock, grand total).

## Notes / gotchas

- Backend startup runs `init_db()` which opens the Supabase connection and runs `SELECT 1`;
  if `DATABASE_URL` is missing/wrong it fails fast at startup (check `db.py`).
- All business logic + Firestore→Postgres data access flows through
  `services.py` → `repository.py` → `db.py`. Calculations are pure Python.
- Parity tests (no DB needed): `cd backend && ./venv/bin/python -m pytest tests/ -v`.
- Production deploy is a DigitalOcean droplet (Nginx + systemd `chicken-erp-api`); set
  `DATABASE_URL` in the droplet's `backend/.env` there too.
