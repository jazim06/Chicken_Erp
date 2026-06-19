"""
SQLAlchemy ORM models — the relational schema for Chicken ERP on Postgres.

One model per former Firestore collection. Columns are clean snake_case;
the repository layer maps them to the exact camelCase dict keys the existing
business logic in services.py expects, so no calculation code changes.

Money / weights use NUMERIC (returned as float by the repository); dates use
DATE (returned as 'YYYY-MM-DD' strings). Every table has a string id (uuid for
all except products, which keeps a human-readable text id like 'chicken').
"""

from __future__ import annotations

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import UUID

from db import Base

_UUID_PK = dict(primary_key=True, server_default=text("gen_random_uuid()"))


class Product(Base):
    __tablename__ = "products"
    id = Column(Text, primary_key=True)              # 'chicken', 'mutton'
    name = Column(Text, nullable=False)
    image = Column(Text)
    description = Column(Text)


class Supplier(Base):
    __tablename__ = "suppliers"
    id = Column(UUID(as_uuid=False), **_UUID_PK)
    name = Column(Text, nullable=False)
    product_type = Column(Text, nullable=False)
    active = Column(Boolean, nullable=False, server_default=text("true"))
    created_at = Column(DateTime(timezone=True), server_default=text("now()"))


class SubParty(Base):
    __tablename__ = "sub_parties"
    id = Column(UUID(as_uuid=False), **_UUID_PK)
    supplier_id = Column(
        UUID(as_uuid=False),
        ForeignKey("suppliers.id", ondelete="CASCADE"),
        nullable=False,
    )
    name = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=text("now()"))


class WeightEntry(Base):
    __tablename__ = "weight_entries"
    id = Column(UUID(as_uuid=False), **_UUID_PK)
    supplier_id = Column(UUID(as_uuid=False), ForeignKey("suppliers.id"), nullable=False)
    party_id = Column(UUID(as_uuid=False), ForeignKey("sub_parties.id"))
    party_name = Column(Text, nullable=False)
    date = Column(Date, nullable=False, index=True)
    load_weight = Column(Numeric(12, 3), nullable=False)
    empty_weight = Column(Numeric(12, 3), nullable=False, server_default=text("0"))
    live_weight = Column(Numeric(12, 3), nullable=False)
    is_deleted = Column(Boolean, nullable=False, server_default=text("false"))
    created_at = Column(DateTime(timezone=True), server_default=text("now()"))
    created_by = Column(Text)


class PriceRate(Base):
    __tablename__ = "price_rates"
    id = Column(UUID(as_uuid=False), **_UUID_PK)
    product_type_id = Column(Text, nullable=False)
    rate_per_kg = Column(Numeric(12, 2), nullable=False)
    effective_from = Column(Date, nullable=False)
    effective_to = Column(Date)
    created_at = Column(DateTime(timezone=True), server_default=text("now()"))


class FinancialEntry(Base):
    __tablename__ = "financial_entries"
    id = Column(UUID(as_uuid=False), **_UUID_PK)
    customer_name = Column(Text, nullable=False)
    weight = Column(Numeric(12, 3))
    rate_per_kg = Column(Numeric(12, 2))
    amount = Column(Numeric(14, 2))
    calculation_method = Column(Text, server_default=text("'STANDARD'"))
    custom_formula_id = Column(Text)
    section = Column(Text, nullable=False, server_default=text("'MAIN'"))
    sort_order = Column(Integer)
    date = Column(Date, nullable=False)
    formula = Column(Text)
    highlight = Column(Boolean, server_default=text("false"))
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=text("now()"))
    created_by = Column(Text)


class SectionFEntry(Base):
    __tablename__ = "section_f_entries"
    id = Column(UUID(as_uuid=False), **_UUID_PK)
    name = Column(Text, nullable=False)
    amount = Column(Numeric(14, 2))
    weight = Column(Numeric(12, 3))
    retail_rate = Column(Numeric(12, 2))
    date = Column(Date, nullable=False)
    sort_order = Column(Integer)
    created_at = Column(DateTime(timezone=True), server_default=text("now()"))


class CustomFinancialEntry(Base):
    __tablename__ = "custom_financial_entries"
    id = Column(UUID(as_uuid=False), **_UUID_PK)
    party_name = Column(Text, nullable=False)
    weight = Column(Numeric(12, 3))
    amount = Column(Numeric(14, 2))
    date = Column(Date, nullable=False)
    product_type = Column(Text, nullable=False, server_default=text("'chicken'"))
    created_at = Column(DateTime(timezone=True), server_default=text("now()"))


class DeductionEntry(Base):
    __tablename__ = "deduction_entries"
    id = Column(UUID(as_uuid=False), **_UUID_PK)
    party_id = Column(Text)                          # loose: may be null / non-uuid
    party_name = Column(Text, nullable=False)
    supplier_id = Column(Text)                       # loose text: bulk endpoint writes ""
    supplier_name = Column(Text)
    amount = Column(Numeric(14, 3), nullable=False)  # holds a WEIGHT in the breakdown
    date = Column(Date, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=text("now()"))


class DailyCarryover(Base):
    __tablename__ = "daily_carryover"
    id = Column(UUID(as_uuid=False), **_UUID_PK)
    date = Column(Date, nullable=False, unique=True)
    balance = Column(Numeric(14, 3), nullable=False, server_default=text("0"))
    ys_amount = Column(Numeric(14, 2))
    today_stock_weight = Column(Numeric(12, 3))


class RmsEntry(Base):
    __tablename__ = "rms_entries"
    __table_args__ = (UniqueConstraint("date", "product_type"),)
    id = Column(UUID(as_uuid=False), **_UUID_PK)
    date = Column(Date, nullable=False)
    product_type = Column(Text, nullable=False, server_default=text("'chicken'"))
    amount = Column(Numeric(14, 2), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=text("now()"))


class AtbEntry(Base):
    __tablename__ = "atb_entries"
    __table_args__ = (UniqueConstraint("date", "product_type"),)
    id = Column(UUID(as_uuid=False), **_UUID_PK)
    date = Column(Date, nullable=False)
    product_type = Column(Text, nullable=False)
    rate = Column(Numeric(12, 2), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=text("now()"))


class SchoolRateEntry(Base):
    __tablename__ = "school_rate_entries"
    __table_args__ = (UniqueConstraint("date", "product_type"),)
    id = Column(UUID(as_uuid=False), **_UUID_PK)
    date = Column(Date, nullable=False)
    product_type = Column(Text, nullable=False)
    rate = Column(Numeric(12, 2), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=text("now()"))
