import { chromium } from 'playwright';

async function run() {
  console.log('Launching browser...');
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
    if (msg.type() === 'error' || text.includes('Error') || text.includes('FPS') || text.includes('paint') || text.includes('BVH')) {
      console.log(`[Browser ${msg.type()}]:`, text);
    }
  });

  page.on('pageerror', (err) => {
    console.error('[Page Error]:', err.message);
  });

  const targetUrl = process.env.APP_URL || 'http://localhost:5000';
  console.log(`Navigating to ${targetUrl} ...`);
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const state = await page.evaluate(() => {
    const engine = window.__STUDIO_ENGINE__;
    return {
      hasEngine: !!engine,
      modelCount: engine?.modelRoot?.children?.length ?? 0,
      targetMeshes: engine?.targetMeshes?.length ?? 0,
      strokes: engine?.strokes?.size ?? 0,
      modelMode: engine?.modelDisplayMode,
    };
  });
  console.log('Initial state:', state);

  // Measure initial FPS
  const initialFps = await page.evaluate(() => {
    return new Promise((resolve) => {
      let frames = 0;
      const start = performance.now();
      function tick() {
        frames++;
        if (performance.now() - start < 1000) {
          requestAnimationFrame(tick);
        } else {
          resolve(Math.round(frames / ((performance.now() - start) / 1000)));
        }
      }
      requestAnimationFrame(tick);
    });
  });
  console.log('Initial FPS:', initialFps);

  // Test 1: Paint on canvas
  console.log('\n--- Test 1: Paint on canvas ---');
  await page.mouse.move(640, 400);
  await page.mouse.down();
  for (let i = 0; i < 15; i++) {
    await page.mouse.move(640 + i * 5, 400 + (i % 2 === 0 ? 5 : -5));
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
  await page.waitForTimeout(300);

  const canvasStrokes = await page.evaluate(() => {
    const engine = window.__STUDIO_ENGINE__;
    return {
      strokes: engine?.strokes?.size ?? 0,
      strokeMeshes: engine?.strokeRoot?.children?.length ?? 0,
    };
  });
  console.log('After canvas paint:', canvasStrokes);

  // Test 2: Load Pikachu model
  console.log('\n--- Test 2: Load 3D model Pikachu ---');
  const loadResult = await page.evaluate(async () => {
    const engine = window.__STUDIO_ENGINE__;
    if (!engine) return { success: false, error: 'No engine' };
    try {
      await engine.loadPresetModel('pikachu', 'texture', 'clear');
      return {
        success: true,
        modelName: engine.activeModelName,
        targetMeshesCount: engine.targetMeshes?.length ?? 0,
        targetMeshes: engine.targetMeshes?.map((m) => ({
          name: m.name,
          visible: m.visible,
          hasGeom: !!m.geometry,
          hasBVH: !!m.geometry?.boundsTree,
          materialType: m.material?.type,
          transparent: m.material?.transparent,
          depthWrite: m.material?.depthWrite,
          depthTest: m.material?.depthTest,
          polygonOffset: m.material?.polygonOffset,
          polygonOffsetFactor: m.material?.polygonOffsetFactor,
          polygonOffsetUnits: m.material?.polygonOffsetUnits,
          renderOrder: m.renderOrder,
        })),
        modelDisplayMode: engine.modelDisplayMode,
      };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  console.log('Model load result:', JSON.stringify(loadResult, null, 2));

  // Measure FPS with model loaded
  const modelFps = await page.evaluate(() => {
    return new Promise((resolve) => {
      let frames = 0;
      const start = performance.now();
      function tick() {
        frames++;
        if (performance.now() - start < 1000) {
          requestAnimationFrame(tick);
        } else {
          resolve(Math.round(frames / ((performance.now() - start) / 1000)));
        }
      }
      requestAnimationFrame(tick);
    });
  });
  console.log('FPS with model loaded:', modelFps);

  // Test 3: Raycasting on model
  const raycastTest = await page.evaluate(() => {
    const engine = window.__STUDIO_ENGINE__;
    const hits = [];
    for (let x = -0.3; x <= 0.3; x += 0.1) {
      for (let y = -0.3; y <= 0.3; y += 0.1) {
        const hit = engine.raycastModel(x, y);
        if (hit && hit.hit) {
          hits.push({
            x: Math.round(x * 10) / 10,
            y: Math.round(y * 10) / 10,
            mesh: hit.mesh?.name,
            point: hit.point,
            worldPoint: hit.worldPoint,
          });
        }
      }
    }
    return {
      totalHits: hits.length,
      sampleHits: hits.slice(0, 5),
    };
  });
  console.log('Raycast test on Pikachu:', JSON.stringify(raycastTest, null, 2));

  // Test 4: Paint on Pikachu in textured mode
  console.log('\n--- Test 4: Paint on Pikachu (Textured) ---');
  await page.mouse.move(640, 400);
  await page.mouse.down();
  for (let i = 0; i < 20; i++) {
    await page.mouse.move(640 + (i - 10) * 4, 400 + i * 2);
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
  await page.waitForTimeout(300);

  const texturedPaintResult = await page.evaluate(() => {
    const engine = window.__STUDIO_ENGINE__;
    const lastStroke = Array.from(engine?.strokes?.values() ?? []).pop();
    return {
      strokeCount: engine?.strokes?.size ?? 0,
      pointsInLastStroke: lastStroke?.descriptor?.points?.length ?? 0,
      lastStrokeMeshCount: lastStroke?.meshes?.length ?? 0,
      lastStrokeMesh: lastStroke?.meshes?.[0] ? {
        visible: lastStroke.meshes[0].visible,
        renderOrder: lastStroke.meshes[0].renderOrder,
        parent: lastStroke.meshes[0].parent?.name || lastStroke.meshes[0].parent?.type,
        material: {
          type: lastStroke.meshes[0].material?.type,
          transparent: lastStroke.meshes[0].material?.transparent,
          depthWrite: lastStroke.meshes[0].material?.depthWrite,
          depthTest: lastStroke.meshes[0].material?.depthTest,
          polygonOffset: lastStroke.meshes[0].material?.polygonOffset,
          polygonOffsetFactor: lastStroke.meshes[0].material?.polygonOffsetFactor,
          polygonOffsetUnits: lastStroke.meshes[0].material?.polygonOffsetUnits,
          stencilFunc: lastStroke.meshes[0].material?.stencilFunc,
          stencilWrite: lastStroke.meshes[0].material?.stencilWrite,
        },
        firstPoint: lastStroke.descriptor.points[0],
      } : null,
    };
  });
  console.log('Textured paint result:', JSON.stringify(texturedPaintResult, null, 2));

  // Test 5: Switch to Clay mode and paint
  console.log('\n--- Test 5: Switch to Clay and paint ---');
  await page.evaluate(() => {
    window.__STUDIO_ENGINE__?.setModelDisplayMode('clay');
  });
  await page.waitForTimeout(300);

  await page.mouse.move(640, 380);
  await page.mouse.down();
  for (let i = 0; i < 20; i++) {
    await page.mouse.move(640 + (i - 10) * 4, 380 + i * 2);
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
  await page.waitForTimeout(300);

  const clayPaintResult = await page.evaluate(() => {
    const engine = window.__STUDIO_ENGINE__;
    const lastStroke = Array.from(engine?.strokes?.values() ?? []).pop();
    const mesh = engine.targetMeshes?.[0];
    return {
      displayMode: engine?.modelDisplayMode,
      strokeCount: engine?.strokes?.size ?? 0,
      pointsInLastStroke: lastStroke?.descriptor?.points?.length ?? 0,
      modelMeshMaterial: mesh ? {
        type: mesh.material?.type,
        transparent: mesh.material?.transparent,
        depthWrite: mesh.material?.depthWrite,
        polygonOffset: mesh.material?.polygonOffset,
        polygonOffsetFactor: mesh.material?.polygonOffsetFactor,
        polygonOffsetUnits: mesh.material?.polygonOffsetUnits,
      } : null,
    };
  });
  console.log('Clay paint result:', JSON.stringify(clayPaintResult, null, 2));

  await browser.close();
}

run().catch(console.error);
