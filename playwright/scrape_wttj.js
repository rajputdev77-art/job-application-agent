// Welcome to the Jungle Playwright scraper.
// Scrapes their actual job listing pages (the api.welcometothejungle.com endpoint we used was 404).

const { chromium } = require('playwright');

const SEARCHES = [
  { query: 'AI Operations', city: 'Paris' },
  { query: 'AI Project Manager', city: 'London' },
  { query: 'AI Customer Success', city: 'Amsterdam' },
  { query: 'AI Strategy', city: 'Berlin' },
  { query: 'Customer Success Manager', city: 'Amsterdam' },
  { query: 'Operations Manager', city: 'Berlin' },
];

async function scrape() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
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
      await page.waitForTimeout(4500);

      const jobs = await page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll('a[href*="/jobs/"], li[data-testid*="job"], article'));
        return cards.slice(0, 10).map(c => {
          let link = c.tagName === 'A' ? c : c.querySelector('a[href*="/jobs/"]');
          if (!link) return null;
          const titleEl = c.querySelector('h2, h3, h4, [class*="title"]');
          const compEl = c.querySelector('[class*="company"], [class*="organization"]');
          const locEl = c.querySelector('[class*="location"], [class*="office"]');
          return {
            job_url: link.href.startsWith('http') ? link.href : `https://www.welcometothejungle.com${link.getAttribute('href')}`,
            job_title: titleEl ? titleEl.textContent.trim().substring(0, 200) : '',
            company: compEl ? compEl.textContent.trim() : '',
            location: locEl ? locEl.textContent.trim() : 'Europe',
          };
        }).filter(j => j && j.job_url && j.job_title);
      });

      for (const j of jobs) {
        if (seen.has(j.job_url)) continue;
        seen.add(j.job_url);
        allJobs.push({
          ...j,
          source_platform: 'wttj',
          search_term: s.query,
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

scrape().catch(e => {
  console.log(JSON.stringify({ error: e.message, jobs: [] }));
});
