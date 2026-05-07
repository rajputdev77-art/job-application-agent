// Naukri.com apply — uses saved auth state from naukri_auth.json
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const args = require('minimist')(process.argv.slice(2));

const APPLICANT = {
  phone: '+91-9810893714',
  current_ctc: '600000',
  expected_ctc: '1200000',
  notice_period: '30'
};

const jobUrl = args.url;
const cvPath = args.cv;
const company = args.company || 'unknown';
const dryRun = args['dry-run'] === true || args['dry-run'] === 'true';
const outputDir = path.join(__dirname, '..', 'output');
const authPath = path.join(__dirname, 'naukri_auth.json');

if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
function ts() { return new Date().toISOString().replace(/[:.]/g, '-'); }
function out(obj) { console.log(JSON.stringify(obj)); }

(async () => {
  if (!jobUrl) return out({ success: false, error: 'No --url provided' });
  if (!fs.existsSync(authPath)) {
    return out({ success: false, error: 'No Naukri auth saved. Run: node playwright/save_naukri_auth.js', action_required: 'one_time_login' });
  }

  const browser = await chromium.launch({ headless: !dryRun });
  const screenshots = [];

  try {
    const context = await browser.newContext({ storageState: authPath, viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();

    async function screenshot(label) {
      try {
        const fp = path.join(outputDir, `naukri_${company.replace(/[^a-zA-Z0-9]/g, '_')}_${label}_${ts()}.png`);
        await page.screenshot({ path: fp });
        screenshots.push(fp);
        return fp;
      } catch (_) { return null; }
    }

    await page.goto(jobUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    await screenshot('01_job_page');

    // Check session valid
    const loginPrompt = await page.locator('text=/Login to apply|Sign in/i').first().isVisible({ timeout: 2000 }).catch(() => false);
    if (loginPrompt) {
      await browser.close();
      return out({ success: false, error: 'Naukri session expired. Re-run save_naukri_auth.js' });
    }

    const applyBtn = page.locator('button:has-text("Apply"), .apply-button, #apply-button').first();
    if (!(await applyBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
      await browser.close();
      return out({ success: false, error: 'Apply button not found', screenshot: screenshots[0] });
    }

    if (dryRun) {
      await screenshot('02_dryrun');
      await browser.close();
      return out({ success: true, dry_run: true, message: 'Apply button found' });
    }

    await applyBtn.click();
    await page.waitForTimeout(3000);
    await screenshot('02_after_click');

    // Naukri sometimes shows Q&A modal
    for (let i = 0; i < 5; i++) {
      // Fill any text inputs
      const phoneInput = page.locator('input[name*="phone"], input[placeholder*="phone" i]').first();
      if (await phoneInput.isVisible({ timeout: 1500 }).catch(() => false)) {
        await phoneInput.fill(APPLICANT.phone).catch(() => {});
      }

      const submitBtn = page.locator('button:has-text("Submit"), button:has-text("Apply")').last();
      const visible = await submitBtn.isVisible({ timeout: 1500 }).catch(() => false);
      if (visible) {
        await submitBtn.click();
        await page.waitForTimeout(2500);
        await screenshot(`03_attempt_${i}`);
        // Check success
        const success = await page.locator('text=/applied successfully|application sent|successfully applied/i').first().isVisible({ timeout: 2000 }).catch(() => false);
        if (success) {
          await browser.close();
          return out({ success: true, screenshot: screenshots[screenshots.length - 1], all_screenshots: screenshots });
        }
      } else {
        break;
      }
    }

    await browser.close();
    return out({ success: false, error: 'Could not confirm submission', screenshot: screenshots[screenshots.length - 1] });

  } catch (err) {
    await browser.close().catch(() => {});
    return out({ success: false, error: err.message, screenshot: screenshots[screenshots.length - 1] });
  }
})();
