// Indeed Playwright scraper - fresh browser, real headers.
// Indeed blocks plain HTTP but allows browser traffic.

const { chromium } = require('playwright');

const SEARCHES = [
  { q: 'AI Operations Manager', l: 'Delhi, India', platform: 'indeed_india' },
  { q: 'AI Project Manager', l: 'Delhi, India', platform: 'indeed_india' },
  { q: 'AI Customer Success', l: 'Delhi, India', platform: 'indeed_india' },
  { q: 'AI Strategy Consultant', l: 'India', platform: 'indeed_india' },
  { q: 'Customer Success Manager', l: 'Delhi, India', platform: 'indeed_india' },
  { q: 'Project Manager', l: 'Delhi NCR', platform: 'indeed_india' },
  { q: 'AI Operations', l: 'Netherlands', platform: 'indeed_eu' },
  { q: 'AI Customer Success', l: 'Europe', platform: 'indeed_eu' },
];

async function scrape() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    locale: 'en-IN',
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9'
    }
  });

  const allJobs = [];
  const seen = new Set();

  for (const s of SEARCHES) {
    try {
      const page = await context.newPage();
      const url = `https://in.indeed.com/jobs?q=${encodeURIComponent(s.q)}&l=${encodeURIComponent(s.l)}&fromage=1&sort=date`;
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(4000);

      // Bypass Cloudflare/anti-bot wait
      const isBlocked = await page.locator('text=/checking your browser|cloudflare/i').first().isVisible({ timeout: 1500 }).catch(() => false);
      if (isBlocked) {
        await page.waitForTimeout(8000);
      }

      const jobs = await page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll('div.job_seen_beacon, td.resultContent, div[data-jk]'));
        return cards.slice(0, 8).map(c => {
          const link = c.querySelector('a[data-jk], h2 a, a.jcs-JobTitle');
          const titleEl = c.querySelector('h2 span[title], h2 a span, span[id^="jobTitle"]');
          const compEl = c.querySelector('span[data-testid="company-name"], .companyName');
          const locEl = c.querySelector('div[data-testid="text-location"], .companyLocation');
          const descEl = c.querySelector('.job-snippet, [data-testid="snippet"]');
          const jk = c.getAttribute('data-jk') || link?.getAttribute('data-jk') || '';
          return {
            job_id: jk,
            job_title: titleEl ? titleEl.textContent.trim() : '',
            job_url: jk ? `https://in.indeed.com/viewjob?jk=${jk}` : (link ? link.href : ''),
            company: compEl ? compEl.textContent.trim() : '',
            location: locEl ? locEl.textContent.trim() : '',
            description: descEl ? descEl.textContent.trim().substring(0, 1500) : ''
          };
        }).filter(j => j.job_url && j.job_title);
      });

      for (const j of jobs) {
        if (seen.has(j.job_id || j.job_url)) continue;
        seen.add(j.job_id || j.job_url);
        allJobs.push({ ...j, source_platform: s.platform, search_term: s.q });
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
