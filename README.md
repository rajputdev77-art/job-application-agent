# Job Application Agent System — Dev Rajput

## System Overview

A fully automated job application pipeline built on n8n, Anthropic Claude API, and Playwright. The system scrapes job listings every 4-6 hours from LinkedIn, Indeed, Welcome to the Jungle, Naukri, and Tier 1 company career pages — scores each against Dev's profile using Claude AI — generates a tailored CV and cover letter for matches scoring 60+ — and submits applications automatically via Playwright. Every application is logged to Google Sheets. Tier 1 company applications pause before final submit for manual review.

---

## Prerequisites

- **Node.js 18+** — [nodejs.org](https://nodejs.org)
- **n8n running locally** — `npx n8n` or `npm install -g n8n && n8n start`
- **Anthropic API key** — [console.anthropic.com](https://console.anthropic.com)
- **Google Cloud service account** with Google Sheets API enabled and editor access to your tracking sheet
- **Git** (for version control and GitHub push)

---

## Setup Instructions

### 1. Fill in your environment variables

```bash
cp .env.example .env
# Edit .env with your actual keys
```

Required values:
- `ANTHROPIC_API_KEY` — from console.anthropic.com
- `GOOGLE_SHEETS_ID` — the ID from your Google Sheet URL (`/spreadsheets/d/SHEET_ID/edit`)
- `GOOGLE_SERVICE_ACCOUNT_EMAIL` — from Google Cloud Console
- `GOOGLE_PRIVATE_KEY` — from the JSON key file (include the full `-----BEGIN PRIVATE KEY-----` block)

### 2. Run setup script

```bash
bash setup/install.sh
```

This installs Playwright, checks n8n, and creates the output directory.

### 3. Import n8n workflows in this exact order

Go to n8n UI → Settings → Import Workflow, import each file:

1. `core/fit_scorer.json`
2. `core/cv_builder.json`
3. `core/app_logger.json`
4. `agents/india_agent.json`
5. `agents/abroad_agent.json`
6. `agents/tier1_agent.json`
7. `scrapers/linkedin_rss.json`
8. `scrapers/naukri_scraper.json`
9. `scrapers/indeed_scraper.json`
10. `scrapers/wttj_scraper.json`
11. `scrapers/tier1_scraper.json`

### 4. Configure credentials in n8n

After importing, open each workflow and set:
- **Google Sheets credential** — add your service account JSON
- **HTTP Request nodes** — the Anthropic API key is read from env (`ANTHROPIC_API_KEY`), no extra setup needed

### 5. Create Google Sheet

Create a new Google Sheet and add these exact headers in Row 1:

```
Timestamp | Company | Job Title | Platform | Location | Fit Score | CV Variant | Cover Letter | Status | Job URL | Notes
```

Share the sheet with your service account email (Editor access).

### 6. Activate all workflows

In n8n, toggle each workflow to **Active**.

### 7. Verify the system

```bash
node setup/test_scorer.js
```

You should see a JSON score response for a sample Customer Success Manager role.

---

## How to Update CV Variants

Drop new or updated markdown files into `/cv`:
- `cv_variant_a.md` — operations-heavy version (default for most roles)
- `cv_variant_b.md` — AI/automation-heavy version (for tech/consulting roles)
- `master_profile.md` — never modify this directly; it's the AI reference document

To add a new variant: create `cv_variant_c.md` and update the CV builder workflow's function node to handle the new variant letter.

---

## How to Read the Application Log

Open your Google Sheet. Each row is one application attempt.

| Column | Description |
|--------|-------------|
| Timestamp | When the application was submitted |
| Company | Company name |
| Job Title | Role applied for |
| Platform | Source (LinkedIn, Naukri, Indeed, WTTJ, Tier1) |
| Location | Job location |
| Fit Score | AI score 0-100 |
| CV Variant | A or B |
| Cover Letter | Yes/No |
| Status | APPLIED / AWAITING_MANUAL_SUBMIT / FAILED / REJECTED |
| Job URL | Direct link to the job posting |
| Notes | Error messages or notes from the agent |

---

## Architecture

```
Scrapers (every 4-6h)
    ↓
Fit Scorer (Claude AI, score 0-100)
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

## Known Limitations

- **LinkedIn anti-bot detection** may block Playwright intermittently. If this happens, the agent logs the failure and moves on — it does not retry.
- **Tier 1 agent** requires manual final submit by design. Dev reviews the screenshot and submits himself.
- **n8n must be running** for scrapers to fire on schedule. Use `pm2` or a system service to keep it alive.
- **LinkedIn RSS** is not officially supported. The scraper uses search URL patterns that may break if LinkedIn changes their frontend.
- **Naukri scraper** requires a logged-in session. Set up Playwright with a saved auth state file.

---

## Troubleshooting

| Error | Fix |
|-------|-----|
| `ANTHROPIC_API_KEY not set` | Check your `.env` file and restart n8n |
| `Google Sheets 403` | Make sure the sheet is shared with the service account email |
| `Playwright: browser not found` | Run `npx playwright install chromium` |
| `Webhook not found` | Make sure all workflows are imported AND activated in n8n |
| `Score always 0` | Check the Claude API response — the fit_scorer prompt may have a formatting issue |
| `Naukri login required` | Run `node playwright/naukri_apply.js --login` to save auth state |

---

## File Reference

```
job-agent/
├── .env                          # Your secrets (never commit this)
├── .env.example                  # Template for new installs
├── cv/
│   ├── cv_variant_a.md           # Operations-heavy CV
│   ├── cv_variant_b.md           # AI/Automation-heavy CV
│   └── master_profile.md         # Full profile for AI context
├── prompts/
│   ├── fit_scorer.md             # System prompt: fit scoring
│   ├── cv_tailor.md              # System prompt: CV tailoring
│   └── cover_letter.md           # System prompt: cover letter writing
├── scrapers/                     # n8n scraper workflows
├── agents/                       # n8n executor workflows
├── core/                         # n8n core pipeline workflows
├── playwright/                   # Browser automation scripts
├── setup/                        # Install and test scripts
└── output/                       # Generated CVs, cover letters, screenshots
```
