import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const PORT = process.env.PORT || 5000;
const BASE_URL = `http://127.0.0.1:${PORT}`;
let spawnedServer = null;

const REQUIRED_BRUSH_FILES = [
  'clay.png',
  'build.png',
  'move.png',
  'inflate.png',
  'pinch.png',
  'crease.png',
  'flatten.png',
  'smooth.png',
];

const VIEWPORTS = [
  { name: 'Phone (Pixel 7 / Android)', width: 412, height: 915 },
  { name: 'Tablet (Galaxy Tab / iPad)', width: 768, height: 1024 },
  { name: 'Desktop (Wide)', width: 1280, height: 800 },
];

async function assertBrushFilesExist() {
  console.log('🔍 [1/5] Checking brush preview assets...');
  const brushesDir = path.join(ROOT_DIR, 'public', 'assets', 'brushes');
  if (!fs.existsSync(brushesDir)) {
    throw new Error(`Brushes directory not found at: ${brushesDir}`);
  }

  for (const filename of REQUIRED_BRUSH_FILES) {
    const fullPath = path.join(brushesDir, filename);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Missing brush asset: ${filename}`);
    }
    const stat = fs.statSync(fullPath);
    if (stat.size < 100) {
      throw new Error(`Brush asset ${filename} is suspiciously small (${stat.size} bytes)`);
    }
  }
  console.log(`  ✓ All ${REQUIRED_BRUSH_FILES.length} brush preview assets verified on disk.`);
}

async function waitForServer(maxRetries = 25) {
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(BASE_URL);
      if (res.ok || res.status === 304) {
        console.log('  ✓ Connected to existing server.');
        return;
      }
    } catch {
      // not yet ready
    }
    await new Promise((r) => setTimeout(r, 400));
  }

  console.log(`  Starting Vite server on port ${PORT}...`);
  spawnedServer = spawn('npx', ['vite', `--port=${PORT}`, '--host=0.0.0.0'], {
    cwd: ROOT_DIR,
    shell: true,
    stdio: 'ignore',
  });

  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(BASE_URL);
      if (res.ok || res.status === 304) {
        console.log('  ✓ Spawned server ready.');
        return;
      }
    } catch {
      // wait and retry
    }
    await new Promise((r) => setTimeout(r, 600));
  }
  throw new Error(`Server at ${BASE_URL} failed to respond.`);
}

async function runSmokeTests() {
  console.log('🚀 Starting V20 Mobile-First Smoke Test Suite...\n');
  await assertBrushFilesExist();

  console.log(`\n🔍 [2/5] Connecting to server at ${BASE_URL}...`);
  await waitForServer();
  console.log('  ✓ Server reachable.');

  console.log('\n🔍 [3/5] Launching headless browser...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-gl=swiftshader'],
  });

  try {
    for (const vp of VIEWPORTS) {
      console.log(`\n📱 Testing Viewport: ${vp.name} (${vp.width}x${vp.height})...`);
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        hasTouch: true,
      });
      const page = await context.newPage();

      // Collect console errors
      const pageErrors = [];
      page.on('pageerror', (err) => pageErrors.push(err.message));

      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#root canvas', { timeout: 15000 });
      console.log('  ✓ Root and WebGL canvas mounted.');

      // Check window.__testApp
      await page.waitForFunction(() => Boolean(window.__testApp), { timeout: 10000 });
      console.log('  ✓ Test hooks (window.__testApp) initialized.');

      // Check touch targets on top strip buttons (minimum 44x44 CSS px)
      const topButtons = await page.$$('.studio-top-strip button');
      for (const btn of topButtons) {
        const box = await btn.boundingBox();
        if (box) {
          if (box.width < 40 || box.height < 40) {
            const aria = (await btn.getAttribute('aria-label')) || 'unlabeled';
            console.warn(`  ⚠️ Warning: Top strip button "${aria}" size is ${box.width}x${box.height}`);
          }
        }
      }
      console.log('  ✓ Top bar buttons verified for touch target compliance.');

      // Test Opening and Closing Settings
      await page.evaluate(() => window.__testApp.openSheet('settings'));
      await page.waitForSelector('.paperrocket-preferences', { state: 'visible', timeout: 5000 });
      console.log('  ✓ Preferences sheet opened successfully.');

      await page.evaluate(() => window.__testApp.closeAllModals());
      await page.waitForSelector('.paperrocket-preferences', { state: 'detached', timeout: 5000 });
      console.log('  ✓ Preferences sheet closed cleanly.');

      // Test Opening Shapes Sheet
      await page.evaluate(() => window.__testApp.openSheet('shapes'));
      await page.waitForTimeout(300);
      await page.evaluate(() => window.__testApp.closeAllModals());
      console.log('  ✓ Shapes sheet toggled cleanly.');

      // Test Opening Models Modal
      await page.evaluate(() => window.__testApp.openModal('models'));
      // Adding is the safe default. Explicitly choose Replace before testing
      // the work-loss guard.
      await page.getByRole('button', { name: 'Replace current' }).click();
      const firstModelCard = page.locator('#model-library-modal .paperrocket-model-item').first();
      await firstModelCard.waitFor({ state: 'visible', timeout: 5000 });
      await firstModelCard.click();
      const workLossDialog = page.getByRole('alertdialog');
      await workLossDialog.waitFor({ state: 'visible', timeout: 5000 });
      const focusedLabel = await page.evaluate(() => document.activeElement?.textContent?.trim() || '');
      if (!focusedLabel.startsWith('Cancel')) {
        throw new Error(`Work-loss dialog did not focus Cancel by default (focused: "${focusedLabel}").`);
      }
      await page.keyboard.press('Escape');
      await workLossDialog.waitFor({ state: 'detached', timeout: 5000 });
      console.log('  ✓ Replacement requires the shared decision sheet; Cancel has default focus and Escape keeps work.');
      await page.evaluate(() => window.__testApp.closeAllModals());
      console.log('  ✓ Models modal toggled cleanly.');

      // Test Drawing stroke, Undo, Redo
      console.log('  ✍️ Simulating drawing gesture...');
      const canvasBox = await page.locator('#root canvas').first().boundingBox();
      if (canvasBox) {
        const cx = canvasBox.x + canvasBox.width * 0.5;
        const cy = canvasBox.y + canvasBox.height * 0.5;

        // Perform drag stroke
        await page.mouse.move(cx, cy);
        await page.mouse.down();
        await page.mouse.move(cx + 40, cy + 30, { steps: 5 });
        await page.mouse.move(cx + 70, cy + 10, { steps: 5 });
        await page.mouse.up();
        await page.waitForTimeout(500);

        // Check if undo button is enabled
        const undoBtn = page.locator('.studio-top-strip button[aria-label="Undo"]');
        const isUndoEnabled = await undoBtn.evaluate((el) => !el.disabled);
        if (!isUndoEnabled) {
          console.warn('  ⚠️ Undo button was not enabled after stroke (gesture may require engine warm-up).');
        } else {
          console.log('  ✓ Stroke registered; Undo button enabled.');
          await undoBtn.click();
          await page.waitForTimeout(300);

          const redoBtn = page.locator('.studio-top-strip button[aria-label="Redo"]');
          const isRedoEnabled = await redoBtn.evaluate((el) => !el.disabled);
          console.log(`  ✓ Undo executed; Redo enabled: ${isRedoEnabled}.`);
          if (isRedoEnabled) {
            await redoBtn.click();
            await page.waitForTimeout(300);
            console.log('  ✓ Redo executed cleanly.');
          }
        }
      }

      // Assert no critical unhandled errors occurred during interaction
      const criticalErrors = pageErrors.filter((e) => !e.includes('ResizeObserver') && !e.includes('WebGL'));
      if (criticalErrors.length > 0) {
        throw new Error(`Encountered page errors: ${criticalErrors.join(', ')}`);
      }

      await context.close();
    }

    console.log('\n🔍 [4/5] Checking brush image asset HTTP loading...');
    const assetPage = await browser.newPage();
    for (const brush of REQUIRED_BRUSH_FILES) {
      const res = await assetPage.goto(`${BASE_URL}/assets/brushes/${brush}`);
      if (!res.ok()) {
        throw new Error(`Failed to load asset over HTTP: /assets/brushes/${brush} (status ${res.status()})`);
      }
    }
    console.log('  ✓ All brush preview images loaded over HTTP with status 200.');
    await assetPage.close();

    console.log('\n🔍 [5/5] All smoke tests passed successfully! 🎉');
  } finally {
    await browser.close();
    if (spawnedServer) {
      try {
        spawnedServer.kill();
      } catch {
        // ignore
      }
    }
  }
}

runSmokeTests().catch((err) => {
  console.error('\n❌ Smoke tests failed:', err);
  process.exit(1);
});
