// Naukri.com Playwright scraper - uses saved auth cookies to bypass reCAPTCHA.
// Returns JSON array of jobs to stdout.
// Usage: node playwright/scrape_naukri.js

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const AUTH_PATH = path.join(__dirname, 'naukri_auth.json');

const KEYWORDS = [
  'AI Operations Manager', 'AI Project Manager', 'AI Customer Success',
  'AI Implementation Specialist', 'AI Strategy Consultant', 'AI Solutions Manager',
  'Generative AI', 'AI Consultant',
  'Customer Success Manager', 'Project Coordinator', 'Operations Manager', 'Project Manager',
];

const LOCATION = 'delhi-ncr';

async function scrape() {
  if (!fs.existsSync(AUTH_PATH)) {
    console.log(JSON.stringify({ error: 'No naukri_auth.json. Run LOGIN_ONCE.bat first.', jobs: [] }));
    return;
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    storageState: AUTH_PATH,
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
  });

  const allJobs = [];
  const seenIds = new Set();

  for (const kw of KEYWORDS) {
    try {
      const page = await context.newPage();
      const url = `https://www.naukri.com/${kw.toLowerCase().replace(/\s+/g, '-')}-jobs-in-${LOCATION}?experience=2-5`;
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
      await page.waitForTimeout(3500);

      // Extract job cards
      const jobs = await page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll('article.jobTuple, div.srp-jobtuple-wrapper, .cust-job-tuple'));
        return cards.slice(0, 8).map(c => {
          const titleEl = c.querySelector('a.title, a[class*="title"]');
          const compEl = c.querySelector('a.subTitle, a.comp-name, [class*="company"]');
          const locEl = c.querySelector('span.locWdth, span[class*="loc"], li[class*="location"]');
          const expEl = c.querySelector('span[class*="exp"], li[class*="exp"]');
          const descEl = c.querySelector('span.job-desc, div[class*="job-desc"]');
          return {
            job_title: titleEl ? titleEl.textContent.trim() : '',
            job_url: titleEl ? titleEl.href : '',
            company: compEl ? compEl.textContent.trim() : '',
            location: locEl ? locEl.textContent.trim() : '',
            experience: expEl ? expEl.textContent.trim() : '',
            description: descEl ? descEl.textContent.trim().substring(0, 1500) : ''
          };
        }).filter(j => j.job_url && j.job_title);
      });

      for (const j of jobs) {
        const id = j.job_url.match(/\/(\d+)/)?.[1] || j.job_url;
        if (seenIds.has(id)) continue;
        seenIds.add(id);
        allJobs.push({ ...j, source_platform: 'naukri', search_term: kw });
      }
      await page.close();
      await new Promise(r => setTimeout(r, 2000));  // 2s between searches
    } catch (e) {
      // Skip this keyword on error, continue with others
    }
  }

  await browser.close();
  console.log(JSON.stringify({ jobs: allJobs, count: allJobs.length }));
}

scrape().catch(e => {
  console.log(JSON.stringify({ error: e.message, jobs: [] }));
});
