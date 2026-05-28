# SpecTrack: Automated Dependency & Feature Intelligence Tracker
## Product Requirements Document (PRD) — v1.0
### Hackathon Sprint Edition | Classification: Internal Engineering

---

## 1. Executive Summary & Problem Statement

### 1.1 Core Value Proposition

SpecTrack is a developer-facing intelligence layer that sits between a software team's dependency graph and the chaotic, unstructured world of open-source release cycles. It ingests a GitHub repository URL, extracts the latest release metadata from the public GitHub REST API, routes that raw changelog payload through a user-selected AI model (via a BYOK routing matrix), and stores a structured, machine-readable intelligence record — categorized into breaking changes, new features, and deprecations — in a persistent PostgreSQL database.

The product eliminates the operational burden of manually monitoring upstream dependencies. Rather than relying on developers to read changelogs, subscribe to release feeds, or maintain internal wikis of library behaviors, SpecTrack converts unstructured release prose into deterministic JSON intelligence records that can be queried, diffed, and acted upon programmatically.

The primary value delivered is **time compression**: what currently takes a developer 15–45 minutes per dependency per release cycle (discovery → reading → categorizing → documenting → communicating) is collapsed into a single API call returning structured data in under 10 seconds.

### 1.2 Problem Statement: Three Critical Pain Points

#### Pain Point 1: Silent Breaking Updates

Modern software projects routinely declare dozens to hundreds of transitive dependencies. When a maintainer ships a semver-major or undocumented breaking change — a renamed method, a changed default, a removed export — the consuming project absorbs the impact silently during the next `npm install`, `pip install`, or `go get`. The failure manifests later, often during CI, staging, or production deployment, frequently without a clear causal trace back to the upstream change.

The root cause is not the breaking change itself — it is the absence of a structured, queryable record that explicitly categorizes the change as breaking at the moment of release. Developers cannot act on information they do not have in a format they can consume. SpecTrack solves this by converting changelog prose into a `breaking_changes` array the moment a new release is published.

#### Pain Point 2: Changelog Fatigue and Information Overload

The open-source ecosystem has no enforced standard for changelog structure. Release notes range from precise semantic entries ("Removed deprecated `createStore` in favor of `configureStore`") to entirely unstructured noise ("Minor fixes and improvements"). Many projects embed changelogs inside GitHub Release markdown bodies, inside `CHANGELOG.md` files with inconsistent formatting, inside commit messages, or not at all.

When a team manages 50 dependencies, changelog fatigue becomes a systemic problem: developers either ignore changelogs entirely (creating risk exposure) or spend disproportionate time reading and manually categorizing releases that may be irrelevant to their use case. The cognitive tax compounds with team size. SpecTrack offloads this categorization work to an AI model selected and controlled by the operator, extracting signal from noise and surfacing only the three categories that matter for operational decisions: what broke, what's new, and what's going away.

#### Pain Point 3: Missed Performance Optimizations and Feature Leverage

Beyond breaking changes, major releases frequently introduce performance improvements, new APIs, or architectural changes that would meaningfully benefit consuming projects — but are never adopted because the team was unaware or lacked the time to investigate. A library ships a 3x faster rendering path behind a new opt-in flag; a data processing library introduces vectorized operations that replace a custom workaround; an ORM adds native connection pooling that eliminates a third-party dependency. These improvements are latent value sitting in changelogs that no one read.

SpecTrack's `new_features` extraction directly addresses this: by surfacing new capabilities as a structured, searchable array rather than buried prose, teams can make deliberate adoption decisions rather than missing optimization opportunities by default.

---

## 2. High-Level Architecture & Data Flow Diagram

### 2.1 System Component Overview

The system is composed of four discrete layers: a client interface layer (single-file HTML/JS), a FastAPI application server, an external data acquisition layer (GitHub REST API + AI provider APIs), and a persistence layer (Supabase/PostgreSQL). All inter-layer communication is JSON over HTTP/HTTPS.

### 2.2 Data Flow Diagram (Text-Based)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER (Browser)                              │
│   Single-file HTML/JS Testing Interface served at GET /                     │
│                                                                             │
│   [Config Panel]          [URL Input Bar]         [Console Window]          │
│   - Provider Selector     - GitHub Repo URL        - Step-by-step log       │
│   - API Key Input         - Track Button           - Status codes           │
│   - Model Override        - Status Indicator       - Error messages         │
│   - Custom Endpoint                                                         │
│                           [Output Data Grid]                                │
│                           - Raw JSON results                                │
│                           - Historical records table                        │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │ POST /api/track  { github_url, provider,
                                   │                    api_key, model?, endpoint? }
                                   │ GET  /api/history { ?repo_filter }
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     APPLICATION LAYER (FastAPI / Python)                     │
│                                                                             │
│  ┌──────────────────────┐    ┌──────────────────────────────────────────┐   │
│  │  Request Validator   │    │         Orchestration Engine             │   │
│  │  - Pydantic models   │───▶│  1. Parse GitHub URL → owner/repo        │   │
│  │  - URL format check  │    │  2. Call GitHub Releases API             │   │
│  │  - Provider enum     │    │  3. Extract release body                 │   │
│  │  - Key presence      │    │  4. Route to AI Provider                 │   │
│  └──────────────────────┘    │  5. Parse AI JSON response               │   │
│                              │  6. Upsert to Supabase                   │   │
│                              │  7. Return structured response           │   │
│                              └──────────────────────────────────────────┘   │
│                                          │                │                 │
└──────────────────────────────────────────┼────────────────┼─────────────────┘
                                           │                │
               ┌───────────────────────────┘                └──────────────────┐
               ▼                                                               ▼
┌──────────────────────────────┐                        ┌──────────────────────────────┐
│  EXTERNAL DATA LAYER         │                        │  EXTERNAL AI LAYER           │
│  GitHub REST API (Public)    │                        │  (BYOK Multi-Provider)       │
│                              │                        │                              │
│  GET /repos/{owner}/{repo}   │                        │  ┌──────────────────────┐   │
│    /releases/latest          │                        │  │ Gemini (Google)      │   │
│                              │                        │  │ OpenAI               │   │
│  Response Fields Used:       │                        │  │ Claude (Anthropic)   │   │
│  - tag_name                  │                        │  │ OpenRouter           │   │
│  - name                      │                        │  │ Custom Endpoint      │   │
│  - published_at              │                        │  └──────────────────────┘   │
│  - body (changelog prose)    │                        │                              │
│  - html_url                  │                        │  System Prompt forces:       │
│                              │                        │  { breaking_changes: [...],  │
│  Error cases handled:        │                        │    new_features: [...],      │
│  - 404 (no releases)         │                        │    deprecations: [...] }     │
│  - 403 (rate limit)          │                        │                              │
│  - 401 (private repo)        │                        └──────────────────────────────┘
└──────────────────────────────┘
                                                                       │
                                                                       ▼
                                              ┌─────────────────────────────────────────┐
                                              │  PERSISTENCE LAYER (Supabase/PostgreSQL) │
                                              │                                          │
                                              │  tracked_repositories                    │
                                              │  ├── id (UUID, PK)                       │
                                              │  ├── github_url (TEXT, UNIQUE)           │
                                              │  ├── owner (TEXT)                        │
                                              │  ├── repo_name (TEXT)                    │
                                              │  └── created_at (TIMESTAMPTZ)            │
                                              │                                          │
                                              │  repository_updates                      │
                                              │  ├── id (UUID, PK)                       │
                                              │  ├── repository_id (UUID, FK → CASCADE)  │
                                              │  ├── release_tag (TEXT)                  │
                                              │  ├── release_name (TEXT)                 │
                                              │  ├── published_at (TIMESTAMPTZ)          │
                                              │  ├── raw_release_body (TEXT)             │
                                              │  ├── ai_analysis (JSONB)                 │
                                              │  ├── provider_used (TEXT)                │
                                              │  └── created_at (TIMESTAMPTZ)            │
                                              └─────────────────────────────────────────┘
```

### 2.3 Request Lifecycle Summary

A full round-trip from button click to rendered output traverses the following sequence:

1. Browser serializes config panel state and URL input into a POST body.
2. FastAPI receives request; Pydantic validates shape and constraints.
3. GitHub Extraction Engine parses URL, constructs API request, fetches latest release.
4. Raw release `body` field is extracted and passed to the AI Router.
5. AI Router constructs provider-specific payload with the deterministic system prompt and release body as user content, then sends authenticated HTTP POST to the selected provider endpoint.
6. AI response text is extracted, sanitized, and JSON-parsed into the three-key structure.
7. Orchestration engine upserts `tracked_repositories` record (insert or fetch existing), then inserts a new `repository_updates` record with the JSONB analysis payload.
8. FastAPI returns a 200 response with the complete structured record.
9. Browser renders JSON into the output grid and appends log entries to the console window.

---

## 3. Database Schema Specification (Supabase/PostgreSQL)

### 3.1 Design Constraints

The schema is designed for the Supabase free tier, which imposes no row limits but limits total database size and connection concurrency. The design therefore avoids redundant data storage, uses JSONB for semi-structured AI output (avoiding premature normalization of variable-length arrays), and indexes only the columns required for the two defined query patterns: primary key lookups and descending chronological scans filtered by repository.

All timestamps use `TIMESTAMPTZ` (timezone-aware) rather than `TIMESTAMP`. All primary keys use `gen_random_uuid()` (PostgreSQL 13+ built-in) rather than serial integers, ensuring global uniqueness suitable for distributed ingestion paths and future horizontal scaling.

### 3.2 Table: `tracked_repositories`

This table maintains a deduplicated registry of every GitHub repository that has ever been submitted for tracking. The `github_url` column carries a `UNIQUE` constraint to serve as the natural idempotency key during upsert operations in the `POST /api/track` handler.

```
TABLE: tracked_repositories
─────────────────────────────────────────────────────────────────────────────
Column         Data Type       Constraints                  Description
─────────────────────────────────────────────────────────────────────────────
id             UUID            PRIMARY KEY                  Surrogate PK,
                               DEFAULT gen_random_uuid()   system-generated

github_url     TEXT            NOT NULL                     Canonical URL as
                               UNIQUE                       submitted by user
                                                            (e.g., https://
                                                            github.com/org/repo)

owner          TEXT            NOT NULL                     Parsed GitHub
                                                            organization or
                                                            username

repo_name      TEXT            NOT NULL                     Parsed repository
                                                            name component

created_at     TIMESTAMPTZ     NOT NULL                     Record creation
                               DEFAULT NOW()                timestamp (UTC)
─────────────────────────────────────────────────────────────────────────────

INDEXES:
  - PRIMARY KEY on (id)                          [implicit B-tree]
  - UNIQUE INDEX on (github_url)                 [deduplication / upsert key]
  - INDEX on (owner, repo_name)                  [composite lookup by parsed components]
```

### 3.3 Table: `repository_updates`

This table stores one record per successful tracking invocation. Each record contains the full raw release body from GitHub, the structured AI analysis as a JSONB object, and metadata about which AI provider was used. The foreign key to `tracked_repositories` enforces referential integrity with cascading deletion: removing a repository record removes all its associated update history atomically.

```
TABLE: repository_updates
─────────────────────────────────────────────────────────────────────────────
Column              Data Type    Constraints                  Description
─────────────────────────────────────────────────────────────────────────────
id                  UUID         PRIMARY KEY                  Surrogate PK
                                 DEFAULT gen_random_uuid()

repository_id       UUID         NOT NULL                     FK to
                                 REFERENCES                   tracked_repositories
                                 tracked_repositories(id)     (id)
                                 ON DELETE CASCADE

release_tag         TEXT         NOT NULL                     Semver tag string
                                                              (e.g., "v2.4.1")

release_name        TEXT                                      Human-readable
                                                              release title;
                                                              nullable (some
                                                              repos omit this)

published_at        TIMESTAMPTZ  NOT NULL                     Release publication
                                                              timestamp from
                                                              GitHub API response
                                                              (ISO 8601 parsed)

raw_release_body    TEXT                                      Full, unmodified
                                                              Markdown body of
                                                              the GitHub Release
                                                              as returned by API;
                                                              nullable for
                                                              releases with no
                                                              body

ai_analysis         JSONB        NOT NULL                     Structured output
                                 DEFAULT '{}'::jsonb          from AI routing
                                                              layer. Enforced
                                                              schema:
                                                              {
                                                                "breaking_changes":
                                                                  [string, ...],
                                                                "new_features":
                                                                  [string, ...],
                                                                "deprecations":
                                                                  [string, ...]
                                                              }

provider_used       TEXT         NOT NULL                     Identifies which
                                                              AI provider
                                                              processed this
                                                              record. Enum-like
                                                              values: "gemini",
                                                              "openai", "claude",
                                                              "openrouter",
                                                              "custom"

model_used          TEXT                                      The specific model
                                                              string passed to
                                                              the provider;
                                                              stored for
                                                              auditability and
                                                              reproducibility

created_at          TIMESTAMPTZ  NOT NULL                     Record insertion
                                 DEFAULT NOW()                timestamp (UTC)
─────────────────────────────────────────────────────────────────────────────

INDEXES:
  - PRIMARY KEY on (id)                          [implicit B-tree]
  - INDEX on (repository_id)                     [FK lookup performance]
  - INDEX on (repository_id, created_at DESC)    [primary query pattern:
                                                  history endpoint scan]
  - INDEX on (published_at DESC)                 [global recency sort]
  - GIN INDEX on (ai_analysis)                   [JSONB content querying,
                                                  future feature search]
```

### 3.4 Cascade Delete Strategy

The `ON DELETE CASCADE` constraint on `repository_updates.repository_id` ensures that any `DELETE FROM tracked_repositories WHERE id = $1` statement atomically removes all descendant `repository_updates` records without requiring application-level orchestration. This is the only cascade behavior in the schema. There is no `ON UPDATE CASCADE` — primary keys are immutable UUIDs and will never change, making update cascade unnecessary.

### 3.5 Migration SQL (Executable Reference)

```sql
-- Enable pgcrypto if gen_random_uuid() is not available natively
-- (not required for PostgreSQL 13+; included for compatibility)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS tracked_repositories (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  github_url   TEXT        NOT NULL UNIQUE,
  owner        TEXT        NOT NULL,
  repo_name    TEXT        NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tracked_repos_owner_name
  ON tracked_repositories (owner, repo_name);

CREATE TABLE IF NOT EXISTS repository_updates (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  repository_id      UUID        NOT NULL
                                 REFERENCES tracked_repositories(id)
                                 ON DELETE CASCADE,
  release_tag        TEXT        NOT NULL,
  release_name       TEXT,
  published_at       TIMESTAMPTZ NOT NULL,
  raw_release_body   TEXT,
  ai_analysis        JSONB       NOT NULL DEFAULT '{}'::jsonb,
  provider_used      TEXT        NOT NULL,
  model_used         TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_repo_updates_repository_id
  ON repository_updates (repository_id);

CREATE INDEX IF NOT EXISTS idx_repo_updates_repo_created
  ON repository_updates (repository_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_repo_updates_published
  ON repository_updates (published_at DESC);

CREATE INDEX IF NOT EXISTS idx_repo_updates_ai_gin
  ON repository_updates USING GIN (ai_analysis);
```

---

## 4. Technical Functional Requirements

### 4.1 GitHub Extraction Engine Module

#### 4.1.1 URL Parsing Logic

The extraction engine must accept a raw string submitted by the user and deterministically isolate the repository `owner` and `repo_name` components before any network call is made. URL parsing is a synchronous, pure function that runs entirely within the application process.

**Accepted URL Formats (all must parse correctly):**

| Input Format                              | Expected owner | Expected repo  |
|-------------------------------------------|----------------|----------------|
| `https://github.com/owner/repo`           | `owner`        | `repo`         |
| `https://github.com/owner/repo/`          | `owner`        | `repo`         |
| `https://github.com/owner/repo.git`       | `owner`        | `repo`         |
| `http://github.com/owner/repo`            | `owner`        | `repo`         |
| `github.com/owner/repo`                   | `owner`        | `repo`         |

**Parsing Algorithm:**

1. Strip leading/trailing whitespace from the input string.
2. Normalize the URL: if no scheme is present (does not start with `http://` or `https://`), prepend `https://` before parsing.
3. Use Python's `urllib.parse.urlparse` to decompose the normalized URL into components.
4. Validate that the `netloc` component is exactly `github.com` (case-insensitive comparison). If not, raise a `ValueError` with message: `"URL must be a valid github.com repository URL"`.
5. Split the `path` component on `/`, filter empty strings, and collect the resulting segments.
6. Validate that exactly 2 or more path segments exist (segments[0] = owner, segments[1] = repo). If fewer than 2 segments are present, raise a `ValueError` with message: `"URL must include both owner and repository name"`.
7. Extract `owner = segments[0]` and `repo_name = segments[1]`.
8. Strip the `.git` suffix from `repo_name` if present (`repo_name.rstrip('.git')` is incorrect; use `removesuffix('.git')` in Python 3.9+ or `re.sub(r'\.git$', '', repo_name)`).
9. Validate that both `owner` and `repo_name` are non-empty strings matching the pattern `^[a-zA-Z0-9._-]+$`. Raise `ValueError` with message: `"Invalid owner or repository name format"` on mismatch.
10. Return `(owner, repo_name)` as a tuple.

#### 4.1.2 GitHub API Request Logic

Once `(owner, repo_name)` is validated, the engine constructs and executes an asynchronous HTTP GET request using `httpx.AsyncClient` (preferred over `requests` for async FastAPI compatibility).

**Target Endpoint:**
```
GET https://api.github.com/repos/{owner}/{repo_name}/releases/latest
```

**Required Request Headers:**

```
Accept: application/vnd.github+json
X-GitHub-Api-Version: 2022-11-28
User-Agent: SpecTrack/1.0
```

If a `GITHUB_TOKEN` environment variable is configured, include:
```
Authorization: Bearer {GITHUB_TOKEN}
```

The `GITHUB_TOKEN` is optional — the public GitHub API allows unauthenticated requests at 60 requests/hour per IP. Authenticated requests raise this to 5,000/hour. The extraction engine must check for the environment variable at module initialization and conditionally include the Authorization header.

**Timeout Configuration:** Set `httpx.AsyncClient(timeout=15.0)` — a 15-second total timeout covering both connection establishment and response body reading. This prevents hanging on slow or unresponsive GitHub infrastructure.

#### 4.1.3 Response Processing

On HTTP 200, parse the JSON response body and extract the following fields into a typed dictionary:

```
release_tag        ← response["tag_name"]          (str, required)
release_name       ← response.get("name")           (str | None)
published_at       ← response["published_at"]       (str ISO 8601, required)
raw_release_body   ← response.get("body")           (str | None)
html_url           ← response["html_url"]           (str, for logging only)
```

`published_at` must be parsed from the ISO 8601 string (`"2024-03-15T14:22:00Z"`) into a Python `datetime` object with UTC timezone before storage.

If `raw_release_body` is `None` or empty string, the AI pipeline receives the placeholder string: `"No release notes provided for this release."` — this prevents the AI router from receiving an empty prompt and ensures a valid (though minimal) response.

#### 4.1.4 Error Handling Cases

All error cases must be caught, logged to the application console with full detail, and returned to the client as structured JSON error responses — never as unhandled exceptions or HTML error pages.

| HTTP Status | Condition                                    | Client Response                                                       |
|-------------|----------------------------------------------|-----------------------------------------------------------------------|
| 404         | No releases found, or repository not found   | `{"error": "NOT_FOUND", "detail": "Repository has no releases or does not exist"}` |
| 401         | Private repository, no auth                  | `{"error": "UNAUTHORIZED", "detail": "Repository is private or requires authentication"}` |
| 403         | Rate limit exceeded                          | `{"error": "RATE_LIMITED", "detail": "GitHub API rate limit exceeded. Retry after {Retry-After header value}"}` |
| 422         | Malformed URL parsed successfully by GitHub  | `{"error": "INVALID_REPO", "detail": "GitHub rejected the repository path"}` |
| Timeout     | httpx.TimeoutException                       | `{"error": "TIMEOUT", "detail": "GitHub API did not respond within 15 seconds"}` |
| Network     | httpx.RequestError (DNS, connection refused) | `{"error": "NETWORK_ERROR", "detail": "Could not connect to GitHub API: {exc}"}` |
| Other 5xx   | GitHub infrastructure error                  | `{"error": "GITHUB_ERROR", "detail": "GitHub returned {status_code}"}` |

---

### 4.2 Multi-Provider BYOK (Bring Your Own Key) AI Matrix

#### 4.2.1 Architectural Principle

The AI routing layer is a fully isolated module — it accepts a standardized internal request object and returns a standardized internal response object, regardless of which provider is selected. The FastAPI orchestration layer is never aware of provider-specific payload structures, authentication mechanisms, or response schemas. All provider-specific logic is encapsulated within individual provider handler functions within the routing module.

The routing layer operates entirely at runtime: no AI credentials are stored on disk or in the database. The API key is received as a request parameter, held in memory for the duration of a single request cycle, used for one HTTP call, and discarded. This architecture makes SpecTrack safe to operate as a shared service where multiple users bring their own credentials.

#### 4.2.2 Internal Routing Contract

**Input to the AI Router (typed as a Python dataclass or Pydantic model):**

```
AIRouterRequest:
  provider      : Literal["gemini", "openai", "claude", "openrouter", "custom"]
  api_key       : str                    (required, non-empty)
  model         : str | None             (optional; each provider has a default)
  release_body  : str                    (the raw changelog text to analyze)
  custom_url    : str | None             (required only when provider == "custom")
  custom_headers: dict[str, str] | None  (optional additional headers for "custom")
```

**Output from the AI Router:**

```
AIRouterResponse:
  breaking_changes : list[str]
  new_features     : list[str]
  deprecations     : list[str]
  model_used       : str                 (resolved model string, for DB storage)
  raw_response     : str                 (the raw AI text output, for debugging)
```

On any failure, the router raises a typed `AIRoutingError` exception containing `provider`, `status_code` (if HTTP), and `detail` string. The orchestration layer catches this and returns a structured error response to the client.

#### 4.2.3 Deterministic System Prompt

This system prompt must be embedded verbatim into every AI provider request, regardless of provider. It is the single most critical configuration element in the entire system. Any deviation from this prompt will produce non-deterministic output that breaks the JSON parsing step.

```
SYSTEM PROMPT (exact text, no modification permitted):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You are a software release analysis engine. Your only function is to analyze
release notes or changelog text and extract structured information.

You MUST output ONLY a single, raw, valid, minified JSON object. You MUST NOT
output any markdown formatting, code fences, backticks, explanatory text,
preamble, postamble, or whitespace outside the JSON object itself.

The JSON object MUST contain exactly three keys:
- "breaking_changes": an array of strings, where each string is a concise
  description of one breaking change. If none exist, use an empty array [].
- "new_features": an array of strings, where each string is a concise
  description of one new feature or enhancement. If none exist, use [].
- "deprecations": an array of strings, where each string is a concise
  description of one deprecated API, parameter, or behavior. If none exist,
  use [].

Every string in every array must be self-contained, under 200 characters,
and written in plain English imperative form (e.g., "Removed support for
Node.js 14", "Added streaming response support for chat completions").

Your entire response must be parseable by JSON.parse() with no pre-processing.
Non-compliance with this format is a critical failure.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

USER MESSAGE TEMPLATE (constructed per-request):
"Analyze the following release notes and extract breaking changes, new
features, and deprecations:\n\n{release_body}"
```

#### 4.2.4 Provider Specifications

---

**Provider 1: Gemini (Google)**

| Parameter        | Value                                                           |
|------------------|-----------------------------------------------------------------|
| Endpoint pattern | `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}` |
| Default model    | `gemini-1.5-flash`                                              |
| Auth mechanism   | API key as query parameter (`?key=`)                            |
| Content-Type     | `application/json`                                              |

Request payload structure:
```json
{
  "system_instruction": {
    "parts": [{ "text": "{SYSTEM_PROMPT}" }]
  },
  "contents": [{
    "role": "user",
    "parts": [{ "text": "{USER_MESSAGE}" }]
  }],
  "generationConfig": {
    "temperature": 0.0,
    "maxOutputTokens": 2048
  }
}
```

Response extraction path: `response["candidates"][0]["content"]["parts"][0]["text"]`

---

**Provider 2: OpenAI**

| Parameter        | Value                                                           |
|------------------|-----------------------------------------------------------------|
| Endpoint         | `https://api.openai.com/v1/chat/completions`                    |
| Default model    | `gpt-4o-mini`                                                   |
| Auth mechanism   | `Authorization: Bearer {api_key}` header                        |
| Content-Type     | `application/json`                                              |

Request payload structure:
```json
{
  "model": "{model}",
  "temperature": 0.0,
  "max_tokens": 2048,
  "messages": [
    { "role": "system", "content": "{SYSTEM_PROMPT}" },
    { "role": "user",   "content": "{USER_MESSAGE}"  }
  ]
}
```

Response extraction path: `response["choices"][0]["message"]["content"]`

---

**Provider 3: Claude (Anthropic)**

| Parameter        | Value                                                           |
|------------------|-----------------------------------------------------------------|
| Endpoint         | `https://api.anthropic.com/v1/messages`                         |
| Default model    | `claude-haiku-4-5-20251001`                                     |
| Auth mechanism   | `x-api-key: {api_key}` header                                   |
| Required headers | `anthropic-version: 2023-06-01`                                 |
| Content-Type     | `application/json`                                              |

Request payload structure:
```json
{
  "model": "{model}",
  "max_tokens": 2048,
  "temperature": 0.0,
  "system": "{SYSTEM_PROMPT}",
  "messages": [
    { "role": "user", "content": "{USER_MESSAGE}" }
  ]
}
```

Response extraction path: `response["content"][0]["text"]`

---

**Provider 4: OpenRouter**

| Parameter        | Value                                                           |
|------------------|-----------------------------------------------------------------|
| Endpoint         | `https://openrouter.ai/api/v1/chat/completions`                 |
| Default model    | `google/gemini-flash-1.5`                                       |
| Auth mechanism   | `Authorization: Bearer {api_key}` header                        |
| Optional headers | `HTTP-Referer: https://spectrack.dev`, `X-Title: SpecTrack`     |
| Content-Type     | `application/json`                                              |

Request payload structure: identical to OpenAI schema (OpenRouter is OpenAI-compatible). The `model` field accepts OpenRouter model IDs (e.g., `anthropic/claude-3-haiku`, `openai/gpt-4o-mini`).

Response extraction path: `response["choices"][0]["message"]["content"]` (identical to OpenAI)

---

**Provider 5: Custom Endpoint**

| Parameter        | Value                                                           |
|------------------|-----------------------------------------------------------------|
| Endpoint         | User-supplied `custom_url` (validated as a valid HTTPS URL)    |
| Default model    | User-supplied `model` field (required for custom provider)      |
| Auth mechanism   | `Authorization: Bearer {api_key}` header (default); overridden by `custom_headers` if provided |
| Content-Type     | `application/json`                                              |

The custom provider assumes an OpenAI-compatible chat completions API structure. The request payload mirrors the OpenAI schema exactly. Additional headers from `custom_headers` dict are merged onto the base headers, with `custom_headers` values taking precedence over defaults (except `Content-Type`, which is always forced to `application/json`).

`custom_url` must be validated at routing time: it must be a non-empty string beginning with `https://`. If validation fails, raise `AIRoutingError` with detail `"Custom endpoint URL must be a valid HTTPS URL"`.

---

#### 4.2.5 AI Response Parsing and Sanitization

After receiving the raw text string from any provider's response extraction path, the following sanitization sequence runs before JSON parsing:

1. Strip leading and trailing whitespace from the raw string.
2. If the string begins with ` ```json ` or ` ``` ` (the model violated the system prompt), strip the opening and closing fence markers using a regex: `re.sub(r'^```(?:json)?\s*|\s*```$', '', text, flags=re.DOTALL)`.
3. Attempt `json.loads(sanitized_text)`.
4. If `json.loads` raises `json.JSONDecodeError`, log the raw text and raise `AIRoutingError` with detail `"AI response was not valid JSON: {raw_text[:500]}"`.
5. Validate that the parsed object is a dict containing exactly the keys `breaking_changes`, `new_features`, and `deprecations`.
6. Validate that all three values are lists of strings. Non-string elements should be converted to strings via `str()` rather than raising errors (defensive parsing).
7. Return the validated `AIRouterResponse`.

---

### 4.3 API Ingestion & Orchestration Endpoints (FastAPI)

#### 4.3.1 Route: `POST /api/track`

**Purpose:** The primary execution endpoint. Accepts a GitHub repository URL and AI provider configuration, runs the full extraction-analysis-storage pipeline, and returns the complete structured result.

**Request Schema (Pydantic model: `TrackRequest`):**

```
github_url      : str          (required) — raw GitHub URL string
provider        : str          (required) — one of: "gemini", "openai",
                                            "claude", "openrouter", "custom"
api_key         : str          (required) — provider API key; min length 10
model           : str | None   (optional) — provider-specific model string;
                                            defaults applied per provider if None
custom_url      : str | None   (optional) — required and validated when
                                            provider == "custom"
custom_headers  : dict | None  (optional) — additional headers for custom provider
```

**Pydantic Validators:**
- `provider` must be one of the five allowed string literals; raise `422` with descriptive message otherwise.
- `api_key` must have `len(api_key.strip()) >= 10`; raise `422` with message `"api_key must be at least 10 characters"`.
- `custom_url` must be non-None and begin with `https://` when `provider == "custom"`; raise `422` with message `"custom_url is required for provider 'custom'"`.

**Processing Steps (sequential, async):**

```
Step 1 — URL Parsing
  Call parse_github_url(github_url)
  → On ValueError: return 400 {"error": "INVALID_URL", "detail": str(exc)}

Step 2 — GitHub API Fetch
  Call fetch_latest_release(owner, repo_name)
  → On any GitHubError: return appropriate error code (400/429/500) + error JSON

Step 3 — AI Analysis
  Construct AIRouterRequest from request body + release data
  Call route_to_provider(ai_router_request)
  → On AIRoutingError: return 502 {"error": "AI_ERROR", "detail": str(exc)}

Step 4 — Database Upsert: tracked_repositories
  Execute INSERT INTO tracked_repositories (github_url, owner, repo_name)
  VALUES ($1, $2, $3)
  ON CONFLICT (github_url) DO UPDATE SET owner = EXCLUDED.owner
  RETURNING id
  → repository_id = returned UUID

Step 5 — Database Insert: repository_updates
  Execute INSERT INTO repository_updates
  (repository_id, release_tag, release_name, published_at,
   raw_release_body, ai_analysis, provider_used, model_used)
  VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)
  RETURNING id, created_at

Step 6 — Construct and return response
```

**Success Response (HTTP 200):**

```json
{
  "status": "success",
  "repository": {
    "id": "uuid-string",
    "github_url": "https://github.com/owner/repo",
    "owner": "owner",
    "repo_name": "repo"
  },
  "update": {
    "id": "uuid-string",
    "release_tag": "v2.4.1",
    "release_name": "Release Title",
    "published_at": "2024-03-15T14:22:00+00:00",
    "provider_used": "openai",
    "model_used": "gpt-4o-mini",
    "ai_analysis": {
      "breaking_changes": ["Removed support for Python 3.8"],
      "new_features": ["Added async iterator protocol to StreamClient"],
      "deprecations": ["Deprecated sync `get()` method; use `aget()` instead"]
    },
    "created_at": "2024-03-15T14:23:10+00:00"
  }
}
```

---

#### 4.3.2 Route: `GET /api/history`

**Purpose:** Retrieves stored tracking records from the database, structured as a descending chronological timeline. Supports optional filtering by repository.

**Query Parameters:**

```
repo_filter  : str | None   (optional) — partial match against github_url
                                         using SQL ILIKE %{repo_filter}%
limit        : int          (optional, default: 50, max: 200) — result count cap
offset       : int          (optional, default: 0) — pagination offset
```

**Query Logic:**

The endpoint executes a JOIN query across both tables, ordered by `repository_updates.created_at DESC`:

```sql
SELECT
  ru.id               AS update_id,
  ru.release_tag,
  ru.release_name,
  ru.published_at,
  ru.ai_analysis,
  ru.provider_used,
  ru.model_used,
  ru.created_at       AS tracked_at,
  tr.id               AS repository_id,
  tr.github_url,
  tr.owner,
  tr.repo_name
FROM repository_updates ru
JOIN tracked_repositories tr ON ru.repository_id = tr.id
WHERE ($1::text IS NULL OR tr.github_url ILIKE '%' || $1 || '%')
ORDER BY ru.created_at DESC
LIMIT $2
OFFSET $3;
```

**Success Response (HTTP 200):**

```json
{
  "status": "success",
  "count": 3,
  "records": [
    {
      "update_id": "uuid",
      "repository_id": "uuid",
      "github_url": "https://github.com/org/repo",
      "owner": "org",
      "repo_name": "repo",
      "release_tag": "v3.0.0",
      "release_name": "Major Release",
      "published_at": "2024-03-15T14:22:00+00:00",
      "tracked_at": "2024-03-15T14:23:10+00:00",
      "provider_used": "gemini",
      "model_used": "gemini-1.5-flash",
      "ai_analysis": {
        "breaking_changes": ["..."],
        "new_features": ["..."],
        "deprecations": ["..."]
      }
    }
  ]
}
```

**Error Responses:**
- Database connection failure → `503 {"error": "DB_ERROR", "detail": "Database unavailable"}`
- Invalid `limit` value (> 200 or < 1) → `422 {"error": "INVALID_PARAM", "detail": "limit must be between 1 and 200"}`

---

## 5. Minimal Testing Interface (HTML/JS Workspace)

### 5.1 Design Philosophy and Scope Exclusion

**Explicit non-goals for this sprint:** CSS frameworks, component libraries, responsive design breakpoints, accessibility compliance, dark mode, animation, visual polish, brand identity, icon systems, loading skeletons, or any design system integration. This interface exists solely as a functional testing harness to validate that the backend pipeline operates correctly end-to-end. It is not a product UI. Aesthetic quality is explicitly deprioritized in favor of functional completeness and debugging visibility.

### 5.2 Delivery Format

A single self-contained HTML file served by FastAPI at `GET /` via `FileResponse("index.html")` or inline `HTMLResponse`. Zero external dependencies beyond what is loaded from a CDN (if any). Zero build steps. Zero bundlers. Vanilla HTML + vanilla JavaScript (ES2020 features acceptable, no TypeScript). The file must be completable in one session by a single developer and must be operational on first load in any modern browser without configuration.

### 5.3 Structural Blueprint

The page is divided into four functional zones rendered as simple `<div>` blocks with inline styles or a minimal `<style>` block. No CSS classes beyond layout necessities.

#### Zone 1: BYOK Configuration Panel

Located at the top of the page. Contains:

- **Provider selector** — `<select>` element with five `<option>` elements: `gemini`, `openai`, `claude`, `openrouter`, `custom`. On change, conditionally show/hide the custom endpoint fields.
- **API Key input** — `<input type="password">` (masked) for the provider API key. Placeholder: `"Your API key (never stored server-side)"`.
- **Model override input** — `<input type="text">` (optional). Placeholder shows per-provider default based on selected provider in the dropdown (updated via JS `onchange` handler). If left empty, the backend applies the provider default.
- **Custom endpoint fields** (conditionally visible when provider == `"custom"`):
  - `<input type="url">` for the custom base URL.
  - `<textarea>` for optional additional headers (JSON format: `{"X-Custom-Header": "value"}`).

#### Zone 2: Repository Input Bar

Located below Zone 1. Contains:

- **GitHub URL input** — `<input type="url">` full width. Placeholder: `"https://github.com/owner/repository"`.
- **Track button** — `<button>` labeled `"Track Latest Release"`. On click: disable button, set button text to `"Tracking..."`, call the submission function, re-enable on completion.

#### Zone 3: Real-Time Console Log Window

A `<pre>` or `<div>` with `font-family: monospace` and a fixed height (e.g., `200px`) with `overflow-y: auto`. New log entries are appended as timestamped lines via `innerHTML` or `innerText` manipulation. The console window auto-scrolls to the bottom on each new entry.

Log entries are appended at each pipeline step. The JavaScript submission function must append status lines at minimum at the following points:

```
[HH:MM:SS] Submitting request to POST /api/track...
[HH:MM:SS] Request sent. Awaiting response...
[HH:MM:SS] Response received. HTTP {status_code}
[HH:MM:SS] SUCCESS — Release {tag} analyzed via {provider}
            OR
[HH:MM:SS] ERROR — {error_code}: {detail}
```

On `GET /api/history` calls:
```
[HH:MM:SS] Fetching history...
[HH:MM:SS] Retrieved {N} records.
```

#### Zone 4: Output Data Grid

Located below Zone 3. A plain `<table>` or structured `<div>` layout displaying the most recent tracking result and the history feed in two sub-sections:

**Sub-section A — Latest Result (raw JSON display):**
A `<pre>` block rendered immediately after a successful track call, containing the full JSON response body from `POST /api/track` formatted with `JSON.stringify(data, null, 2)`. Updated on every successful submission.

**Sub-section B — History Table:**
A minimal `<table>` with columns: `Tracked At`, `Repository`, `Release Tag`, `Provider`, `Breaking Changes`, `New Features`, `Deprecations`. Rows are populated by calling `GET /api/history` on page load and after every successful track submission. Breaking/New/Deprecations columns render as `<ul>` lists inline within cells, or comma-separated strings for compactness. An explicit "Refresh History" `<button>` allows manual re-fetch.

### 5.4 JavaScript Submission Function Specification

The core JS function `async function trackRepository()` must:

1. Read and validate that GitHub URL input is non-empty; alert and return if empty.
2. Read and validate that API key input is non-empty; alert and return if empty.
3. Collect provider, model, custom_url, and custom_headers fields.
4. If provider is `"custom"` and custom_url is empty, alert and return.
5. If custom_headers field is non-empty, attempt `JSON.parse()`; if parse fails, alert `"Custom headers must be valid JSON"` and return.
6. Construct the request payload object.
7. Append first log entry to console.
8. Call `fetch('/api/track', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) })`.
9. Await response; append HTTP status to console.
10. Parse response JSON.
11. On success: render JSON to Sub-section A, append success log, call `loadHistory()`.
12. On error: append error log with detail from response JSON.
13. Re-enable the Track button in a `finally` block.

### 5.5 Environment Variable Configuration

The FastAPI application reads all sensitive configuration from environment variables at startup. The application must not start if `SUPABASE_URL` or `SUPABASE_KEY` are absent. A startup validation block must check for these and raise a descriptive `RuntimeError` naming the missing variable.

Required environment variables:

```
SUPABASE_URL        — Supabase project URL (e.g., https://xxxx.supabase.co)
SUPABASE_KEY        — Supabase service role key or anon key
GITHUB_TOKEN        — (optional) GitHub personal access token for higher rate limits
HOST                — (optional, default: "0.0.0.0")
PORT                — (optional, default: 8000)
```

---

## Appendix A: Python Dependency Manifest

```
fastapi>=0.111.0
uvicorn[standard]>=0.29.0
httpx>=0.27.0
pydantic>=2.7.0
supabase>=2.4.0       # Official Supabase Python client
python-dotenv>=1.0.0  # .env file loading for local development
```

---

## Appendix B: Project File Structure

```
spectrack/
├── main.py                   # FastAPI app instantiation, route registration,
│                             # startup validation, static file serving
├── .env                      # Local environment variables (git-ignored)
├── .env.example              # Committed template with placeholder values
├── requirements.txt          # Python dependency manifest
├── index.html                # Single-file testing interface
└── modules/
    ├── __init__.py
    ├── github_extractor.py   # URL parser + GitHub API client
    ├── ai_router.py          # BYOK multi-provider routing layer
    └── db.py                 # Supabase client initialization + query functions
```

---

## Appendix C: Key Architectural Decisions & Rationale

| Decision | Rationale |
|---|---|
| `httpx.AsyncClient` over `requests` | Preserves FastAPI's async execution model; prevents blocking the event loop during I/O-bound GitHub API calls |
| JSONB for `ai_analysis` | AI output shape is fixed (three keys) but array lengths are variable; JSONB allows GIN indexing for future full-text search on analysis content without schema migration |
| BYOK runtime credentials | Eliminates operator credential storage liability; each user bears responsibility for their own API key security |
| `ON CONFLICT DO UPDATE` upsert | Ensures `tracked_repositories` remains deduplicated without requiring application-level pre-check queries |
| `temperature: 0.0` across all providers | Maximizes JSON output determinism; reduces risk of creative formatting that breaks the parser |
| System prompt forbids markdown fences | Models frequently wrap JSON in code fences by default; the prohibition plus the sanitization step in §4.2.5 create defense in depth |
| Single-file HTML interface | Eliminates build toolchain complexity entirely; the interface is a debugging tool, not a product, and must be operational in one file open |
```
