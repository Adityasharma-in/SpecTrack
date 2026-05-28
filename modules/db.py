import os

from supabase import create_async_client, AsyncClient

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

_db: AsyncClient | None = None
_HAS_USER_ID: bool | None = None


async def get_db() -> AsyncClient:
    global _db
    if _db is None:
        if not SUPABASE_URL or not SUPABASE_KEY:
            raise RuntimeError("SUPABASE_URL and SUPABASE_KEY must be set")
        _db = await create_async_client(SUPABASE_URL, SUPABASE_KEY)
    return _db


async def _check_column() -> bool:
    global _HAS_USER_ID
    if _HAS_USER_ID is not None:
        return _HAS_USER_ID
    db = await get_db()
    try:
        await (
            db.table("repository_updates")
            .select("user_id")
            .limit(1)
            .execute()
        )
        _HAS_USER_ID = True
    except Exception:
        _HAS_USER_ID = False
        print("⚠  user_id column not found. Run migration_add_user_id.sql in Supabase SQL Editor.")
    return _HAS_USER_ID


async def upsert_repository(github_url: str, owner: str, repo_name: str, user_id: str = "") -> str:
    db = await get_db()
    payload = {"github_url": github_url, "owner": owner, "repo_name": repo_name}
    if user_id and (await _check_column()):
        payload["user_id"] = user_id
    result = await (
        db.table("tracked_repositories")
        .upsert(payload, on_conflict="github_url")
        .execute()
    )
    return result.data[0]["id"]


async def insert_update(
    repository_id: str,
    release_tag: str,
    release_name: str | None,
    published_at: str,
    raw_release_body: str | None,
    ai_analysis: dict,
    provider_used: str,
    model_used: str | None,
    user_id: str = "",
) -> dict:
    db = await get_db()
    payload = {
        "repository_id": repository_id,
        "release_tag": release_tag,
        "release_name": release_name,
        "published_at": published_at,
        "raw_release_body": raw_release_body,
        "ai_analysis": ai_analysis,
        "provider_used": provider_used,
        "model_used": model_used,
    }
    if user_id and (await _check_column()):
        payload["user_id"] = user_id
    result = await (
        db.table("repository_updates")
        .insert(payload)
        .execute()
    )
    return result.data[0]


async def fetch_history(
    repo_filter: str | None = None,
    limit: int = 50,
    offset: int = 0,
    user_id: str = "",
) -> list[dict]:
    db = await get_db()
    query = (
        db.table("repository_updates")
        .select(
            "id, release_tag, release_name, published_at, ai_analysis, provider_used, model_used, created_at, "
            "repository_id!inner(id, github_url, owner, repo_name)"
        )
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
    )
    if user_id and (await _check_column()):
        query = query.filter("user_id", "eq", user_id)
    if repo_filter:
        query = query.filter("repository_id.github_url", "ilike", f"%{repo_filter}%")
    result = await query.execute()
    records = []
    for row in result.data:
        repo = row.get("repository_id", {})
        records.append({
            "update_id": row["id"],
            "repository_id": repo.get("id"),
            "github_url": repo.get("github_url"),
            "owner": repo.get("owner"),
            "repo_name": repo.get("repo_name"),
            "release_tag": row["release_tag"],
            "release_name": row.get("release_name"),
            "published_at": row["published_at"],
            "tracked_at": row["created_at"],
            "provider_used": row["provider_used"],
            "model_used": row.get("model_used"),
            "ai_analysis": row.get("ai_analysis", {}),
        })
    return records
