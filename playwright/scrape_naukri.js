// Naukri.com Playwright scraper with stealth plugin to bypass Akamai bot detection.
const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealth);

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
  const launchOpts = { headless: true, args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'] };
  const browser = await chromium.launch(launchOpts);
  const ctxOpts = {
    viewport: { width: 1366, height: 800 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata',
    extraHTTPHeaders: {
      'Accept-Language': 'en-IN,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Sec-Ch-Ua': '"Chromium";v="131", "Not_A Brand";v="24"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"'
    }
  };
  if (fs.existsSync(AUTH_PATH)) ctxOpts.storageState = AUTH_PATH;
  const context = await browser.newContext(ctxOpts);

  const allJobs = [];
  const seen = new Set();

  for (const kw of KEYWORDS) {
    try {
      const page = await context.newPage();
      const url = `https://www.naukri.com/${kw.toLowerCase().replace(/\s+/g, '-')}-jobs-in-${LOCATION}?experience=2-5`;
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(4500);

      // Detect Access Denied
      const title = await page.title().catch(() => '');
      if (/access denied|forbidden/i.test(title)) {
        await page.close();
        continue;
      }

      const jobs = await page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll('article.jobTuple, div.srp-jobtuple-wrapper, .cust-job-tuple, div[data-job-id]'));
        return cards.slice(0, 8).map(c => {
          const titleEl = c.querySelector('a.title, a[class*="title"]');
          const compEl = c.querySelector('a.subTitle, a.comp-name, [class*="company"]');
          const locEl = c.querySelector('span.locWdth, span[class*="loc"]');
          const descEl = c.querySelector('span.job-desc, div[class*="job-desc"]');
          return {
            job_title: titleEl ? titleEl.textContent.trim() : '',
            job_url: titleEl ? titleEl.href : '',
            company: compEl ? compEl.textContent.trim() : '',
            location: locEl ? locEl.textContent.trim() : '',
            description: descEl ? descEl.textContent.trim().substring(0, 1500) : ''
          };
        }).filter(j => j.job_url && j.job_title);
      });

      for (const j of jobs) {
        const id = j.job_url.match(/\/(\d+)/)?.[1] || j.job_url;
        if (seen.has(id)) continue;
        seen.add(id);
        allJobs.push({ ...j, source_platform: 'naukri', search_term: kw });
      }
      await page.close();
      await new Promise(r => setTimeout(r, 2500));
    } catch (e) {}
  }

  await browser.close();
  console.log(JSON.stringify({ jobs: allJobs, count: allJobs.length }));
}

scrape().catch(e => console.log(JSON.stringify({ error: e.message, jobs: [] })));
