const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const args = require('minimist')(process.argv.slice(2));

// Tier 1 agent NEVER submits — it fills, screenshots, and stops for manual review

const APPLICANT = {
  firstName: 'Debu',
  lastName: 'Rajput',
  fullName: 'Debu Rajput',
  email: 'rajputdev77@gmail.com',
  phone: '+91-9810893714',
  phone_country_code: '+91',
  location: 'Delhi NCR, India',
  city: 'Delhi',
  country: 'India',
  linkedin: 'https://linkedin.com/in/devrajput07',
  current_company: 'County Group',
  current_title: 'Client Operations & Coordination Executive',
  years_experience: '3',
  education: 'MBA',
  university: 'Ambedkar University Delhi',
  graduation_year: '2023',
  authorized_india: 'Yes',
  require_sponsorship: 'No',
  willing_to_relocate: 'Yes',
  current_ctc: '6,00,000',
  expected_ctc: '8,00,000',
  notice_period: '30 days'
};

const jobUrl = args.url;
const cvPath = args.cv;
const coverLetterPath = args.coverletter;
const company = args.company || 'Tier1Company';
const jobTitle = args.title || 'Role';
const outputDir = path.join(__dirname, '..', 'output');

if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

function ts() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function fillTextInput(page, selectors, value) {
  for (const selector of selectors) {
    try {
      const el = page.locator(selector).first();
      if (await el.isVisible({ timeout: 1000 }).catch(() => false)) {
        await el.clear();
        await el.fill(value);
        return true;
      }
    } catch (_) {}
  }
  return false;
}

async function run() {
  if (!jobUrl) {
    console.log(JSON.stringify({ ready_for_review: false, error: 'No --url provided' }));
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: false }); // Visible for review
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 }
  });

  const page = await context.newPage();
  const screenshots = [];

  async function screenshot(label) {
    try {
      const fp = path.join(outputDir, `tier1_${company}_${label}_${ts()}.png`);
      await page.screenshot({ path: fp, fullPage: true });
      screenshots.push(fp);
      return fp;
    } catch (_) {
      return null;
    }
  }

  try {
    await page.goto(jobUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await screenshot('01_job_page');

    // Look for Apply / Start Application button
    const applyBtnSelectors = [
      'button:has-text("Apply")',
      'a:has-text("Apply Now")',
      'a:has-text("Apply for this job")',
      'button:has-text("Start Application")',
      '.apply-btn',
      '[data-testid="apply-button"]'
    ];

    for (const sel of applyBtnSelectors) {
      try {
        const btn = page.locator(sel).first();
        if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await btn.click();
          await page.waitForTimeout(2000);
          break;
        }
      } catch (_) {}
    }

    await screenshot('02_application_form');

    // Fill personal info fields — comprehensive selector list for common ATS systems
    // (Workday, Greenhouse, Lever, iCIMS, SAP SuccessFactors, Taleo)
    const fieldMappings = [
      {
        value: APPLICANT.firstName,
        selectors: ['input[name="firstName"]', 'input[id*="firstName"]', 'input[id*="first-name"]', 'input[placeholder*="First name"]', '[data-automation-id="legalNameSection_firstName"]']
      },
      {
        value: APPLICANT.lastName,
        selectors: ['input[name="lastName"]', 'input[id*="lastName"]', 'input[id*="last-name"]', 'input[placeholder*="Last name"]', '[data-automation-id="legalNameSection_lastName"]']
      },
      {
        value: APPLICANT.email,
        selectors: ['input[type="email"]', 'input[name="email"]', 'input[id*="email"]', 'input[placeholder*="Email"]']
      },
      {
        value: APPLICANT.phone,
        selectors: ['input[type="tel"]', 'input[name="phone"]', 'input[id*="phone"]', 'input[placeholder*="Phone"]', 'input[placeholder*="Mobile"]']
      },
      {
        value: APPLICANT.city,
        selectors: ['input[name="city"]', 'input[id*="city"]', 'input[placeholder*="City"]']
      },
      {
        value: APPLICANT.linkedin,
        selectors: ['input[name="linkedin"]', 'input[id*="linkedin"]', 'input[placeholder*="LinkedIn"]', 'input[placeholder*="LinkedIn URL"]']
      },
      {
        value: APPLICANT.current_company,
        selectors: ['input[name="currentCompany"]', 'input[id*="current-employer"]', 'input[placeholder*="Current company"]', 'input[placeholder*="Employer"]']
      },
      {
        value: APPLICANT.current_title,
        selectors: ['input[name="currentTitle"]', 'input[id*="current-title"]', 'input[placeholder*="Current title"]', 'input[placeholder*="Job title"]']
      },
      {
        value: APPLICANT.years_experience,
        selectors: ['input[name="yearsExperience"]', 'input[id*="experience"]', 'input[placeholder*="Years of experience"]']
      }
    ];

    for (const fm of fieldMappings) {
      await fillTextInput(page, fm.selectors, fm.value);
    }

    await screenshot('03_personal_info_filled');

    // Upload CV
    if (cvPath && fs.existsSync(cvPath)) {
      try {
        const fileInput = page.locator('input[type="file"]').first();
        if (await fileInput.isVisible({ timeout: 3000 }).catch(() => false)) {
          await fileInput.setInputFiles(cvPath);
          await page.waitForTimeout(2000);
        }
      } catch (_) {}

      // Try drag-and-drop upload areas
      try {
        const uploadArea = page.locator('[data-testid="file-upload"], .upload-zone, [class*="upload"]').first();
        if (await uploadArea.isVisible({ timeout: 2000 }).catch(() => false)) {
          const fileInput2 = page.locator('input[type="file"]').nth(1);
          if (await fileInput2.count() > 0) {
            await fileInput2.setInputFiles(cvPath);
            await page.waitForTimeout(2000);
          }
        }
      } catch (_) {}
    }

    // Upload cover letter if provided
    if (coverLetterPath && fs.existsSync(coverLetterPath)) {
      try {
        const fileInputs = await page.locator('input[type="file"]').all();
        if (fileInputs.length > 1) {
          await fileInputs[1].setInputFiles(coverLetterPath);
          await page.waitForTimeout(1500);
        }
      } catch (_) {}
    }

    await screenshot('04_files_uploaded');

    // Scroll through entire form to verify completeness
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await page.waitForTimeout(500);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    await screenshot('05_form_complete_full_page');

    // CRITICAL: Do NOT click submit — save form URL for manual review
    const currentUrl = page.url();

    // Keep browser open for manual review
    // Output result immediately so n8n can log it
    const finalScreenshot = screenshots[screenshots.length - 1];

    console.log(JSON.stringify({
      ready_for_review: true,
      screenshot: finalScreenshot,
      all_screenshots: screenshots,
      form_url: currentUrl,
      company: company,
      job_title: jobTitle,
      message: `Form filled for ${company} — ${jobTitle}. Review screenshot at: ${finalScreenshot}. Submit manually at: ${currentUrl}`,
      error: null
    }));

    // Keep browser open for 5 minutes for manual review then close
    await page.waitForTimeout(300000).catch(() => {});
    await browser.close().catch(() => {});

  } catch (err) {
    const ss = await screenshot('error').catch(() => null);
    await browser.close().catch(() => {});
    console.log(JSON.stringify({
      ready_for_review: false,
      screenshot: ss,
      form_url: jobUrl,
      company: company,
      error: err.message
    }));
  }
}

run();
