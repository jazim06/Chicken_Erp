"""
Business-logic services for the Chicken ERP dashboard.

All domain calculations live here — weight summation, stock allocation,
running-balance sequencing, financial breakdown, grand total.
"""

from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone

from cache import cache_get, cache_set, cache_invalidate
from firebase_client import (
    create_document,
    get_collection,
    get_document,
    list_documents,
    update_document,
    delete_document,
    batch_update,
    get_firestore_client,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Collections
# ---------------------------------------------------------------------------
WEIGHT_ENTRIES = "weight_entries"
FINANCIAL_ENTRIES = "financial_entries"
SECTION_F_ENTRIES = "section_f_entries"
DEDUCTION_ENTRIES = "deduction_entries"
RMS_ENTRIES = "rms_entries"
ATB_ENTRIES = "atb_entries"
CUSTOM_FINANCIAL_ENTRIES = "custom_financial_entries"
PRICE_RATES = "price_rates"
SUPPLIERS = "suppliers"
SUB_PARTIES = "sub_parties"
PRODUCTS = "products"
USERS = "users"

# Default financial breakdown party list (in display order)
DEFAULT_FINANCIAL_PARTIES = [
    'RMS', 'Thamim', 'Irfan', 'Rajendran', 'BBC', 'Parveen',
    'Masthan', 'MBB', 'Al Ayaan', 'Anas', 'Anna city',
    'B.Less', 'Saleem Bhai', 'Ramesh', 'School', '110',
    'Daas', 'Mahendran', 'Iruppu',
]

# ---------------------------------------------------------------------------
# Fallback seed data (when Firestore is empty)
# ---------------------------------------------------------------------------
_FALLBACK_PRODUCTS = [
    {
        "id": "chicken",
        "name": "CHICKEN",
        "image": "https://images.unsplash.com/photo-1587593810167-a84920ea0781?q=80&w=800",
        "description": "Poultry Management",
    },
    {
        "id": "mutton",
        "name": "MUTTON",
        "image": "https://images.unsplash.com/photo-1602470520998-f4a52199a3d6?q=80&w=800",
        "description": "Sheep & Goat Management",
    },
]

_FALLBACK_SUPPLIERS = {
    "chicken": [
        {
            "id": "supp_joseph",
            "name": "JOSEPH",
            "productType": "chicken",
            "active": True,
            "subParties": [
                {"id": "party_rms", "name": "RMS", "partyName": "RMS"},
                {"id": "party_thamim", "name": "Thamim", "partyName": "Thamim"},
                {"id": "party_anna", "name": "Anna City", "partyName": "Anna City"},
            ],
        },
        {
            "id": "supp_sadiq",
            "name": "SADIQ",
            "productType": "chicken",
            "active": True,
            "subParties": [
                {"id": "party_a", "name": "Party A", "partyName": "Party A"},
                {"id": "party_b", "name": "Party B", "partyName": "Party B"},
            ],
        },
    ],
    "mutton": [
        {
            "id": "supp_raheem",
            "name": "RAHEEM",
            "productType": "mutton",
            "active": True,
            "subParties": [
                {"id": "party_farm_a", "name": "Farm A", "partyName": "Farm A"},
                {"id": "party_farm_b", "name": "Farm B", "partyName": "Farm B"},
            ],
        },
    ],
}


# ===================================================================
# PRICE RATE
# ===================================================================

# ---------------------------------------------------------------------------
# Cached helpers
# ---------------------------------------------------------------------------

def _get_supplier_names() -> dict[str, str]:
    """Get all supplier ID→name mappings. Cached 10 min."""
    cache_key = "supplier_names"
    cached = cache_get(cache_key)
    if cached is not None:
        return cached
    suppliers = list_documents(SUPPLIERS)
    mapping = {s["id"]: s["name"] for s in suppliers}
    cache_set(cache_key, mapping, ttl_seconds=600)
    return mapping


def get_effective_rate(product_type_id: str, date: str) -> float:
    """
    Return the effective rate (₹/kg) for a product type on a given date.
    Cached per product+date for 1 hour.
    """
    cache_key = f"rate:{product_type_id}:{date}"
    cached = cache_get(cache_key)
    if cached is not None:
        return cached

    rates = list_documents(
        PRICE_RATES,
        filters=[("productTypeId", "==", product_type_id)],
    )
    valid = [
        r for r in rates
        if r.get("effectiveFrom", "") <= date and 
           (r.get("effectiveTo") is None or r["effectiveTo"] >= date)
    ]
    if valid:
        valid.sort(key=lambda x: x.get("effectiveFrom", ""))
        rate = valid[-1]["ratePerKg"]
    else:
        rate = 0.0
    cache_set(cache_key, rate, ttl_seconds=3600)
    return rate


def create_price_rate(data: dict) -> str:
    """Create a new price rate entry and invalidate rate + dashboard cache."""
    data["createdAt"] = datetime.now(timezone.utc).isoformat()
    doc_id = create_document(PRICE_RATES, data)
    cache_invalidate("rate:")
    cache_invalidate("dashboard:")
    return doc_id


# ===================================================================
# WEIGHT ENTRIES
# ===================================================================

def create_weight_entry(data: dict, user_id: str | None = None) -> dict:
    """
    Create a weight entry. Auto-calculates liveWeight.
    Validates loadWeight > emptyWeight.
    """
    load_w = data["loadWeight"]
    empty_w = data["emptyWeight"]
    if load_w <= empty_w:
        raise ValueError("loadWeight must be greater than emptyWeight")

    live_weight = round(load_w - empty_w, 3)
    doc = {
        "supplierId": data["supplierId"],
        "partyId": data["partyId"],
        "partyName": data["partyName"],
        "date": data["date"],
        "loadWeight": load_w,
        "emptyWeight": empty_w,
        "liveWeight": live_weight,
        "isDeleted": False,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "createdBy": user_id,
    }
    doc_id = create_document(WEIGHT_ENTRIES, doc)
    doc["id"] = doc_id
    cache_invalidate("dashboard:")
    cache_invalidate("weight_entries:")
    cache_invalidate(f"supplier:{data['supplierId']}:")
    return doc


def update_weight_entry(entry_id: str, data: dict) -> dict:
    """Update a weight entry. Recalculates liveWeight if weights change."""
    existing = get_document(WEIGHT_ENTRIES, entry_id)
    if not existing:
        raise LookupError(f"Weight entry {entry_id} not found")

    load_w = data.get("loadWeight", existing["loadWeight"])
    empty_w = data.get("emptyWeight", existing["emptyWeight"])

    # For retail entries emptyWeight=0, allow loadWeight == emptyWeight == 0
    # but still require loadWeight > emptyWeight for wholesale
    if empty_w > 0 and load_w <= empty_w:
        raise ValueError("loadWeight must be greater than emptyWeight")

    updates = {}
    if "loadWeight" in data:
        updates["loadWeight"] = data["loadWeight"]
    if "emptyWeight" in data:
        updates["emptyWeight"] = data["emptyWeight"]
    if "liveWeight" in data:
        updates["liveWeight"] = data["liveWeight"]
    else:
        updates["liveWeight"] = round(load_w - empty_w, 3)

    update_document(WEIGHT_ENTRIES, entry_id, updates)
    existing.update(updates)
    cache_invalidate("dashboard:")
    cache_invalidate("weight_entries:")
    cache_invalidate(f"supplier:{existing['supplierId']}:")
    return existing


def soft_delete_weight_entry(entry_id: str) -> None:
    """Soft-delete a weight entry (set isDeleted=True)."""
    existing = get_document(WEIGHT_ENTRIES, entry_id)
    if not existing:
        raise LookupError(f"Weight entry {entry_id} not found")
    update_document(WEIGHT_ENTRIES, entry_id, {"isDeleted": True})


def get_weight_entries(date: str, supplier_id: str | None = None) -> list[dict]:
    """Return weight entries for a date, optionally filtered by supplier."""
    cache_key = f"weight_entries:{date}:{supplier_id or 'all'}"
    cached = cache_get(cache_key)
    if cached is not None:
        return cached
    
    filters = [("date", "==", date), ("isDeleted", "==", False)]
    if supplier_id:
        filters.append(("supplierId", "==", supplier_id))
    entries = list_documents(WEIGHT_ENTRIES, filters=filters)
    cache_set(cache_key, entries, ttl_seconds=180)
    return entries


# ===================================================================
# SUPPLIER TOTALS (Column A / B / C)
# ===================================================================

def calculate_supplier_totals(date: str, rate: float) -> list[dict]:
    """
    For every supplier that has weight entries on `date`, group by
    sub-party and calculate:
      Column A = loadWeight
      Column B = emptyWeight
      Column C = liveWeight (calculated: loadWeight - emptyWeight)
    Each supplier's total live weight (sum of all parties' C values) goes to totals overview.
    Returns list of supplier dicts with rows.
    """
    entries = get_weight_entries(date)

    # Group: supplierId → partyId → list of weight entry details
    supplier_map: dict[str, dict[str, list]] = {}
    party_names: dict[str, str] = {}
    supplier_names: dict[str, str] = {}
    entry_details: dict[str, dict] = {}

    for e in entries:
        sid = e["supplierId"]
        pid = e["partyId"]
        supplier_map.setdefault(sid, {}).setdefault(pid, []).append(e)
        party_names[pid] = e.get("partyName", pid)
        entry_details[e["id"]] = e

    # Use cached supplier names instead of querying every time
    supplier_names = _get_supplier_names()

    result = []
    for sid, parties in supplier_map.items():
        rows = []
        supplier_total_live_weight = 0.0  # Sum of all parties' live weight (column C)
        
        for pid, weight_entries in parties.items():
            # Sum load, empty, and live weights for this party across all entries
            party_load_total = round(sum(e.get("loadWeight", 0) for e in weight_entries), 3)
            party_empty_total = round(sum(e.get("emptyWeight", 0) for e in weight_entries), 3)
            party_live_total = round(sum(e.get("liveWeight", 0) for e in weight_entries), 3)
            
            supplier_total_live_weight += party_live_total
            
            rows.append({
                "id": pid,
                "party": party_names.get(pid, pid),
                "a": party_load_total,      # Column A: Load Weight
                "b": party_empty_total,     # Column B: Empty Weight
                "c": party_live_total,      # Column C: Live Weight (liveWeight = loadWeight - emptyWeight)
            })

        result.append({
            "id": sid,
            "name": supplier_names.get(sid, sid),
            "rows": rows,
            "totalWeight": round(supplier_total_live_weight, 3),  # Only live weight total
            "totalValue": round(supplier_total_live_weight * rate, 3),  # Value calculated from live weight
        })

    return result


# ===================================================================
# TOTALS OVERVIEW — Running Balance
# ===================================================================

def _get_previous_day_carryover(date: str) -> float:
    """
    M.Iruppu = yesterday's remaining stock (totalBalance).
    Query previous day's section-f entry named 'Iruppu', or compute from
    yesterday's dashboard. For simplicity, store daily carryover in a
    dedicated collection or derive from yesterday's totalBalance.
    Here we look at yesterday's financial_entries to derive it.
    """
    prev_date = (
        datetime.strptime(date, "%Y-%m-%d") - timedelta(days=1)
    ).strftime("%Y-%m-%d")

    # Look for a specific "carryover" document for the previous day
    docs = list_documents(
        "daily_carryover",
        filters=[("date", "==", prev_date)],
    )
    if docs:
        return docs[0].get("balance", 0.0)
    return 0.0


def calculate_totals_overview(
    date: str,
    supplier_totals: list[dict],
) -> dict:
    """
    Build the totals-overview section:
      1. Sum all supplier totals (live weight only) + M.Iruppu carryover → subtotal
      2. Fetch deduction entries for the date
      3. totalBalance = subtotal - totalDeductions
    """
    # Sum of all supplier live weights
    available = sum(s["totalWeight"] for s in supplier_totals)
    carryover = _get_previous_day_carryover(date)
    subtotal = round(available + carryover, 3)

    # Deductions
    deductions = get_deduction_entries(date)
    total_deductions = round(sum(d.get("amount", 0) for d in deductions), 3)
    total_balance = round(subtotal - total_deductions, 3)

    return {
        "subtotal": subtotal,
        "carryover": carryover,
        "totalDeductions": total_deductions,
        "deductions": deductions,
        "totalBalance": total_balance,
    }


# ===================================================================
# FINANCIAL ENTRIES CRUD
# ===================================================================

def create_financial_entry(data: dict, rate: float, user_id: str | None = None) -> dict:
    """
    Create a financial entry (customer allocation).
    Standard calc: amount = weight × rate
    """
    # Auto-assign sortOrder if not provided
    if data.get("sortOrder") is None:
        existing = list_documents(
            FINANCIAL_ENTRIES,
            filters=[("date", "==", data["date"]), ("section", "==", data.get("section", "MAIN"))],
        )
        data["sortOrder"] = len(existing) + 1

    rate_used = data.get("ratePerKg") or rate
    calc_method = data.get("calculationMethod", "STANDARD")

    if calc_method == "STANDARD":
        amount = round(data["weight"] * rate_used, 2)
    else:
        # Phase 2: custom formula evaluation
        amount = data.get("amount", 0.0)

    doc = {
        "customerName": data["customerName"],
        "weight": data["weight"],
        "ratePerKg": rate_used,
        "amount": amount,
        "calculationMethod": calc_method,
        "customFormulaId": data.get("customFormulaId"),
        "section": data.get("section", "MAIN"),
        "sortOrder": data["sortOrder"],
        "date": data["date"],
        "formula": data.get("formula"),
        "highlight": data.get("highlight", False),
        "notes": data.get("notes"),
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "createdBy": user_id,
    }
    doc_id = create_document(FINANCIAL_ENTRIES, doc)
    doc["id"] = doc_id
    return doc


def update_financial_entry(entry_id: str, data: dict, rate: float | None = None) -> dict:
    """
    Update a financial entry. Recalculate amount if weight or rate changes.
    """
    existing = get_document(FINANCIAL_ENTRIES, entry_id)
    if not existing:
        raise LookupError(f"Financial entry {entry_id} not found")

    updates = {}
    for field in ("customerName", "weight", "ratePerKg", "sortOrder", "notes", "amount"):
        if field in data and data[field] is not None:
            updates[field] = data[field]

    # Recalculate amount for standard entries when weight or rate changes
    calc_method = existing.get("calculationMethod", "STANDARD")
    if calc_method == "STANDARD" and ("weight" in updates or "ratePerKg" in updates):
        w = updates.get("weight", existing["weight"])
        r = updates.get("ratePerKg", existing.get("ratePerKg", rate or 0))
        updates["amount"] = round(w * r, 2)

    if updates:
        update_document(FINANCIAL_ENTRIES, entry_id, updates)
    existing.update(updates)
    return existing


def delete_financial_entry(entry_id: str) -> None:
    """Delete a financial entry and recalculate sort orders."""
    existing = get_document(FINANCIAL_ENTRIES, entry_id)
    if not existing:
        raise LookupError(f"Financial entry {entry_id} not found")
    delete_document(FINANCIAL_ENTRIES, entry_id)


def reorder_financial_entries(items: list[dict]) -> None:
    """
    Batch-update sortOrder for financial entries.
    items: [{"id": "...", "sortOrder": 1}, ...]
    """
    db = get_firestore_client()
    batch = db.batch()
    col = db.collection(FINANCIAL_ENTRIES)
    for item in items:
        ref = col.document(item["id"])
        batch.update(ref, {"sortOrder": item["sortOrder"]})
    batch.commit()


def get_financial_entries(date: str, section: str = "MAIN") -> list[dict]:
    """List financial entries for a date/section, ordered by sortOrder."""
    entries = list_documents(
        FINANCIAL_ENTRIES,
        filters=[("date", "==", date), ("section", "==", section)],
    )
    # Sort in Python to avoid composite index requirement
    entries.sort(key=lambda x: x.get("sortOrder", 0))
    return entries


# ===================================================================
# SECTION F ENTRIES
# ===================================================================

def create_section_f_entry(data: dict) -> dict:
    """Create a Section F entry."""
    if data.get("sortOrder") is None:
        existing = list_documents(
            SECTION_F_ENTRIES,
            filters=[("date", "==", data["date"])],
        )
        data["sortOrder"] = len(existing) + 1

    doc = {
        "name": data["name"],
        "amount": data["amount"],
        "weight": data.get("weight"),
        "date": data["date"],
        "sortOrder": data["sortOrder"],
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    doc_id = create_document(SECTION_F_ENTRIES, doc)
    doc["id"] = doc_id
    return doc


def update_section_f_entry(entry_id: str, data: dict) -> dict:
    """Update a Section F entry."""
    existing = get_document(SECTION_F_ENTRIES, entry_id)
    if not existing:
        raise LookupError(f"Section F entry {entry_id} not found")

    updates = {}
    for field in ("name", "amount", "weight", "sortOrder"):
        if field in data and data[field] is not None:
            updates[field] = data[field]

    if updates:
        update_document(SECTION_F_ENTRIES, entry_id, updates)
    existing.update(updates)
    return existing


def delete_section_f_entry(entry_id: str) -> None:
    """Delete a Section F entry."""
    existing = get_document(SECTION_F_ENTRIES, entry_id)
    if not existing:
        raise LookupError(f"Section F entry {entry_id} not found")
    delete_document(SECTION_F_ENTRIES, entry_id)


def get_section_f_entries(date: str) -> list[dict]:
    """List Section F entries for a date."""
    entries = list_documents(
        SECTION_F_ENTRIES,
        filters=[("date", "==", date)],
    )
    # Sort in Python to avoid composite index requirement
    entries.sort(key=lambda x: x.get("sortOrder", 0))
    return entries


# ===================================================================
# RMS ENTRIES CRUD
# ===================================================================

def get_rms_entry(date: str, product_type: str = "chicken") -> dict | None:
    """Get the RMS amount entry for a date."""
    cache_key = f"rms:{product_type}:{date}"
    cached = cache_get(cache_key)
    if cached is not None:
        return cached
    entries = list_documents(
        RMS_ENTRIES,
        filters=[("date", "==", date), ("productType", "==", product_type)],
    )
    result = entries[0] if entries else None
    cache_set(cache_key, result, ttl_seconds=120)
    return result


def save_rms_entry(date: str, product_type: str, amount: float) -> dict:
    """Create or update an RMS amount entry for a date (stores ₹ directly)."""
    db = get_firestore_client()
    from google.cloud.firestore_v1.base_query import FieldFilter
    existing = list(
        db.collection(RMS_ENTRIES)
        .where(filter=FieldFilter("date", "==", date))
        .where(filter=FieldFilter("productType", "==", product_type))
        .limit(1)
        .stream()
    )
    doc = next(iter(existing), None)
    if doc:
        db.collection(RMS_ENTRIES).document(doc.id).update({"amount": amount})
        result = {"id": doc.id, "date": date, "productType": product_type, "amount": amount}
    else:
        doc_data = {
            "date": date,
            "productType": product_type,
            "amount": amount,
            "createdAt": datetime.now(timezone.utc).isoformat(),
        }
        doc_id = create_document(RMS_ENTRIES, doc_data)
        result = {"id": doc_id, **doc_data}
    cache_invalidate("rms:")
    cache_invalidate("dashboard:")
    return result


# ===================================================================
# ATB (Amount To Be Paid) ENTRIES CRUD
# ===================================================================

def get_atb_entry(date: str, product_type: str = "chicken") -> dict | None:
    """Get the ATB rate entry for a date."""
    cache_key = f"atb:{product_type}:{date}"
    cached = cache_get(cache_key)
    if cached is not None:
        return cached
    entries = list_documents(
        ATB_ENTRIES,
        filters=[("date", "==", date), ("productType", "==", product_type)],
    )
    result = entries[0] if entries else None
    cache_set(cache_key, result, ttl_seconds=120)
    return result


def save_atb_entry(date: str, product_type: str, rate: float) -> dict:
    """Create or update an ATB rate entry for a date."""
    db = get_firestore_client()
    from google.cloud.firestore_v1.base_query import FieldFilter
    existing = list(
        db.collection(ATB_ENTRIES)
        .where(filter=FieldFilter("date", "==", date))
        .where(filter=FieldFilter("productType", "==", product_type))
        .limit(1)
        .stream()
    )
    doc = next(iter(existing), None)
    if doc:
        db.collection(ATB_ENTRIES).document(doc.id).update({"rate": rate})
        result = {"id": doc.id, "date": date, "productType": product_type, "rate": rate}
    else:
        doc_data = {
            "date": date,
            "productType": product_type,
            "rate": rate,
            "createdAt": datetime.now(timezone.utc).isoformat(),
        }
        doc_id = create_document(ATB_ENTRIES, doc_data)
        result = {"id": doc_id, **doc_data}
    cache_invalidate("atb:")
    cache_invalidate("dashboard:")
    return result


# ===================================================================
# CUSTOM FINANCIAL ENTRIES CRUD
# ===================================================================

def get_custom_financial_entries(date: str, product_type: str = "chicken") -> list[dict]:
    """Get all custom financial entries for a date."""
    cache_key = f"custom_fin:{product_type}:{date}"
    cached = cache_get(cache_key)
    if cached is not None:
        return cached
    entries = list_documents(
        CUSTOM_FINANCIAL_ENTRIES,
        filters=[("date", "==", date), ("productType", "==", product_type)],
    )
    cache_set(cache_key, entries, ttl_seconds=120)
    return entries


def create_custom_financial_entry(data: dict) -> dict:
    """Create a custom financial entry (user-added party in financial breakdown)."""
    doc = {
        "partyName": data["partyName"],
        "weight": float(data.get("weight", 0)),
        "amount": float(data.get("amount", 0)),
        "date": data["date"],
        "productType": data.get("productType", "chicken"),
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    doc_id = create_document(CUSTOM_FINANCIAL_ENTRIES, doc)
    doc["id"] = doc_id
    cache_invalidate("custom_fin:")
    cache_invalidate("dashboard:")
    return doc


def update_custom_financial_entry(entry_id: str, data: dict) -> dict:
    """Update weight/amount of a custom financial entry."""
    db = get_firestore_client()
    doc_ref = db.collection(CUSTOM_FINANCIAL_ENTRIES).document(entry_id)
    doc = doc_ref.get()
    if not doc.exists:
        raise LookupError(f"Custom financial entry {entry_id} not found")
    updates = {}
    if "weight" in data:
        updates["weight"] = float(data["weight"])
    if "amount" in data:
        updates["amount"] = float(data["amount"])
    if updates:
        doc_ref.update(updates)
    result = {"id": entry_id, **doc.to_dict(), **updates}
    cache_invalidate("custom_fin:")
    cache_invalidate("dashboard:")
    return result


def delete_custom_financial_entry(entry_id: str) -> None:
    """Delete a custom financial entry."""
    db = get_firestore_client()
    doc_ref = db.collection(CUSTOM_FINANCIAL_ENTRIES).document(entry_id)
    doc = doc_ref.get()
    if not doc.exists:
        raise LookupError(f"Custom financial entry {entry_id} not found")
    doc_ref.delete()
    cache_invalidate("custom_fin:")
    cache_invalidate("dashboard:")


# ===================================================================
# DEDUCTION ENTRIES CRUD
# ===================================================================

def create_deduction_entry(data: dict) -> dict:
    """Create a deduction entry for a sub-party on a given date."""
    doc = {
        "partyId": data.get("partyId"),
        "partyName": data["partyName"],
        "supplierId": data["supplierId"],
        "supplierName": data["supplierName"],
        "amount": round(data["amount"], 3),
        "date": data["date"],
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    doc_id = create_document(DEDUCTION_ENTRIES, doc)
    doc["id"] = doc_id
    cache_invalidate("dashboard:")
    return doc


def get_deduction_entries(date: str) -> list[dict]:
    """List all deduction entries for a date."""
    return list_documents(
        DEDUCTION_ENTRIES,
        filters=[("date", "==", date)],
    )


def update_deduction_entry(entry_id: str, data: dict) -> dict:
    """Update a deduction entry."""
    existing = get_document(DEDUCTION_ENTRIES, entry_id)
    if not existing:
        raise LookupError(f"Deduction entry {entry_id} not found")

    updates = {}
    for field in ("amount", "partyName", "partyId"):
        if field in data and data[field] is not None:
            val = data[field]
            if field == "amount":
                val = round(val, 3)
            updates[field] = val

    if updates:
        update_document(DEDUCTION_ENTRIES, entry_id, updates)
    existing.update(updates)
    return existing


def delete_deduction_entry(entry_id: str) -> None:
    """Delete a deduction entry."""
    existing = get_document(DEDUCTION_ENTRIES, entry_id)
    if not existing:
        raise LookupError(f"Deduction entry {entry_id} not found")
    delete_document(DEDUCTION_ENTRIES, entry_id)
    cache_invalidate("dashboard:")


def _get_other_calc_items(date: str, weight_entries: list[dict] | None = None) -> list[dict]:
    """
    Build the other-calc items list (Section F entries + OTHER CALCULATION
    supplier weight entries) so financial breakdown can pull weights for
    non-deduction parties.
    """
    supplier_names = _get_supplier_names()

    # Section F entries
    sf_entries = get_section_f_entries(date)
    items = [
        {"id": e["id"], "name": e["name"], "value": e["amount"]}
        for e in sf_entries
    ]

    # OTHER CALCULATION supplier entries
    if weight_entries is None:
        weight_entries = get_weight_entries(date)

    # Find the OTHER CALCULATION supplier id(s)
    other_calc_sids = [
        sid for sid, name in supplier_names.items()
        if name == "OTHER CALCULATION"
    ]

    # Group weight entries by partyName for OTHER CALCULATION suppliers
    party_totals: dict[str, float] = {}
    party_ids: dict[str, str] = {}
    for e in weight_entries:
        if e["supplierId"] in other_calc_sids:
            pname = e.get("partyName", e.get("partyId", ""))
            party_totals[pname] = party_totals.get(pname, 0) + e.get("liveWeight", 0)
            party_ids[pname] = e.get("partyId", "")

    for pname, total_weight in party_totals.items():
        items.append({
            "id": party_ids.get(pname, pname),
            "name": pname,
            "value": round(total_weight, 3),
        })

    return items


def get_deduction_summary(date: str, product_type: str = "chicken") -> dict:
    """
    Summary of deductions + affected totals + financial breakdown for a date.
    Used after deduction CRUD operations to refresh all dependent sections
    without a full dashboard rebuild.
    """
    deductions = get_deduction_entries(date)
    total_deductions = round(sum(d.get("amount", 0) for d in deductions), 3)

    # Subtotal = sum of all live weights (from cache) + yesterday's carryover
    weight_entries = get_weight_entries(date)
    available = round(sum(e.get("liveWeight", 0) for e in weight_entries), 3)
    carryover = _get_previous_day_carryover(date)
    subtotal = round(available + carryover, 3)
    total_balance = round(subtotal - total_deductions, 3)

    # Build other-calc items (Section F + OTHER CALCULATION supplier entries)
    # so financial breakdown can pull weights for non-deduction parties
    other_calc_items = _get_other_calc_items(date, weight_entries)

    # Rebuild financial breakdown since deductions feed into it
    rate = get_effective_rate(product_type, date)
    financial, financial_total = _build_financial_breakdown(
        deductions, rate, date, product_type, other_calc_items=other_calc_items
    )

    return {
        "deductions": deductions,
        "totalDeductions": total_deductions,
        "subtotal": subtotal,
        "totalBalance": total_balance,
        "financial": financial,
        "financialTotal": financial_total,
    }


# ===================================================================
# SUPPLIER / PRODUCT CRUD
# ===================================================================

def get_all_products() -> list[dict]:
    """Return all products. Falls back to hardcoded seed data if Firestore is empty."""
    docs = list_documents(PRODUCTS)
    return docs if docs else _FALLBACK_PRODUCTS


def get_all_suppliers(product_type: str | None = None) -> list[dict]:
    """Return suppliers, optionally filtered by productType. Falls back to hardcoded seed data if Firestore is empty."""
    cache_key = f"suppliers:{product_type or 'all'}"
    cached = cache_get(cache_key)
    if cached is not None:
        return cached
    
    filters = []
    if product_type:
        filters.append(("productType", "==", product_type))
    suppliers = list_documents(SUPPLIERS, filters=filters if filters else None)

    # If Firestore has suppliers, use those; otherwise use fallback
    if not suppliers:
        if product_type:
            suppliers = _FALLBACK_SUPPLIERS.get(product_type, [])
        else:
            suppliers = [s for supp_list in _FALLBACK_SUPPLIERS.values() for s in supp_list]
    else:
        # Attach sub-parties from Firestore
        for s in suppliers:
            subs = list_documents(
                SUB_PARTIES,
                filters=[("supplierId", "==", s["id"])],
            )
            s["subParties"] = subs
    
    cache_set(cache_key, suppliers, ttl_seconds=300)
    return suppliers


def get_supplier(supplier_id: str) -> dict | None:
    """Return a single supplier with sub-parties and today's weight computed from entries."""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    cache_key = f"supplier:{supplier_id}:{today}"
    cached = cache_get(cache_key)
    if cached is not None:
        return cached
    
    supplier = get_document(SUPPLIERS, supplier_id)
    if supplier:
        subs = list_documents(
            SUB_PARTIES,
            filters=[("supplierId", "==", supplier_id)],
        )
        # Compute todayWeight from actual weight entries
        today_entries = get_weight_entries(today, supplier_id=supplier_id)
        # Build a mapping partyId → total live weight
        party_weights = {}
        for entry in today_entries:
            pid = entry.get("partyId", "")
            party_weights[pid] = party_weights.get(pid, 0) + entry.get("liveWeight", 0)
        for sub in subs:
            sub["todayWeight"] = round(party_weights.get(sub["id"], 0), 3)
        supplier["subParties"] = subs
        cache_set(cache_key, supplier, ttl_seconds=120)
    return supplier


def create_supplier(data: dict) -> dict:
    """Create a new supplier."""
    doc = {
        "name": data["name"],
        "productType": data["productType"],
        "active": data.get("active", True),
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    doc_id = create_document(SUPPLIERS, doc)
    doc["id"] = doc_id
    doc["subParties"] = []
    cache_invalidate("suppliers:")
    return doc


def add_sub_party(supplier_id: str, party_name: str) -> dict:
    """Add a sub-party to a supplier."""
    supplier = get_document(SUPPLIERS, supplier_id)
    if not supplier:
        raise LookupError(f"Supplier {supplier_id} not found")
    doc = {
        "supplierId": supplier_id,
        "partyName": party_name,
        "name": party_name,
        "todayWeight": 0,
        "totalWeight": 0,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    doc_id = create_document(SUB_PARTIES, doc)
    doc["id"] = doc_id
    cache_invalidate("suppliers:")
    cache_invalidate(f"supplier:{supplier_id}:")
    return doc


def delete_sub_party(supplier_id: str, sub_party_id: str) -> None:
    """Delete a sub-party."""
    existing = get_document(SUB_PARTIES, sub_party_id)
    if not existing or existing.get("supplierId") != supplier_id:
        raise LookupError(f"Sub-party {sub_party_id} not found under supplier {supplier_id}")
    delete_document(SUB_PARTIES, sub_party_id)
    cache_invalidate("suppliers:")
    cache_invalidate(f"supplier:{supplier_id}:")


# ===================================================================
# DAILY CARRYOVER
# ===================================================================

def save_daily_carryover(date: str, balance: float) -> None:
    """Store the end-of-day balance for carryover to next day."""
    docs = list_documents("daily_carryover", filters=[("date", "==", date)])
    if docs:
        update_document("daily_carryover", docs[0]["id"], {"balance": balance})
    else:
        create_document("daily_carryover", {"date": date, "balance": balance})
    cache_invalidate("dashboard:")


# ===================================================================
# FINANCIAL BREAKDOWN BUILDER
# ===================================================================

def _build_financial_breakdown(
    deductions: list[dict],
    rate: float,
    date: str,
    product_type: str = "chicken",
    other_calc_items: list[dict] | None = None,
) -> tuple[list[dict], float]:
    """
    Build the financial breakdown section from deduction entries,
    other-calculation entries, RMS entry, and custom financial entries.

    Each deduction party becomes a row: amount = weight × rate
    (unless a custom formula applies).
    For remaining default parties not in deductions, weights are pulled
    from other_calc_items (Section F / OTHER CALCULATION supplier entries).
    Returns (list_of_rows, grand_total).
    """
    # Custom formulas: party_name → calc(weight, rate)
    CUSTOM_FORMULAS = {
        'Parveen': lambda w, r: round((r - 3) * w, 2),
        'Anna city': lambda w, r: round((w * 1.5) * (r + 4), 2),
        'Saleem Bhai': lambda w, r: round((w * 1.6) * (r + 5), 2),
    }

    rows: list[dict] = []
    grand_total = 0.0

    # Build a lookup of other-calc weights by normalised party name
    other_weight_map: dict[str, float] = {}
    for item in (other_calc_items or []):
        name = (item.get("name") or "").strip()
        if name:
            key = name.lower()
            other_weight_map[key] = other_weight_map.get(key, 0) + (item.get("value", 0) or 0)

    # 1. RMS entry (fixed amount, no weight)
    rms_entry = get_rms_entry(date, product_type)
    rms_amount = round(rms_entry["amount"], 2) if rms_entry else 0.0
    rows.append({
        "id": rms_entry["id"] if rms_entry else "rms_placeholder",
        "name": "RMS",
        "weight": 0,
        "ratePerKg": rate,
        "amount": rms_amount,
        "formula": None,
        "isRms": True,
        "isCustom": False,
    })
    grand_total += rms_amount

    # 2. Deduction-based rows (each deduction party → financial line)
    seen_names: set[str] = {"rms"}  # RMS already added above

    for ded in deductions:
        name = ded.get("partyName", "Unknown")
        weight = round(ded.get("amount", 0), 3)  # deduction 'amount' is the weight
        formula_fn = CUSTOM_FORMULAS.get(name)
        if formula_fn and weight > 0:
            amount = formula_fn(weight, rate)
            formula_label = _get_formula_label(name)
        else:
            amount = round(weight * rate, 2)
            formula_label = None

        rows.append({
            "id": ded["id"],
            "name": name,
            "weight": weight,
            "ratePerKg": rate,
            "amount": amount,
            "formula": formula_label,
            "isRms": False,
            "isCustom": False,
        })
        grand_total += amount
        seen_names.add(name.lower())

    # 3. Add remaining default parties — pull weight from other_calc_items
    for party_name in DEFAULT_FINANCIAL_PARTIES:
        key = party_name.lower()
        if key in seen_names or party_name == "RMS":
            continue
        # Look up weight from Other Calculations / Section F
        weight = round(other_weight_map.get(key, 0), 3)
        formula_fn = CUSTOM_FORMULAS.get(party_name)
        if formula_fn and weight > 0:
            amount = formula_fn(weight, rate)
            formula_label = _get_formula_label(party_name)
        elif weight > 0:
            amount = round(weight * rate, 2)
            formula_label = None
        else:
            amount = 0
            formula_label = _get_formula_label(party_name) if party_name in CUSTOM_FORMULAS else None
        rows.append({
            "id": f"default_{party_name}",
            "name": party_name,
            "weight": weight,
            "ratePerKg": rate,
            "amount": amount,
            "formula": formula_label,
            "isRms": False,
            "isCustom": False,
        })
        grand_total += amount

    # 4. Custom financial entries (user-added parties)
    custom_entries = get_custom_financial_entries(date, product_type)
    for ce in custom_entries:
        name = ce.get("partyName", "Custom")
        weight = round(ce.get("weight", 0), 3)
        amount = round(ce.get("amount", 0), 2)
        rows.append({
            "id": ce["id"],
            "name": name,
            "weight": weight,
            "ratePerKg": rate,
            "amount": amount,
            "formula": None,
            "isRms": False,
            "isCustom": True,
        })
        grand_total += amount

    return rows, round(grand_total, 2)


def _get_formula_label(name: str) -> str | None:
    """Return a human-readable formula label for known custom-formula parties."""
    formulas = {
        'Parveen': '(PR-3) × W',
        'Anna city': '(W×1.5) × (PR+4)',
        'Saleem Bhai': '(W×1.6) × (PR+5)',
    }
    return formulas.get(name)


# ===================================================================
# OPTIMIZED HELPERS (avoid repeat queries)
# ===================================================================

def _build_supplier_totals(entries: list[dict], rate: float) -> list[dict]:
    """
    Build supplier totals from pre-fetched weight entries.
    Same logic as calculate_supplier_totals but without the extra query.
    """
    supplier_map: dict[str, dict[str, list]] = {}
    party_names: dict[str, str] = {}

    for e in entries:
        sid = e["supplierId"]
        pid = e["partyId"]
        supplier_map.setdefault(sid, {}).setdefault(pid, []).append(e)
        party_names[pid] = e.get("partyName", pid)

    supplier_names = _get_supplier_names()

    result = []
    for sid, parties in supplier_map.items():
        rows = []
        supplier_total_live_weight = 0.0

        for pid, weight_entries in parties.items():
            party_load_total = round(sum(e.get("loadWeight", 0) for e in weight_entries), 3)
            party_empty_total = round(sum(e.get("emptyWeight", 0) for e in weight_entries), 3)
            party_live_total = round(sum(e.get("liveWeight", 0) for e in weight_entries), 3)
            supplier_total_live_weight += party_live_total

            rows.append({
                "id": pid,
                "party": party_names.get(pid, pid),
                "a": party_load_total,
                "b": party_empty_total,
                "c": party_live_total,
            })

        result.append({
            "id": sid,
            "name": supplier_names.get(sid, sid),
            "rows": rows,
            "totalWeight": round(supplier_total_live_weight, 3),
            "totalValue": round(supplier_total_live_weight * rate, 3),
        })

    return result


def _calculate_totals_overview_prefetched(
    date: str,
    supplier_totals: list[dict],
    carryover: float,
) -> dict:
    """
    Totals overview using pre-fetched carryover (avoids duplicate query).
    Still fetches deductions (cheap single query).
    """
    available = sum(s["totalWeight"] for s in supplier_totals)
    subtotal = round(available + carryover, 3)

    deductions = get_deduction_entries(date)
    total_deductions = round(sum(d.get("amount", 0) for d in deductions), 3)
    total_balance = round(subtotal - total_deductions, 3)

    return {
        "subtotal": subtotal,
        "carryover": carryover,
        "totalDeductions": total_deductions,
        "deductions": deductions,
        "totalBalance": total_balance,
    }


# ===================================================================
# FULL DASHBOARD AGGREGATION
# ===================================================================

def get_dashboard(date: str, product_type: str = "chicken") -> dict:
    """
    Build the complete dashboard state for a given date.
    Orchestrates: supplier totals → totals overview → financial breakdown
    → section F → grand total.
    Uses parallel queries to reduce latency.
    Results are cached for 30s to avoid repeated Firestore round-trips.
    """
    # ── Check dashboard cache first ──
    cache_key = f"dashboard:{product_type}:{date}"
    cached = cache_get(cache_key)
    if cached is not None:
        logger.info("Dashboard served from cache: %s", cache_key)
        return cached

    # ── Parallel I/O phase: fire independent queries concurrently ──
    with ThreadPoolExecutor(max_workers=4) as pool:
        f_rate = pool.submit(get_effective_rate, product_type, date)
        f_weight = pool.submit(get_weight_entries, date)
        f_sf = pool.submit(get_section_f_entries, date)
        f_carry = pool.submit(_get_previous_day_carryover, date)

        rate = f_rate.result()
        all_weight_entries = f_weight.result()
        sf_entries = f_sf.result()
        carryover = f_carry.result()

    # 2. Supplier totals built from pre-fetched weight entries (no extra query)
    all_supplier_totals = _build_supplier_totals(all_weight_entries, rate)
    supplier_totals = [s for s in all_supplier_totals if s["name"] != "OTHER CALCULATION"]
    other_calc_supplier = [s for s in all_supplier_totals if s["name"] == "OTHER CALCULATION"]

    # 3. Totals overview (uses pre-fetched carryover, fetches deductions)
    totals = _calculate_totals_overview_prefetched(date, supplier_totals, carryover)

    # 4. Financial breakdown — built from deduction entries + other calc items
    #    Other calc items provide weights for parties not in the deduction list
    other_items = [
        {"id": e["id"], "name": e["name"], "value": e["amount"]}
        for e in sf_entries
    ]
    for s in other_calc_supplier:
        for row in s["rows"]:
            other_items.append({"id": row["id"], "name": row["party"], "value": row["c"]})

    financial, financial_total = _build_financial_breakdown(
        totals.get("deductions", []), rate, date, product_type,
        other_calc_items=other_items,
    )

    # Get ATB entry (persisted rate)
    atb_entry = get_atb_entry(date, product_type)
    atb_rate = atb_entry["rate"] if atb_entry else 0.0

    # 5. Section F (other calculations) - now empty since merged into financial
    #    Keep for backward compatibility but return empty list
    section_f = []
    section_f_total = 0.0

    # 6. Grand total (only financial now, Section F is merged)
    grand_total = round(financial_total, 2)

    # 7. Build totals overview entries for display (regular suppliers only)
    totals_display = []
    for s in supplier_totals:
        totals_display.append({
            "id": f"sup_{s['id']}",
            "party": s["name"],
            "total": s["totalWeight"],
        })
    # Always show Yesterday Stock row (editable manual entry)
    totals_display.append({
        "id": "yesterday_stock",
        "party": "Yesterday Stock",
        "total": totals["carryover"],
        "editable": True,
    })

    # 8. Deductions display (from totals dict)
    deductions_display = [
        {
            "id": d["id"],
            "partyName": d["partyName"],
            "supplierName": d.get("supplierName", ""),
            "amount": d["amount"],
        }
        for d in totals.get("deductions", [])
    ]

    # 9. Other calculations display — combine Section F entries + Other
    #    Calculation supplier entries (retail weight only)
    other_items = [
        {"id": e["id"], "name": e["name"], "value": e["amount"]}
        for e in sf_entries
    ]
    for s in other_calc_supplier:
        for row in s["rows"]:
            other_items.append({
                "id": row["id"],
                "name": row["party"],
                "value": row["c"],  # actual weight (retail)
            })
    other_calc = {
        "title": "Section F",
        "items": other_items,
    }

    result = {
        "date": date,
        "effectivePrRate": rate,
        "atbRate": atb_rate,
        "suppliers": supplier_totals,
        "otherCalculations": other_calc,
        "totalsOverview": totals_display,
        "subtotal": totals["subtotal"],
        "deductions": deductions_display,
        "totalDeductions": totals["totalDeductions"],
        "financial": financial,
        "financialTotal": financial_total,
        "sectionF": section_f,
        "sectionFTotal": section_f_total,
        "grandTotal": grand_total,
        "totalBalance": totals["totalBalance"],
    }

    # Cache the full dashboard result for 30 seconds
    cache_set(cache_key, result, ttl_seconds=30)
    logger.info("Dashboard cached: %s", cache_key)
    return result
