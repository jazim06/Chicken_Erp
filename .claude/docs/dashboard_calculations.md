# Dashboard Calculations — the daily financial pipeline

This is the most complex and least-obvious part of the system. The entire daily
sheet is assembled by `get_dashboard(date, product_type)` at
[services.py:1643-1813](../../backend/services.py#L1643-L1813). Read this before
changing any number that appears on the dashboard.

## Pipeline overview

`get_dashboard` orchestrates smaller builders. The whole result is cached for 30s
under key `dashboard:{product_type}:{date}` ([services.py:1652-1656](../../backend/services.py#L1652-L1656)).

1. **Parallel fetch** ([services.py:1659-1668](../../backend/services.py#L1659-L1668)) —
   a `ThreadPoolExecutor` fans out four independent reads: effective rate, weight
   entries, Section F entries, previous-day carryover.
2. **Supplier totals** — `_build_supplier_totals` ([services.py:1536-1611](../../backend/services.py#L1536-L1611))
   groups weight entries by supplier→party, sums A/B/C, sorts rows into a fixed
   per-supplier party order (`_PARTY_ORDER`). The `OTHER CALCULATION` supplier is
   split out ([services.py:1672-1673](../../backend/services.py#L1672-L1673)).
3. **Totals overview** — `_calculate_totals_overview_prefetched`
   ([services.py:1614-1636](../../backend/services.py#L1614-L1636)):
   `subtotal = Σ supplier liveWeight + carryover`, then
   `totalBalance = subtotal − Σ deductions`.
4. **Financial breakdown** — `_build_financial_breakdown`
   ([services.py:1281-1510](../../backend/services.py#L1281-L1510)). The heart of it
   (see below).
5. **Grand total** = the financial-breakdown total ([services.py:1737](../../backend/services.py#L1737)).
   Section F is now merged into the breakdown and returned empty for backward compat
   ([services.py:1731-1734](../../backend/services.py#L1731-L1734)).
6. Assemble display arrays (`totalsOverview`, `deductions`, `otherCalculations`) and
   return ([services.py:1792-1808](../../backend/services.py#L1792-L1808)).

## The financial breakdown — row by row

`_build_financial_breakdown` builds an **ordered** list of rows and sums their
`amount`. Order matters (it's what the UI renders top to bottom):

1. **RMS** — fixed ₹ from `rms_entries`, weight 0 — [services.py:1327-1340](../../backend/services.py#L1327-L1340).
2. **Deduction parties** — one row per `deduction_entries` doc; the deduction's
   `amount` is treated as a **weight** — [services.py:1342-1367](../../backend/services.py#L1342-L1367).
3a. **Supplier sub-parties** (Joseph/Sadiq parties) — always shown even at weight 0
    so they never disappear — [services.py:1369-1401](../../backend/services.py#L1369-L1401).
3b. **Other-calc parties** (Section F + `OTHER CALCULATION`) — shown only when
    weight > 0 — [services.py:1403-1473](../../backend/services.py#L1403-L1473).
4. **Custom financial entries** (user-added) — [services.py:1475-1491](../../backend/services.py#L1475-L1491).
5. **Today Stock** — always last — [services.py:1493-1508](../../backend/services.py#L1493-L1508).

De-duplication is by lowercased name via a `seen_names` set, so a party never appears
twice across sections.

## Pricing rules (per party)

The amount for a row depends on the party. Defined at
[services.py:1304-1308](../../backend/services.py#L1304-L1308) and applied throughout
the builder:

| Party | Formula (W = weight, PR = price rate) | Where |
|---|---|---|
| Parveen | `(PR − 3) × W` | `CUSTOM_FORMULAS` |
| Anna City | `(W × 1.5) × (PR + 4)` | `CUSTOM_FORMULAS` |
| Saleem Bhai | `(W × 1.6) × (PR + 5)` | `CUSTOM_FORMULAS` |
| School | `W × custom rate` (from `school_rate_entries`) | [services.py:1418-1435](../../backend/services.py#L1418-L1435) |
| Today Stock | `W × max(PR − 10, 0)` | [services.py:1493-1508](../../backend/services.py#L1493-L1508) |
| Thamim, Irfan, Rajendran, BBC, Masthan | `W × PR` (shown with a "W × PR" label) | `STANDARD_FORMULA_PARTIES` [services.py:1312-1314](../../backend/services.py#L1312-L1314) |
| Generic Section F party | `W × retailRate` (0 if no `retailRate` stored — does **not** fall back to PR) | [services.py:1452-1470](../../backend/services.py#L1452-L1470) |
| Everyone else | `W × PR` | default |

Human-readable formula labels (shown in the UI as blue text) come from
`_get_formula_label` at [services.py:1513-1529](../../backend/services.py#L1513-L1529).

> When adding a new specially-priced party you must touch **both** `CUSTOM_FORMULAS`
> and `_get_formula_label` (and possibly `_PARTY_ORDER` and `STANDARD_FORMULA_PARTIES`).

## Carryover / running balance

- "Yesterday Stock" for date *D* = the `balance` saved on date *D−1*
  (`_get_previous_day_carryover`, [services.py:324-343](../../backend/services.py#L324-L343)).
- Confirming a dashboard saves today's `totalBalance` as the carryover, which becomes
  tomorrow's Yesterday Stock — `POST /api/dashboard/confirm`
  ([server.py:359-371](../../backend/server.py#L359-L371)).
- Manually setting carryover (`PUT /api/carryover`) invalidates the cache for **both**
  date *D* and *D+1* because both depend on it — [server.py:374-427](../../backend/server.py#L374-L427).

## Caching & invalidation (critical for correctness)

A read-through TTL cache ([backend/cache.py](../../backend/cache.py)) sits in front of
Firestore. Keys are namespaced by prefix (`dashboard:`, `rate:`, `weight_entries:`,
`rms:`, `atb:`, `school_rate:`, `custom_fin:`, `supplier:`, `suppliers:`, `analytics:`).
**Every mutating service function calls `cache_invalidate(prefix)`** so stale numbers
don't survive a write (e.g. [services.py:193-196](../../backend/services.py#L193-L196),
[services.py:592-594](../../backend/services.py#L592-L594)). If you add a new write path
that affects the dashboard, you must `cache_invalidate("dashboard:")` (and any other
affected prefix), or the change won't show for up to 30s.

`get_deduction_summary` ([services.py:869-932](../../backend/services.py#L869-L932)) is a
lighter recompute used by the frontend after deduction edits to refresh only the
affected sections without a full dashboard rebuild — keep its subtotal logic in sync
with `get_dashboard`.

## Analytics

`get_analytics` ([services.py:939-1085](../../backend/services.py#L939-L1085)) reuses
`_build_financial_breakdown` per day to compute daily revenue, then rolls up into
daily/weekly/monthly series plus supplier/party breakdowns (cached 60s). It excludes
the `OTHER CALCULATION` virtual supplier from weight breakdowns
([services.py:1021-1022](../../backend/services.py#L1021-L1022)).
