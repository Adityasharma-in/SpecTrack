import json
import os
import time

import httpx
import jwt
from fastapi import HTTPException, Request

CLERK_DOMAIN = os.environ.get("CLERK_DOMAIN", "")
CLERK_JWKS_URL = f"https://{CLERK_DOMAIN}/.well-known/jwks.json"

_jwks_cache: dict = {}
_jwks_fetched_at: float = 0


async def _fetch_jwks() -> dict:
    global _jwks_cache, _jwks_fetched_at
    now = time.time()
    if _jwks_cache and now - _jwks_fetched_at < 3600:
        return _jwks_cache
    async with httpx.AsyncClient() as client:
        r = await client.get(CLERK_JWKS_URL)
        _jwks_cache = r.json()
        _jwks_fetched_at = now
    return _jwks_cache


def _find_key(jwks: dict, kid: str) -> dict | None:
    for k in jwks.get("keys", []):
        if k.get("kid") == kid:
            return k
    return None


async def get_current_user(request: Request) -> str | None:
    if not CLERK_DOMAIN:
        return None
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None
    token = auth[7:]
    try:
        jwks = await _fetch_jwks()
        header = jwt.get_unverified_header(token)
        kid = header.get("kid")
        key_data = _find_key(jwks, kid)
        if not key_data:
            return None
        public_key = jwt.algorithms.RSAAlgorithm.from_jwk(json.dumps(key_data))
        payload = jwt.decode(
            token,
            public_key,
            algorithms=["RS256"],
            issuer=f"https://{CLERK_DOMAIN}",
            options={"verify_aud": False},
        )
        return payload.get("sub")
    except Exception:
        return None


async def require_user(request: Request) -> str:
    if not CLERK_DOMAIN:
        return "anonymous"
    uid = await get_current_user(request)
    if not uid:
        raise HTTPException(status_code=401, detail="Authentication required")
    return uid
