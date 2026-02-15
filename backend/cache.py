"""
Simple in-memory cache with TTL for reducing Firestore reads.
Suitable for single-process deployments. Replace with Redis for multi-worker.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

_cache: dict[str, object] = {}
_cache_ttl: dict[str, datetime] = {}


# Stats counters
_hits = 0
_misses = 0


def cache_get(key: str):
    """Return cached value if not expired, else None."""
    global _hits, _misses
    if key in _cache:
        if datetime.now() < _cache_ttl.get(key, datetime.min):
            _hits += 1
            logger.info("Cache HIT: %s", key)
            return _cache[key]
        # Expired — evict
        del _cache[key]
        del _cache_ttl[key]
    _misses += 1
    logger.info("Cache MISS: %s", key)
    return None


def cache_set(key: str, value, ttl_seconds: int = 300):
    """Store a value with TTL (default 5 min)."""
    _cache[key] = value
    _cache_ttl[key] = datetime.now() + timedelta(seconds=ttl_seconds)
    logger.info("Cache SET: %s (TTL: %ds)", key, ttl_seconds)


def cache_stats() -> dict:
    """Return cache statistics for debugging."""
    return {
        "entries": len(_cache),
        "hits": _hits,
        "misses": _misses,
        "hit_rate": round(_hits / max(_hits + _misses, 1) * 100, 1),
        "keys": list(_cache.keys()),
    }


def cache_invalidate(pattern: str | None = None):
    """
    Invalidate cache entries.
    If pattern is given, only keys containing that substring are cleared.
    Otherwise, clears everything.
    """
    if pattern:
        keys = [k for k in _cache if pattern in k]
        for k in keys:
            _cache.pop(k, None)
            _cache_ttl.pop(k, None)
        if keys:
            logger.debug("Cache invalidated %d keys matching '%s'", len(keys), pattern)
    else:
        _cache.clear()
        _cache_ttl.clear()
        logger.debug("Cache fully cleared")
