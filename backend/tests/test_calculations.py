"""
Parity tests for the core dashboard calculations.

These exercise the pure calculation builders in services.py with crafted inputs
(DB-touching helpers are monkeypatched), so they run WITHOUT a database and
prove the business logic is unchanged by the Firestore→Postgres migration.
"""

import services


def test_supplier_totals_columns_and_value(monkeypatch):
    monkeypatch.setattr(services, "_get_supplier_names", lambda: {"s1": "JOSEPH"})
    entries = [
        {"supplierId": "s1", "partyId": "p1", "partyName": "RMS",
         "loadWeight": 100, "emptyWeight": 10, "liveWeight": 90},
        {"supplierId": "s1", "partyId": "p2", "partyName": "Thamim",
         "loadWeight": 50, "emptyWeight": 5, "liveWeight": 45},
    ]
    result = services._build_supplier_totals(entries, rate=100)

    assert len(result) == 1
    sup = result[0]
    assert sup["name"] == "JOSEPH"
    assert sup["totalWeight"] == 135.0          # Σ live weight
    assert sup["totalValue"] == 13500.0         # totalWeight × rate
    # rows ordered by the fixed JOSEPH party order (RMS before Thamim)
    assert [r["party"] for r in sup["rows"]] == ["RMS", "Thamim"]
    rms = sup["rows"][0]
    assert (rms["a"], rms["b"], rms["c"]) == (100.0, 10.0, 90.0)


def _patch_breakdown_io(monkeypatch):
    monkeypatch.setattr(services, "get_rms_entry", lambda *a, **k: None)
    monkeypatch.setattr(services, "get_custom_financial_entries", lambda *a, **k: [])
    monkeypatch.setattr(services, "_get_school_custom_rate", lambda *a, **k: None)


def test_financial_breakdown_order_and_formulas(monkeypatch):
    _patch_breakdown_io(monkeypatch)
    rows, total = services._build_financial_breakdown(
        deductions=[{"id": "d1", "partyName": "Thamim", "amount": 10}],
        rate=100, date="2026-06-19", product_type="chicken",
        other_calc_items=[{"name": "Parveen", "value": 5}],
        supplier_parties=[{"name": "Parveen"}],
        today_stock_weight=2,
    )

    # strict ordering: RMS first, Today Stock always last
    assert rows[0]["name"] == "RMS"
    assert rows[-1]["name"] == "Today Stock"

    by_name = {r["name"]: r for r in rows}
    assert by_name["Thamim"]["amount"] == 1000.0       # deduction weight × PR = 10×100
    assert by_name["Parveen"]["amount"] == 485.0       # (PR-3)×W = 97×5
    assert "(PR-3)" in by_name["Parveen"]["formula"]
    assert by_name["Today Stock"]["amount"] == 180.0   # W×(PR-10) = 2×90
    assert total == 1665.0


def test_other_calc_anna_city_formula(monkeypatch):
    _patch_breakdown_io(monkeypatch)
    rows, total = services._build_financial_breakdown(
        deductions=[], rate=100, date="2026-06-19", product_type="chicken",
        other_calc_items=[{"name": "Anna City", "value": 4}],
        supplier_parties=[],
        today_stock_weight=0,
    )
    by_name = {r["name"]: r for r in rows}
    assert by_name["Anna City"]["amount"] == 624.0     # (W×1.5)×(PR+4) = 6×104
    assert total == 624.0


def test_no_dedupe_double_count(monkeypatch):
    """A party present as both a supplier sub-party and an other-calc item
    must appear once (de-duplicated by lowercased name)."""
    _patch_breakdown_io(monkeypatch)
    rows, _ = services._build_financial_breakdown(
        deductions=[], rate=100, date="2026-06-19", product_type="chicken",
        other_calc_items=[{"name": "Parveen", "value": 5}],
        supplier_parties=[{"name": "Parveen"}],
        today_stock_weight=0,
    )
    parveen_rows = [r for r in rows if r["name"] == "Parveen"]
    assert len(parveen_rows) == 1
