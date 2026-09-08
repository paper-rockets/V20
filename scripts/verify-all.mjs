import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

async function verify() {
  console.log('--- Starting Comprehensive Headless Verification ---');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });

  const page = await context.newPage();

  page.on('console', (msg) => {
    const text = msg.text();
    if (msg.type() === 'error' || text.includes('Error')) {
      console.log(`[Browser ${msg.type()}]:`, text);
    }
  });

  const targetUrl = process.env.APP_URL || 'http://localhost:5000';
  console.log(`Navigating to ${targetUrl} ...`);
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // 1. Check Quality Profile
  const profileInfo = await page.evaluate(() => {
    const profile = window.__QUALITY_PROFILE__;
    const engine = window.__STUDIO_ENGINE__;
    return {
      tier: profile?.tier,
      targetFps: profile?.targetFps,
      idleFps: profile?.idleFps,
      reason: profile?.reason,
      minFrameIntervalMs: engine?.minFrameIntervalMs,
    };
  });
  console.log('\n[Hardware Profile Check]:', JSON.stringify(profileInfo, null, 2));

  // 2. Load Pikachu 3D Model in Textured Mode
  console.log('\n[Loading 3D Model: Pikachu (Textured)]...');
  const loadRes = await page.evaluate(async () => {
    const engine = window.__STUDIO_ENGINE__;
    if (!engine) return { success: false, error: 'No engine' };
    await engine.loadPresetModel('pikachu', 'texture', 'clear');
    return {
      success: true,
      activeModel: engine.activeModelName,
      displayMode: engine.modelDisplayMode,
      targetMeshes: engine.targetMeshes?.length,
      meshMaterials: engine.targetMeshes?.map((m) => ({
        name: m.name,
        type: m.material?.type,
        transparent: m.material?.transparent,
        depthWrite: m.material?.depthWrite,
        depthTest: m.material?.depthTest,
        polygonOffset: m.material?.polygonOffset,
        polygonOffsetFactor: m.material?.polygonOffsetFactor,
      })),
    };
  });
  console.log('Model Load Result:', JSON.stringify(loadRes, null, 2));
  await page.waitForTimeout(1000);

  // 3. Paint on Textured Pikachu
  console.log('\n[Painting on Textured Pikachu]...');
  await page.mouse.move(640, 420);
  await page.mouse.down();
  for (let i = 0; i < 25; i++) {
    await page.mouse.move(640 + (i - 12) * 5, 420 + Math.sin(i * 0.5) * 20);
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
  await page.waitForTimeout(500);

  const texturedStrokeRes = await page.evaluate(() => {
    const engine = window.__STUDIO_ENGINE__;
    const strokes = Array.from(engine.strokes.values());
    const last = strokes[strokes.length - 1];
    return {
      totalStrokes: strokes.length,
      strokePoints: last?.descriptor?.points?.length ?? 0,
      meshRenderOrder: last?.meshes?.[0]?.renderOrder,
      meshVisible: last?.meshes?.[0]?.visible,
      meshParent: last?.meshes?.[0]?.parent?.type,
      material: {
        type: last?.meshes?.[0]?.material?.type,
        transparent: last?.meshes?.[0]?.material?.transparent,
        depthWrite: last?.meshes?.[0]?.material?.depthWrite,
        depthTest: last?.meshes?.[0]?.material?.depthTest,
      },
    };
  });
  console.log('Textured Stroke Result:', JSON.stringify(texturedStrokeRes, null, 2));

  // Take screenshot of textured painting
  const texturedScreenshotPath = 'scripts/verify-textured-stroke.png';
  await page.screenshot({ path: texturedScreenshotPath });
  console.log('Saved screenshot:', texturedScreenshotPath);

  // 4. Switch to Clay Mode & Paint
  console.log('\n[Switching to Clay Mode & Painting]...');
  await page.evaluate(() => {
    window.__STUDIO_ENGINE__?.setModelDisplayMode('clay');
  });
  await page.waitForTimeout(500);

  await page.mouse.move(640, 360);
  await page.mouse.down();
  for (let i = 0; i < 25; i++) {
    await page.mouse.move(640 + (i - 12) * 5, 360 + Math.cos(i * 0.5) * 20);
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
  await page.waitForTimeout(500);

  const clayStrokeRes = await page.evaluate(() => {
    const engine = window.__STUDIO_ENGINE__;
    const strokes = Array.from(engine.strokes.values());
    const last = strokes[strokes.length - 1];
    const mesh = engine.targetMeshes?.[0];
    return {
      displayMode: engine.modelDisplayMode,
      totalStrokes: strokes.length,
      strokePoints: last?.descriptor?.points?.length ?? 0,
      modelMaterial: {
        type: mesh?.material?.type,
        transparent: mesh?.material?.transparent,
        depthWrite: mesh?.material?.depthWrite,
        polygonOffset: mesh?.material?.polygonOffset,
      },
    };
  });
  console.log('Clay Stroke Result:', JSON.stringify(clayStrokeRes, null, 2));

  const clayScreenshotPath = 'scripts/verify-clay-stroke.png';
  await page.screenshot({ path: clayScreenshotPath });
  console.log('Saved screenshot:', clayScreenshotPath);

  // 5. Switch back to Textured Mode & verify strokes remain visible
  console.log('\n[Switching back to Textured Mode]...');
  await page.evaluate(() => {
    window.__STUDIO_ENGINE__?.setModelDisplayMode('texture');
  });
  await page.waitForTimeout(500);

  const backToTextureRes = await page.evaluate(() => {
    const engine = window.__STUDIO_ENGINE__;
    const mesh = engine.targetMeshes?.[0];
    return {
      displayMode: engine.modelDisplayMode,
      totalStrokes: engine.strokes.size,
      modelMaterial: {
        type: mesh?.material?.type,
        transparent: mesh?.material?.transparent,
        depthWrite: mesh?.material?.depthWrite,
        polygonOffset: mesh?.material?.polygonOffset,
      },
    };
  });
  console.log('Back to Texture Mode Result:', JSON.stringify(backToTextureRes, null, 2));

  const backToTextureScreenshotPath = 'scripts/verify-back-to-textured.png';
  await page.screenshot({ path: backToTextureScreenshotPath });
  console.log('Saved screenshot:', backToTextureScreenshotPath);

  await browser.close();
  console.log('\n--- Verification Finished Successfully ---');
}

verify().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
