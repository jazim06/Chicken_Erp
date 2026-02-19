"""
Pydantic models for request / response validation.
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, field_validator


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class CalculationMethod(str, Enum):
    STANDARD = "STANDARD"
    CUSTOM_FORMULA = "CUSTOM_FORMULA"


class EntrySection(str, Enum):
    MAIN = "MAIN"
    SECTION_F = "SECTION_F"


# ---------------------------------------------------------------------------
# Weight Entries
# ---------------------------------------------------------------------------

class WeightEntryCreate(BaseModel):
    supplierId: str
    partyId: str
    partyName: str
    date: str  # YYYY-MM-DD
    loadWeight: float
    emptyWeight: float

    @field_validator("loadWeight")
    @classmethod
    def load_must_be_positive(cls, v):
        if v <= 0:
            raise ValueError("loadWeight must be > 0")
        if v > 10_000:
            raise ValueError("loadWeight cannot exceed 10,000 kg")
        return round(v, 3)

    @field_validator("emptyWeight")
    @classmethod
    def empty_must_be_non_negative(cls, v):
        if v < 0:
            raise ValueError("emptyWeight must be >= 0")
        return round(v, 3)


class WeightEntryUpdate(BaseModel):
    loadWeight: Optional[float] = None
    emptyWeight: Optional[float] = None

    @field_validator("loadWeight")
    @classmethod
    def load_valid(cls, v):
        if v is not None:
            if v <= 0:
                raise ValueError("loadWeight must be > 0")
            if v > 10_000:
                raise ValueError("loadWeight cannot exceed 10,000 kg")
            return round(v, 3)
        return v

    @field_validator("emptyWeight")
    @classmethod
    def empty_valid(cls, v):
        if v is not None and v < 0:
            raise ValueError("emptyWeight must be >= 0")
        return round(v, 3) if v is not None else v


class WeightEntryResponse(BaseModel):
    id: str
    supplierId: str
    partyId: str
    partyName: str
    date: str
    loadWeight: float
    emptyWeight: float
    liveWeight: float
    isDeleted: bool = False
    createdAt: str
    createdBy: Optional[str] = None


# ---------------------------------------------------------------------------
# Financial Entries (Totals Overview + Financial Breakdown)
# ---------------------------------------------------------------------------

class FinancialEntryCreate(BaseModel):
    customerName: str = Field(..., min_length=1, max_length=255)
    weight: float
    date: str  # YYYY-MM-DD
    ratePerKg: Optional[float] = None
    calculationMethod: CalculationMethod = CalculationMethod.STANDARD
    customFormulaId: Optional[str] = None
    section: EntrySection = EntrySection.MAIN
    sortOrder: Optional[int] = None
    notes: Optional[str] = None

    @field_validator("weight")
    @classmethod
    def weight_positive(cls, v):
        if v <= 0:
            raise ValueError("weight must be > 0")
        return round(v, 3)


class FinancialEntryUpdate(BaseModel):
    customerName: Optional[str] = Field(None, min_length=1, max_length=255)
    weight: Optional[float] = None
    ratePerKg: Optional[float] = None
    amount: Optional[float] = None
    sortOrder: Optional[int] = None
    notes: Optional[str] = None

    @field_validator("weight")
    @classmethod
    def weight_valid(cls, v):
        if v is not None and v <= 0:
            raise ValueError("weight must be > 0")
        return round(v, 3) if v is not None else v


class FinancialEntryResponse(BaseModel):
    id: str
    customerName: str
    weight: float
    ratePerKg: float
    amount: float
    calculationMethod: str
    customFormulaId: Optional[str] = None
    section: str
    sortOrder: int
    date: str
    formula: Optional[str] = None
    highlight: bool = False
    notes: Optional[str] = None
    createdAt: Optional[str] = None


# ---------------------------------------------------------------------------
# Section F Entries
# ---------------------------------------------------------------------------

class SectionFEntryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    amount: float
    weight: Optional[float] = None
    date: str
    sortOrder: Optional[int] = None

    @field_validator("amount")
    @classmethod
    def amount_non_negative(cls, v):
        return round(v, 3)


class SectionFEntryUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    amount: Optional[float] = None
    weight: Optional[float] = None
    sortOrder: Optional[int] = None


class SectionFEntryResponse(BaseModel):
    id: str
    name: str
    amount: float
    weight: Optional[float] = None
    date: str
    sortOrder: int


# ---------------------------------------------------------------------------
# Deduction Entries
# ---------------------------------------------------------------------------

class DeductionEntryCreate(BaseModel):
    partyName: str = Field(..., min_length=1, max_length=255)
    partyId: Optional[str] = None
    supplierId: str
    supplierName: str
    amount: float
    date: str  # YYYY-MM-DD

    @field_validator("amount")
    @classmethod
    def amount_valid(cls, v):
        return round(v, 3)


class DeductionEntryUpdate(BaseModel):
    amount: Optional[float] = None
    partyName: Optional[str] = None

    @field_validator("amount")
    @classmethod
    def amount_valid(cls, v):
        return round(v, 3) if v is not None else v


# ---------------------------------------------------------------------------
# Price Rates
# ---------------------------------------------------------------------------

class PriceRateCreate(BaseModel):
    productTypeId: str
    ratePerKg: float
    effectiveFrom: str  # YYYY-MM-DD
    effectiveTo: Optional[str] = None  # YYYY-MM-DD or null = current

    @field_validator("ratePerKg")
    @classmethod
    def rate_positive(cls, v):
        if v <= 0:
            raise ValueError("ratePerKg must be > 0")
        return round(v, 2)


class PriceRateResponse(BaseModel):
    id: str
    productTypeId: str
    ratePerKg: float
    effectiveFrom: str
    effectiveTo: Optional[str] = None


# ---------------------------------------------------------------------------
# Suppliers
# ---------------------------------------------------------------------------

class SupplierCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    productType: str
    active: bool = True


class SubPartyCreate(BaseModel):
    partyName: str = Field(..., min_length=1, max_length=255)


class SupplierResponse(BaseModel):
    id: str
    name: str
    productType: str
    active: bool
    subParties: list[dict] = []


# ---------------------------------------------------------------------------
# Products
# ---------------------------------------------------------------------------

class ProductResponse(BaseModel):
    id: str
    name: str
    image: Optional[str] = None
    description: Optional[str] = None


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

class LoginRequest(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    uid: str
    email: str
    displayName: Optional[str] = None
    role: Optional[str] = None


# ---------------------------------------------------------------------------
# Dashboard aggregate response
# ---------------------------------------------------------------------------

class SubPartyWeight(BaseModel):
    partyId: str
    partyName: str
    liveWeight: float
    financialValue: float


class SupplierTotal(BaseModel):
    supplierId: str
    supplierName: str
    subParties: list[SubPartyWeight]
    totalWeight: float
    totalValue: float


class CustomerBalance(BaseModel):
    id: str
    name: str
    weight: float
    runningBalance: float
    highlight: bool = False


class TotalsOverview(BaseModel):
    totalAvailable: float
    customers: list[CustomerBalance]
    totalAllocated: float
    totalBalance: float


class FinancialItem(BaseModel):
    id: str
    name: str
    weight: float
    ratePerKg: float
    amount: float
    formula: Optional[str] = None
    highlight: bool = False
    calculationMethod: str = "STANDARD"


class SectionFItem(BaseModel):
    id: str
    name: str
    amount: float
    weight: Optional[float] = None


class DashboardResponse(BaseModel):
    date: str
    effectivePrRate: float
    suppliers: list[SupplierTotal]
    otherCalculations: dict  # {title, items}
    totalsOverview: TotalsOverview
    financial: list[FinancialItem]
    financialTotal: float
    sectionF: list[SectionFItem]
    sectionFTotal: float
    grandTotal: float
    totalBalance: float


# ---------------------------------------------------------------------------
# Reorder
# ---------------------------------------------------------------------------

class ReorderItem(BaseModel):
    id: str
    sortOrder: int


class ReorderRequest(BaseModel):
    items: list[ReorderItem]
