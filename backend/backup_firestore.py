"""
Firestore daily backup script.

Exports all collections to a local JSON file.
Run manually or via cron:  python backup_firestore.py

Requires: GOOGLE_APPLICATION_CREDENTIALS or service-account.json in this dir.
"""

import json
import os
from datetime import datetime
from pathlib import Path

import firebase_admin
from firebase_admin import credentials, firestore

# ── Initialise Firebase ─────────────────────────────────────────
ROOT_DIR = Path(__file__).parent
cred_path = os.getenv("FIREBASE_CREDENTIALS_PATH", str(ROOT_DIR / "service-account.json"))

if not firebase_admin._apps:
    cred = credentials.Certificate(cred_path)
    firebase_admin.initialize_app(cred)

db = firestore.client()

# ── Collections to back up ──────────────────────────────────────
COLLECTIONS = [
    "suppliers",
    "products",
    "weight_entries",
    "financial_entries",
    "custom_financial_entries",
    "deduction_entries",
    "section_f_entries",
    "price_rates",
    "daily_carryover",
    "atb_entries",
    "rms_entries",
]


def backup():
    """Export all collections to a timestamped JSON file."""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_dir = ROOT_DIR / "backups"
    backup_dir.mkdir(exist_ok=True)

    data = {}
    total_docs = 0

    for coll_name in COLLECTIONS:
        docs = db.collection(coll_name).stream()
        coll_data = []
        for doc in docs:
            entry = doc.to_dict()
            entry["_id"] = doc.id
            # Convert Firestore timestamps to ISO strings
            for key, val in entry.items():
                if hasattr(val, "isoformat"):
                    entry[key] = val.isoformat()
            coll_data.append(entry)
        data[coll_name] = coll_data
        total_docs += len(coll_data)
        print(f"  ✓ {coll_name}: {len(coll_data)} documents")

    out_file = backup_dir / f"backup_{timestamp}.json"
    with open(out_file, "w") as f:
        json.dump(data, f, indent=2, default=str)

    size_mb = out_file.stat().st_size / (1024 * 1024)
    print(f"\n✅ Backup complete: {out_file}")
    print(f"   {total_docs} documents, {size_mb:.2f} MB")
    return out_file


if __name__ == "__main__":
    backup()
