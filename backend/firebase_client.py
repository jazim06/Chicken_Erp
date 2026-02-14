"""
Firebase Admin SDK initialization and Firestore client helpers.
Loads credentials from FIREBASE_CREDENTIALS_PATH env var.
"""

import os
import logging
from functools import lru_cache

import firebase_admin
from firebase_admin import credentials, firestore, auth

logger = logging.getLogger(__name__)

_app = None


def initialize_firebase() -> firebase_admin.App:
    """Initialize Firebase Admin SDK (idempotent)."""
    global _app
    if _app is not None:
        return _app

    cred_path = os.environ.get("FIREBASE_CREDENTIALS_PATH")
    if not cred_path:
        raise RuntimeError(
            "FIREBASE_CREDENTIALS_PATH env var is required. "
            "Set it to the path of your Firebase service-account JSON file."
        )

    if not os.path.isfile(cred_path):
        raise FileNotFoundError(f"Service-account file not found: {cred_path}")

    cred = credentials.Certificate(cred_path)
    _app = firebase_admin.initialize_app(cred)
    logger.info("Firebase Admin SDK initialized successfully.")
    return _app


def get_firestore_client() -> firestore.firestore.Client:
    """Return the Firestore client. Initializes Firebase if needed."""
    initialize_firebase()
    return firestore.client()


def verify_id_token(id_token: str) -> dict:
    """
    Verify a Firebase Auth ID token.
    Returns the decoded token claims (uid, email, etc.)
    Raises firebase_admin.auth.InvalidIdTokenError on failure.
    """
    initialize_firebase()
    decoded = auth.verify_id_token(id_token)
    return decoded


def get_user_by_uid(uid: str) -> auth.UserRecord:
    """Fetch Firebase Auth user by UID."""
    initialize_firebase()
    return auth.get_user(uid)


# ---------------------------------------------------------------------------
# Generic Firestore CRUD helpers
# ---------------------------------------------------------------------------

def get_collection(collection_name: str):
    """Return a Firestore CollectionReference."""
    db = get_firestore_client()
    return db.collection(collection_name)


def get_document(collection_name: str, doc_id: str) -> dict | None:
    """Fetch a single document. Returns dict with 'id' field or None."""
    ref = get_collection(collection_name).document(doc_id)
    snap = ref.get()
    if snap.exists:
        data = snap.to_dict()
        data["id"] = snap.id
        return data
    return None


def list_documents(
    collection_name: str,
    filters: list[tuple] | None = None,
    order_by: str | None = None,
    limit: int | None = None,
) -> list[dict]:
    """
    List documents with optional filters, ordering, and limit.
    filters: list of (field, operator, value) tuples
        e.g. [("date", "==", "2026-02-13"), ("isDeleted", "==", False)]
    """
    query = get_collection(collection_name)
    if filters:
        for field, op, val in filters:
            query = query.where(field, op, val)
    if order_by:
        query = query.order_by(order_by)
    if limit:
        query = query.limit(limit)

    docs = []
    for snap in query.stream():
        data = snap.to_dict()
        data["id"] = snap.id
        docs.append(data)
    return docs


def create_document(collection_name: str, data: dict, doc_id: str | None = None) -> str:
    """
    Create a document. Returns the document ID.
    If doc_id is provided, uses set(); otherwise auto-generates.
    """
    col = get_collection(collection_name)
    if doc_id:
        col.document(doc_id).set(data)
        return doc_id
    else:
        _, ref = col.add(data)
        return ref.id


def update_document(collection_name: str, doc_id: str, data: dict) -> None:
    """Update fields on an existing document."""
    get_collection(collection_name).document(doc_id).update(data)


def delete_document(collection_name: str, doc_id: str) -> None:
    """Hard-delete a document."""
    get_collection(collection_name).document(doc_id).delete()


def batch_update(collection_name: str, updates: list[dict]) -> None:
    """
    Batch update multiple documents.
    updates: list of {"id": "doc_id", ...fields_to_update}
    """
    db = get_firestore_client()
    batch = db.batch()
    col = db.collection(collection_name)
    for item in updates:
        doc_id = item.pop("id")
        ref = col.document(doc_id)
        batch.update(ref, item)
    batch.commit()
