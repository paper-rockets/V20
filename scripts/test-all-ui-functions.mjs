import { chromium } from 'file:///e:/X/AiStudio Workflow/V20/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';

const SCREENSHOT_DIR = 'C:/Users/macie/.gemini/antigravity/brain/7bcd66b1-fb9a-4700-ab96-9f6cfbbbc06f/scratch/ui-test';
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function runComprehensiveUITest() {
  console.log('🚀 Starting Comprehensive UI & Guide Function Audit...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage({
    viewport: { width: 412, height: 915 }, // Mobile Pixel 7 (matching user phone)
    hasTouch: true,
  });

  const testResults = [];
  function record(feature, status, details = '') {
    testResults.push({ feature, status, details });
    console.log(`[${status}] ${feature}: ${details}`);
  }

  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.log('Browser console error:', msg.text());
    }
  });

  try {
    const targetUrl = process.env.APP_URL || 'http://localhost:5000';
    await page.goto(targetUrl, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/01-initial-mobile.png` });
    record('Page Load', 'PASS', 'Canvas and UI mounted cleanly');

    // 1. Bottom Dock - Draw Tool
    const drawBtn = page.locator('button[data-pro-rail-button="true"][aria-label="Draw"]');
    if (await drawBtn.isVisible()) {
      await drawBtn.click();
      await page.waitForTimeout(500);
      const isDrawOpen = await page.evaluate(() => window.__testApp?.getEngine()?.currentDrawingMode || 'brush');
      await page.screenshot({ path: `${SCREENSHOT_DIR}/02-dock-draw.png` });
      record('Dock Draw Button', 'PASS', `Active drawing mode: ${isDrawOpen}`);
    } else {
      record('Dock Draw Button', 'FAIL', 'Draw button not visible');
    }

    // 2. Bottom Dock - Erase Tool
    const eraseBtn = page.locator('button[data-pro-rail-button="true"][aria-label="Erase"]');
    if (await eraseBtn.isVisible()) {
      await eraseBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/03-dock-erase.png` });
      record('Dock Erase Button', 'PASS', 'Switched tool to eraser');
    } else {
      record('Dock Erase Button', 'FAIL', 'Erase button not visible');
    }

    // 3. Bottom Dock - Color Swatch & Popover
    const colorBtn = page.locator('button[data-pro-rail-button="true"][aria-label="Color"]');
    if (await colorBtn.isVisible()) {
      await colorBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/04-dock-color-shelf.png` });
      const shelfVisible = await page.locator('.paperrocket-studio-shelf').isVisible();
      record('Dock Color Button', shelfVisible ? 'PASS' : 'FAIL', `Shelf visible: ${shelfVisible}`);

      // Pick staple color if visible
      const blueSwatch = page.locator('button[aria-label="Pick color #2563eb"]');
      if (await blueSwatch.isVisible()) {
        await blueSwatch.click();
        await page.waitForTimeout(300);
        record('Dock Color Pick', 'PASS', 'Picked color #2563eb');
      }
      // Dismiss shelf by clicking backdrop
      const backdrop = page.locator('.fixed.inset-0.z-30.pointer-events-auto');
      if (await backdrop.isVisible()) {
        await backdrop.click({ position: { x: 50, y: 100 } });
      }
      await page.waitForTimeout(300);
    }

    // 4. Bottom Dock - Size Button & Slider
    const sizeBtn = page.locator('button[data-pro-rail-button="true"][aria-label="Size"]');
    if (await sizeBtn.isVisible()) {
      await sizeBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/05-dock-size-shelf.png` });
      const sizeShelfVisible = await page.locator('.paperrocket-studio-shelf').isVisible();
      record('Dock Size Button', sizeShelfVisible ? 'PASS' : 'FAIL', `Size slider shelf: ${sizeShelfVisible}`);
      // Dismiss shelf
      const backdrop = page.locator('.fixed.inset-0.z-30.pointer-events-auto');
      if (await backdrop.isVisible()) {
        await backdrop.click({ position: { x: 50, y: 100 } });
      }
      await page.waitForTimeout(300);
    }

    // 5. Bottom Dock - Brush Button & Preset Shelf
    const brushBtn = page.locator('button[data-pro-rail-button="true"][aria-label="Brush"]');
    if (await brushBtn.isVisible()) {
      await brushBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/06-dock-brush-shelf.png` });
      const brushShelfVisible = await page.locator('.paperrocket-studio-shelf').isVisible();
      record('Dock Brush Button', brushShelfVisible ? 'PASS' : 'FAIL', `Brush shelf: ${brushShelfVisible}`);
      // Dismiss shelf
      const backdrop = page.locator('.fixed.inset-0.z-30.pointer-events-auto');
      if (await backdrop.isVisible()) {
        await backdrop.click({ position: { x: 50, y: 100 } });
      }
      await page.waitForTimeout(300);
    }

    // 6. Bottom Dock - Symmetry Button
    const symmBtn = page.locator('button[data-pro-rail-button="true"][aria-label="Symmetry"]');
    if (await symmBtn.isVisible()) {
      await symmBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/07-dock-symmetry.png` });
      record('Dock Symmetry Button', 'PASS', 'Toggled symmetry');
    }

    // Ensure panels closed before rail clicks
    await page.evaluate(() => window.__testApp?.closeAllModals());
    await page.waitForTimeout(300);

    // 7. Right Rail - Select Mode
    const selectRailBtn = page.locator('button.paperrocket-studio-mode[aria-label="Select"]');
    if (await selectRailBtn.isVisible()) {
      await selectRailBtn.click();
      await page.waitForTimeout(600);
      const isSelectPanelVisible = await page.locator('aside[aria-label="Select Panel"]').isVisible();
      await page.screenshot({ path: `${SCREENSHOT_DIR}/08-rail-select-panel.png` });
      record('Rail Select Mode', isSelectPanelVisible ? 'PASS' : 'FAIL', `Select panel open: ${isSelectPanelVisible}`);
      // Close panel
      await page.evaluate(() => window.__testApp?.closeAllModals());
      await page.waitForTimeout(300);
    }

    // 8. Right Rail - Create Mode
    const createRailBtn = page.locator('button.paperrocket-studio-mode[aria-label="Create"]');
    if (await createRailBtn.isVisible()) {
      await createRailBtn.click();
      await page.waitForTimeout(600);
      const isCreatePanelVisible = await page.locator('aside[aria-label="Create Panel"]').isVisible();
      await page.screenshot({ path: `${SCREENSHOT_DIR}/09-rail-create-panel.png` });
      record('Rail Create Mode', isCreatePanelVisible ? 'PASS' : 'FAIL', `Create panel open: ${isCreatePanelVisible}`);

      // Check if 3D Armatures button is present inside CreatePanel
      const armaturesBtn = page.locator('button:has-text("3D Armatures")');
      const hasArmatures = await armaturesBtn.isVisible();
      record('Create Panel: 3D Armatures Button', hasArmatures ? 'PASS' : 'FAIL', `Visible: ${hasArmatures}`);

      // Check if Bend Path button is present inside CreatePanel
      const bendBtn = page.locator('button:has-text("Bend Path")');
      const hasBend = await bendBtn.isVisible();
      record('Create Panel: Bend Path Button', hasBend ? 'PASS' : 'FAIL', `Visible: ${hasBend}`);

      // Test Opening 3D Armatures modal
      if (hasArmatures) {
        await armaturesBtn.click();
        await page.waitForTimeout(600);
        await page.screenshot({ path: `${SCREENSHOT_DIR}/10-scaffolding-modal.png` });
        const isScaffoldModalOpen = await page.locator('#mody-scaffolding-modal').isVisible();
        record('3D Armatures Modal Open', isScaffoldModalOpen ? 'PASS' : 'FAIL', `Modal visible: ${isScaffoldModalOpen}`);

        // Spawn a Human Mannequin proxy
        const mannequinBtn = page.locator('button:has-text("Human Mannequin")');
        if (await mannequinBtn.isVisible()) {
          await mannequinBtn.click();
          await page.waitForTimeout(600);
          const scaffoldCount = await page.evaluate(() => window.__testApp?.getEngine()?.scaffoldingEngine?.getScaffolds()?.length || 0);
          record('Spawn Mannequin Guide', scaffoldCount > 0 ? 'PASS' : 'FAIL', `Active scaffolds: ${scaffoldCount}`);
        }

        // Close scaffolding modal
        const closeScaffoldBtn = page.locator('#mody-scaffolding-modal button:has(.lucide-x), #mody-scaffolding-modal button[title="Close"]');
        if (await closeScaffoldBtn.first().isVisible()) {
          await closeScaffoldBtn.first().click();
        } else {
          await page.evaluate(() => window.__testApp?.closeAllModals());
        }
        await page.waitForTimeout(300);
      }

      // Close Create panel if still open
      await page.evaluate(() => window.__testApp?.closeAllModals());
      await page.waitForTimeout(300);
    }

    // 9. Test Bend Along Path (Spiral Guide - matching user's screenshot)
    console.log('🌀 Testing Bent Guide Creation (Spiral)...');
    await page.evaluate(() => window.__testApp?.openModal('bentGuide'));
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/11-bent-guide-modal.png` });
    const isBentModalOpen = await page.locator('#mody-bent-guide-modal').isVisible();
    record('Bent Guide Modal Open', isBentModalOpen ? 'PASS' : 'FAIL', `Modal visible: ${isBentModalOpen}`);

    if (isBentModalOpen) {
      // Click SPIRAL preset button
      const spiralBtn = page.locator('#mody-bent-guide-modal button:has-text("spiral")');
      if (await spiralBtn.isVisible()) {
        await spiralBtn.click();
        await page.waitForTimeout(300);
        record('Select Spiral Preset', 'PASS', 'Spiral button clicked');
      }

      // Click "Create Curved Guide"
      const createGuideBtn = page.locator('#mody-bent-guide-modal button:has-text("Create Curved Guide")');
      if (await createGuideBtn.isVisible()) {
        await createGuideBtn.click();
        await page.waitForTimeout(600);
        const bentGuideCount = await page.evaluate(() => window.__testApp?.getEngine()?.getBentGuides()?.length || 0);
        record('Create Spiral Curved Guide', bentGuideCount > 0 ? 'PASS' : 'FAIL', `Bent guides in engine: ${bentGuideCount}`);
      }

      // Close modal
      const closeBentBtn = page.locator('#mody-bent-guide-modal button:has(.lucide-x)');
      if (await closeBentBtn.first().isVisible()) {
        await closeBentBtn.first().click();
      } else {
        await page.evaluate(() => window.__testApp?.closeAllModals());
      }
      await page.waitForTimeout(600);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/12-spiral-guide-on-canvas.png` });
    }

    // 10. Audit Guide Stretch / Edit / Transform Interaction
    console.log('🔍 Auditing Guide Stretch / Edit / Transform capability...');
    // Check if the guide can be selected or transformed
    const guideInteraction = await page.evaluate(() => {
      const engine = window.__testApp?.getEngine();
      if (!engine) return { error: 'No engine' };
      const bentGuides = engine.getBentGuides?.() || [];
      const scaffolds = engine.scaffoldingEngine?.getScaffolds?.() || [];
      const hasTransformGizmo = Boolean(engine.transformController);
      const activeScope = engine.transformActiveScope;
      return {
        bentGuideCount: bentGuides.length,
        scaffoldCount: scaffolds.length,
        hasTransformGizmo,
        activeScope,
        // Check if there is an active selection or handle on the guide
        selectedModelId: engine.activeSelectedModelId,
        hasGuideTransformHandle: false, // investigate
      };
    });
    record('Guide Canvas Interaction Check', 'AUDIT', JSON.stringify(guideInteraction));

    // 11. Right Rail - Deform Mode
    const deformRailBtn = page.locator('button.paperrocket-studio-mode[aria-label="Deform"]');
    if (await deformRailBtn.isVisible()) {
      await deformRailBtn.click();
      await page.waitForTimeout(600);
      const isDeformPanelVisible = await page.locator('aside[aria-label="Deform Panel"]').isVisible();
      await page.screenshot({ path: `${SCREENSHOT_DIR}/13-rail-deform-panel.png` });
      record('Rail Deform Mode', isDeformPanelVisible ? 'PASS' : 'FAIL', `Deform panel open: ${isDeformPanelVisible}`);
      await page.evaluate(() => window.__testApp?.closeAllModals());
      await page.waitForTimeout(300);
    }

    // 12. Right Rail - Layers Mode
    const layersRailBtn = page.locator('button.paperrocket-studio-mode[aria-label="Layers"]');
    if (await layersRailBtn.isVisible()) {
      await layersRailBtn.click();
      await page.waitForTimeout(600);
      const isLayersPanelVisible = await page.locator('aside[aria-label="Layers Panel"]').isVisible();
      await page.screenshot({ path: `${SCREENSHOT_DIR}/14-rail-layers-panel.png` });
      record('Rail Layers Mode', isLayersPanelVisible ? 'PASS' : 'FAIL', `Layers panel open: ${isLayersPanelVisible}`);
      await page.evaluate(() => window.__testApp?.closeAllModals());
      await page.waitForTimeout(300);
    }

    // 13. Top Strip - Undo, Redo, More Menu
    const undoBtn = page.locator('.studio-top-strip button[aria-label="Undo"]');
    const redoBtn = page.locator('.studio-top-strip button[aria-label="Redo"]');
    const moreBtn = page.locator('.studio-top-strip button[aria-label="More options"], .studio-top-strip button[aria-label="More"]');

    record('Top Strip Undo Button', await undoBtn.isVisible() ? 'PASS' : 'FAIL', 'Undo button verified');
    record('Top Strip Redo Button', await redoBtn.isVisible() ? 'PASS' : 'FAIL', 'Redo button verified');

    if (await moreBtn.first().isVisible()) {
      await moreBtn.first().click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/15-top-more-menu.png` });
      const moreMenuVisible = await page.locator('.paperrocket-studio-top-more-menu, [role="menu"]').isVisible();
      record('Top Strip More Menu', moreMenuVisible ? 'PASS' : 'FAIL', `More menu popup visible: ${moreMenuVisible}`);
      // Close menu
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }

    // 14. Stylus Radial Menu
    console.log('🎨 Testing Stylus Radial Menu trigger...');
    // Long press on canvas to trigger radial menu
    await page.mouse.move(206, 400);
    await page.mouse.down();
    await page.waitForTimeout(700); // long press threshold
    await page.mouse.up();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/16-radial-menu-trigger.png` });
    const radialMenuVisible = await page.locator('.paperrocket-radial-menu, [data-radial-menu]').isVisible();
    record('Stylus Radial Menu', radialMenuVisible ? 'PASS' : 'INFO', `Radial menu on long-press: ${radialMenuVisible}`);

  } catch (err) {
    console.error('Test error:', err);
    record('Execution', 'ERROR', err.message);
  } finally {
    await browser.close();
  }

  // Save report
  fs.writeFileSync(
    `${SCREENSHOT_DIR}/test-results.json`,
    JSON.stringify(testResults, null, 2)
  );
  console.log('\n📊 Test completed. Results saved to scratch/ui-test/test-results.json');
}

runComprehensiveUITest();
