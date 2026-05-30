import json
import re
from dataclasses import dataclass
from typing import Literal

import httpx

SYSTEM_PROMPT = """You are a release notes analyzer. Classify each change by its FUNCTIONAL CONSEQUENCE, not by surface keywords.

CRITICAL RULE — Do NOT map keywords to categories:
- "Added" does NOT always mean new_feature. "Added a breaking change" = breaking_change. "Added deprecation notice" = deprecation.
- "Removed" does NOT always mean breaking_change. "Removed deprecated code that was already announced" = deprecation cleanup. "Removed the experimental flag from feature X" = new_feature (it stabilized).
- "Deprecated" does NOT always mean deprecation. "Deprecated and removed /v1/users" = breaking_change (it's actually gone now).

HEADING TRAP — Do NOT trust section headings. Analyze each bullet by its action verbs, not its heading:
- A bullet under "## Features" that says "Remove from public SDK" → breaking_change, not new_feature
- A bullet under "## Improvements" that says "Deprecate /v1/users" → deprecation, not new_feature
- A single bullet may contain multiple changes: "Added /v2/users and removed /v1/users" → split into new_feature + breaking_change

DESTRUCTIVE KEYWORD RULE — These actions are breaking_change triggers regardless of heading:
Words: remove, drop, delete, disallow, restrict, terminate, kill, sunset, remove from public/export/SDK, rename, break
- If a bullet contains any of these verbs, the described change is almost certainly a breaking_change
- Exception: past-tense removal of a thing that only existed in a pre-release context

Ask yourself for EACH change: "What action does the user need to take?"
- If they MUST CHANGE their code/config/workflow to keep things working → breaking_change
- If they CAN use something new but don't have to change anything → new_feature
- If they SHOULD PLAN to change because something will stop working later → deprecation

Category definitions:
1. breaking_changes: Something that was working in the previous version NOW FAILS or BEHAVES DIFFERENTLY without user action. Examples: API endpoint removed, function signature changed, config key renamed, behavior change, minimum dependency version bumped, feature deleted. If removing something that was already deprecated, still list it here (it actually broke now).
2. new_features: Something NEW the user can optionally use. It adds capability without removing existing functionality. Examples: new API endpoint, new command, new option/flag, new module, new integration, new UI, new tool. NEW deprecation notices do NOT go here.
3. deprecations: Something that STILL WORKS but has a warning/migration notice for future removal. The feature is still present and functional. Examples: "will be removed in v3", "consider migrating to X", "this is now legacy", "support ends next release". If the feature is actually removed now, it is a breaking_change, not a deprecation.

Output rules:
- Extract EVERY single change described — leave nothing out
- Summarize each item clearly in 8-20 words with specific names (endpoints, functions, config keys, CLI flags)
- If notes say "see changelog" or link to one, include the linked items
- Output ONLY valid JSON — no markdown, no explanation
- Use [] for categories with no changes, never null

JSON output format:
{"breaking_changes":["item1","item2"],"new_features":["item1","item2"],"deprecations":["item1","item2"]}"""


@dataclass
class AIRouterRequest:
    provider: Literal["gemini", "openai", "claude", "openrouter", "nvidia_nim", "mistral", "groq", "together", "deepseek"]
    api_key: str
    model: str | None
    release_body: str
    custom_url: str | None = None
    custom_headers: dict[str, str] | None = None


@dataclass
class AIRouterResponse:
    breaking_changes: list[str]
    new_features: list[str]
    deprecations: list[str]
    model_used: str
    raw_response: str


class AIRoutingError(Exception):
    def __init__(self, provider: str, detail: str, status_code: int | None = None):
        self.provider = provider
        self.status_code = status_code
        self.detail = detail


PROVIDER_DEFAULTS = {
    "gemini": "gemini-2.0-flash-lite",
    "openai": "gpt-4o-mini",
    "claude": "claude-sonnet-4-20250514",
    "openrouter": "openai/gpt-4o-mini",
    "nvidia_nim": "nvidia/llama-3.1-70b-instruct",
    "mistral": "mistral-small-latest",
    "groq": "llama-3.3-70b-versatile",
    "together": "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    "deepseek": "deepseek-chat",
}

PROVIDER_URLS = {
    "openrouter": "https://openrouter.ai/api/v1",
    "nvidia_nim": "https://integrate.api.nvidia.com/v1",
    "mistral": "https://api.mistral.ai/v1",
    "groq": "https://api.groq.com/openai/v1",
    "together": "https://api.together.xyz/v1",
    "deepseek": "https://api.deepseek.com/v1",
}


def _extract_text(provider: str, data: dict) -> str:
    """Safely extract text content from provider JSON response, checking for errors first."""
    if "error" in data:
        err = data["error"]
        if isinstance(err, dict):
            msg = err.get("message", str(err))
        else:
            msg = str(err)
        raise AIRoutingError(provider, f"AI provider returned an error: {msg[:300]}")
    try:
        if provider == "gemini":
            return data["candidates"][0]["content"]["parts"][0]["text"]
        elif provider == "claude":
            return data["content"][0]["text"]
        else:
            return data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        keys_preview = list(data.keys())[:8]
        raise AIRoutingError(provider, f"Unexpected AI provider response: missing key at {exc}. Top-level keys: {keys_preview}")


def _user_message(release_body: str) -> str:
    return f"""Classify each change by functional impact (what breaks vs what's new vs what's warned), not by keywords.

Example — note the REASONING:
- "Removed /v1/users endpoint" → breaking_change (users must update their API calls NOW)
- "Added /v2/users endpoint with new response format" → new_feature (optional upgrade)
- "Added deprecation notice: /v1/users will be removed in v3" → deprecation (still works, plan migration)
- "Removed deprecated --old-flag that was announced 2 releases ago" → breaking_change (it's gone now)
- "Stabilized --experimental-feature as --feature" → new_feature (it graduated, not a change to existing)

HEADING TRAP — even if "Remove from public SDK" appears under "## Features", it is still a breaking_change.
Split multi-part bullets: "Added X and removed Y" goes to two categories.

---
Release notes:
{release_body}

---
JSON:"""


def _openrouter_message(release_body: str) -> str:
    return f"""{SYSTEM_PROMPT}

Classify each change by functional impact (what breaks vs what's new vs what's warned), not by keywords.

Example — note the REASONING:
- "Removed /v1/users endpoint" → breaking_change (users must update their API calls NOW)
- "Added /v2/users endpoint with new response format" → new_feature (optional upgrade)
- "Added deprecation notice: /v1/users will be removed in v3" → deprecation (still works, plan migration)
- "Removed deprecated --old-flag that was announced 2 releases ago" → breaking_change (it's gone now)
- "Stabilized --experimental-feature as --feature" → new_feature (it graduated, not a change to existing)

HEADING TRAP — even if "Remove from public SDK" appears under "## Features", it is still a breaking_change.
Split multi-part bullets: "Added X and removed Y" goes to two categories.

---
Release notes:
{release_body}

---
JSON:"""


def _parse_ai_response(raw: str) -> AIRouterResponse:
    cleaned = raw.strip()
    cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", cleaned, flags=re.DOTALL)
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        brace_match = re.search(r"\{.*\}", cleaned, re.DOTALL)
        if brace_match:
            try:
                data = json.loads(brace_match.group())
            except json.JSONDecodeError:
                raise AIRoutingError("parsing", f"AI response was not valid JSON: {raw[:500]}")
        else:
            raise AIRoutingError("parsing", f"AI response was not valid JSON: {raw[:500]}")
    if not isinstance(data, dict):
        raise AIRoutingError("parsing", "AI response is not a JSON object")
    for key in ("breaking_changes", "new_features", "deprecations"):
        if key not in data:
            data[key] = []
        elif not isinstance(data[key], list):
            data[key] = [str(data[key])]
        else:
            data[key] = [str(item) for item in data[key]]
    return AIRouterResponse(
        breaking_changes=data["breaking_changes"],
        new_features=data["new_features"],
        deprecations=data["deprecations"],
        model_used="",
        raw_response=raw,
    )


async def _call_gemini(req: AIRouterRequest) -> AIRouterResponse:
    model = req.model or PROVIDER_DEFAULTS["gemini"]
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={req.api_key}"
    payload = {
        "system_instruction": {"parts": [{"text": SYSTEM_PROMPT}]},
        "contents": [{"role": "user", "parts": [{"text": _user_message(req.release_body)}]}],
        "generationConfig": {"temperature": 0.0, "maxOutputTokens": 4096, "response_mime_type": "application/json"},
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            resp = await client.post(url, json=payload, headers={"Content-Type": "application/json"})
        except httpx.RequestError as exc:
            raise AIRoutingError("gemini", f"Request failed: {exc}")
    if resp.status_code >= 400:
        resp_body = resp.text[:500]
        if "not supported" in resp_body.lower() or "unsupported" in resp_body.lower():
            payload.pop("generationConfig", None)
            payload["generationConfig"] = {"temperature": 0.0, "maxOutputTokens": 4096}
            async with httpx.AsyncClient(timeout=30.0) as client2:
                resp2 = await client2.post(url, json=payload, headers={"Content-Type": "application/json"})
            if resp2.status_code >= 400:
                raise AIRoutingError("gemini", f"API returned {resp2.status_code}: {resp2.text[:300]}", resp2.status_code)
            try:
                data = resp2.json()
            except json.JSONDecodeError:
                raise AIRoutingError("gemini", f"Non-JSON response on retry: {resp2.text[:200]}")
        else:
            raise AIRoutingError("gemini", f"API returned {resp.status_code}: {resp_body}", resp.status_code)
    else:
        try:
            data = resp.json()
        except json.JSONDecodeError:
            raise AIRoutingError("gemini", f"Non-JSON response: {resp.text[:200]}")
    raw_text = _extract_text("gemini", data)
    result = _parse_ai_response(raw_text)
    result.model_used = model
    return result


async def _call_openai(req: AIRouterRequest) -> AIRouterResponse:
    model = req.model or PROVIDER_DEFAULTS["openai"]
    url = "https://api.openai.com/v1/chat/completions"
    payload = {
        "model": model,
        "temperature": 0.0,
        "max_tokens": 4096,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": _user_message(req.release_body)},
        ],
    }
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {req.api_key}",
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            resp = await client.post(url, json=payload, headers=headers)
        except httpx.RequestError as exc:
            raise AIRoutingError("openai", f"Request failed: {exc}")
    if resp.status_code >= 400:
        raise AIRoutingError("openai", f"API returned {resp.status_code}: {resp.text[:300]}", resp.status_code)
    try:
        data = resp.json()
    except json.JSONDecodeError:
        raise AIRoutingError("openai", f"Non-JSON response: {resp.text[:200]}")
    raw_text = _extract_text("openai", data)
    result = _parse_ai_response(raw_text)
    result.model_used = model
    return result


async def _call_claude(req: AIRouterRequest) -> AIRouterResponse:
    model = req.model or PROVIDER_DEFAULTS["claude"]
    url = "https://api.anthropic.com/v1/messages"
    payload = {
        "model": model,
        "max_tokens": 4096,
        "temperature": 0.0,
        "system": SYSTEM_PROMPT,
        "messages": [{"role": "user", "content": _user_message(req.release_body)}],
    }
    headers = {
        "Content-Type": "application/json",
        "x-api-key": req.api_key,
        "anthropic-version": "2023-06-01",
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            resp = await client.post(url, json=payload, headers=headers)
        except httpx.RequestError as exc:
            raise AIRoutingError("claude", f"Request failed: {exc}")
    if resp.status_code >= 400:
        raise AIRoutingError("claude", f"API returned {resp.status_code}: {resp.text[:300]}", resp.status_code)
    try:
        data = resp.json()
    except json.JSONDecodeError:
        raise AIRoutingError("claude", f"Non-JSON response: {resp.text[:200]}")
    raw_text = _extract_text("claude", data)
    result = _parse_ai_response(raw_text)
    result.model_used = model
    return result


async def _call_openai_compatible(req: AIRouterRequest) -> AIRouterResponse:
    model = req.model or PROVIDER_DEFAULTS.get(req.provider, "default")
    base_url = PROVIDER_URLS[req.provider]
    url = f"{base_url}/chat/completions"
    payload = {
        "model": model,
        "temperature": 0.0,
        "max_tokens": 4096,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": _user_message(req.release_body)},
        ],
    }
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {req.api_key}",
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            resp = await client.post(url, json=payload, headers=headers)
        except httpx.RequestError as exc:
            raise AIRoutingError(req.provider, f"Request failed: {exc}")
    if resp.status_code >= 400:
        resp_body = resp.text[:500].lower()
        if "not supported" in resp_body or "unsupported" in resp_body or "invalid" in resp_body:
            payload.pop("response_format", None)
            async with httpx.AsyncClient(timeout=30.0) as client2:
                resp2 = await client2.post(url, json=payload, headers=headers)
            if resp2.status_code >= 400:
                raise AIRoutingError(req.provider, f"API returned {resp2.status_code}: {resp2.text[:300]}", resp2.status_code)
            try:
                data = resp2.json()
            except json.JSONDecodeError:
                raise AIRoutingError(req.provider, f"Non-JSON response on retry: {resp2.text[:200]}")
        else:
            raise AIRoutingError(req.provider, f"API returned {resp.status_code}: {resp.text[:300]}", resp.status_code)
    else:
        try:
            data = resp.json()
        except json.JSONDecodeError:
            raise AIRoutingError(req.provider, f"Non-JSON response: {resp.text[:200]}")
    raw_text = _extract_text(req.provider, data)
    result = _parse_ai_response(raw_text)
    result.model_used = model
    return result


PROVIDER_MAP = {
    "gemini": _call_gemini,
    "openai": _call_openai,
    "claude": _call_claude,
    "openrouter": _call_openai_compatible,
    "nvidia_nim": _call_openai_compatible,
    "mistral": _call_openai_compatible,
    "groq": _call_openai_compatible,
    "together": _call_openai_compatible,
    "deepseek": _call_openai_compatible,
}


async def route_to_provider(req: AIRouterRequest) -> AIRouterResponse:
    handler = PROVIDER_MAP.get(req.provider)
    if not handler:
        raise AIRoutingError(req.provider, f"Unknown provider: {req.provider}")
    return await handler(req)
