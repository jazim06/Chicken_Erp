# Data Model — Firestore collections & domain glossary

The only datastore is **Google Firestore** (NoSQL). There are no joins; documents
reference each other by stored ID strings. All access funnels through the generic
helpers in [backend/firebase_client.py](../../backend/firebase_client.py) (`get_document`,
`list_documents`, `create_document`, `update_document`, `delete_document`,
`batch_update`). Collection names are defined once as constants in
[backend/services.py:31-43](../../backend/services.py#L31-L43).

Security rules: [backend/firestore.rules](../../backend/firestore.rules) — `products`
and `suppliers` are publicly readable; everything else requires auth; writes require auth.

## Collections

| Collection | Key fields | Notes |
|---|---|---|
| `products` | `name`, `image`, `description` | Product types (CHICKEN, MUTTON). Doc id = lowercase name. Seeded at [seed_firestore.py:29-46](../../backend/seed_firestore.py#L29-L46) |
| `suppliers` | `name`, `productType`, `active`, `createdAt` | A top-level supplier. `OTHER CALCULATION` is a **virtual supplier** treated specially (see below) |
| `sub_parties` | `supplierId`, `partyName`, `name`, `todayWeight`, `totalWeight` | Separate collection linked to a supplier by `supplierId` (NOT nested). Attached to suppliers at read time — [services.py:1160-1166](../../backend/services.py#L1160-L1166) |
| `weight_entries` | `supplierId`, `partyId`, `partyName`, `date`, `loadWeight`, `emptyWeight`, `liveWeight`, `isDeleted`, `createdAt`, `createdBy` | The core fact table. `liveWeight = loadWeight − emptyWeight`, computed server-side at [services.py:178](../../backend/services.py#L178). **Soft-deleted** via `isDeleted` |
| `financial_entries` | `customerName`, `weight`, `ratePerKg`, `amount`, `calculationMethod`, `section` (`MAIN`/`SECTION_F`), `sortOrder`, `date`, `formula`, `highlight`, `notes` | Customer allocations. `amount = weight × ratePerKg` for `STANDARD`. Created at [services.py:379-419](../../backend/services.py#L379-L419) |
| `section_f_entries` | `name`, `amount`, `weight`, `retailRate`, `date`, `sortOrder` | "Section F" / Other-Calculations manual rows |
| `custom_financial_entries` | `partyName`, `weight`, `amount`, `date`, `productType` | User-added one-off parties in the financial breakdown |
| `deduction_entries` | `partyId`, `partyName`, `supplierId`, `supplierName`, `amount`, `date` | ⚠️ **`amount` actually stores a WEIGHT** in the financial-breakdown context — see [services.py:1347](../../backend/services.py#L1347) |
| `price_rates` | `productTypeId`, `ratePerKg`, `effectiveFrom`, `effectiveTo` | **Effective-dated** ₹/kg "PR rate". `effectiveTo: null` = current. Lookup at [services.py:127-152](../../backend/services.py#L127-L152) |
| `daily_carryover` | `date`, `balance`, `ys_amount`, `today_stock_weight` | One doc per date. Carries stock balance forward; holds manual overrides. [services.py:1249-1274](../../backend/services.py#L1249-L1274) |
| `rms_entries` | `date`, `productType`, `amount` | One ₹ amount per date (the "RMS" row) |
| `atb_entries` | `date`, `productType`, `rate` | "Amount To Be Paid" rate per date |
| `school_rate_entries` | `date`, `productType`, `rate` | Per-date custom rate for the "School" party |

Pydantic schemas mirroring these live in [backend/models.py](../../backend/models.py).
Note: response models there are partly aspirational — most endpoints return raw dicts
assembled in `services.py`, not the `*Response` models.

## Relationships

```
products (productType) ──< suppliers ──< sub_parties
                                  │             │
                                  │ supplierId  │ partyId / partyName
                                  ▼             ▼
                              weight_entries (the daily facts, per date)
                                  │
                  date ──────────┼────────── price_rates (effective-dated)
                                  ▼
   daily_carryover ─ deduction_entries ─ financial_entries ─ section_f_entries
   rms_entries ─ atb_entries ─ school_rate_entries ─ custom_financial_entries
        (all keyed by `date`, aggregated by get_dashboard)
```

Almost everything is keyed by a `date` string (`YYYY-MM-DD`). The dashboard for a
date is assembled by joining all of the above **in Python**, not in Firestore — see
[dashboard_calculations.md](dashboard_calculations.md).

## Fallback / seed data

When Firestore has no suppliers/products, the API serves hardcoded fallbacks:
[services.py:53-104](../../backend/services.py#L53-L104) (`_FALLBACK_PRODUCTS`,
`_FALLBACK_SUPPLIERS`). Predictable seed IDs (e.g. `supp_joseph`) are written by
[seed_firestore.py](../../backend/seed_firestore.py).

## Domain glossary (essential)

| Term | Meaning |
|---|---|
| **PR / PR rate** | Price rate in ₹/kg effective for the date (`price_rates`) |
| **Live weight** | `loadWeight − emptyWeight` (the net sellable weight) |
| **Columns A / B / C** | Load weight / Empty weight / Live weight, per party — [services.py:301-307](../../backend/services.py#L301-L307) |
| **M.Iruppu / Yesterday Stock / carryover** | Previous day's `totalBalance`, carried into today as opening stock — [services.py:324-343](../../backend/services.py#L324-L343) |
| **Deduction** | A weight subtracted from the running balance; its `amount` field holds a *weight* and also seeds a financial-breakdown row |
| **RMS** | A fixed ₹ amount row in the financial breakdown (`rms_entries`) |
| **ATB** | "Amount To Be Paid" — a rate stored per date (`atb_entries`) |
| **Today Stock** | Manually entered closing weight; `amount = weight × (PR − 10)`; always the **last** financial row — [services.py:1493-1508](../../backend/services.py#L1493-L1508) |
| **School** | Other-calc party priced with a per-date custom rate (`school_rate_entries`) |
| **Section F / Other Calculations** | Manual rows + the `OTHER CALCULATION` virtual supplier's parties |
| **OTHER CALCULATION** | A supplier whose weights are *excluded* from the stock subtotal and instead feed the financial breakdown — [services.py:1672-1673](../../backend/services.py#L1672-L1673) |

Per-party pricing **custom formulas** (Parveen, Anna City, Saleem Bhai, School) are
defined at [services.py:1304-1308](../../backend/services.py#L1304-L1308) with display
labels at [services.py:1513-1529](../../backend/services.py#L1513-L1529). Details in
[dashboard_calculations.md](dashboard_calculations.md).
