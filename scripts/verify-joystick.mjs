import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const SCREENSHOT_DIR = path.join(ROOT_DIR, 'scripts', 'screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function verify() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1200, height: 800 },
  });
  const page = await context.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log('Browser error:', msg.text());
  });

  console.log('Navigating to http://localhost:5000 ...');
  await page.goto('http://localhost:5000', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  // Set style to petal
  await page.evaluate(() => {
    localStorage.setItem('paperrocket_nav_style', 'petal');
    localStorage.setItem('mody_active_controller', 'navigator');
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // Take screenshot of Petal
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-petal-live.png') });
  console.log('Saved 01-petal-live.png');

  // Verify petal elements exist
  const petalCount = await page.locator('.jsk-disc path').count();
  console.log('Petal SVG paths found:', petalCount);

  // Switch to Disc
  const discBtn = page.locator('button.rig-chip:has-text("Disc")');
  if (await discBtn.isVisible()) {
    await discBtn.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02-disc-live.png') });
    console.log('Saved 02-disc-live.png');
  }

  // Switch to Collar
  const collarBtn = page.locator('button.rig-chip:has-text("Collar")');
  if (await collarBtn.isVisible()) {
    await collarBtn.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03-collar-live.png') });
    console.log('Saved 03-collar-live.png');
  }

  // Switch back to Petal
  const petalBtn = page.locator('button.rig-chip:has-text("Petal")');
  if (await petalBtn.isVisible()) {
    await petalBtn.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04-petal-final.png') });
    console.log('Saved 04-petal-final.png');
  }

  await browser.close();
  console.log('Verification complete.');
}

verify().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
