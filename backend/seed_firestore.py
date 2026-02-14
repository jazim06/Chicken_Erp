"""
Seed Firestore with initial data (products, suppliers, sub-parties, price rates).
Run once to populate a fresh Firestore database.

Usage:
    cd backend
    python seed_firestore.py
"""

import os
import sys
from pathlib import Path

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from firebase_client import create_document, get_firestore_client, initialize_firebase


def seed():
    initialize_firebase()
    db = get_firestore_client()

    # ---------------------------------------------------------------
    # Products
    # ---------------------------------------------------------------
    products = [
        {
            "name": "CHICKEN",
            "image": "https://images.unsplash.com/photo-1587593810167-a84920ea0781?q=80&w=800",
            "description": "Poultry Management",
        },
        {
            "name": "MUTTON",
            "image": "https://images.unsplash.com/photo-1602470520998-f4a52199a3d6?q=80&w=800",
            "description": "Sheep & Goat Management",
        },
    ]
    product_ids = {}
    for p in products:
        doc_id = p["name"].lower()
        db.collection("products").document(doc_id).set(p)
        product_ids[p["name"]] = doc_id
        print(f"  Product: {p['name']} → {doc_id}")

    # ---------------------------------------------------------------
    # Suppliers
    # ---------------------------------------------------------------
    suppliers_data = [
        {"name": "JOSEPH", "productType": "chicken", "active": True},
        {"name": "SADIQ", "productType": "chicken", "active": True},
        {"name": "OTHER CALCULATION", "productType": "chicken", "active": True},
        {"name": "RAHEEM", "productType": "mutton", "active": True},
    ]
    
    # Use predictable IDs matching the fallback data in services.py
    supplier_id_map = {
        "JOSEPH": "supp_joseph",
        "SADIQ": "supp_sadiq",
        "OTHER CALCULATION": "supp_other_calc",
        "RAHEEM": "supp_raheem",
    }
    
    supplier_ids = {}
    for s in suppliers_data:
        doc_id = supplier_id_map[s["name"]]
        db.collection("suppliers").document(doc_id).set(s)
        supplier_ids[s["name"]] = doc_id
        print(f"  Supplier: {s['name']} → {doc_id}")

    # ---------------------------------------------------------------
    # Sub-parties
    # ---------------------------------------------------------------
    sub_parties = {
        "JOSEPH": ["RMS", "Thamim", "Anna City"],
        "SADIQ": ["Party A", "Party B"],
        "OTHER CALCULATION": ["Iruppu", "Misc Items"],
        "RAHEEM": ["Farm A", "Farm B"],
    }
    for supplier_name, parties in sub_parties.items():
        sid = supplier_ids[supplier_name]
        for pname in parties:
            ref = db.collection("sub_parties").document()
            ref.set({
                "supplierId": sid,
                "partyName": pname,
                "name": pname,
                "todayWeight": 0,
                "totalWeight": 0,
            })
            print(f"    Sub-party: {pname} under {supplier_name} → {ref.id}")

    # ---------------------------------------------------------------
    # Price rates (initial)
    # ---------------------------------------------------------------
    rates = [
        {
            "productTypeId": "chicken",
            "ratePerKg": 177,
            "effectiveFrom": "2026-01-01",
            "effectiveTo": None,
        },
        {
            "productTypeId": "mutton",
            "ratePerKg": 650,
            "effectiveFrom": "2026-01-01",
            "effectiveTo": None,
        },
    ]
    for r in rates:
        ref = db.collection("price_rates").document()
        ref.set(r)
        print(f"  Rate: {r['productTypeId']} = ₹{r['ratePerKg']}/kg → {ref.id}")

    print("\n✅  Seed data written to Firestore.")
    print("Supplier IDs:")
    for name, sid in supplier_ids.items():
        print(f"  {name}: {sid}")


if __name__ == "__main__":
    seed()
