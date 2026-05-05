# Job Application Agent System — Dev Rajput

## System Overview

A fully automated job application pipeline built on **n8n + local Ollama (Qwen 2.5 7B Instruct) + Playwright**. Runs entirely on your local machine — **zero API costs**.

The system scrapes job listings every 4-6 hours from LinkedIn, Indeed, Welcome to the Jungle, Naukri, and Tier 1 company career pages — scores each against Dev's profile using Qwen 2.5 — generates a tailored CV and cover letter for matches scoring 60+ — and submits applications automatically via Playwright. Every application is logged to Google Sheets. Tier 1 company applications pause before final submit for manual review.

---

## Prerequisites

- **Node.js 18+**
- **n8n** (`npm install -g n8n`)
- **Ollama** with `qwen2.5:7b-instruct` model (~4.7 GB)
- **Google Cloud service account** with Sheets API enabled
- **16 GB RAM minimum** (8 GB used by Qwen during inference)

---

## Setup

### 1. Install Ollama and pull Qwen
```bash
# Ollama (if not installed): https://ollama.com/download
ollama pull qwen2.5:7b-instruct
ollama list  # verify
```

### 2. Fill `.env`
```bash
cp .env.example .env
# Then edit .env:
#   OLLAMA_BASE_URL=http://localhost:11434
#   OLLAMA_MODEL=qwen2.5:7b-instruct
#   GOOGLE_SHEETS_ID=...
#   GOOGLE_SERVICE_ACCOUNT_EMAIL=...
#   GOOGLE_PRIVATE_KEY=...
```

### 3. Run setup
```bash
bash setup/install.sh
```

### 4. Import workflows into n8n
**One-shot CLI import (recommended):**
```bash
for f in core/*.json agents/*.json scrapers/*.json; do
  n8n import:workflow --input="$f"
done
```

Then activate them all:
```bash
for id in fit-scorer-workflow cv-builder-workflow app-logger-workflow \
          india-agent-workflow abroad-agent-workflow tier1-agent-workflow \
          linkedin-scraper-workflow naukri-scraper-workflow indeed-scraper-workflow \
          wttj-scraper-workflow tier1-scraper-workflow; do
  n8n update:workflow --id="$id" --active=true
done
```

**Restart n8n** for activations to take effect: stop the running n8n process, then `npx n8n` again.

### 5. Create Google Sheet
Add these headers in row 1: `Timestamp | Company | Job Title | Platform | Location | Fit Score | CV Variant | Cover Letter | Status | Job URL | Notes`. Share with your service account email.

### 6. Verify
```bash
node setup/test_scorer.js
```
First call takes 30-90s (Qwen cold start). Subsequent calls ~10-20s.

---

## Why Local Ollama Instead of Anthropic API

- **Free** — no per-token costs
- **Private** — your CV and job data never leave your machine
- **Fast enough** — Qwen 2.5 7B on CPU produces a fit score in ~15s
- **Good enough quality** — Qwen 2.5 7B reliably outputs structured JSON, follows multi-step prompts, and writes coherent prose

The workflows still send the same prompts; only the HTTP endpoint changed (Anthropic → `localhost:11434/api/chat`).

---

## Architecture

```
Scrapers (every 4-6h)
    ↓
Fit Scorer (Qwen 2.5, score 0-100)
    ↓ (60+ only)
CV Builder (tailor CV + write cover letter)
    ↓
Router (India / Abroad / Tier1)
    ↓
Executor Agents (Playwright auto-apply)
    ↓
App Logger (Google Sheets)
```

---

## Application Log Columns

| Column | Description |
|--------|-------------|
| Timestamp | When the application was submitted |
| Company | Company name |
| Job Title | Role applied for |
| Platform | linkedin / naukri / indeed / wttj / tier1_X |
| Location | Job location |
| Fit Score | Qwen score 0-100 |
| CV Variant | A or B |
| Cover Letter | Yes/No |
| Status | APPLIED / AWAITING_MANUAL_SUBMIT / FAILED / REJECTED |
| Job URL | Direct link |
| Notes | Errors / agent comments |

---

## Known Limitations

- **First Qwen inference is slow** (cold start ~30s). Keep Ollama warm by sending periodic pings.
- **LinkedIn anti-bot detection** may block Playwright. Save your auth cookies to `playwright/linkedin_auth.json` to reduce blocks.
- **Tier 1 agent never auto-submits** by design — review the screenshot and submit manually.
- **n8n must restart** when workflows are activated via CLI.

---

## Troubleshooting

| Error | Fix |
|-------|-----|
| `Webhook not registered` | Restart n8n after CLI activation |
| `Ollama returned empty response` | Check `ollama ps` — model loaded? Increase timeout |
| `Playwright: browser not found` | `npx playwright install chromium` |
| `Google Sheets 403` | Share sheet with service account email |
| `Score always 0` | Qwen may be returning malformed JSON; check n8n execution logs |
| `Out of memory` | Switch to `qwen2.5:3b-instruct` or `llama3.2:latest` (smaller models) |

---

## File Reference

```
job-agent/
├── .env                          # Your secrets (gitignored)
├── .env.example                  # Template
├── cv/
│   ├── cv_variant_a.md           # Operations-heavy CV
│   ├── cv_variant_b.md           # AI/Automation-heavy CV
│   └── master_profile.md         # Full profile for AI context
├── prompts/
│   ├── fit_scorer.md
│   ├── cv_tailor.md
│   └── cover_letter.md
├── core/                         # fit_scorer, cv_builder, app_logger
├── agents/                       # india_agent, abroad_agent, tier1_agent
├── scrapers/                     # linkedin, naukri, indeed, wttj, tier1
├── playwright/                   # apply scripts
├── setup/                        # install.sh + test_scorer.js
└── output/                       # Generated CVs, cover letters, screenshots
```
