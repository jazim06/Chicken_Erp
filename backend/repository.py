"""
Postgres data-access layer — drop-in replacement for the Firestore helpers
that used to live in firebase_client.py.

It exposes the SAME generic primitives the business logic in services.py calls
(get_document, list_documents, create_document, update_document,
delete_document, batch_update) and returns the IDENTICAL dict shapes — including
camelCase keys (loadWeight, supplierId, isDeleted, …), the `id` field, dates as
'YYYY-MM-DD' strings, and NUMERIC columns as floats. This keeps every
calculation in services.py byte-for-byte unchanged.

A per-collection registry maps each former Firestore collection to its ORM model
and the camelCase↔snake_case field mapping.
"""

from __future__ import annotations

import datetime as _dt

from sqlalchemy import Date as SADate
from sqlalchemy import DateTime as SADateTime
from sqlalchemy import Numeric as SANumeric
from sqlalchemy import select

from db import session_scope
from db_models import (
    AtbEntry,
    CustomFinancialEntry,
    DailyCarryover,
    DeductionEntry,
    FinancialEntry,
    PriceRate,
    Product,
    RmsEntry,
    SchoolRateEntry,
    SectionFEntry,
    SubParty,
    Supplier,
    WeightEntry,
)


# ---------------------------------------------------------------------------
# Per-collection registry: dict-key (camelCase) -> column (snake_case)
# ---------------------------------------------------------------------------

def _subparty_post_read(d: dict) -> None:
    """Reconstruct the legacy sub-party dict shape (partyName/today/total)."""
    d["partyName"] = d.get("name")
    d.setdefault("todayWeight", 0)
    d.setdefault("totalWeight", 0)


_CONFIG: dict[str, dict] = {
    "products": {
        "model": Product,
        "fields": {"name": "name", "image": "image", "description": "description"},
    },
    "suppliers": {
        "model": Supplier,
        "fields": {
            "name": "name", "productType": "product_type",
            "active": "active", "createdAt": "created_at",
        },
    },
    "sub_parties": {
        "model": SubParty,
        "fields": {"supplierId": "supplier_id", "name": "name", "createdAt": "created_at"},
        "post_read": _subparty_post_read,
    },
    "weight_entries": {
        "model": WeightEntry,
        "fields": {
            "supplierId": "supplier_id", "partyId": "party_id", "partyName": "party_name",
            "date": "date", "loadWeight": "load_weight", "emptyWeight": "empty_weight",
            "liveWeight": "live_weight", "isDeleted": "is_deleted",
            "createdAt": "created_at", "createdBy": "created_by",
        },
    },
    "price_rates": {
        "model": PriceRate,
        "fields": {
            "productTypeId": "product_type_id", "ratePerKg": "rate_per_kg",
            "effectiveFrom": "effective_from", "effectiveTo": "effective_to",
            "createdAt": "created_at",
        },
    },
    "financial_entries": {
        "model": FinancialEntry,
        "fields": {
            "customerName": "customer_name", "weight": "weight", "ratePerKg": "rate_per_kg",
            "amount": "amount", "calculationMethod": "calculation_method",
            "customFormulaId": "custom_formula_id", "section": "section",
            "sortOrder": "sort_order", "date": "date", "formula": "formula",
            "highlight": "highlight", "notes": "notes",
            "createdAt": "created_at", "createdBy": "created_by",
        },
    },
    "section_f_entries": {
        "model": SectionFEntry,
        "fields": {
            "name": "name", "amount": "amount", "weight": "weight",
            "retailRate": "retail_rate", "date": "date", "sortOrder": "sort_order",
            "createdAt": "created_at",
        },
    },
    "custom_financial_entries": {
        "model": CustomFinancialEntry,
        "fields": {
            "partyName": "party_name", "weight": "weight", "amount": "amount",
            "date": "date", "productType": "product_type", "createdAt": "created_at",
        },
    },
    "deduction_entries": {
        "model": DeductionEntry,
        "fields": {
            "partyId": "party_id", "partyName": "party_name", "supplierId": "supplier_id",
            "supplierName": "supplier_name", "amount": "amount", "date": "date",
            "createdAt": "created_at",
        },
    },
    "daily_carryover": {
        # NOTE: keys stay snake_case here — the existing code reads
        # docs[0].get("ys_amount") / ("today_stock_weight").
        "model": DailyCarryover,
        "fields": {
            "date": "date", "balance": "balance",
            "ys_amount": "ys_amount", "today_stock_weight": "today_stock_weight",
        },
    },
    "rms_entries": {
        "model": RmsEntry,
        "fields": {"date": "date", "productType": "product_type", "amount": "amount",
                   "createdAt": "created_at"},
    },
    "atb_entries": {
        "model": AtbEntry,
        "fields": {"date": "date", "productType": "product_type", "rate": "rate",
                   "createdAt": "created_at"},
    },
    "school_rate_entries": {
        "model": SchoolRateEntry,
        "fields": {"date": "date", "productType": "product_type", "rate": "rate",
                   "createdAt": "created_at"},
    },
}


# ---------------------------------------------------------------------------
# Value conversion (column type <-> python/JSON)
# ---------------------------------------------------------------------------

def _coerce_write(value, col_type):
    if value is None:
        return None
    if isinstance(col_type, SADateTime):
        return _dt.datetime.fromisoformat(value) if isinstance(value, str) else value
    if isinstance(col_type, SADate):
        return _dt.date.fromisoformat(value) if isinstance(value, str) else value
    return value  # Numeric accepts int/float; Boolean/Text/Integer pass through


def _read_value(value, col_type):
    if value is None:
        return None
    if isinstance(col_type, SADateTime):
        return value.isoformat()
    if isinstance(col_type, SADate):
        return value.isoformat()           # 'YYYY-MM-DD'
    if isinstance(col_type, SANumeric):
        return float(value)
    return value


def _to_dict(obj, cfg) -> dict:
    model = cfg["model"]
    cols = model.__table__.columns
    out = {"id": str(obj.id)}
    for dict_key, col_name in cfg["fields"].items():
        out[dict_key] = _read_value(getattr(obj, col_name), cols[col_name].type)
    if cfg.get("post_read"):
        cfg["post_read"](out)
    return out


def _to_columns(data: dict, cfg) -> dict:
    model = cfg["model"]
    cols = model.__table__.columns
    out = {}
    for dict_key, value in data.items():
        if dict_key == "id":
            continue
        col_name = cfg["fields"].get(dict_key)
        if col_name is None:
            continue  # drop denormalized/unknown keys (e.g. sub_parties.todayWeight)
        out[col_name] = _coerce_write(value, cols[col_name].type)
    return out


def _column_and_type(model, cfg, field):
    col_name = cfg["fields"].get(field, field if field == "id" else None)
    if col_name is None:
        raise KeyError(f"Unknown field '{field}' for {model.__tablename__}")
    return getattr(model, col_name), model.__table__.columns[col_name].type


def _apply_op(column, op, value):
    if op in ("==", "="):
        return column == value
    if op == "!=":
        return column != value
    if op == ">=":
        return column >= value
    if op == "<=":
        return column <= value
    if op == ">":
        return column > value
    if op == "<":
        return column < value
    if op == "in":
        return column.in_(value)
    raise ValueError(f"Unsupported filter operator: {op}")


# ---------------------------------------------------------------------------
# Generic primitives (same signatures the old firebase_client exposed)
# ---------------------------------------------------------------------------

def get_document(collection: str, doc_id: str) -> dict | None:
    cfg = _CONFIG[collection]
    with session_scope() as s:
        obj = s.get(cfg["model"], doc_id)
        return _to_dict(obj, cfg) if obj else None


def list_documents(
    collection: str,
    filters: list[tuple] | None = None,
    order_by: str | None = None,
    limit: int | None = None,
) -> list[dict]:
    cfg = _CONFIG[collection]
    model = cfg["model"]
    stmt = select(model)
    for field, op, value in (filters or []):
        column, col_type = _column_and_type(model, cfg, field)
        if op == "in":
            value = [_coerce_write(v, col_type) for v in value]
        else:
            value = _coerce_write(value, col_type)
        stmt = stmt.where(_apply_op(column, op, value))
    if order_by:
        column, _ = _column_and_type(model, cfg, order_by)
        stmt = stmt.order_by(column)
    if limit:
        stmt = stmt.limit(limit)
    with session_scope() as s:
        return [_to_dict(r, cfg) for r in s.execute(stmt).scalars().all()]


def create_document(collection: str, data: dict, doc_id: str | None = None) -> str:
    cfg = _CONFIG[collection]
    cols = _to_columns(data, cfg)
    if doc_id is not None:
        cols["id"] = doc_id
    with session_scope() as s:
        obj = cfg["model"](**cols)
        s.add(obj)
        s.flush()  # populates server-generated id via RETURNING
        return str(obj.id)


def update_document(collection: str, doc_id: str, data: dict) -> None:
    cfg = _CONFIG[collection]
    cols = _to_columns(data, cfg)
    with session_scope() as s:
        obj = s.get(cfg["model"], doc_id)
        if obj is None:
            return
        for key, value in cols.items():
            setattr(obj, key, value)


def delete_document(collection: str, doc_id: str) -> None:
    cfg = _CONFIG[collection]
    with session_scope() as s:
        obj = s.get(cfg["model"], doc_id)
        if obj is not None:
            s.delete(obj)


def batch_update(collection: str, updates: list[dict]) -> None:
    cfg = _CONFIG[collection]
    with session_scope() as s:
        for item in updates:
            item = dict(item)
            doc_id = item.pop("id")
            cols = _to_columns(item, cfg)
            obj = s.get(cfg["model"], doc_id)
            if obj is not None:
                for key, value in cols.items():
                    setattr(obj, key, value)


def upsert(collection: str, match: dict, values: dict) -> dict:
    """Insert-or-update one record matching `match` (replaces the old Firestore
    query-then-update-or-create blocks for RMS/ATB/School/price-rate)."""
    existing = list_documents(
        collection, filters=[(k, "==", v) for k, v in match.items()], limit=1
    )
    if existing:
        update_document(collection, existing[0]["id"], values)
        return get_document(collection, existing[0]["id"])
    new_id = create_document(collection, {**match, **values})
    return get_document(collection, new_id)
