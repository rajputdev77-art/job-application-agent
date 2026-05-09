// WTTJ Playwright scraper with stealth + cookie banner dismissal.
const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealth);

const SEARCHES = [
  { query: 'AI Operations', city: 'Paris' },
  { query: 'AI Project Manager', city: 'London' },
  { query: 'AI Customer Success', city: 'Amsterdam' },
  { query: 'AI Strategy', city: 'Berlin' },
  { query: 'Customer Success Manager', city: 'Amsterdam' },
  { query: 'Operations Manager', city: 'Berlin' },
];

async function scrape() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox']
  });
  const context = await browser.newContext({
    viewport: { width: 1366, height: 800 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    locale: 'en-US'
  });

  const allJobs = [];
  const seen = new Set();

  for (const s of SEARCHES) {
    try {
      const page = await context.newPage();
      const url = `https://www.welcometothejungle.com/en/jobs?query=${encodeURIComponent(s.query)}&aroundQuery=${encodeURIComponent(s.city)}&page=1`;
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3000);

      // Dismiss cookie consent banner (Axeptio uses "OK for me" or "I choose")
      try {
        const consentBtn = page.locator('button:has-text("OK for me"), button:has-text("Accept"), [data-testid*="consent"] button').first();
        if (await consentBtn.isVisible({ timeout: 2500 }).catch(() => false)) {
          await consentBtn.click();
          await page.waitForTimeout(2000);
        }
      } catch (_) {}

      // Wait for job cards to render
      await page.waitForTimeout(4000);

      const jobs = await page.evaluate(() => {
        // WTTJ uses li elements with data-testid="search-results-list-item-wrapper"
        const cards = Array.from(document.querySelectorAll('li[data-testid*="search-results"], li[role="listitem"], a[href*="/companies/"][href*="/jobs/"]'));
        return cards.slice(0, 10).map(c => {
          const link = c.tagName === 'A' ? c : c.querySelector('a[href*="/jobs/"], a[href*="/companies/"]');
          if (!link) return null;
          const titleEl = c.querySelector('h2, h3, h4, [data-testid*="title"]');
          const compEl = c.querySelector('[data-testid*="company"], [class*="organization"]');
          const locEl = c.querySelector('[data-testid*="location"], [class*="location"]');
          return {
            job_url: link.href.startsWith('http') ? link.href : `https://www.welcometothejungle.com${link.getAttribute('href')}`,
            job_title: titleEl ? titleEl.textContent.trim().substring(0, 200) : '',
            company: compEl ? compEl.textContent.trim() : '',
            location: locEl ? locEl.textContent.trim() : 'Europe',
          };
        }).filter(j => j && j.job_url && j.job_title && j.job_title.length > 3);
      });

      for (const j of jobs) {
        if (seen.has(j.job_url)) continue;
        seen.add(j.job_url);
        allJobs.push({
          ...j, source_platform: 'wttj', search_term: s.query,
          description: `${j.job_title} at ${j.company}, ${j.location}. See: ${j.job_url}`
        });
      }
      await page.close();
      await new Promise(r => setTimeout(r, 2500));
    } catch (e) {}
  }

  await browser.close();
  console.log(JSON.stringify({ jobs: allJobs, count: allJobs.length }));
}

scrape().catch(e => console.log(JSON.stringify({ error: e.message, jobs: [] })));
