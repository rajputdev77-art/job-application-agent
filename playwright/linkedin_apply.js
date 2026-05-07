// LinkedIn Easy Apply — fully autonomous after one-time auth save.
// Loads saved cookies from linkedin_auth.json (run save_linkedin_auth.js first).

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const args = require('minimist')(process.argv.slice(2));

const APPLICANT = {
  name: 'Debu Rajput',
  email: 'rajputdev77@gmail.com',
  phone: '+91-9810893714',
  location: 'Delhi NCR, India',
  years_experience: '3'
};

const jobUrl = args.url;
const cvPath = args.cv;
const company = args.company || 'unknown';
const jobTitle = args.title || 'unknown';
const dryRun = args['dry-run'] === true || args['dry-run'] === 'true';
const isEu = args.eu === true || args.eu === 'true';

const outputDir = path.join(__dirname, '..', 'output');
const authPath = path.join(__dirname, 'linkedin_auth.json');

if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

function ts() { return new Date().toISOString().replace(/[:.]/g, '-'); }
function out(obj) { console.log(JSON.stringify(obj)); }

(async () => {
  if (!jobUrl) return out({ success: false, error: 'No --url provided' });

  // Verify auth file exists
  if (!fs.existsSync(authPath)) {
    return out({
      success: false,
      error: 'No LinkedIn auth saved. Run: node playwright/save_linkedin_auth.js',
      action_required: 'one_time_login'
    });
  }

  const browser = await chromium.launch({ headless: !dryRun });
  const screenshots = [];

  try {
    const context = await browser.newContext({
      storageState: authPath,
      viewport: { width: 1280, height: 800 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    async function screenshot(label) {
      try {
        const fp = path.join(outputDir, `linkedin_${company.replace(/[^a-zA-Z0-9]/g, '_')}_${label}_${ts()}.png`);
        await page.screenshot({ path: fp });
        screenshots.push(fp);
        return fp;
      } catch (_) { return null; }
    }

    // Navigate to job
    await page.goto(jobUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2500);
    await screenshot('01_job_page');

    // Check if logged in (no "Join now" button)
    const notLoggedIn = await page.locator('text=/Join now|Sign in/i').first().isVisible({ timeout: 2000 }).catch(() => false);
    if (notLoggedIn) {
      await browser.close();
      return out({ success: false, error: 'LinkedIn session expired. Re-run save_linkedin_auth.js', screenshot: screenshots[0] });
    }

    // Find Easy Apply button
    const easyApplyBtn = page.locator('button:has-text("Easy Apply")').first();
    const easyApply = await easyApplyBtn.isVisible({ timeout: 8000 }).catch(() => false);

    if (!easyApply) {
      // Check for external Apply button
      const externalApply = await page.locator('button:has-text("Apply"), a:has-text("Apply")').first().isVisible({ timeout: 3000 }).catch(() => false);
      await browser.close();
      return out({
        success: false,
        error: externalApply ? 'External application required (no Easy Apply)' : 'No apply button found',
        screenshot: screenshots[0],
        skipped: true
      });
    }

    if (dryRun) {
      await screenshot('02_dryrun_easyapply_visible');
      await browser.close();
      return out({ success: true, dry_run: true, message: 'Easy Apply found, would have applied', screenshots });
    }

    await easyApplyBtn.click();
    await page.waitForTimeout(2500);
    await screenshot('02_modal_opened');

    // Iterate through Easy Apply modal pages (max 6)
    for (let pageNum = 1; pageNum <= 6; pageNum++) {
      // Auto-fill phone if visible
      const phoneInput = page.locator('input[id*="phoneNumber"], input[name*="phone"]').first();
      if (await phoneInput.isVisible({ timeout: 1500 }).catch(() => false)) {
        await phoneInput.fill(APPLICANT.phone).catch(() => {});
      }

      // Upload CV if file input is visible (Easy Apply CV upload step)
      if (cvPath && fs.existsSync(cvPath)) {
        const fileInput = page.locator('input[type="file"]').first();
        if (await fileInput.isVisible({ timeout: 1500 }).catch(() => false)) {
          await fileInput.setInputFiles(cvPath).catch(() => {});
          await page.waitForTimeout(2000);
        }
      }

      // Common screening question answers
      const screeningPatterns = [
        { regex: /years?\s+of\s+experience/i, type: 'number', value: '3' },
        { regex: /authorized\s+to\s+work|right\s+to\s+work/i, type: 'radio', answer: 'Yes' },
        { regex: /require.*sponsorship|require.*visa/i, type: 'radio', answer: 'No' },
        { regex: /willing\s+to\s+relocate/i, type: 'radio', answer: 'Yes' },
        { regex: /currently\s+employ/i, type: 'radio', answer: 'Yes' },
        { regex: /notice\s+period/i, type: 'number', value: '30' },
        { regex: /current\s+(salary|ctc)/i, type: 'number', value: '600000' },
        { regex: /expected\s+(salary|ctc)/i, type: 'number', value: '1200000' }
      ];

      const labels = await page.locator('label').all();
      for (const label of labels) {
        const text = await label.textContent().catch(() => '');
        if (!text) continue;
        for (const pattern of screeningPatterns) {
          if (pattern.regex.test(text)) {
            try {
              if (pattern.type === 'number') {
                const input = page.locator('input[type="number"], input[type="text"]').near(label).first();
                if (await input.isVisible({ timeout: 800 }).catch(() => false)) {
                  await input.clear().catch(() => {});
                  await input.fill(pattern.value).catch(() => {});
                }
              } else if (pattern.type === 'radio') {
                const radio = page.locator(`input[type="radio"][value="${pattern.answer}"]`).near(label).first();
                if (await radio.isVisible({ timeout: 800 }).catch(() => false)) {
                  await radio.click().catch(() => {});
                }
              }
            } catch (_) {}
            break;
          }
        }
      }

      await screenshot(`03_page_${pageNum}_filled`);

      // Find Submit or Next button
      const submitBtn = page.locator('button:has-text("Submit application")').last();
      const reviewBtn = page.locator('button:has-text("Review")').last();
      const nextBtn = page.locator('button[aria-label*="Continue"], button:has-text("Next"), button:has-text("Continue to next")').last();

      const submitVisible = await submitBtn.isVisible({ timeout: 1500 }).catch(() => false);
      if (submitVisible) {
        await screenshot(`04_pre_submit`);
        await submitBtn.click();
        await page.waitForTimeout(3000);
        await screenshot(`05_submitted`);

        // Verify application sent (LinkedIn shows "Application sent" or closes modal)
        const success = await page.locator('text=/Application sent|Your application was sent/i').first().isVisible({ timeout: 3000 }).catch(() => false);
        await browser.close();
        return out({ success: true, screenshot: screenshots[screenshots.length - 1], all_screenshots: screenshots, verified: success });
      }

      const reviewVisible = await reviewBtn.isVisible({ timeout: 1500 }).catch(() => false);
      if (reviewVisible) {
        await reviewBtn.click();
        await page.waitForTimeout(2000);
        continue;
      }

      const nextVisible = await nextBtn.isVisible({ timeout: 1500 }).catch(() => false);
      if (nextVisible) {
        await nextBtn.click();
        await page.waitForTimeout(2000);
      } else {
        // Modal might have additional questions we couldn't answer
        await screenshot('06_stuck');
        await browser.close();
        return out({ success: false, error: 'Modal has unanswered questions or unknown layout', screenshot: screenshots[screenshots.length - 1] });
      }
    }

    await browser.close();
    return out({ success: false, error: 'Modal exceeded 6 pages — likely complex application', screenshot: screenshots[screenshots.length - 1] });

  } catch (err) {
    await browser.close().catch(() => {});
    return out({ success: false, error: err.message, screenshot: screenshots[screenshots.length - 1] });
  }
})();
