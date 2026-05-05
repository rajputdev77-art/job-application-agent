const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const args = require('minimist')(process.argv.slice(2));

const APPLICANT = {
  name: 'Debu Rajput',
  email: 'rajputdev77@gmail.com',
  phone: '+91-9810893714',
  location: 'Delhi NCR',
  current_ctc: '600000',
  expected_ctc: '800000',
  notice_period: '30',
  total_experience: '3'
};

const jobUrl = args.url;
const cvPath = args.cv;
const outputDir = path.join(__dirname, '..', 'output');

if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

function ts() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function run() {
  if (!jobUrl) {
    console.log(JSON.stringify({ success: false, error: 'No --url provided' }));
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });

  // Load Naukri session cookies if available
  const authStatePath = path.join(__dirname, 'naukri_auth.json');
  if (fs.existsSync(authStatePath)) {
    try {
      const state = JSON.parse(fs.readFileSync(authStatePath, 'utf-8'));
      await context.addCookies(state.cookies || []);
    } catch (_) {}
  }

  const page = await context.newPage();
  const screenshots = [];

  async function screenshot(label) {
    try {
      const fp = path.join(outputDir, `naukri_${label}_${ts()}.png`);
      await page.screenshot({ path: fp, fullPage: false });
      screenshots.push(fp);
      return fp;
    } catch (_) {
      return null;
    }
  }

  try {
    await page.goto(jobUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await screenshot('01_job_page');

    // Check for login wall
    const loginRequired = await page.locator('text=Login to apply, text=Sign in to apply').first().isVisible({ timeout: 3000 }).catch(() => false);
    if (loginRequired) {
      await browser.close();
      console.log(JSON.stringify({ success: false, error: 'Naukri login required. Run with --login flag to save auth state.' }));
      return;
    }

    // Click Apply button
    const applyBtn = page.locator('button:has-text("Apply"), a:has-text("Apply"), .apply-button').first();
    const applyVisible = await applyBtn.isVisible({ timeout: 8000 }).catch(() => false);

    if (!applyVisible) {
      await screenshot('02_no_apply');
      await browser.close();
      console.log(JSON.stringify({ success: false, error: 'Apply button not found on Naukri page', screenshot: screenshots[0] }));
      return;
    }

    await applyBtn.click();
    await page.waitForTimeout(2000);
    await screenshot('02_apply_form');

    // Fill standard Naukri apply form fields
    const fieldsToFill = [
      { selector: 'input[name="currentCity"], input[placeholder*="city"], input[placeholder*="location"]', value: APPLICANT.location },
      { selector: 'input[name="currentCtc"], input[placeholder*="current CTC"]', value: APPLICANT.current_ctc },
      { selector: 'input[name="expectedCtc"], input[placeholder*="expected CTC"]', value: APPLICANT.expected_ctc },
      { selector: 'input[name="noticePeriod"], input[placeholder*="notice"]', value: APPLICANT.notice_period }
    ];

    for (const field of fieldsToFill) {
      try {
        const el = page.locator(field.selector).first();
        if (await el.isVisible({ timeout: 1500 }).catch(() => false)) {
          await el.clear();
          await el.fill(field.value);
        }
      } catch (_) {}
    }

    // Upload CV if file input present
    if (cvPath && fs.existsSync(cvPath)) {
      try {
        const fileInput = page.locator('input[type="file"]').first();
        if (await fileInput.isVisible({ timeout: 2000 }).catch(() => false)) {
          await fileInput.setInputFiles(cvPath);
          await page.waitForTimeout(2000);
        }
      } catch (_) {}
    }

    await screenshot('03_form_filled');

    // Submit
    const submitBtn = page.locator('button:has-text("Apply"), button:has-text("Submit"), button[type="submit"]').last();
    const submitVisible = await submitBtn.isVisible({ timeout: 3000 }).catch(() => false);

    if (submitVisible) {
      await submitBtn.click();
      await page.waitForTimeout(3000);
      await screenshot('04_submitted');
    } else {
      await screenshot('04_no_submit_btn');
      await browser.close();
      console.log(JSON.stringify({ success: false, error: 'Submit button not found', screenshot: screenshots[screenshots.length - 1] }));
      return;
    }

    // Confirm success
    const successText = await page.locator('text=Application submitted, text=Successfully applied, text=application has been sent').first().isVisible({ timeout: 5000 }).catch(() => false);

    await browser.close();
    console.log(JSON.stringify({
      success: successText,
      screenshot: screenshots[screenshots.length - 1] || null,
      all_screenshots: screenshots,
      error: successText ? null : 'Could not confirm submission — check screenshot'
    }));

  } catch (err) {
    const ss = await screenshot('error').catch(() => null);
    await browser.close().catch(() => {});
    console.log(JSON.stringify({ success: false, screenshot: ss, error: err.message }));
  }
}

run();
