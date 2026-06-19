"""
Seed initial config data into Postgres (products, suppliers, sub-parties,
price rates) — the Postgres equivalent of the old seed_firestore.py.

Usage (after init_db.py):
    cd backend && python seed_db.py

Safe to run on a fresh database. If products already exist it skips, to avoid
creating duplicate suppliers.
"""

from datetime import datetime, timezone

from repository import create_document, get_document, list_documents

PRODUCTS = "products"
SUPPLIERS = "suppliers"
SUB_PARTIES = "sub_parties"
PRICE_RATES = "price_rates"

_NOW = datetime.now(timezone.utc).isoformat()

_PRODUCTS = [
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

# (supplier name, productType)
_SUPPLIERS = [
    ("JOSEPH", "chicken"),
    ("SADIQ", "chicken"),
    ("OTHER CALCULATION", "chicken"),
    ("RAHEEM", "mutton"),
]

_SUB_PARTIES = {
    "JOSEPH": ["RMS", "Thamim", "Irfan", "Rajendran", "BBC", "Parveen"],
    "SADIQ": ["RMS", "Masthan"],
    "OTHER CALCULATION": [
        "Anas", "Anna City", "B.Less", "Sk", "RMS",
        "Saleem Bhai", "Ramesh", "School", "110", "Daas", "Mahendran",
    ],
    "RAHEEM": ["Farm A", "Farm B"],
}

_PRICE_RATES = [
    {"productTypeId": "chicken", "ratePerKg": 177, "effectiveFrom": "2026-01-01", "effectiveTo": None},
    {"productTypeId": "mutton", "ratePerKg": 650, "effectiveFrom": "2026-01-01", "effectiveTo": None},
]


def seed() -> None:
    if get_document(PRODUCTS, "chicken") or list_documents(SUPPLIERS, limit=1):
        print("⚠️  Data already present — skipping seed (drop tables to reseed).")
        return

    for p in _PRODUCTS:
        data = dict(p)
        pid = data.pop("id")
        create_document(PRODUCTS, data, doc_id=pid)
        print(f"  Product: {data['name']} → {pid}")

    for name, product_type in _SUPPLIERS:
        sid = create_document(
            SUPPLIERS,
            {"name": name, "productType": product_type, "active": True, "createdAt": _NOW},
        )
        print(f"  Supplier: {name} → {sid}")
        for party in _SUB_PARTIES.get(name, []):
            create_document(SUB_PARTIES, {"supplierId": sid, "name": party, "createdAt": _NOW})
            print(f"    Sub-party: {party}")

    for r in _PRICE_RATES:
        create_document(PRICE_RATES, {**r, "createdAt": _NOW})
        print(f"  Rate: {r['productTypeId']} = ₹{r['ratePerKg']}/kg")

    print("\n✅  Seed data written to Postgres.")


if __name__ == "__main__":
    seed()
