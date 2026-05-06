# How Your Job Agent Works (Plain English)

## What it does in one sentence

While you sleep, eat, or scroll Instagram, robots search 5 job sites every few hours, score each job against your CV, and apply to the good ones automatically.

---

## The 5 robots (and what each one does)

### 1. Scrapers — "The Spies"
Every 4-6 hours, 5 scraper robots wake up and check job sites:
- **LinkedIn Scraper** — searches LinkedIn for jobs matching "Customer Success", "Project Coordinator", "Operations Manager", "BDM", in India and Europe
- **Naukri Scraper** — searches Naukri.com for the same roles in Delhi NCR
- **Indeed Scraper** — searches Indeed (India + EU)
- **Welcome to the Jungle Scraper** — searches WTTJ for European roles
- **Tier 1 Scraper** — checks Capgemini, Accenture, JLL, CBRE, EY career pages

They grab the title, company, location, and full job description. They remember which jobs they've already seen so they don't waste time re-checking them.

### 2. Fit Scorer — "The Judge"
Every job the spies find gets sent to the Judge (Qwen 2.5 AI running on your laptop).

The Judge reads the job description and your CV and gives a score 0-100 based on:
- Does the title match your target roles? (25 pts)
- How many of your skills appear in the job? (25 pts)
- Does 3 years experience meet the requirement? (15 pts)
- Is the salary 10+ LPA? (15 pts) — **rejects anything below 10 LPA**
- Is it an AI/tech company? (10 pts)
- Does it lead toward Europe? (10 pts)

**Below 70 = REJECTED.** Above 70 = goes to the next robot.

### 3. CV Builder — "The Tailor"
For every job that scores 70+, the Tailor takes your master CV and rewrites it specifically for that job. It mirrors the keywords from the job description but never invents experience you don't have.

It also writes a custom cover letter (3 paragraphs, max 250 words, in your voice — direct, not desperate).

Both files are saved to `output/` with the company name in the filename.

### 4. Executor Agents — "The Submitters"
Three submitters handle different platforms:

- **India Agent** — applies to Naukri, Indeed India, LinkedIn India automatically using a real Chrome browser (Playwright). Fills the form, uploads CV, hits submit.
- **Abroad Agent** — same for European jobs (LinkedIn EU, WTTJ, Indeed EU). Always includes a cover letter.
- **Tier 1 Agent** — for Capgemini/Accenture/JLL/CBRE/EY: fills the entire form, takes a screenshot, then **STOPS** without submitting. Sends you the screenshot. You review and click submit yourself. (These companies care more, so we don't want a bot screwup costing you the job.)

### 5. App Logger — "The Notebook"
Every single action — applied, rejected, failed, awaiting review — gets written to a Google Sheet with a timestamp. That's how you know what happened overnight.

The Sheet has columns: Timestamp | Company | Job Title | Platform | Location | Fit Score | CV Variant | Cover Letter | Status | Job URL | Notes

---

## Do you have to do anything daily?

**No.** Once it's set up, it runs forever. You just open the dashboard each morning to see what was applied to.

The only manual thing: when the Tier 1 Agent fills a Capgemini/Accenture/etc. form, you have to click "Submit" yourself after reviewing the screenshot. That's by design (5 companies max per week probably).

---

## What's running where

| Part | Where it runs | Cost |
|---|---|---|
| n8n (the conductor) | Your laptop, port 5678 | Free |
| Qwen AI | Your laptop, Ollama (port 11434) | Free |
| Playwright Chrome | Your laptop, in the background | Free |
| Google Sheets log | Google's servers | Free |
| Dashboard HTML | Your laptop | Free |

**Total monthly cost: ₹0**

---

## What can go wrong

| Problem | What happens | Fix |
|---|---|---|
| Laptop is OFF | Nothing runs. No applications. | Keep laptop ON or use a Raspberry Pi |
| LinkedIn detects bot | That one application fails. Logged as FAILED. Other sites continue. | Save your LinkedIn cookies once |
| Internet is down | Scrapers fail silently, retry next cycle | Nothing |
| Ollama crashes | All AI scoring stops | Restart with `ollama serve` |
| n8n crashes | Everything stops | Restart n8n |
| Job site changes their HTML | That scraper breaks until updated | Tell me, I fix it |

---

## What you control

Edit these files anytime — the system picks up changes automatically:

- `cv/cv_variant_a.md` — your operations CV
- `cv/cv_variant_b.md` — your AI/automation CV
- `prompts/fit_scorer.md` — what the AI Judge looks for (raise/lower threshold, change preferences)
- `prompts/cover_letter.md` — your voice and tone
- `.env` — `MIN_SALARY_LPA` and `FIT_THRESHOLD`

---

## TL;DR

You set it up once. Then every 4-6 hours, robots find jobs, the AI grades them, and the good ones get applied to with a custom CV and cover letter. Everything is logged. You check the dashboard whenever you want. Total cost: zero.
