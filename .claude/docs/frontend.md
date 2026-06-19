# Frontend — React + Vite SPA

Lives in `frontend-vite/`. Entry: [src/index.jsx](../../frontend-vite/src/index.jsx)
→ [src/App.jsx](../../frontend-vite/src/App.jsx). Vite config (port 3000, `@` → `src`
alias, build → `build/`) at [vite.config.js](../../frontend-vite/vite.config.js).

## Routing & navigation

Routes are declared in [App.jsx:26-46](../../frontend-vite/src/App.jsx#L26-L46). All
real pages are wrapped in `<ProtectedRoute>` (which checks
`getCurrentUser()` from localStorage, [App.jsx:16-19](../../frontend-vite/src/App.jsx#L16-L19))
and share `AppLayout` (sidebar + content, [components/AppLayout.jsx](../../frontend-vite/src/components/AppLayout.jsx)).

Typical user flow:
`/login` → `/product-select` → `/suppliers` → `/supplier/:id` (data entry) →
`/supplier/:id/dashboard` (the financial sheet); plus `/history` and `/analytics`.

| Route | Page | Purpose |
|---|---|---|
| `/login` | [LoginPage.jsx](../../frontend-vite/src/pages/LoginPage.jsx) | Email/password → JWT |
| `/product-select` | [ProductSelectPage.jsx](../../frontend-vite/src/pages/ProductSelectPage.jsx) | Pick chicken/mutton |
| `/suppliers` | [SupplierListPage.jsx](../../frontend-vite/src/pages/SupplierListPage.jsx) | List suppliers |
| `/supplier/:id` | [SupplierManagementPage.jsx](../../frontend-vite/src/pages/SupplierManagementPage.jsx) | **Data entry** — weight entries per sub-party, by date |
| `/supplier/:id/dashboard` | [SupplierDashboardPage.jsx](../../frontend-vite/src/pages/SupplierDashboardPage.jsx) | **The daily financial dashboard** (1900+ lines, the main screen) |
| `/history` | [LogHistoryPage.jsx](../../frontend-vite/src/pages/LogHistoryPage.jsx) | Calendar of days with entries |
| `/analytics` | [AnalyticsPage.jsx](../../frontend-vite/src/pages/AnalyticsPage.jsx) | Recharts trends over a range |

Sidebar nav items + active-route logic: [components/Sidebar.jsx:27-79](../../frontend-vite/src/components/Sidebar.jsx#L27-L79).
It deep-links "Data Entry"/"Dashboard" to the last-used supplier.

## The API adapter (single source of backend access)

**Every** backend call goes through [src/utils/apiAdapter.jsx](../../frontend-vite/src/utils/apiAdapter.jsx).
Do not call `fetch` directly elsewhere — add a function here instead.

- Core wrapper `api(path, method, body)` at
  [apiAdapter.jsx:62-95](../../frontend-vite/src/utils/apiAdapter.jsx#L62-L95): injects the
  `Authorization: Bearer` header, throws `Error(detail)` on non-2xx, and **deduplicates
  in-flight GET requests** via a `_pending` Map.
- `API_BASE` resolution ([apiAdapter.jsx:12-33](../../frontend-vite/src/utils/apiAdapter.jsx#L12-L33))
  uses `VITE_API_BASE_URL`, but forces same-origin when served from a remote host so a
  localhost value can't leak into production.
- Auth helpers `login` / `logout` / `getCurrentUser` persist the JWT and user to
  `localStorage` ([apiAdapter.jsx:105-122](../../frontend-vite/src/utils/apiAdapter.jsx#L105-L122)).
- Formatting helpers `formatCurrency` (INR) and `formatWeight` (3 dp) live here too.
- Dashboard "inline edit" helpers (`updateDashboardEntry` / `createDashboardEntry` /
  `deleteDashboardEntry`, [apiAdapter.jsx:268-336](../../frontend-vite/src/utils/apiAdapter.jsx#L268-L336))
  translate generic UI edits to the right endpoint and **re-fetch the whole dashboard**.
- Firestore realtime listeners (`subscribe*`, [apiAdapter.jsx:399-439](../../frontend-vite/src/utils/apiAdapter.jsx#L399-L439))
  exist but their Firebase imports are missing — treat as **dead/broken code** unless
  you wire up the imports from [src/firebase.js](../../frontend-vite/src/firebase.js).

## State & data fetching

- No data-fetching library. Pages fetch in `useEffect`, hold results in `useState`,
  track `loading`, and **re-fetch after every mutation** (e.g.
  [SupplierManagementPage.jsx:93-117](../../frontend-vite/src/pages/SupplierManagementPage.jsx#L93-L117)).
  Stale requests are cancelled with an `AbortController`
  ([SupplierManagementPage.jsx:57-79](../../frontend-vite/src/pages/SupplierManagementPage.jsx#L57-L79)).
- Global state is minimal: [context/AppContext.jsx](../../frontend-vite/src/context/AppContext.jsx)
  holds the last-selected supplier (persisted to `localStorage`) and sidebar open state.
- The dashboard page manages many `useState` flags for its inline-edit cells (rate,
  RMS, ATB, school rate, today stock, deductions, financial weight/amount) — see the
  state block at [SupplierDashboardPage.jsx:71-135](../../frontend-vite/src/pages/SupplierDashboardPage.jsx#L71-L135).

## UI components

- `src/components/ui/` — Radix-based shadcn/ui primitives (button, dialog, calendar,
  popover, sonner, etc.). Compose these; don't restyle from scratch.
- Shared app components: `Sidebar`, `AppLayout`, `StatBar`, `SubPartyList`,
  `EntriesTable`, `WeightEntryModal`, `AddEntryModal`, `InlineEdit`, `SupplierCard`,
  `ProductCard`, `LoginCard`.
- Styling: Tailwind CSS; merge classes with the `cn()` helper
  ([src/lib/utils.jsx](../../frontend-vite/src/lib/utils.jsx)). Toasts via `sonner`
  (`toast.success/error`) — fired on essentially every mutation.

## Env

[frontend-vite/.env](../../frontend-vite/.env): `VITE_API_BASE_URL` (backend URL) and
`VITE_FIREBASE_*` (client SDK config). Anything exposed to the browser must be
`VITE_`-prefixed.
