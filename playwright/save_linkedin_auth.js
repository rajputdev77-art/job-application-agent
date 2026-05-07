// One-time helper: opens LinkedIn in a visible browser, lets user log in,
// then saves auth state so all future apply scripts run authenticated.
//
// Usage: node playwright/save_linkedin_auth.js

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const readline = require('readline');

const AUTH_PATH = path.join(__dirname, 'linkedin_auth.json');

(async () => {
  console.log('\n=========================================');
  console.log('  LinkedIn Auth Saver (one-time setup)');
  console.log('=========================================\n');
  console.log('A browser window will open. Please:');
  console.log('  1. Log in to LinkedIn');
  console.log('  2. Wait until you see your home feed');
  console.log('  3. Come back here and press Enter');
  console.log('');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  const page = await context.newPage();
  await page.goto('https://www.linkedin.com/login');

  // Wait for user to press Enter
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  await new Promise(resolve => rl.question('\nPress Enter AFTER you have logged in and see your feed... ', () => { rl.close(); resolve(); }));

  // Save auth state
  await context.storageState({ path: AUTH_PATH });
  console.log(`\n✓ Auth saved to: ${AUTH_PATH}`);
  console.log('  All future linkedin_apply.js runs will use this session.');
  console.log('  Re-run this script if LinkedIn logs you out (usually monthly).\n');

  await browser.close();
})();
