# Backend — FastAPI + Firestore

## Layout & layering

Three layers, strictly separated:

- **[backend/server.py](../../backend/server.py)** — HTTP only. Each route validates
  input (Pydantic model or `request.json()`), calls one service function, and maps
  domain exceptions to HTTP status codes: `LookupError → 404`, `ValueError → 400`
  (e.g. [server.py:319-330](../../backend/server.py#L319-L330)).
- **[backend/services.py](../../backend/services.py)** — all business logic + Firestore
  reads/writes. This is where calculations and caching live.
- **[backend/firebase_client.py](../../backend/firebase_client.py)** — Firebase init
  and generic collection-agnostic CRUD helpers.

App entrypoint: `app = FastAPI(...)` at [server.py:116](../../backend/server.py#L116);
Firebase is initialised in the `lifespan` startup hook
([server.py:107-113](../../backend/server.py#L107-L113)). All routes are under `/api`.
CORS origins, rate limit, and Sentry are configured from env at
[server.py:92-138](../../backend/server.py#L92-L138).

Run/seed/backup commands are in [CLAUDE.md](../../CLAUDE.md#essential-commands).

## Auth

Custom JWT, no Firebase Auth. [backend/auth.py](../../backend/auth.py):

- `POST /api/auth/login` ([server.py:193-234](../../backend/server.py#L193-L234)) checks
  credentials against `_HARDCODED_USERS` (built from `ADMIN_EMAIL`/`ADMIN_PASSWORD`
  env, [server.py:180-190](../../backend/server.py#L180-L190)) and returns a signed JWT.
- `get_current_user` ([auth.py:60-93](../../backend/auth.py#L60-L93)) is the `Depends`
  guard for protected routes; `get_optional_user` ([auth.py:96-107](../../backend/auth.py#L96-L107))
  returns `None` instead of 401. In `ENVIRONMENT=development` a legacy static token
  `dev-hardcoded-token` is also accepted.
- Frontend stores the JWT in `localStorage` and sends `Authorization: Bearer`. There
  is only **one** user (admin); there is no real user table despite a `USERS` constant.

## Endpoint → service map

Mutations require `get_current_user` unless noted. Reads are mostly open.

| Method & path | Service fn ([services.py](../../backend/services.py)) |
|---|---|
| `GET /api/health`, `/api`, `/api/cache-stats` | — (health/diagnostics) |
| `POST /api/auth/login` | (in `server.py`) |
| `GET /api/products` | `get_all_products` |
| `GET /api/suppliers` | `get_all_suppliers` |
| `GET /api/suppliers/{id}` | `get_supplier` |
| `POST /api/suppliers` | `create_supplier` |
| `POST /api/suppliers/{id}/sub-parties` | `add_sub_party` |
| `DELETE /api/suppliers/{id}/sub-parties/{spId}` | `delete_sub_party` |
| `GET /api/weight-entries` | `get_weight_entries` |
| `POST /api/weight-entries` | `create_weight_entry` |
| `PATCH /api/weight-entries/{id}` | `update_weight_entry` |
| `DELETE /api/weight-entries/{id}` | `soft_delete_weight_entry` (soft delete) |
| `GET /api/dashboard` | `get_dashboard` |
| `POST /api/dashboard/confirm` | `save_daily_carryover` (saves tomorrow's opening stock) |
| `PUT /api/carryover` | `save_daily_carryover` (manual override; invalidates D and D+1) |
| `GET/POST/PATCH/DELETE /api/financial-entries` | `*_financial_entry` |
| `PATCH /api/financial-entries/reorder` | `reorder_financial_entries` (batch) |
| `GET/POST/PATCH/DELETE /api/section-f-entries` | `*_section_f_entry` |
| `GET /api/price-rates` | `get_effective_rate` |
| `POST/PUT /api/price-rates` | `create_price_rate` / upsert (in `server.py`) |
| `PUT /api/rms-entries` | `save_rms_entry` |
| `PUT /api/atb-entries` | `save_atb_entry` |
| `PUT /api/school-rate` | `save_school_custom_rate` |
| `POST/PATCH/DELETE /api/custom-financial-entries` | `*_custom_financial_entry` |
| `GET/POST/PATCH/DELETE /api/deduction-entries` | `*_deduction_entry` |
| `POST /api/deduction-entries/bulk` | replace-all for a date ([server.py:741-771](../../backend/server.py#L741-L771)) |
| `GET /api/deduction-summary` | `get_deduction_summary` (light recompute) |
| `GET /api/entry-dates`, `/api/entry-dates/{date}/details` | `get_entry_dates`, `get_entry_date_details` |
| `GET /api/analytics` | `get_analytics` |

## Conventions you'll repeat

- **Caching**: read-through TTL cache with prefix invalidation on every write — see
  [dashboard_calculations.md](dashboard_calculations.md#caching--invalidation-critical-for-correctness)
  and [architectural_patterns.md](architectural_patterns.md). Forgetting to invalidate
  is the most common correctness bug here.
- **Upsert-by-(date, productType)** for singleton-per-date docs (RMS/ATB/School/carryover):
  query `limit(1)` → update or create. Example [services.py:568-594](../../backend/services.py#L568-L594).
- **Sort in Python**, not Firestore, to avoid composite-index requirements
  ([services.py:476-477](../../backend/services.py#L476-L477)).
- **Pydantic validators round** numeric inputs (weights to 3 dp, rates to 2 dp) — see
  [models.py:40-54](../../backend/models.py#L40-L54).

## Tests & CI

- `pytest` is a dependency and `tests/` exists, but the suite is currently effectively
  empty (`tests/__init__.py` only). `test_result.md` / `test_reports/` are reports.
- CI: [.github/workflows/deploy.yml](../../.github/workflows/deploy.yml) builds the
  frontend, SSH-deploys the backend to the droplet, uploads the build, and curls
  `/api/health`. No test step runs in CI yet.
