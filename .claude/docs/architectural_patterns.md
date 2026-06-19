# Architectural Patterns & Conventions

Patterns that recur across the codebase. Follow these when adding code so new work
matches the existing structure. Each entry cites multiple occurrences.

## Backend

### 1. Three-layer separation: routes → services → Firestore helpers
HTTP concerns never mix with business logic, and business logic never calls Firestore
SDK directly (it uses generic helpers). Routes validate + translate exceptions; services
compute; `firebase_client` does I/O.
- Routes: [server.py:265-267](../../backend/server.py#L265-L267), [server.py:311-330](../../backend/server.py#L311-L330)
- Services: [services.py:168-196](../../backend/services.py#L168-L196), [services.py:379-419](../../backend/services.py#L379-L419)
- Helpers: [firebase_client.py:85-160](../../backend/firebase_client.py#L85-L160)

### 2. Domain exceptions → HTTP status codes
Services raise plain `LookupError` (not found) and `ValueError` (bad input); routes
catch and convert to 404 / 400. Services stay HTTP-agnostic.
- [server.py:280-283](../../backend/server.py#L280-L283), [server.py:319-330](../../backend/server.py#L319-L330),
  [server.py:460-463](../../backend/server.py#L460-L463) — raisers at
  [services.py:202-203](../../backend/services.py#L202-L203), [services.py:175-176](../../backend/services.py#L175-L176).

### 3. Generic Firestore CRUD + collection-name constants
All reads/writes go through `get_document` / `list_documents` / `create_document` /
`update_document` / `delete_document` / `batch_update`
([firebase_client.py:79-160](../../backend/firebase_client.py#L79-L160)). Collection
names are module constants, never string literals at call sites
([services.py:31-43](../../backend/services.py#L31-L43)). Every fetched doc gets its
Firestore id merged in as `data["id"]`.

### 4. Read-through TTL cache with prefix invalidation
Reads check `cache_get` first and `cache_set` the result with a namespaced key; **every
mutation calls `cache_invalidate(prefix)`**. This is the project's central performance +
correctness convention.
- Read-through: [services.py:127-152](../../backend/services.py#L127-L152) (`rate:`),
  [services.py:241-253](../../backend/services.py#L241-L253) (`weight_entries:`),
  [services.py:1643-1656](../../backend/services.py#L1643-L1656) (`dashboard:`).
- Invalidate-on-write: [services.py:193-196](../../backend/services.py#L193-L196),
  [services.py:505-506](../../backend/services.py#L505-L506),
  [services.py:592-594](../../backend/services.py#L592-L594),
  [server.py:417-420](../../backend/server.py#L417-L420).
- Cache impl: [cache.py](../../backend/cache.py).
> Rule of thumb: if your write changes anything on the dashboard, also
> `cache_invalidate("dashboard:")`.

### 5. Upsert-by-query for singleton-per-date documents
RMS, ATB, School rate, and carryover are "one doc per (date, productType)". The pattern:
query with `FieldFilter` + `limit(1)`, then `update` if found else `create`.
- [services.py:568-594](../../backend/services.py#L568-L594) (RMS),
  [services.py:616-642](../../backend/services.py#L616-L642) (ATB),
  [services.py:664-692](../../backend/services.py#L664-L692) (School),
  [services.py:1249-1266](../../backend/services.py#L1249-L1266) (carryover),
  and the price-rate upsert at [server.py:629-659](../../backend/server.py#L629-L659).

### 6. Sort/filter in Python to avoid Firestore composite indexes
Lists are fetched with simple equality filters, then ordered in memory — the code
comments call this out explicitly.
- [services.py:470-478](../../backend/services.py#L470-L478),
  [services.py:538-546](../../backend/services.py#L538-L546),
  [services.py:1595-1601](../../backend/services.py#L1595-L1601).

### 7. Auto `sortOrder` + batch reorder
New ordered rows get `sortOrder = len(existing) + 1`; reordering is a single Firestore
batch write.
- Assign: [services.py:385-390](../../backend/services.py#L385-L390),
  [services.py:487-492](../../backend/services.py#L487-L492).
- Batch reorder: [services.py:456-467](../../backend/services.py#L456-L467) via
  [firebase_client.py:148-160](../../backend/firebase_client.py#L148-L160).

### 8. Pydantic validators normalize numeric input
Weights round to 3 dp, rates to 2 dp, with range checks — applied consistently so the
DB never stores noisy floats.
- [models.py:40-54](../../backend/models.py#L40-L54), [models.py:109-114](../../backend/models.py#L109-L114),
  [models.py:162-172](../../backend/models.py#L162-L172), [models.py:238-243](../../backend/models.py#L238-L243).

### 9. Soft delete
`weight_entries` are flagged `isDeleted=True` rather than removed, and every read filters
`isDeleted == False`.
- Delete: [services.py:231-238](../../backend/services.py#L231-L238).
- Read filter: [services.py:248](../../backend/services.py#L248),
  [services.py:962-963](../../backend/services.py#L962-L963),
  [services.py:1110](../../backend/services.py#L1110).

### 10. Orchestrator + prefetched builders for aggregation
Heavy aggregations fetch shared data once (often in parallel) then pass it into small
builder functions, which have `_prefetched` variants that avoid re-querying.
- `get_dashboard` parallel fetch + builders: [services.py:1659-1727](../../backend/services.py#L1659-L1727).
- `_build_supplier_totals` / `_calculate_totals_overview_prefetched` /
  `_build_financial_breakdown`: [services.py:1536](../../backend/services.py#L1536),
  [services.py:1614](../../backend/services.py#L1614), [services.py:1281](../../backend/services.py#L1281).

### 11. Strategy/lookup tables for per-entity rules
Per-party pricing and ordering are data, not branching logic: `CUSTOM_FORMULAS`,
`STANDARD_FORMULA_PARTIES`, `_get_formula_label`, `_PARTY_ORDER`. Add a party by editing
these tables.
- [services.py:1304-1314](../../backend/services.py#L1304-L1314),
  [services.py:1513-1529](../../backend/services.py#L1513-L1529),
  [services.py:1543-1550](../../backend/services.py#L1543-L1550).

### 12. Env-driven config with safe defaults
`os.getenv(KEY, default)` everywhere; secrets/limits/origins come from `.env`, never
hardcoded (the dev admin login is the one deliberate exception).
- [server.py:92-138](../../backend/server.py#L92-L138), [auth.py:24-30](../../backend/auth.py#L24-L30),
  [firebase_client.py:20-49](../../backend/firebase_client.py#L20-L49).

## Frontend

### 13. One API adapter module; never `fetch` inline
All backend access is a named export from
[utils/apiAdapter.jsx](../../frontend-vite/src/utils/apiAdapter.jsx), built on a single
`api()` wrapper that adds auth + dedups GETs. Pages import functions; they don't know URLs.
- Wrapper [apiAdapter.jsx:62-95](../../frontend-vite/src/utils/apiAdapter.jsx#L62-L95);
  consumers e.g. [SupplierManagementPage.jsx:12](../../frontend-vite/src/pages/SupplierManagementPage.jsx#L12).

### 14. JWT in localStorage + `ProtectedRoute` gate
Token/user persisted to `localStorage`; route guard reads it; bearer header added per
request.
- [App.jsx:16-19](../../frontend-vite/src/App.jsx#L16-L19),
  [apiAdapter.jsx:105-122](../../frontend-vite/src/utils/apiAdapter.jsx#L105-L122).

### 15. Fetch-in-`useEffect`, refetch-after-mutation, abort stale
No react-query. Pages own `loading`/data state, re-fetch after writes, and cancel
superseded requests with `AbortController`.
- [SupplierManagementPage.jsx:31-117](../../frontend-vite/src/pages/SupplierManagementPage.jsx#L31-L117);
  dashboard re-fetch helpers [apiAdapter.jsx:292-293](../../frontend-vite/src/utils/apiAdapter.jsx#L292-L293).

### 16. Inline-edit cell pattern
Editable dashboard fields use a uniform `editing*` / `*Value` state pair plus
click/save/keydown handlers, then persist and refetch.
- [SupplierDashboardPage.jsx:87-134](../../frontend-vite/src/pages/SupplierDashboardPage.jsx#L87-L134),
  [SupplierDashboardPage.jsx:323-352](../../frontend-vite/src/pages/SupplierDashboardPage.jsx#L323-L352);
  reusable [components/InlineEdit.jsx](../../frontend-vite/src/components/InlineEdit.jsx).

### 17. shadcn/ui + Tailwind + `cn()` + `@/` alias
Compose Radix-based primitives from `src/components/ui/`; merge classes with `cn()`;
import via the `@` → `src` alias. Toast feedback via `sonner` on every mutation.
- [lib/utils.jsx](../../frontend-vite/src/lib/utils.jsx),
  [vite.config.js:25-29](../../frontend-vite/vite.config.js#L25-L29).

### 18. Context + localStorage for cross-page preferences
Small shared state (last supplier, sidebar) lives in a Context that hydrates from and
writes to `localStorage`; consumed via a `useAppContext()` hook that throws outside the
provider.
- [context/AppContext.jsx](../../frontend-vite/src/context/AppContext.jsx),
  used in [Sidebar.jsx:28](../../frontend-vite/src/components/Sidebar.jsx#L28),
  [SupplierManagementPage.jsx:41-48](../../frontend-vite/src/pages/SupplierManagementPage.jsx#L41-L48).

## Cross-cutting

- **`date` (`YYYY-MM-DD`) is the universal key.** Almost every collection and endpoint is
  scoped by date; the dashboard joins them by date in Python.
- **Money is INR, weights are kg to 3 dp.** Format only at the edge via `formatCurrency` /
  `formatWeight` ([apiAdapter.jsx:43-53](../../frontend-vite/src/utils/apiAdapter.jsx#L43-L53)).
- **`OTHER CALCULATION` is a virtual supplier** handled specially in aggregation — don't
  treat it like a normal supplier ([services.py:1672-1673](../../backend/services.py#L1672-L1673),
  [services.py:1021-1022](../../backend/services.py#L1021-L1022)).
