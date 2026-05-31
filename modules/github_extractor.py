import os
import re
from datetime import datetime, timezone
from urllib.parse import quote, urlparse

import httpx

GITHUB_API_BASE = "https://api.github.com"
_raw_token = os.environ.get("GITHUB_TOKEN", "") or ""
GITHUB_TOKEN = _raw_token if (
    _raw_token
    and not _raw_token.startswith("your-")
    and not _raw_token.upper().startswith("YOUR_")
) else None


class GitHubError(Exception):
    def __init__(self, error: str, detail: str, status_code: int = 400):
        self.error = error
        self.detail = detail
        self.status_code = status_code


def parse_github_url(raw_url: str) -> tuple[str, str]:
    raw_url = raw_url.strip()
    if not raw_url.startswith("http://") and not raw_url.startswith("https://"):
        raw_url = "https://" + raw_url
    parsed = urlparse(raw_url)
    if parsed.netloc.lower() != "github.com":
        raise ValueError("URL must be a valid github.com repository URL")
    segments = [s for s in parsed.path.split("/") if s]
    if len(segments) < 2:
        raise ValueError("URL must include both owner and repository name")
    owner = segments[0]
    repo_name = segments[1]
    repo_name = re.sub(r"\.git$", "", repo_name)
    pattern = r"^[a-zA-Z0-9._-]+$"
    if not re.match(pattern, owner) or not re.match(pattern, repo_name):
        raise ValueError("Invalid owner or repository name format")
    return owner, repo_name


def _build_headers(token: str | None) -> dict:
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "SpecTrack/1.0",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


async def _enrich_with_commits(owner: str, repo_name: str, current_tag: str, release_body: str, token: str | None) -> str:
    """Fetch commits between the previous and current release, append to release body."""
    if not current_tag:
        return release_body
    try:
        url = f"{GITHUB_API_BASE}/repos/{owner}/{repo_name}/releases?per_page=2"
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url, headers=_build_headers(token))
        if resp.status_code != 200:
            return release_body
        releases = resp.json()
        if not isinstance(releases, list) or len(releases) < 2:
            return release_body
        prev_tag = releases[1].get("tag_name")
        if not prev_tag or prev_tag == current_tag:
            return release_body

        compare_url = f"{GITHUB_API_BASE}/repos/{owner}/{repo_name}/compare/{quote(prev_tag, safe='')}...{quote(current_tag, safe='')}"
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp2 = await client.get(compare_url, headers=_build_headers(token))
        if resp2.status_code != 200:
            return release_body
        compare_data = resp2.json()
        commits = compare_data.get("commits", [])
        files_changed = compare_data.get("files", [])

        parts = [release_body]
        if commits:
            parts.append(f"\n\n## Commits ({len(commits)} total, {len(files_changed)} files changed)")
            for c in commits:
                msg = c["commit"]["message"].split("\n")[0]
                author = c["commit"]["author"]["name"]
                parts.append(f"- {msg} ({author})")

        enriched = "\n".join(parts)
        if len(enriched) > 45000:
            enriched = enriched[:45000] + "\n\n[... content truncated for length ...]"
        return enriched
    except Exception:
        return release_body


async def fetch_latest_release(owner: str, repo_name: str) -> dict:
    token = GITHUB_TOKEN
    for attempt in range(2):
        url = f"{GITHUB_API_BASE}/repos/{owner}/{repo_name}/releases/latest"
        headers = _build_headers(token)
        async with httpx.AsyncClient(timeout=15.0) as client:
            try:
                response = await client.get(url, headers=headers)
            except httpx.TimeoutException:
                raise GitHubError(
                    "TIMEOUT",
                    "GitHub API did not respond within 15 seconds",
                    status_code=504,
                )
            except httpx.RequestError as exc:
                raise GitHubError(
                    "NETWORK_ERROR",
                    f"Could not connect to GitHub API: {exc}",
                    status_code=502,
                )
        if response.status_code == 401 and token and attempt == 0:
            token = None
            continue
        if response.status_code == 404:
            raise GitHubError(
                "NOT_FOUND",
                "Repository has no releases or does not exist",
                status_code=404,
            )
        if response.status_code == 401:
            raise GitHubError(
                "UNAUTHORIZED",
                "Repository is private or requires authentication",
                status_code=401,
            )
        if response.status_code == 403:
            retry_after = response.headers.get("Retry-After", "unknown")
            hint = ""
            if not token:
                hint = " Set GITHUB_TOKEN in your environment to increase the limit from 60 to 5000 req/hr."
            raise GitHubError(
                "RATE_LIMITED",
                f"GitHub API rate limit exceeded. Retry after {retry_after}.{hint}",
                status_code=429,
            )
        if response.status_code == 422:
            raise GitHubError(
                "INVALID_REPO",
                "GitHub rejected the repository path",
                status_code=422,
            )
        if response.status_code >= 500:
            raise GitHubError(
                "GITHUB_ERROR",
                f"GitHub returned {response.status_code}",
                status_code=502,
            )
        data = response.json()
        tag = data["tag_name"]
        name = data.get("name")
        published_raw = data["published_at"]
        published_at = datetime.fromisoformat(published_raw.replace("Z", "+00:00"))
        body = data.get("body")
        if not body or not body.strip():
            body = "No release notes provided for this release."
        enriched_body = await _enrich_with_commits(owner, repo_name, tag, body, token)
        return {
            "release_tag": tag,
            "release_name": name,
            "published_at": published_at,
            "raw_release_body": enriched_body,
            "html_url": data["html_url"],
        }
