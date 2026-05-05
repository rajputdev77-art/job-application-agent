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
  linkedin: 'linkedin.com/in/devrajput07',
  years_experience: '3',
  authorized_india: 'Yes',
  require_sponsorship: 'No',
  willing_to_relocate: 'Yes'
};

const jobUrl = args.url;
const cvPath = args.cv;
const coverLetterPath = args.coverletter;
const isEu = args.eu === true || args.eu === 'true';
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

  // Load saved auth state if it exists (for logged-in LinkedIn session)
  const authStatePath = path.join(__dirname, 'linkedin_auth.json');
  if (fs.existsSync(authStatePath)) {
    try {
      const authState = JSON.parse(fs.readFileSync(authStatePath, 'utf-8'));
      await context.addCookies(authState.cookies || []);
    } catch (e) {
      // Auth state invalid — continue without it
    }
  }

  const page = await context.newPage();
  const screenshots = [];

  async function screenshot(label) {
    try {
      const fp = path.join(outputDir, `linkedin_${label}_${ts()}.png`);
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

    // Find Easy Apply button
    const easyApplyBtn = page.locator('button:has-text("Easy Apply"), .jobs-apply-button--top-card button, [data-control-name="jobdetails_topcard_inapply"]').first();
    const easyApplyVisible = await easyApplyBtn.isVisible({ timeout: 8000 }).catch(() => false);

    if (!easyApplyVisible) {
      await screenshot('02_no_easy_apply');
      await browser.close();
      console.log(JSON.stringify({ success: false, error: 'Easy Apply button not found — may require external application', screenshot: screenshots[0] }));
      return;
    }

    await easyApplyBtn.click();
    await page.waitForTimeout(2000);
    await screenshot('02_apply_modal');

    // Fill contact information fields if present
    const fieldsToFill = [
      { selector: 'input[name="phoneNumber"], input[id*="phone"]', value: APPLICANT.phone },
      { selector: 'input[id*="firstName"], input[name="firstName"]', value: 'Debu' },
      { selector: 'input[id*="lastName"], input[name="lastName"]', value: 'Rajput' },
      { selector: 'input[type="email"]', value: APPLICANT.email }
    ];

    for (const field of fieldsToFill) {
      try {
        const el = page.locator(field.selector).first();
        if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
          await el.clear();
          await el.fill(field.value);
        }
      } catch (_) {}
    }

    // Upload CV if file upload exists
    if (cvPath && fs.existsSync(cvPath)) {
      try {
        const fileInput = page.locator('input[type="file"]').first();
        if (await fileInput.isVisible({ timeout: 3000 }).catch(() => false)) {
          await fileInput.setInputFiles(cvPath);
          await page.waitForTimeout(1500);
        }
      } catch (_) {}
    }

    await screenshot('03_form_filled');

    // Answer screening questions - iterate through modal pages
    let pageNum = 0;
    let maxPages = 10;

    while (pageNum < maxPages) {
      pageNum++;

      // Answer common yes/no questions
      const questionAnswers = [
        { text: /years of experience/i, type: 'number', value: '3' },
        { text: /authorized to work/i, type: 'radio_yes', value: 'Yes' },
        { text: /require.*visa|require.*sponsorship/i, type: 'radio_no', value: 'No' },
        { text: /willing to relocate/i, type: 'radio_yes', value: 'Yes' },
        { text: /currently employ/i, type: 'radio_yes', value: 'Yes' }
      ];

      for (const qa of questionAnswers) {
        try {
          const labels = await page.locator('label').all();
          for (const label of labels) {
            const text = await label.textContent().catch(() => '');
            if (qa.text.test(text)) {
              if (qa.type === 'number') {
                const input = page.locator('input[type="number"], input[type="text"]').near(label).first();
                if (await input.isVisible({ timeout: 1000 }).catch(() => false)) {
                  await input.clear();
                  await input.fill(qa.value);
                }
              } else if (qa.type === 'radio_yes') {
                const yesRadio = page.locator('input[type="radio"][value="Yes"], input[type="radio"][value="yes"]').near(label).first();
                if (await yesRadio.isVisible({ timeout: 1000 }).catch(() => false)) await yesRadio.click();
              } else if (qa.type === 'radio_no') {
                const noRadio = page.locator('input[type="radio"][value="No"], input[type="radio"][value="no"]').near(label).first();
                if (await noRadio.isVisible({ timeout: 1000 }).catch(() => false)) await noRadio.click();
              }
            }
          }
        } catch (_) {}
      }

      // Look for Next or Submit button
      const nextBtn = page.locator('button:has-text("Next"), button:has-text("Continue"), button:has-text("Review")').last();
      const submitBtn = page.locator('button:has-text("Submit application"), button:has-text("Submit")').last();

      const submitVisible = await submitBtn.isVisible({ timeout: 2000 }).catch(() => false);
      if (submitVisible) {
        await screenshot(`0${pageNum + 3}_pre_submit`);
        await submitBtn.click();
        await page.waitForTimeout(3000);
        await screenshot(`0${pageNum + 3}_submitted`);
        break;
      }

      const nextVisible = await nextBtn.isVisible({ timeout: 2000 }).catch(() => false);
      if (nextVisible) {
        await nextBtn.click();
        await page.waitForTimeout(1500);
        await screenshot(`0${pageNum + 3}_page_${pageNum}`);
      } else {
        break;
      }
    }

    await browser.close();
    console.log(JSON.stringify({
      success: true,
      screenshot: screenshots[screenshots.length - 1] || null,
      all_screenshots: screenshots,
      error: null
    }));

  } catch (err) {
    const ss = await screenshot('error').catch(() => null);
    await browser.close().catch(() => {});
    console.log(JSON.stringify({
      success: false,
      screenshot: ss,
      error: err.message
    }));
  }
}

run();
