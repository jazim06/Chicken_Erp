"""
FastAPI auth middleware — hardcoded token for development.

Accepts any Bearer token and returns a static admin user.
Replace with Firebase verify_id_token when ready for production.
"""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

logger = logging.getLogger(__name__)

_bearer_scheme = HTTPBearer(auto_error=False)

# Static token issued at login — any non-empty token is accepted for now
_DEV_TOKEN = "dev-hardcoded-token"


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
) -> dict:
    """
    Dev-mode auth: accepts any Bearer token and returns a static admin user.
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # In dev mode, accept any token
    return {
        "uid": "admin-001",
        "email": "admin@supplier.com",
        "name": "Admin User",
        "role": "admin",
    }


async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
) -> dict | None:
    """
    Same as get_current_user but returns None instead of 401.
    """
    if credentials is None:
        return None
    return {
        "uid": "admin-001",
        "email": "admin@supplier.com",
        "name": "Admin User",
        "role": "admin",
    }
