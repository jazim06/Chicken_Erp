"""
FastAPI application — Chicken ERP backend.

All routes are under /api.  Firebase Auth protects mutations;
read endpoints are accessible with an optional token.
"""

from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import sentry_sdk
from dotenv import load_dotenv
from fastapi import Body, Depends, FastAPI, HTTPException, Query, Request, status
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from starlette.middleware.cors import CORSMiddleware

from auth import create_access_token, get_current_user, get_optional_user
from cache import cache_stats
from firebase_client import initialize_firebase
from models import (
    DeductionEntryCreate,
    DeductionEntryUpdate,
    FinancialEntryCreate,
    FinancialEntryUpdate,
    LoginRequest,
    PriceRateCreate,
    ReorderRequest,
    SectionFEntryCreate,
    SectionFEntryUpdate,
    SubPartyCreate,
    SupplierCreate,
    UserResponse,
    WeightEntryCreate,
    WeightEntryUpdate,
)
from services import (
    add_sub_party,
    create_custom_financial_entry,
    create_deduction_entry,
    create_financial_entry,
    create_price_rate,
    create_section_f_entry,
    create_supplier,
    create_weight_entry,
    delete_custom_financial_entry,
    delete_deduction_entry,
    delete_financial_entry,
    delete_section_f_entry,
    delete_sub_party,
    get_all_products,
    get_all_suppliers,
    get_dashboard,
    get_deduction_entries,
    get_deduction_summary,
    get_effective_rate,
    get_analytics,
    get_entry_date_details,
    get_entry_dates,
    get_financial_entries,
    get_section_f_entries,
    get_supplier,
    get_weight_entries,
    reorder_financial_entries,
    save_daily_carryover,
    save_atb_entry,
    save_rms_entry,
    save_school_custom_rate,
    soft_delete_weight_entry,
    update_custom_financial_entry,
    update_deduction_entry,
    update_financial_entry,
    update_section_f_entry,
    update_weight_entry,
)

# ---------------------------------------------------------------------------
# Startup
# ---------------------------------------------------------------------------

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# ---------------------------------------------------------------------------
# Sentry — error tracking (no-op if SENTRY_DSN is empty)
# ---------------------------------------------------------------------------
_sentry_dsn = os.getenv("SENTRY_DSN", "")
if _sentry_dsn:
    sentry_sdk.init(
        dsn=_sentry_dsn,
        traces_sample_rate=0.2,
        environment=os.getenv("ENVIRONMENT", "development"),
    )

# ---------------------------------------------------------------------------
# Rate Limiter
# ---------------------------------------------------------------------------
_rate_per_min = os.getenv("RATE_LIMIT_PER_MINUTE", "60")
limiter = Limiter(key_func=get_remote_address, default_limits=[f"{_rate_per_min}/minute"])


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    initialize_firebase()
    logger.info("Firebase initialised — server ready.")
    yield
    # Shutdown (nothing to close for Firestore)


app = FastAPI(title="Chicken ERP API", lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


# ---------------------------------------------------------------------------
# CORS — origins from environment variable
# ---------------------------------------------------------------------------
_cors_origins = [
    o.strip()
    for o in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:3000,http://localhost:5173",
    ).split(",")
    if o.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=_cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO"),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


# ===================================================================
# HEALTH
# ===================================================================

@app.get("/api")
async def root():
    return {"message": "Chicken ERP API is running"}


@app.get("/api/health")
async def health_check():
    """Production health-check endpoint for Railway / uptime monitors."""
    return {
        "status": "healthy",
        "environment": os.getenv("ENVIRONMENT", "development"),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/api/cache-stats")
async def get_cache_stats():
    """Return cache statistics for debugging."""
    return cache_stats()


# ===================================================================
# AUTH
# ===================================================================

# Users loaded from environment (override defaults via .env)
_ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@supplier.com")
_ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")

_HARDCODED_USERS = {
    _ADMIN_EMAIL: {
        "password": _ADMIN_PASSWORD,
        "uid": "admin-001",
        "displayName": "Admin User",
        "role": "admin",
    },
}


@app.post("/api/auth/login")
@limiter.limit("5/minute")
async def login(request: Request):
    """
    Login — validates credentials, returns a signed JWT token.
    Rate-limited to 5 attempts per minute per IP.
    """
    try:
        data = await request.json()
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid JSON body")

    email = data.get("email", "")
    password = data.get("password", "")

    if not email or not password:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="email and password required")

    user = _HARDCODED_USERS.get(email)
    if not user or user["password"] != password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    # Issue a JWT token
    token = create_access_token(
        data={
            "uid": user["uid"],
            "email": email,
            "name": user["displayName"],
            "role": user["role"],
        }
    )

    return {
        "uid": user["uid"],
        "email": email,
        "displayName": user["displayName"],
        "role": user["role"],
        "token": token,
    }


# ===================================================================
# PRODUCTS
# ===================================================================

@app.get("/api/products")
async def list_products():
    """Return all product types."""
    return get_all_products()


# ===================================================================
# SUPPLIERS
# ===================================================================

@app.get("/api/suppliers")
async def list_suppliers(productType: Optional[str] = Query(None)):
    """List suppliers, optionally by product type."""
    return get_all_suppliers(product_type=productType)


@app.get("/api/suppliers/{supplier_id}")
async def read_supplier(supplier_id: str):
    supplier = get_supplier(supplier_id)
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return supplier


@app.post("/api/suppliers", status_code=201)
async def new_supplier(body: SupplierCreate, user: dict = Depends(get_current_user)):
    return create_supplier(body.model_dump())


# ===================================================================
# SUB-PARTIES
# ===================================================================

@app.post("/api/suppliers/{supplier_id}/sub-parties", status_code=201)
async def new_sub_party(
    supplier_id: str,
    body: SubPartyCreate,
    user: dict = Depends(get_current_user),
):
    try:
        return add_sub_party(supplier_id, body.partyName)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.delete("/api/suppliers/{supplier_id}/sub-parties/{sub_party_id}")
async def remove_sub_party(
    supplier_id: str,
    sub_party_id: str,
    user: dict = Depends(get_optional_user),
):
    try:
        delete_sub_party(supplier_id, sub_party_id)
        return {"success": True}
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


# ===================================================================
# WEIGHT ENTRIES
# ===================================================================

@app.get("/api/weight-entries")
async def list_weight_entries(
    date: str = Query(..., description="YYYY-MM-DD"),
    supplierId: Optional[str] = Query(None),
):
    return get_weight_entries(date, supplier_id=supplierId)


@app.post("/api/weight-entries", status_code=201)
async def new_weight_entry(body: WeightEntryCreate, user: dict = Depends(get_current_user)):
    try:
        return create_weight_entry(body.model_dump(), user_id=user["uid"])
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.patch("/api/weight-entries/{entry_id}")
async def patch_weight_entry(
    entry_id: str,
    body: WeightEntryUpdate,
    user: dict = Depends(get_current_user),
):
    try:
        return update_weight_entry(entry_id, body.model_dump(exclude_none=True))
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.delete("/api/weight-entries/{entry_id}")
async def remove_weight_entry(entry_id: str, user: dict = Depends(get_optional_user)):
    try:
        soft_delete_weight_entry(entry_id)
        return {"success": True}
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


# ===================================================================
# DASHBOARD
# ===================================================================

@app.get("/api/dashboard")
async def read_dashboard(
    date: str = Query(..., description="YYYY-MM-DD"),
    productType: str = Query("chicken"),
):
    """Return the full aggregated dashboard for a date."""
    try:
        return get_dashboard(date, product_type=productType)
    except Exception as e:
        logger.error(f"Dashboard error for date={date}, productType={productType}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Dashboard calculation failed: {str(e)}")


@app.post("/api/dashboard/confirm")
async def confirm_dashboard(
    date: str = Query(..., description="YYYY-MM-DD"),
    productType: str = Query("chicken"),
    user: dict = Depends(get_current_user),
):
    """
    Confirm dashboard = save daily carryover for the next day.
    Uses the current totalBalance as tomorrow's M.Iruppu.
    """
    dashboard = get_dashboard(date, product_type=productType)
    save_daily_carryover(date, dashboard["totalBalance"])
    return {"confirmed": True, "carryover": dashboard["totalBalance"]}


@app.put("/api/carryover")
async def set_carryover(
    request: Request,
    user: dict = Depends(get_current_user),
):
    """
    Manually set the daily carryover (Yesterday Stock) for a given date.
    Body: { "date": "YYYY-MM-DD", "balance": 123.456 }
    """
    body = await request.json()
    date = body.get("date")
    balance = float(body.get("balance", 0))
    if not date:
        raise HTTPException(status_code=400, detail="date is required")
    save_daily_carryover(date, balance)
    return {"success": True, "date": date, "balance": balance}


# ===================================================================
# FINANCIAL ENTRIES
# ===================================================================

@app.get("/api/financial-entries")
async def list_financial_entries_route(
    date: str = Query(...),
    section: str = Query("MAIN"),
):
    return get_financial_entries(date, section=section)


@app.post("/api/financial-entries", status_code=201)
async def new_financial_entry(
    body: FinancialEntryCreate,
    user: dict = Depends(get_current_user),
):
    rate = get_effective_rate("chicken", body.date)
    try:
        return create_financial_entry(body.model_dump(), rate=rate, user_id=user["uid"])
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.patch("/api/financial-entries/{entry_id}")
async def patch_financial_entry(
    entry_id: str,
    body: FinancialEntryUpdate,
    user: dict = Depends(get_current_user),
):
    try:
        return update_financial_entry(entry_id, body.model_dump(exclude_none=True))
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.delete("/api/financial-entries/{entry_id}")
async def remove_financial_entry(entry_id: str, user: dict = Depends(get_current_user)):
    try:
        delete_financial_entry(entry_id)
        return {"success": True}
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.patch("/api/financial-entries/reorder")
async def reorder_entries(body: ReorderRequest, user: dict = Depends(get_current_user)):
    reorder_financial_entries([item.model_dump() for item in body.items])
    return {"success": True}


# ===================================================================
# SECTION F ENTRIES
# ===================================================================

@app.get("/api/section-f-entries")
async def list_section_f_entries_route(date: str = Query(...)):
    return get_section_f_entries(date)


@app.post("/api/section-f-entries", status_code=201)
async def new_section_f_entry(body: SectionFEntryCreate, user: dict = Depends(get_current_user)):
    return create_section_f_entry(body.model_dump())


@app.patch("/api/section-f-entries/{entry_id}")
async def patch_section_f_entry(
    entry_id: str,
    body: SectionFEntryUpdate,
    user: dict = Depends(get_current_user),
):
    try:
        return update_section_f_entry(entry_id, body.model_dump(exclude_none=True))
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.delete("/api/section-f-entries/{entry_id}")
async def remove_section_f_entry(entry_id: str, user: dict = Depends(get_current_user)):
    try:
        delete_section_f_entry(entry_id)
        return {"success": True}
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


# ===================================================================
# PRICE RATES
# ===================================================================

@app.get("/api/price-rates")
async def read_price_rate(
    date: str = Query(...),
    productTypeId: str = Query("chicken"),
):
    rate = get_effective_rate(productTypeId, date)
    return {"productTypeId": productTypeId, "date": date, "ratePerKg": rate}


@app.post("/api/price-rates", status_code=201)
async def new_price_rate(body: PriceRateCreate, user: dict = Depends(get_current_user)):
    doc_id = create_price_rate(body.model_dump())
    return {"id": doc_id, **body.model_dump()}


# ===================================================================
# RMS ENTRIES
# ===================================================================

@app.put("/api/rms-entries")
async def upsert_rms_entry(
    request: Request,
    user: dict = Depends(get_current_user),
):
    """Save or update the RMS amount (₹) for a given date."""
    body = await request.json()
    amount = float(body.get("amount", 0))
    date = body.get("date", datetime.now(timezone.utc).strftime("%Y-%m-%d"))
    product_type = body.get("productType", "chicken")
    result = save_rms_entry(date, product_type, amount)
    return result


# ===================================================================
# ATB (Amount To Be Paid) ENTRIES
# ===================================================================

@app.put("/api/atb-entries")
async def upsert_atb_entry(
    request: Request,
    user: dict = Depends(get_current_user),
):
    """Save or update the ATB rate for a given date."""
    body = await request.json()
    rate = float(body.get("rate", 0))
    date = body.get("date", datetime.now(timezone.utc).strftime("%Y-%m-%d"))
    product_type = body.get("productType", "chicken")
    result = save_atb_entry(date, product_type, rate)
    return result


# ===================================================================
# CUSTOM FINANCIAL ENTRIES
# ===================================================================

@app.post("/api/custom-financial-entries", status_code=201)
async def new_custom_financial_entry(
    request: Request,
    user: dict = Depends(get_current_user),
):
    """Create a custom financial entry (user-added party in breakdown)."""
    body = await request.json()
    return create_custom_financial_entry(body)


@app.patch("/api/custom-financial-entries/{entry_id}")
async def patch_custom_financial_entry(
    entry_id: str,
    request: Request,
    user: dict = Depends(get_current_user),
):
    """Update weight/amount of a custom financial entry."""
    body = await request.json()
    try:
        return update_custom_financial_entry(entry_id, body)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.delete("/api/custom-financial-entries/{entry_id}")
async def remove_custom_financial_entry(
    entry_id: str,
    user: dict = Depends(get_current_user),
):
    """Delete a custom financial entry."""
    try:
        delete_custom_financial_entry(entry_id)
        return {"success": True}
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


# ===================================================================
# SCHOOL CUSTOM RATE
# ===================================================================

@app.put("/api/school-rate")
async def upsert_school_rate(
    request: Request,
    user: dict = Depends(get_current_user),
):
    """Set / update School custom rate for a date."""
    body = await request.json()
    date = body.get("date", datetime.now(timezone.utc).strftime("%Y-%m-%d"))
    product = body.get("productTypeId", "chicken")
    rate_val = float(body.get("rate", 0))
    return save_school_custom_rate(date, product, rate_val)


@app.put("/api/price-rates")
async def upsert_price_rate(request: Request, user: dict = Depends(get_current_user)):
    """Set / update today's rate. Creates a new rate doc or updates existing one."""
    body = await request.json()
    rate_val = float(body.get("ratePerKg", 0))
    date = body.get("date", datetime.now(timezone.utc).strftime("%Y-%m-%d"))
    product = body.get("productTypeId", "chicken")

    # Try to find existing rate for this exact date
    from firebase_client import get_firestore_client
    from google.cloud.firestore_v1.base_query import FieldFilter
    db = get_firestore_client()
    existing = (
        db.collection("price_rates")
        .where(filter=FieldFilter("productTypeId", "==", product))
        .where(filter=FieldFilter("effectiveFrom", "==", date))
        .limit(1)
        .stream()
    )
    doc = next(existing, None)
    if doc:
        db.collection("price_rates").document(doc.id).update({"ratePerKg": rate_val})
        return {"id": doc.id, "ratePerKg": rate_val, "updated": True}
    else:
        doc_id = create_price_rate({
            "productTypeId": product,
            "ratePerKg": rate_val,
            "effectiveFrom": date,
            "effectiveTo": None,
        })
        return {"id": doc_id, "ratePerKg": rate_val, "updated": False}


# ===================================================================
# DEDUCTION ENTRIES
# ===================================================================

@app.get("/api/deduction-entries")
async def list_deduction_entries_route(date: str = Query(...)):
    return get_deduction_entries(date)


@app.get("/api/deduction-summary")
async def get_deduction_summary_route(date: str = Query(...)):
    """Lightweight: deductions + totalDeductions/totalBalance for a date."""
    return get_deduction_summary(date)


@app.post("/api/deduction-entries", status_code=201)
async def new_deduction_entry(
    body: DeductionEntryCreate,
    user: dict = Depends(get_current_user),
):
    return create_deduction_entry(body.model_dump())


@app.patch("/api/deduction-entries/{entry_id}")
async def patch_deduction_entry(
    entry_id: str,
    body: DeductionEntryUpdate,
    user: dict = Depends(get_current_user),
):
    try:
        return update_deduction_entry(entry_id, body.model_dump(exclude_none=True))
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.delete("/api/deduction-entries/{entry_id}")
async def remove_deduction_entry(entry_id: str, user: dict = Depends(get_current_user)):
    try:
        delete_deduction_entry(entry_id)
        return {"success": True}
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


# ===================================================================
# ENTRY DATES (log history / streak calendar)
# ===================================================================

@app.get("/api/entry-dates")
async def list_entry_dates(
    startDate: str = Query(..., description="YYYY-MM-DD"),
    endDate: str = Query(..., description="YYYY-MM-DD"),
    supplierId: Optional[str] = Query(None),
):
    """Return distinct dates that have weight entries in a range."""
    dates = get_entry_dates(startDate, endDate, supplier_id=supplierId)
    return {"dates": dates}


@app.get("/api/entry-dates/{date}/details")
async def entry_date_details(date: str):
    """Brief summary for a single date: supplier count + total weight."""
    return get_entry_date_details(date)


# ===================================================================
# ANALYTICS
# ===================================================================

@app.get("/api/analytics")
async def analytics(
    startDate: str = Query(..., description="YYYY-MM-DD"),
    endDate: str = Query(..., description="YYYY-MM-DD"),
    productType: str = Query("chicken"),
):
    """Return aggregated analytics for the given date range."""
    return get_analytics(startDate, endDate, product_type=productType)


@app.post("/api/deduction-entries/bulk", status_code=201)
async def bulk_update_deductions(
    request: Request,
    user: dict = Depends(get_current_user)
):
    """Replace all deductions for a date with new batch."""
    data = await request.json()
    date = data.get("date")
    deductions = data.get("deductions", [])
    
    if not date:
        raise HTTPException(400, "date required")
    
    # Delete existing deductions for this date
    existing = get_deduction_entries(date)
    for ded in existing:
        delete_deduction_entry(ded["id"])
    
    # Create new deductions
    created = []
    for ded in deductions:
        entry = create_deduction_entry({
            "partyName": ded["partyName"],
            "supplierId": "",
            "supplierName": "",
            "amount": ded["amount"],
            "date": date,
        })
        created.append(entry)
    
    return {"success": True, "count": len(created)}