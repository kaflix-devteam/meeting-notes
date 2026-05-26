const { chromium } = require('playwright');

const BASE = 'https://meeting.kaflix.com';

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--ignore-certificate-errors'],
  });

  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    ignoreHTTPSErrors: true,
  });

  const page = await context.newPage();

  // 1. Login page
  console.log('1. Login page...');
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'screenshots/01_login.png', fullPage: true });

  // Login as admin
  const inputs = await page.$$('input');
  if (inputs.length >= 2) {
    await inputs[0].fill('admin');
    await inputs[1].fill('1234');
  }
  await page.screenshot({ path: 'screenshots/01_login_filled.png', fullPage: true });

  // Submit
  await page.click('button:has-text("로그인"), button[type="submit"]');
  await page.waitForTimeout(3000);

  // 2. My Reports (default page)
  console.log('2. My Reports...');
  await page.goto(`${BASE}/my-reports`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'screenshots/02_my_reports.png', fullPage: true });

  // 3. New Report
  console.log('3. New Report...');
  await page.goto(`${BASE}/reports/new`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'screenshots/03_report_create.png', fullPage: true });

  // 4. Meetings list (최종 보고서)
  console.log('4. Meetings list...');
  await page.goto(`${BASE}/meetings`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'screenshots/04_meetings.png', fullPage: true });

  // 5. Meeting detail
  console.log('5. Meeting detail...');
  const cards = await page.$$('.metro-card--clickable');
  if (cards.length > 0) {
    await cards[0].click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'screenshots/05_meeting_detail.png', fullPage: true });
  } else {
    console.log('  No meetings found, trying direct URL...');
    // Try navigating to meetings/1 directly
    await page.goto(`${BASE}/meetings`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'screenshots/05_meeting_detail.png', fullPage: true });
  }

  // 6. User Management
  console.log('6. User Management...');
  await page.goto(`${BASE}/admin/users`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'screenshots/06_user_management.png', fullPage: true });

  // 7. Team Management
  console.log('7. Team Management...');
  await page.goto(`${BASE}/admin/teams`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'screenshots/07_team_management.png', fullPage: true });

  // 8. Signup page
  console.log('8. Signup page...');
  await page.goto(`${BASE}/signup`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'screenshots/08_signup.png', fullPage: true });

  await browser.close();
  console.log('Done! Screenshots saved to screenshots/');
}

main().catch(console.error);
