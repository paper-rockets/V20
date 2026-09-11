import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const outDir = 'E:/X/AiStudio Workflow/V20/screenshots/test';
fs.mkdirSync(outDir, { recursive: true });

async function test() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  // Mode A: CSS mobile viewport (412x893) with deviceScaleFactor 3.5 -> Output image is 1442x3126 (native S25 Ultra physical pixels with crisp UI)
  const ctxA = await browser.newContext({
    viewport: { width: 412, height: 893 },
    deviceScaleFactor: 3.5,
    isMobile: true,
    hasTouch: true,
  });
  const pageA = await ctxA.newPage();
  await pageA.goto('http://localhost:3002/?device=none', { waitUntil: 'networkidle' });
  await pageA.waitForTimeout(1500);
  await pageA.screenshot({ path: path.join(outDir, 'mode-a-mobile-dpr3.5.png') });
  await ctxA.close();

  // Mode B: Direct 1440x3120 viewport
  const ctxB = await browser.newContext({
    viewport: { width: 1440, height: 3120 },
    deviceScaleFactor: 1,
  });
  const pageB = await ctxB.newPage();
  await pageB.goto('http://localhost:3002/?device=none', { waitUntil: 'networkidle' });
  await pageB.waitForTimeout(1500);
  await pageB.screenshot({ path: path.join(outDir, 'mode-b-direct-1440x3120.png') });
  await ctxB.close();

  // Mode C: device=s25ultra simulator frame
  const ctxC = await browser.newContext({
    viewport: { width: 1440, height: 3120 },
    deviceScaleFactor: 1,
  });
  const pageC = await ctxC.newPage();
  await pageC.goto('http://localhost:3002/?device=s25ultra', { waitUntil: 'networkidle' });
  await pageC.waitForTimeout(1500);
  await pageC.screenshot({ path: path.join(outDir, 'mode-c-simulator-frame.png') });
  await ctxC.close();

  await browser.close();
  console.log('Test screenshots saved to', outDir);
}

test().catch(console.error);
