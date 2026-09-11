import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const SCREENSHOT_DIR = 'E:/X/AiStudio Workflow/V20/screenshots/s25ultra-audit';
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const targetUrl = process.env.APP_URL || 'http://localhost:3002/?device=none';

async function captureAllScreenshots() {
  console.log('===============================================================');
  console.log('  S25 ULTRA HEADLESS BROWSER AUDIT: SCREENSHOT RUNNER');
  console.log('===============================================================');
  console.log(`Target URL: ${targetUrl}`);
  console.log(`Output Directory: ${SCREENSHOT_DIR}`);
  console.log('Resolution: 1440 × 3120 Portrait (Viewport 412 × 893 @ 3.5 DPR)');
  console.log('---------------------------------------------------------------\n');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--enable-webgl'],
  });

  const context = await browser.newContext({
    viewport: { width: 412, height: 893 },
    deviceScaleFactor: 3.5, // 412 * 3.5 = 1442, 893 * 3.5 = 3125.5 (~ 1440 × 3120 S25 Ultra Native)
    isMobile: true,
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (Linux; Android 15; SM-S938B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Mobile Safari/537.36',
  });

  const page = await context.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.log('  [Browser Error]:', msg.text());
    }
  });

  const manifest = [];

  async function snap(filename, description, category = 'General') {
    const filePath = path.join(SCREENSHOT_DIR, filename);
    await page.waitForTimeout(350);
    await page.screenshot({ path: filePath });
    const stat = fs.statSync(filePath);
    const item = {
      filename,
      description,
      category,
      path: filePath,
      sizeBytes: stat.size,
    };
    manifest.push(item);
    console.log(`[SAVED] ${filename} (${Math.round(stat.size / 1024)} KB) - ${description}`);
  }

  try {
    console.log('1. Navigating to Studio application...');
    await page.goto(targetUrl, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // -------------------------------------------------------------
    // CATEGORY 1: BASE WORKSPACE & SYSTEM OVERLAYS
    // -------------------------------------------------------------
    console.log('\n--- Category 1: Base Workspace & Toolbars ---');
    await snap('01-base-canvas-fullscreen.png', 'Base 3D Canvas in Fullscreen mode', 'Base Workspace');

    // -------------------------------------------------------------
    // CATEGORY 2: BOTTOM DOCK QUICK TOOLS
    // -------------------------------------------------------------
    console.log('\n--- Category 2: Bottom Dock Quick Tools ---');
    
    // Draw tool active
    const drawBtn = page.locator('button[data-pro-rail-button="true"][aria-label="Draw"]');
    if (await drawBtn.isVisible()) {
      await drawBtn.click();
      await snap('02-dock-tool-draw-active.png', 'Bottom Dock: Draw Tool Active', 'Bottom Dock');
    }

    // Erase tool active
    const eraseBtn = page.locator('button[data-pro-rail-button="true"][aria-label="Erase"]');
    if (await eraseBtn.isVisible()) {
      await eraseBtn.click();
      await snap('03-dock-tool-erase-active.png', 'Bottom Dock: Erase Tool Active', 'Bottom Dock');
    }

    // Switch back to draw
    if (await drawBtn.isVisible()) {
      await drawBtn.click();
    }

    // Color Swatch Shelf
    const colorBtn = page.locator('button[data-pro-rail-button="true"][aria-label="Color"]');
    if (await colorBtn.isVisible()) {
      await colorBtn.click();
      await page.waitForTimeout(400);
      await snap('04-dock-color-shelf-open.png', 'Bottom Dock: Quick Color Shelf Open', 'Bottom Dock');

      // Pick staple blue color
      const blueSwatch = page.locator('button[aria-label="Pick color #2563eb"], button[title*="#2563eb"]').first();
      if (await blueSwatch.isVisible()) {
        await blueSwatch.click();
        await snap('05-dock-color-shelf-swatch-selected.png', 'Bottom Dock: Blue Swatch Selected', 'Bottom Dock');
      }

      // Close shelf by clicking color button again
      await colorBtn.click();
      await page.waitForTimeout(300);
    }

    // Size Slider Shelf
    const sizeBtn = page.locator('button[data-pro-rail-button="true"][aria-label="Stroke size"]');
    if (await sizeBtn.isVisible()) {
      await sizeBtn.click();
      await page.waitForTimeout(400);
      await snap('06-dock-size-shelf-open.png', 'Bottom Dock: Size Slider Shelf Open', 'Bottom Dock');

      // Interact with size slider if present
      const slider = page.locator('.paperrocket-studio-shelf input[type="range"]');
      if (await slider.isVisible()) {
        await slider.fill('0.08');
        await snap('07-dock-size-slider-adjusted.png', 'Bottom Dock: Brush Size Slider Adjusted', 'Bottom Dock');
      }

      await sizeBtn.click();
      await page.waitForTimeout(300);
    }

    // Quick Brush Preset Shelf
    const brushBtn = page.locator('button[data-pro-rail-button="true"][aria-label="Brushes"]');
    if (await brushBtn.isVisible()) {
      await brushBtn.click();
      await page.waitForTimeout(400);
      await snap('08-dock-brush-shelf-open.png', 'Bottom Dock: Quick Brush Preset Shelf Open', 'Bottom Dock');

      // Select Conformal Bead brush preset
      const conformalBtn = page.locator('button:has-text("Hugs models"), button:has-text("Conformal")').first();
      if (await conformalBtn.isVisible()) {
        await conformalBtn.click();
        await snap('09-dock-brush-conformal-selected.png', 'Bottom Dock: Conformal Bead Hugs Model Brush Selected', 'Bottom Dock');
      }

      await brushBtn.click();
      await page.waitForTimeout(300);
    }

    // Symmetry toggle
    const symmBtn = page.locator('button[data-pro-rail-button="true"][aria-label="Symmetry"]');
    if (await symmBtn.isVisible()) {
      await symmBtn.click();
      await page.waitForTimeout(400);
      await snap('10-dock-symmetry-active.png', 'Bottom Dock: Symmetry Tool Activated', 'Bottom Dock');
      // Click again to close panel
      await page.evaluate(() => window.__testApp?.closeAllModals());
      await page.waitForTimeout(300);
    }

    // -------------------------------------------------------------
    // CATEGORY 3: RIGHT RAIL MODAL PANELS (SELECT, CREATE, DEFORM, LAYERS)
    // -------------------------------------------------------------
    console.log('\n--- Category 3: Right Rail Mode Panels ---');

    // Select Mode
    const selectRailBtn = page.locator('button.paperrocket-studio-mode[aria-label="Select"]');
    if (await selectRailBtn.isVisible()) {
      await selectRailBtn.click();
      await page.waitForTimeout(500);
      await snap('11-rail-select-panel-open.png', 'Right Rail: Select Panel Open', 'Right Rail');

      // Switch selection mode to Lasso
      const lassoBtn = page.locator('button:has-text("Lasso"), button[title*="Lasso"]').first();
      if (await lassoBtn.isVisible()) {
        await lassoBtn.click();
        await snap('12-rail-select-lasso-mode.png', 'Right Rail: Lasso Select Mode Active', 'Right Rail');
      }

      // Expand transform details
      const transformToggle = page.locator('button:has-text("Transform Details"), button:has-text("Exact Position")').first();
      if (await transformToggle.isVisible()) {
        await transformToggle.click();
        await snap('13-rail-select-transform-details.png', 'Right Rail: Transform Coordinates & Values Expanded', 'Right Rail');
      }

      await page.evaluate(() => window.__testApp?.closeAllModals());
      await page.waitForTimeout(300);
    }

    // Create Mode
    const createRailBtn = page.locator('button.paperrocket-studio-mode[aria-label="Create"]');
    if (await createRailBtn.isVisible()) {
      await createRailBtn.click();
      await page.waitForTimeout(500);
      await snap('14-rail-create-panel-primitives.png', 'Right Rail: Create Panel & 3D Shapes Overview', 'Right Rail');

      // Spawn 3D Cube
      const cubeBtn = page.locator('button[title*="Cube"]').first();
      if (await cubeBtn.isVisible()) {
        await cubeBtn.click();
        await page.waitForTimeout(400);
        await snap('15-rail-create-action-spawn-cube.png', 'Action: 3D Cube Primitive Spawned in Scene', 'Actions & Clicks');
      }

      // Spawn 3D Sphere
      const sphereBtn = page.locator('button[title*="Sphere"]').first();
      if (await sphereBtn.isVisible()) {
        await sphereBtn.click();
        await page.waitForTimeout(400);
        await snap('16-rail-create-action-spawn-sphere.png', 'Action: 3D Sphere Primitive Spawned in Scene', 'Actions & Clicks');
      }

      // Switch to Clay mode
      const clayBtn = page.locator('button:has-text("White Clay")').first();
      if (await clayBtn.isVisible()) {
        await clayBtn.click();
        await page.waitForTimeout(400);
        await snap('17-rail-create-show-as-clay.png', 'Action: Display Mode Switched to White Clay', 'Actions & Clicks');
      }

      // Switch back to Full Texture
      const textureBtn = page.locator('button:has-text("Full Texture")').first();
      if (await textureBtn.isVisible()) {
        await textureBtn.click();
        await page.waitForTimeout(400);
        await snap('18-rail-create-show-as-texture.png', 'Action: Display Mode Switched to Full Texture', 'Actions & Clicks');
      }

      // Expand Fine Geometry & Display
      const fineGeomBtn = page.locator('button:has-text("Fine Geometry & Display"), button:has-text("Opacity / Wireframe")').first();
      if (await fineGeomBtn.isVisible()) {
        await fineGeomBtn.click();
        await page.waitForTimeout(400);
        await snap('19-rail-create-fine-geometry-sliders.png', 'Right Rail: Fine Geometry & Display Sliders Open', 'Right Rail');
      }

      await page.evaluate(() => window.__testApp?.closeAllModals());
      await page.waitForTimeout(300);
    }

    // Deform Mode
    const deformRailBtn = page.locator('button.paperrocket-studio-mode[aria-label="Deform"]');
    if (await deformRailBtn.isVisible()) {
      await deformRailBtn.click();
      await page.waitForTimeout(500);
      await snap('20-rail-deform-panel-overview.png', 'Right Rail: Deform & Sculpt Panel Overview', 'Right Rail');

      // Toggle mirror axis X
      const mirrorXBtn = page.locator('button:has-text("Mirror X"), button:has-text("X-Axis")').first();
      if (await mirrorXBtn.isVisible()) {
        await mirrorXBtn.click();
        await snap('21-rail-deform-mirror-plane-active.png', 'Right Rail: Mirror Plane Active along Axis', 'Right Rail');
      }

      await page.evaluate(() => window.__testApp?.closeAllModals());
      await page.waitForTimeout(300);
    }

    // Layers Mode
    const layersRailBtn = page.locator('button.paperrocket-studio-mode[aria-label="Layers"]');
    if (await layersRailBtn.isVisible()) {
      await layersRailBtn.click();
      await page.waitForTimeout(500);
      await snap('22-rail-layers-panel-overview.png', 'Right Rail: Layers Panel Overview', 'Right Rail');

      // Add a layer
      const addLayerBtn = page.locator('button[title*="Add Layer"], button:has-text("New Layer"), button:has-text("Add")').first();
      if (await addLayerBtn.isVisible()) {
        await addLayerBtn.click();
        await page.waitForTimeout(400);
        await snap('23-rail-layers-new-layer-added.png', 'Action: New Artwork Layer Created', 'Actions & Clicks');
      }

      await page.evaluate(() => window.__testApp?.closeAllModals());
      await page.waitForTimeout(300);
    }

    // -------------------------------------------------------------
    // CATEGORY 4: DRAW PANEL & FULL BRUSH SUITE
    // -------------------------------------------------------------
    console.log('\n--- Category 4: Draw Panel & Brushes ---');

    await page.evaluate(() => window.__testApp?.openSheet?.('draw'));
    await page.waitForTimeout(500);
    await snap('24-draw-panel-paint-tab.png', 'Draw Panel: Paint Tab (Profiles & Surfaces)', 'Draw & Brushes');

    // Switch to Brush Tab
    const brushTabBtn = page.locator('button:has-text("Brush")').first();
    if (await brushTabBtn.isVisible()) {
      await brushTabBtn.click();
      await page.waitForTimeout(400);
      await snap('25-draw-panel-brush-tab-curated.png', 'Draw Panel: Brush Tab (Essential Curated Brushes)', 'Draw & Brushes');

      // Click "More Brushes"
      const moreBrushesBtn = page.locator('button:has-text("More Brushes"), button:has-text("Show All")').first();
      if (await moreBrushesBtn.isVisible()) {
        await moreBrushesBtn.click();
        await page.waitForTimeout(400);
        await snap('26-draw-panel-brush-tab-more-expanded.png', 'Draw Panel: All 18 Specialist Brushes Expanded', 'Draw & Brushes');
      }
    }

    // Switch to Advanced Tab
    const advancedTabBtn = page.locator('button:has-text("Advanced"), button:has-text("Settings")').first();
    if (await advancedTabBtn.isVisible()) {
      await advancedTabBtn.click();
      await page.waitForTimeout(400);
      await snap('27-draw-panel-advanced-tab.png', 'Draw Panel: Advanced Tab (Smoothing, Taper, Jitter)', 'Draw & Brushes');
    }

    await page.evaluate(() => window.__testApp?.closeAllModals());
    await page.waitForTimeout(300);

    // Shapes Sheet
    await page.evaluate(() => window.__testApp?.openSheet?.('shapes'));
    await page.waitForTimeout(500);
    await snap('28-shapes-sheet-snapping-settings.png', 'Shapes Sheet: Auto-detect Shapes & Sensitivity', 'Draw & Brushes');
    await page.evaluate(() => window.__testApp?.closeAllModals());
    await page.waitForTimeout(300);

    // -------------------------------------------------------------
    // CATEGORY 5: ACTIVE CANVAS DRAWING ACTIONS
    // -------------------------------------------------------------
    console.log('\n--- Category 5: Active Canvas Drawing Actions ---');

    // Draw a stroke on the canvas
    await page.mouse.move(206, 400);
    await page.mouse.down();
    for (let i = 0; i < 25; i++) {
      await page.mouse.move(206 + (i - 12) * 5, 400 + i * 6);
      await page.waitForTimeout(16);
    }
    await page.mouse.up();
    await page.waitForTimeout(500);
    await snap('29-canvas-stroke-drawn.png', 'Action: Freehand 3D Stroke Drawn on Canvas', 'Actions & Clicks');

    // Draw second contrasting stroke
    await page.evaluate(() => {
      window.__testApp?.setBrushSettings?.((prev) => ({
        ...prev,
        color: '#f59e0b',
        size: 0.06,
        profile: 'tube',
      }));
    });
    await page.mouse.move(140, 360);
    await page.mouse.down();
    for (let i = 0; i < 20; i++) {
      await page.mouse.move(140 + i * 7, 360 + (i % 3 === 0 ? 12 : -10));
      await page.waitForTimeout(16);
    }
    await page.mouse.up();
    await page.waitForTimeout(500);
    await snap('30-canvas-second-golden-stroke.png', 'Action: Second Golden 3D Tube Stroke Drawn', 'Actions & Clicks');

    // Erase a section of the stroke
    if (await eraseBtn.isVisible()) {
      await eraseBtn.click();
      await page.waitForTimeout(300);
      await page.mouse.move(206, 450);
      await page.mouse.down();
      for (let i = 0; i < 15; i++) {
        await page.mouse.move(206 + i * 4, 450 + i * 2);
        await page.waitForTimeout(16);
      }
      await page.mouse.up();
      await page.waitForTimeout(500);
      await snap('31-canvas-stroke-erased.png', 'Action: Erasing Stroke with Real Eraser', 'Actions & Clicks');
      await drawBtn.click();
    }

    // -------------------------------------------------------------
    // CATEGORY 6: COLOR STUDIO COMPREHENSIVE SUITE
    // -------------------------------------------------------------
    console.log('\n--- Category 6: Color Studio Suite ---');

    await page.evaluate(() => window.__testApp?.openModal?.('colorStudio'));
    await page.waitForTimeout(600);

    // Tab 1: Wheel
    await snap('32-color-studio-tab-wheel.png', 'Color Studio: HSV Color Wheel & Brightness Slider', 'Color Studio');

    // Tab 2: OKLCh
    const oklchTab = page.locator('button:has-text("OKLCh"), button:has-text("Perceptual")').first();
    if (await oklchTab.isVisible()) {
      await oklchTab.click();
      await page.waitForTimeout(400);
      await snap('33-color-studio-tab-oklch-polar.png', 'Color Studio: OKLCh Polar Color Space (Lightness, Chroma, Hue)', 'Color Studio');

      // Posterize preview toggle
      const posterizeToggle = page.locator('button:has-text("Posterize"), input[type="checkbox"]').first();
      if (await posterizeToggle.isVisible()) {
        await posterizeToggle.click();
        await snap('34-color-studio-oklch-posterize-steps.png', 'Color Studio: OKLCh Posterization Stepped Bands', 'Color Studio');
      }
    }

    // Tab 3: Harmonies
    const harmoniesTab = page.locator('button:has-text("Harmonies"), button:has-text("Palettes")').first();
    if (await harmoniesTab.isVisible()) {
      await harmoniesTab.click();
      await page.waitForTimeout(400);
      await snap('35-color-studio-tab-harmonies.png', 'Color Studio: Complementary & Analogous Harmonies', 'Color Studio');

      // Expand curated palettes
      const curatedBtn = page.locator('button:has-text("Curated Palettes"), button:has-text("Drafting Neon")').first();
      if (await curatedBtn.isVisible()) {
        await curatedBtn.click();
        await page.waitForTimeout(400);
        await snap('36-color-studio-harmonies-curated-palettes.png', 'Color Studio: Curated Designer Color Palettes List', 'Color Studio');
      }
    }

    // Tab 4: 1-Click Material Shaders
    const shadersTab = page.locator('button:has-text("Shaders"), button:has-text("Materials")').first();
    if (await shadersTab.isVisible()) {
      await shadersTab.click();
      await page.waitForTimeout(400);
      await snap('37-color-studio-tab-material-shaders.png', 'Color Studio: 1-Click 3D Material Shaders Suite', 'Color Studio');

      // Click Prism Glass or Gold shader
      const goldShader = page.locator('button:has-text("Metal"), button:has-text("Gold")').first();
      if (await goldShader.isVisible()) {
        await goldShader.click();
        await snap('38-color-studio-shader-metal-applied.png', 'Action: Polished Metal Gold Material Applied', 'Color Studio');
      }
    }

    await page.evaluate(() => window.__testApp?.closeAllModals());
    await page.waitForTimeout(300);

    // -------------------------------------------------------------
    // CATEGORY 7: TOP STRIP & TOP MORE MENU
    // -------------------------------------------------------------
    console.log('\n--- Category 7: Top Strip & Top More Menu ---');

    const moreBtn = page.locator('button[aria-label="More options"], button[aria-label="More"]').first();
    if (await moreBtn.isVisible()) {
      await moreBtn.click();
      await page.waitForTimeout(500);
      await snap('39-top-more-menu-open.png', 'Top More Menu: Quick Actions List Open', 'Top More Menu');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }

    // -------------------------------------------------------------
    // CATEGORY 8: STUDIO SETTINGS SHEET
    // -------------------------------------------------------------
    console.log('\n--- Category 8: Studio Settings Sheet ---');

    await page.evaluate(() => window.__testApp?.openModal?.('settings'));
    await page.waitForTimeout(500);
    await snap('40-settings-sheet-appearance-theme.png', 'Settings Sheet: Appearance, Theme & Quality', 'Settings');

    // Scroll down settings sheet
    const settingsContainer = page.locator('.paperrocket-studio-sheet-content, [role="dialog"]').first();
    if (await settingsContainer.isVisible()) {
      await settingsContainer.evaluate((el) => el.scrollTo({ top: 350, behavior: 'smooth' }));
      await page.waitForTimeout(400);
      await snap('41-settings-sheet-scene-and-camera.png', 'Settings Sheet: Projection Mode & Grid Toggles', 'Settings');

      await settingsContainer.evaluate((el) => el.scrollTo({ top: 750, behavior: 'smooth' }));
      await page.waitForTimeout(400);
      await snap('42-settings-sheet-storage-and-backup.png', 'Settings Sheet: Storage Persistence & Local Autosaves', 'Settings');
    }

    await page.evaluate(() => window.__testApp?.closeAllModals());
    await page.waitForTimeout(300);

    // -------------------------------------------------------------
    // CATEGORY 9: MODEL LIBRARY & 3D INGESTION
    // -------------------------------------------------------------
    console.log('\n--- Category 9: Model Library & Ingestion ---');

    await page.evaluate(() => window.__testApp?.openModal?.('models'));
    await page.waitForTimeout(600);
    await snap('43-model-library-presets-tab.png', 'Model Library: 3D Preset Models Tab', '3D Models');

    // Saved models tab
    const savedTab = page.locator('button:has-text("Saved"), button:has-text("My Models")').first();
    if (await savedTab.isVisible()) {
      await savedTab.click();
      await page.waitForTimeout(400);
      await snap('44-model-library-saved-tab.png', 'Model Library: Local Saved Models Archive Tab', '3D Models');
    }

    // Filter presets
    const presetsTab = page.locator('button:has-text("Presets")').first();
    if (await presetsTab.isVisible()) {
      await presetsTab.click();
      const searchInput = page.locator('input[placeholder*="Search"]').first();
      if (await searchInput.isVisible()) {
        await searchInput.fill('Pikachu');
        await page.waitForTimeout(300);
        await snap('45-model-library-search-filtered.png', 'Model Library: Search Query Filtered', '3D Models');
      }
    }

    // Load Pikachu Model into Canvas
    console.log('Loading 3D model Pikachu...');
    await page.evaluate(async () => {
      window.__testApp?.closeAllModals();
      const engine = window.__testApp?.getEngine();
      if (engine) {
        await engine.loadPresetModel('pikachu', 'texture', 'clear');
      }
    });
    await page.waitForTimeout(1500);
    await snap('46-canvas-model-pikachu-textured.png', '3D Model: Pikachu Loaded on Canvas in Full Texture Mode', '3D Models');

    // Switch Pikachu to Clay Mode
    await page.evaluate(() => {
      const engine = window.__testApp?.getEngine();
      engine?.setModelDisplayMode('clay');
    });
    await page.waitForTimeout(800);
    await snap('47-canvas-model-pikachu-clay.png', '3D Model: Pikachu Displayed in White Clay Mode', '3D Models');

    // Conformal Paint on Pikachu Model
    console.log('Painting conformal stroke onto 3D model...');
    await page.evaluate(() => {
      window.__testApp?.setBrushSettings?.((prev) => ({
        ...prev,
        color: '#ef4444',
        size: 0.05,
        profile: 'conformal',
        drawingMode: 'surface',
      }));
    });
    await page.mouse.move(206, 420);
    await page.mouse.down();
    for (let i = 0; i < 20; i++) {
      await page.mouse.move(206 + (i - 10) * 4, 420 + i * 3);
      await page.waitForTimeout(16);
    }
    await page.mouse.up();
    await page.waitForTimeout(600);
    await snap('48-canvas-model-conformal-paint-stroke.png', 'Action: Conformal Surface Stroke Painted Hugging 3D Model', 'Actions & Clicks');

    // -------------------------------------------------------------
    // CATEGORY 10: ILLUMINATION & LIGHTING STUDIO
    // -------------------------------------------------------------
    console.log('\n--- Category 10: Illumination Studio ---');

    await page.evaluate(() => window.__testApp?.openModal?.('illumination'));
    await page.waitForTimeout(600);
    await snap('49-illumination-studio-modal-overview.png', 'Studio Illumination: 3D Lighting Dome & Studio Presets', 'Lighting');

    // Pick Warm tone
    const warmToneBtn = page.locator('button:has-text("Warm")').first();
    if (await warmToneBtn.isVisible()) {
      await warmToneBtn.click();
      await snap('50-illumination-studio-tone-warm.png', 'Studio Illumination: Warm Golden Ambient Lighting Tone', 'Lighting');
    }

    // Pick Silhouette preset
    const silPresetBtn = page.locator('button:has-text("Silhouette"), button:has-text("Dramatic")').first();
    if (await silPresetBtn.isVisible()) {
      await silPresetBtn.click();
      await snap('51-illumination-studio-preset-silhouette.png', 'Studio Illumination: Dramatic Silhouette Lighting Preset', 'Lighting');
    }

    await page.evaluate(() => window.__testApp?.closeAllModals());
    await page.waitForTimeout(300);

    // -------------------------------------------------------------
    // CATEGORY 11: 3D ARMATURES & SCAFFOLDING GUIDES
    // -------------------------------------------------------------
    console.log('\n--- Category 11: Scaffolding & Armatures ---');

    await page.evaluate(() => window.__testApp?.openModal?.('scaffolding'));
    await page.waitForTimeout(600);
    await snap('52-scaffolding-modal-proxies-tab.png', '3D Armatures: Proxies Tab (Mannequin, Loomis Head, Vehicle)', 'Armatures & Guides');

    // Tab 2: Primitives
    const primitivesTab = page.locator('button:has-text("Primitives")').first();
    if (await primitivesTab.isVisible()) {
      await primitivesTab.click();
      await page.waitForTimeout(400);
      await snap('53-scaffolding-modal-primitives-tab.png', '3D Armatures: Topology-Accurate Primitives Tab', 'Armatures & Guides');
    }

    // Tab 1: Spawn Human Mannequin
    const proxiesTab = page.locator('button:has-text("Proxies")').first();
    if (await proxiesTab.isVisible()) {
      await proxiesTab.click();
      const mannequinBtn = page.locator('button:has-text("Human Mannequin"), button:has-text("Mannequin Torso")').first();
      if (await mannequinBtn.isVisible()) {
        await mannequinBtn.click();
        await page.waitForTimeout(600);
        await snap('54-scaffolding-mannequin-spawned.png', 'Action: Human Mannequin Scaffolding Spawned on Canvas', 'Actions & Clicks');
      }
    }

    await page.evaluate(() => window.__testApp?.closeAllModals());
    await page.waitForTimeout(400);
    await snap('55-canvas-mannequin-guide-rendered.png', 'Canvas: 3D Mannequin Proportional Guide Rendered', 'Armatures & Guides');

    // -------------------------------------------------------------
    // CATEGORY 12: BEND ALONG PATH CURVED GUIDES
    // -------------------------------------------------------------
    console.log('\n--- Category 12: Bend Along Path Guides ---');

    await page.evaluate(() => window.__testApp?.openModal?.('bentGuide'));
    await page.waitForTimeout(600);
    await snap('56-bent-guide-modal-wave-preset.png', 'Bend Along Path: Wave Preset & Ribbon Geometry', 'Armatures & Guides');

    // Select Spiral Preset
    const spiralBtn = page.locator('#mody-bent-guide-modal button:has-text("spiral"), button:has-text("Spiral")').first();
    if (await spiralBtn.isVisible()) {
      await spiralBtn.click();
      await page.waitForTimeout(300);
      await snap('57-bent-guide-modal-spiral-preset.png', 'Bend Along Path: Spiral 3D Preset Selected', 'Armatures & Guides');

      const createGuideBtn = page.locator('button:has-text("Create Curved Guide")').first();
      if (await createGuideBtn.isVisible()) {
        await createGuideBtn.click();
        await page.waitForTimeout(600);
      }
    }

    await page.evaluate(() => window.__testApp?.closeAllModals());
    await page.waitForTimeout(400);
    await snap('58-canvas-spiral-curved-guide-active.png', 'Canvas: Spiral Curved 3D Guide Surface Active', 'Armatures & Guides');

    // -------------------------------------------------------------
    // CATEGORY 13: ARBITRARY 3D MIRROR PLANE
    // -------------------------------------------------------------
    console.log('\n--- Category 13: Custom Mirror Plane ---');

    await page.evaluate(() => window.__testApp?.openModal?.('customMirror'));
    await page.waitForTimeout(600);
    await snap('59-custom-mirror-modal-overview.png', 'Custom Mirror Plane: 3D Coordinate Controls', 'Armatures & Guides');

    const alignCamBtn = page.locator('button:has-text("Align to Camera View"), button:has-text("Align to Camera")').first();
    if (await alignCamBtn.isVisible()) {
      await alignCamBtn.click();
      await page.waitForTimeout(400);
      await snap('60-custom-mirror-aligned-to-camera.png', 'Action: 3D Mirror Plane Aligned Directly to Camera Direction', 'Actions & Clicks');
    }

    await page.evaluate(() => window.__testApp?.closeAllModals());
    await page.waitForTimeout(300);

    // -------------------------------------------------------------
    // CATEGORY 14: EXPORT & SESSIONS MODALS
    // -------------------------------------------------------------
    console.log('\n--- Category 14: Export & Sessions ---');

    await page.evaluate(() => window.__testApp?.openModal?.('export'));
    await page.waitForTimeout(600);
    await snap('61-export-modal-options.png', 'Export Modal: GLB, Wavefront OBJ, UV Texture & Snapshot', 'Export & Sessions');
    await page.evaluate(() => window.__testApp?.closeAllModals());
    await page.waitForTimeout(300);

    await page.evaluate(() => window.__testApp?.openModal?.('sessions'));
    await page.waitForTimeout(600);
    await snap('62-project-sessions-modal.png', 'Project Sessions: Non-destructive History & Undo Preservation', 'Export & Sessions');
    await page.evaluate(() => window.__testApp?.closeAllModals());
    await page.waitForTimeout(300);

    // -------------------------------------------------------------
    // CATEGORY 15: PICTURE QUALITY & POST-PROCESSING
    // -------------------------------------------------------------
    console.log('\n--- Category 15: Picture Quality & Post-Processing ---');

    await page.evaluate(() => window.__testApp?.openModal?.('renderSettings'));
    await page.waitForTimeout(600);
    await snap('63-render-settings-picture-quality-modal.png', 'Picture Quality: Render Mode (Draft vs Composited) & Shaders', 'Rendering & Shaders');
    await page.evaluate(() => window.__testApp?.closeAllModals());
    await page.waitForTimeout(300);

    // -------------------------------------------------------------
    // CATEGORY 16: CURVE DECIMATION & RDP SIMPLIFICATION
    // -------------------------------------------------------------
    console.log('\n--- Category 16: Curve Decimation ---');

    await page.evaluate(() => window.__testApp?.openModal?.('curveDecimate'));
    await page.waitForTimeout(600);
    await snap('64-curve-decimate-modal.png', 'Simplify Lines: Ramer-Douglas-Peucker Curve Decimation', 'Editing Tools');
    await page.evaluate(() => window.__testApp?.closeAllModals());
    await page.waitForTimeout(300);

    // -------------------------------------------------------------
    // CATEGORY 17: FLOATING REFERENCE CLIPBOARD & MOODBOARD
    // -------------------------------------------------------------
    console.log('\n--- Category 17: Floating Reference Clipboard ---');

    await page.evaluate(() => window.__testApp?.openModal?.('clipboard'));
    await page.waitForTimeout(600);
    await snap('65-floating-reference-clipboard.png', 'Floating Blueprint: 2D Moodboard & Reference Overlay', 'Editing Tools');
    await page.evaluate(() => window.__testApp?.closeAllModals());
    await page.waitForTimeout(300);

    // -------------------------------------------------------------
    // CATEGORY 18: WEBXR AR VIEWER MODAL
    // -------------------------------------------------------------
    console.log('\n--- Category 18: AR Viewer ---');

    await page.evaluate(() => window.__testApp?.openModal?.('arViewer'));
    await page.waitForTimeout(600);
    await snap('66-ar-viewer-modal.png', 'WebXR AR Viewer: Floor Scan & Real-World Placement Modal', 'AR & Camera');
    await page.evaluate(() => window.__testApp?.closeAllModals());
    await page.waitForTimeout(300);

    // -------------------------------------------------------------
    // CATEGORY 19: HOLISTIC DNA INSPECTOR POPUP
    // -------------------------------------------------------------
    console.log('\n--- Category 19: Holistic DNA Inspector ---');

    await page.evaluate(() => window.__testApp?.openModal?.('dna'));
    await page.waitForTimeout(600);
    await snap('67-holistic-dna-inspector.png', 'Holistic DNA Inspector: Roughness, Metalness, Emissive & Shaders', 'Editing Tools');
    await page.evaluate(() => window.__testApp?.closeAllModals());
    await page.waitForTimeout(300);

    // -------------------------------------------------------------
    // CATEGORY 20: STYLUS RADIAL MENU (LONG PRESS CANVAS)
    // -------------------------------------------------------------
    console.log('\n--- Category 20: Stylus Radial Menu ---');

    await page.mouse.move(206, 380);
    await page.mouse.down();
    await page.waitForTimeout(750); // Long-press threshold
    await snap('68-stylus-radial-menu-active.png', 'Stylus Radial Menu: Long-Press Quick Tools Wheel', 'Gestures & Stylus');
    await page.mouse.up();
    await page.waitForTimeout(300);

    // -------------------------------------------------------------
    // CATEGORY 21: LIGHT THEME COMPREHENSIVE AUDIT
    // -------------------------------------------------------------
    console.log('\n--- Category 21: Light Theme Audit ---');

    await page.evaluate(() => window.__testApp?.setTheme?.('light'));
    await page.waitForTimeout(500);
    await snap('69-light-theme-base-canvas.png', 'Light Theme: Base 3D Canvas in Warm White Mode', 'Light Theme');

    // Bottom Dock in light theme
    if (await colorBtn.isVisible()) {
      await colorBtn.click();
      await page.waitForTimeout(400);
      await snap('70-light-theme-color-shelf.png', 'Light Theme: Quick Color Shelf Open', 'Light Theme');
      await colorBtn.click();
      await page.waitForTimeout(300);
    }

    // Color studio in light theme
    await page.evaluate(() => window.__testApp?.openModal?.('colorStudio'));
    await page.waitForTimeout(600);
    await snap('71-light-theme-color-studio.png', 'Light Theme: Compact Color Studio Modal', 'Light Theme');
    await page.evaluate(() => window.__testApp?.closeAllModals());
    await page.waitForTimeout(300);

    // Create panel in light theme
    if (await createRailBtn.isVisible()) {
      await createRailBtn.click();
      await page.waitForTimeout(500);
      await snap('72-light-theme-create-panel.png', 'Light Theme: Create Panel & 3D Shapes', 'Light Theme');
      await page.evaluate(() => window.__testApp?.closeAllModals());
      await page.waitForTimeout(300);
    }

    // Top More Menu in light theme
    if (await moreBtn.isVisible()) {
      await moreBtn.click();
      await page.waitForTimeout(400);
      await snap('73-light-theme-top-more-menu.png', 'Light Theme: Top More Menu Actions', 'Light Theme');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }

    // Switch back to dark theme
    await page.evaluate(() => window.__testApp?.setTheme?.('dark'));
    await page.waitForTimeout(400);

    // -------------------------------------------------------------
    // CATEGORY 22: S25 ULTRA SIMULATOR FRAME BEZEL MODE
    // -------------------------------------------------------------
    console.log('\n--- Category 22: S25 Ultra Device Frame Simulator Mode ---');

    await page.goto('http://localhost:3002/?device=s25ultra', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    await snap('74-s25ultra-titanium-bezel-frame-view.png', 'Simulator Mode: Galaxy S25 Ultra Titanium Frame with Punch Hole', 'Hardware Simulator');

    // Switch simulator orientation to Landscape
    const orientBtn = page.locator('header button:has-text("Portrait"), header button[title*="Orientation"]').first();
    if (await orientBtn.isVisible()) {
      await orientBtn.click();
      await page.waitForTimeout(800);
      await snap('75-s25ultra-titanium-bezel-landscape.png', 'Simulator Mode: Galaxy S25 Ultra Landscape Mode (3120 × 1440)', 'Hardware Simulator');
    }

    console.log('\n===============================================================');
    console.log(`🎉 ALL ${manifest.length} SCREENSHOTS CAPTURED SUCCESSFULLY!`);
    console.log('===============================================================');

  } catch (error) {
    console.error('Audit runner error:', error);
  } finally {
    await browser.close();
  }

  // Write manifest file
  fs.writeFileSync(
    path.join(SCREENSHOT_DIR, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  );
  console.log(`Manifest written to: ${path.join(SCREENSHOT_DIR, 'manifest.json')}`);
}

captureAllScreenshots().catch(console.error);
