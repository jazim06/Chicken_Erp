"""
Business-logic services for the Chicken ERP dashboard.

All domain calculations live here — weight summation, stock allocation,
running-balance sequencing, financial breakdown, grand total.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

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
PRICE_RATES = "price_rates"
SUPPLIERS = "suppliers"
SUB_PARTIES = "sub_parties"
PRODUCTS = "products"
USERS = "users"

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

def get_effective_rate(product_type_id: str, date: str) -> float:
    """
    Return the effective rate (₹/kg) for a product type on a given date.
    Queries price_rates where effectiveFrom <= date and
    (effectiveTo is null OR effectiveTo >= date).
    Falls back to 0 if no rate found.
    """
    # Fetch all rates for the product type and filter in Python to avoid composite index
    rates = list_documents(
        PRICE_RATES,
        filters=[("productTypeId", "==", product_type_id)],
    )
    
    # Filter by date range in Python
    valid = [
        r for r in rates
        if r.get("effectiveFrom", "") <= date and 
           (r.get("effectiveTo") is None or r["effectiveTo"] >= date)
    ]
    
    if valid:
        # Pick the most recent effectiveFrom
        valid.sort(key=lambda x: x.get("effectiveFrom", ""))
        return valid[-1]["ratePerKg"]
    return 0.0


def create_price_rate(data: dict) -> str:
    """Create a new price rate entry."""
    data["createdAt"] = datetime.now(timezone.utc).isoformat()
    return create_document(PRICE_RATES, data)


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
    return doc


def update_weight_entry(entry_id: str, data: dict) -> dict:
    """Update a weight entry. Recalculates liveWeight if weights change."""
    existing = get_document(WEIGHT_ENTRIES, entry_id)
    if not existing:
        raise LookupError(f"Weight entry {entry_id} not found")

    load_w = data.get("loadWeight", existing["loadWeight"])
    empty_w = data.get("emptyWeight", existing["emptyWeight"])
    if load_w <= empty_w:
        raise ValueError("loadWeight must be greater than emptyWeight")

    updates = {}
    if "loadWeight" in data:
        updates["loadWeight"] = data["loadWeight"]
    if "emptyWeight" in data:
        updates["emptyWeight"] = data["emptyWeight"]
    updates["liveWeight"] = round(load_w - empty_w, 3)

    update_document(WEIGHT_ENTRIES, entry_id, updates)
    existing.update(updates)
    return existing


def soft_delete_weight_entry(entry_id: str) -> None:
    """Soft-delete a weight entry (set isDeleted=True)."""
    existing = get_document(WEIGHT_ENTRIES, entry_id)
    if not existing:
        raise LookupError(f"Weight entry {entry_id} not found")
    update_document(WEIGHT_ENTRIES, entry_id, {"isDeleted": True})


def get_weight_entries(date: str, supplier_id: str | None = None) -> list[dict]:
    """Return weight entries for a date, optionally filtered by supplier."""
    filters = [("date", "==", date), ("isDeleted", "==", False)]
    if supplier_id:
        filters.append(("supplierId", "==", supplier_id))
    return list_documents(WEIGHT_ENTRIES, filters=filters)


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

    # Resolve supplier names from collection
    all_suppliers = list_documents(SUPPLIERS)
    for s in all_suppliers:
        supplier_names[s["id"]] = s["name"]

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
# DEDUCTION ENTRIES CRUD
# ===================================================================

def create_deduction_entry(data: dict) -> dict:
    """Create a deduction entry for a sub-party on a given date."""
    doc = {
        "partyName": data["partyName"],
        "supplierId": data["supplierId"],
        "supplierName": data["supplierName"],
        "amount": data["amount"],
        "date": data["date"],
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    doc_id = create_document(DEDUCTION_ENTRIES, doc)
    doc["id"] = doc_id
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
    for field in ("amount", "partyName"):
        if field in data and data[field] is not None:
            updates[field] = data[field]

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


# ===================================================================
# SUPPLIER / PRODUCT CRUD
# ===================================================================

def get_all_products() -> list[dict]:
    """Return all products. Falls back to hardcoded seed data if Firestore is empty."""
    docs = list_documents(PRODUCTS)
    return docs if docs else _FALLBACK_PRODUCTS


def get_all_suppliers(product_type: str | None = None) -> list[dict]:
    """Return suppliers, optionally filtered by productType. Falls back to hardcoded seed data if Firestore is empty."""
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
    
    return suppliers


def get_supplier(supplier_id: str) -> dict | None:
    """Return a single supplier with sub-parties and today's weight computed from entries."""
    supplier = get_document(SUPPLIERS, supplier_id)
    if supplier:
        subs = list_documents(
            SUB_PARTIES,
            filters=[("supplierId", "==", supplier_id)],
        )
        # Compute todayWeight from actual weight entries
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        today_entries = get_weight_entries(today, supplier_id=supplier_id)
        # Build a mapping partyId → total live weight
        party_weights = {}
        for entry in today_entries:
            pid = entry.get("partyId", "")
            party_weights[pid] = party_weights.get(pid, 0) + entry.get("liveWeight", 0)
        for sub in subs:
            sub["todayWeight"] = round(party_weights.get(sub["id"], 0), 3)
        supplier["subParties"] = subs
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
    return doc


def delete_sub_party(supplier_id: str, sub_party_id: str) -> None:
    """Delete a sub-party."""
    existing = get_document(SUB_PARTIES, sub_party_id)
    if not existing or existing.get("supplierId") != supplier_id:
        raise LookupError(f"Sub-party {sub_party_id} not found under supplier {supplier_id}")
    delete_document(SUB_PARTIES, sub_party_id)


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


# ===================================================================
# FULL DASHBOARD AGGREGATION
# ===================================================================

def get_dashboard(date: str, product_type: str = "chicken") -> dict:
    """
    Build the complete dashboard state for a given date.
    Orchestrates: supplier totals → totals overview → financial breakdown
    → section F → grand total.
    """
    # 1. Effective rate
    rate = get_effective_rate(product_type, date)

    # 2. Supplier totals (left column)
    #    - Regular suppliers (JOSEPH, SADIQ, etc.) use load/empty/live
    #    - "OTHER CALCULATION" is Section-F (retail — only actual weight)
    all_supplier_totals = calculate_supplier_totals(date, rate)
    supplier_totals = [s for s in all_supplier_totals if s["name"] != "OTHER CALCULATION"]
    other_calc_supplier = [s for s in all_supplier_totals if s["name"] == "OTHER CALCULATION"]

    # 3. Totals overview (center column — only regular suppliers)
    totals = calculate_totals_overview(date, supplier_totals)

    # 4. Financial breakdown (right column) — each sub-party × rate
    #    Custom formulas for specific parties:
    #      Parveen:     (Paper rate - 3) × weight
    #      Anna City:   (Weight × 1.5) × (Paper rate + 4)
    #      Saleem Bhai: (Weight × 1.6) × (Paper rate + 5)
    CUSTOM_FORMULAS = {
        "Parveen": {
            "calc": lambda w, r: round((r - 3) * w, 2),
            "label": "(Paper rate - 3) × Weight",
        },
        "Anna City": {
            "calc": lambda w, r: round((w * 1.5) * (r + 4), 2),
            "label": "(Weight × 1.5) × (Paper rate + 4)",
        },
        "Saleem Bhai": {
            "calc": lambda w, r: round((w * 1.6) * (r + 5), 2),
            "label": "(Weight × 1.6) × (Paper rate + 5)",
        },
    }

    financial = []
    financial_total = 0.0
    for supplier in supplier_totals:
        for row in supplier["rows"]:
            live_weight = row["c"]  # Column C = live weight
            party_name = row["party"]
            formula_info = CUSTOM_FORMULAS.get(party_name)
            if formula_info:
                amount = formula_info["calc"](live_weight, rate)
                formula_label = formula_info["label"]
            else:
                amount = round(live_weight * rate, 2)
                formula_label = None
            financial.append({
                "id": row["id"],
                "name": party_name,
                "weight": live_weight,
                "ratePerKg": rate,
                "amount": amount,
                "supplierName": supplier["name"],
                "formula": formula_label,
            })
            financial_total += amount
    # Also add Other Calculation sub-parties (retail weight × rate)
    for supplier in other_calc_supplier:
        for row in supplier["rows"]:
            weight = row["c"]  # For Section F, C = actual weight entered
            party_name = row["party"]
            formula_info = CUSTOM_FORMULAS.get(party_name)
            if formula_info:
                amount = formula_info["calc"](weight, rate)
                formula_label = formula_info["label"]
            else:
                amount = round(weight * rate, 2)
                formula_label = None
            financial.append({
                "id": row["id"],
                "name": party_name,
                "weight": weight,
                "ratePerKg": rate,
                "amount": amount,
                "supplierName": supplier["name"],
                "formula": formula_label,
            })
            financial_total += amount
    financial_total = round(financial_total, 2)

    # 5. Section F (other calculations)
    sf_entries = get_section_f_entries(date)
    section_f = [
        {"id": e["id"], "name": e["name"], "amount": e["amount"], "weight": e.get("weight")}
        for e in sf_entries
    ]
    section_f_total = round(sum(e["amount"] for e in sf_entries), 3)

    # 6. Grand total
    grand_total = round(financial_total + section_f_total, 2)

    # 7. Build totals overview entries for display (regular suppliers only)
    totals_display = []
    for s in supplier_totals:
        totals_display.append({
            "id": f"sup_{s['id']}",
            "party": s["name"],
            "total": s["totalWeight"],
        })
    # Add carryover if exists
    if totals.get("carryover", 0) > 0:
        totals_display.append({
            "id": "carryover",
            "party": "M.Iruppu",
            "total": totals["carryover"],
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

    return {
        "date": date,
        "effectivePrRate": rate,
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
