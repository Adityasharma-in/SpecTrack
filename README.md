# SpecTrack

**AI-powered GitHub release intelligence tracker** — Stop reading changelogs manually. SpecTrack ingests any GitHub repository's latest release, runs it through your chosen AI model, and returns structured intelligence: breaking changes, new features, and deprecations.

---

## The Problem

Every modern project relies on dozens to hundreds of dependencies. When upstream maintainers ship updates, developers face three critical pain points:

| Pain Point | Impact |
|---|---|
| **Silent breaking changes** | An API removal, renamed export, or changed default silently breaks your build — not at release, but at deploy. No structured record exists to alert you. |
| **Changelog fatigue** | Reading, understanding, and categorizing release notes for 50+ dependencies is unsustainable. Changelogs range from precise to entirely unstructured. Teams either ignore them (risk) or spend hours (cost). |
| **Missed feature leverage** | Performance improvements, new APIs, and architectural upgrades sit in changelogs no one reads. Teams miss out on 3x faster rendering, native connection pooling, or simpler APIs — not because they chose to, but because they didn't know. |

## What SpecTrack Solves

SpecTrack converts unstructured release prose into **deterministic JSON intelligence records** in under 10 seconds:

- **Breaking changes** — What will break if I upgrade? (API removals, behavior shifts, config changes, renamed interfaces)
- **New features** — What can I optionally use? (new endpoints, commands, modules, integrations)
- **Deprecations** — What should I plan to migrate away from? (end-of-life notices, migration warnings)

No more reading changelogs. No more surprise CI failures. One API call → structured data.

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌───────────────┐     ┌─────────────┐
│   Browser   │ ──▶ │  FastAPI     │ ──▶ │  GitHub API   │     │  Supabase   │
│  (React/JS) │ ◀── │  Server      │ ──▶ │  + AI Provider│     │ (PostgreSQL)│
└─────────────┘     └──────────────┘     └───────────────┘     └─────────────┘
                           │
                     ┌─────┴──────┐
                     │  AI Router  │
                     │  Gemini ◀──│── Your API Key
                     │  OpenAI ◀──│── Your API Key
                     │  Claude ◀──│── Your API Key
                     │  OpenRouter │
                     │  Custom     │
                     └────────────┘
```

**Your API keys. Your choice of AI model. Zero vendor lock-in.**

## Features

- **Multi-provider AI routing** — BYOK (Bring Your Own Key) to Gemini, OpenAI, Claude, OpenRouter, or any OpenAI-compatible endpoint
- **Commit enrichment** — Automatically fetches and appends commit messages between releases for richer context
- **Structured JSON output** — Every analysis is stored as `breaking_changes`, `new_features`, and `deprecations` arrays
- **Historical tracking** — Every analysis is persisted with timestamps, viewable in a paginated history table
- **Authentication via Clerk** — Secure user-scoped access to history and tracking
- **Smart NLP categorization** — The AI model is prompted with explicit reasoning rules to classify changes by functional consequence, not keyword matching

## Quick Start

### Prerequisites
- Python 3.10+
- Supabase project (for persistence)
- API key for at least one AI provider

### 1. Clone and install
```bash
git clone https://github.com/Adityasharma-in/SpecTrack.git
cd SpecTrack
pip install -r requirements.txt
```

### 2. Configure environment
```bash
cp .env.example .env
```
Fill in your `.env`:
```
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
CLERK_SECRET_KEY=your_clerk_secret
GITHUB_TOKEN=your_github_token  # optional, increases rate limits
```

### 3. Run database migration
```bash
python run_migration.py
```

### 4. Start the server
```bash
python main.py
```
Open **http://localhost:8000** in your browser.

### 5. Use the API
```bash
curl -X POST http://localhost:8000/api/track \
  -H "Content-Type: application/json" \
  -d '{
    "github_url": "https://github.com/openclaw/openclaw",
    "provider": "openrouter",
    "api_key": "your_openrouter_key"
  }'
```

### Response
```json
{
  "status": "success",
  "repository": { "owner": "openclaw", "repo_name": "openclaw" },
  "update": {
    "release_tag": "v2026.5.26",
    "ai_analysis": {
      "breaking_changes": ["...", "..."],
      "new_features": ["...", "..."],
      "deprecations": ["...", "..."]
    }
  }
}
```

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.10+, FastAPI, Uvicorn |
| Frontend | React 18 + Vite (or vanilla HTML/JS fallback) |
| Database | Supabase (PostgreSQL) |
| AI Providers | Gemini, OpenAI, Claude, OpenRouter, Custom |
| Auth | Clerk (JWT) |
| GitHub | REST API v3, Compare API |

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/track` | Track a repo's latest release |
| `GET` | `/api/history` | Get tracked history (paginated) |
| `GET` | `/api/me` | Get current user info |

---

Built for developers who want to stay ahead of their dependencies.
