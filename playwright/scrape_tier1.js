// Tier 1 career page scraper with stealth.
const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealth);

const TARGETS = [
  {
    company: 'Capgemini',
    url: 'https://www.capgemini.com/jobs/?_sft_country=india&_keyword=customer+success+operations+project',
    extract: () => Array.from(document.querySelectorAll('a[href*="/jobs/"]')).slice(0, 10).map(a => ({
      job_title: a.querySelector('h3, h4, [class*="title"]')?.textContent?.trim() || a.textContent.trim().substring(0, 100),
      job_url: a.href, company: 'Capgemini'
    })).filter(j => j.job_url && j.job_title && j.job_title.length > 5 && !j.job_url.includes('?_sft'))
  },
  {
    company: 'Accenture',
    url: 'https://www.accenture.com/in-en/careers/jobsearch?jk=customer+success+operations+project&jl=India',
    extract: () => Array.from(document.querySelectorAll('a[href*="/job/"], a[href*="/jobs/"]')).slice(0, 10).map(a => ({
      job_title: a.querySelector('h3, span[class*="title"]')?.textContent?.trim() || a.textContent.trim().substring(0, 100),
      job_url: a.href.startsWith('http') ? a.href : `https://www.accenture.com${a.getAttribute('href')}`,
      company: 'Accenture'
    })).filter(j => j.job_url && j.job_title && j.job_title.length > 5)
  },
  {
    company: 'JLL',
    url: 'https://careers.jll.com/global/en/search-results?keywords=customer%20success%20operations',
    extract: () => Array.from(document.querySelectorAll('a[data-ph-at-id*="job-link"], a[href*="/job/"]')).slice(0, 10).map(a => ({
      job_title: a.querySelector('span, h3')?.textContent?.trim() || a.textContent.trim().substring(0, 100),
      job_url: a.href.startsWith('http') ? a.href : `https://careers.jll.com${a.getAttribute('href')}`,
      company: 'JLL'
    })).filter(j => j.job_url && j.job_title && j.job_title.length > 5)
  },
  {
    company: 'EY',
    url: 'https://careers.ey.com/ey/search/?createNewAlert=false&q=customer+success+operations&locationsearch=India',
    extract: () => Array.from(document.querySelectorAll('a.jobTitle-link, a[href*="/job/"]')).slice(0, 10).map(a => ({
      job_title: a.textContent.trim().substring(0, 200),
      job_url: a.href.startsWith('http') ? a.href : `https://careers.ey.com${a.getAttribute('href')}`,
      company: 'EY'
    })).filter(j => j.job_url && j.job_title && j.job_title.length > 5)
  },
];

async function scrape() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox']
  });
  const context = await browser.newContext({
    viewport: { width: 1366, height: 800 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
  });

  const allJobs = [];
  const seen = new Set();

  for (const target of TARGETS) {
    try {
      const page = await context.newPage();
      await page.goto(target.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(6000);
      const jobs = await page.evaluate(target.extract);
      for (const j of jobs) {
        if (seen.has(j.job_url)) continue;
        seen.add(j.job_url);
        allJobs.push({
          ...j, source_platform: 'tier1_' + target.company.toLowerCase(),
          location: 'India',
          description: `${j.job_title} at ${target.company}. Open URL for full description.`
        });
      }
      await page.close();
      await new Promise(r => setTimeout(r, 3000));
    } catch (e) {}
  }

  await browser.close();
  console.log(JSON.stringify({ jobs: allJobs, count: allJobs.length }));
}

scrape().catch(e => console.log(JSON.stringify({ error: e.message, jobs: [] })));
