import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query, Depends
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, field_validator

load_dotenv(Path(__file__).parent / ".env")

from modules.ai_router import AIRouterRequest, AIRouterResponse, AIRoutingError, route_to_provider
from modules.auth import require_user, get_current_user
from modules.db import fetch_history, insert_update, upsert_repository
from modules.github_extractor import GitHubError, fetch_latest_release, parse_github_url


app = FastAPI(title="SpecTrack", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

FRONTEND_DIR = Path(__file__).parent / "frontend" / "dist"
if FRONTEND_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")


@app.on_event("startup")
async def validate_env():
    missing = [v for v in ("SUPABASE_URL", "SUPABASE_KEY") if not os.environ.get(v)]
    if missing:
        print(f"⚠  Missing environment variables: {', '.join(missing)}. DB features will fail.")


VALID_PROVIDERS = {"gemini", "openai", "claude", "openrouter", "custom"}


class TrackRequest(BaseModel):
    github_url: str
    provider: str
    api_key: str
    model: str | None = None
    custom_url: str | None = None
    custom_headers: dict[str, str] | None = None

    @field_validator("provider")
    @classmethod
    def validate_provider(cls, v: str) -> str:
        if v not in VALID_PROVIDERS:
            raise ValueError(f"provider must be one of: {', '.join(sorted(VALID_PROVIDERS))}")
        return v

    @field_validator("api_key")
    @classmethod
    def validate_api_key(cls, v: str) -> str:
        if len(v.strip()) < 10:
            raise ValueError("api_key must be at least 10 characters")
        return v.strip()

    @field_validator("custom_url")
    @classmethod
    def validate_custom_url(cls, v: str | None, info) -> str | None:
        if v is not None:
            values = info.data
            if values.get("provider") == "custom" and not v.startswith("https://"):
                raise ValueError("custom_url is required for provider 'custom'")
        return v


class TrackResponse(BaseModel):
    status: str
    repository: dict
    update: dict


@app.post("/api/track")
async def track_repo(req: TrackRequest, user_id: str = Depends(require_user)) -> TrackResponse:
    try:
        owner, repo_name = parse_github_url(req.github_url)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"error": "INVALID_URL", "detail": str(exc)})

    try:
        release = await fetch_latest_release(owner, repo_name)
    except GitHubError as exc:
        raise HTTPException(status_code=exc.status_code, detail={"error": exc.error, "detail": exc.detail})

    ai_req = AIRouterRequest(
        provider=req.provider,
        api_key=req.api_key,
        model=req.model,
        release_body=release["raw_release_body"],
        custom_url=req.custom_url,
        custom_headers=req.custom_headers,
    )
    try:
        ai_result: AIRouterResponse = await route_to_provider(ai_req)
    except AIRoutingError as exc:
        prefix = f"[{req.provider}/{req.model or 'default'}]"
        raise HTTPException(status_code=502, detail={"error": "AI_ERROR", "detail": f"{prefix} {exc.detail}"})

    try:
        repo_id = await upsert_repository(req.github_url, owner, repo_name, user_id=user_id)
        update = await insert_update(
            repository_id=repo_id,
            release_tag=release["release_tag"],
            release_name=release["release_name"],
            published_at=release["published_at"].isoformat(),
            raw_release_body=release["raw_release_body"],
            ai_analysis={
                "breaking_changes": ai_result.breaking_changes,
                "new_features": ai_result.new_features,
                "deprecations": ai_result.deprecations,
            },
            provider_used=req.provider,
            model_used=ai_result.model_used,
            user_id=user_id,
        )
    except Exception as exc:
        raise HTTPException(status_code=503, detail={"error": "DB_ERROR", "detail": str(exc)})

    return TrackResponse(
        status="success",
        repository={
            "id": repo_id,
            "github_url": req.github_url,
            "owner": owner,
            "repo_name": repo_name,
        },
        update={
            "id": update["id"],
            "release_tag": release["release_tag"],
            "release_name": release["release_name"],
            "published_at": release["published_at"].isoformat(),
            "provider_used": req.provider,
            "model_used": ai_result.model_used,
            "ai_analysis": {
                "breaking_changes": ai_result.breaking_changes,
                "new_features": ai_result.new_features,
                "deprecations": ai_result.deprecations,
            },
            "created_at": update["created_at"],
        },
    )


@app.get("/api/history")
async def get_history(
    repo_filter: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user_id: str = Depends(require_user),
):
    try:
        records = await fetch_history(repo_filter=repo_filter, limit=limit, offset=offset, user_id=user_id)
    except Exception as exc:
        raise HTTPException(status_code=503, detail={"error": "DB_ERROR", "detail": str(exc)})
    return {"status": "success", "count": len(records), "records": records}


@app.get("/api/me")
async def get_me(user_id: str = Depends(require_user)):
    return {"user_id": user_id}


@app.get("/")
@app.get("/{full_path:path}")
async def serve_spa(full_path: str = ""):
    if full_path.startswith("api/"):
        raise HTTPException(status_code=404)
    if FRONTEND_DIR.exists():
        index_path = FRONTEND_DIR / "index.html"
        if index_path.exists():
            return FileResponse(str(index_path))
    fallback = Path(__file__).parent / "index.html"
    if not fallback.exists():
        return HTMLResponse("<h1>SpecTrack</h1><p>index.html not found</p>", status_code=200)
    return FileResponse(str(fallback))


if __name__ == "__main__":
    import uvicorn

    host = os.environ.get("HOST", "0.0.0.0")
    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run("main:app", host=host, port=port, reload=True)
