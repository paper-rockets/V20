# V20 Technical Issues Already Detected

This file contains only technical issues previously confirmed through source inspection, build checks, or direct testing of the deployed V19/V20 application. It is not a new speculative audit. Product strategy, visual taste, feature-trimming recommendations, and legal opinions are excluded.

## Severity definitions

- **P0 — Blocking:** Can destroy work or prevent a core task.
- **P1 — Major:** Must be addressed before a commercial release.
- **P2 — Moderate:** Material reliability, accessibility, performance, or maintenance problem.
- **P3 — Minor:** Cleanup or polish with limited immediate user impact.

## Unresolved confirmed issues

### 1. [P0] Loading a preset model can silently destroy the current drawing and undo history

**Evidence:**

- `src/components/ModelLibraryModal.tsx:82-89` loads a selected preset without checking whether the current canvas contains work and without asking for confirmation.
- `src/core/studioEngine.ts:723-728` calls `clearModel()` before loading the new preset.
- `src/core/studioEngine.ts:2673-2675` shows that `clearModel()` calls `clearAllStrokes()`.
- `clearAllStrokes()` resets the drawing state and history.
- Direct testing confirmed that loading a model after drawing removed the existing stroke/model state and left Undo/Redo unavailable.

**Impact:** A user can permanently lose unsaved creative work by choosing a model from the Pro model library.

**Required fix:** Add a dirty-work check and a real confirmation dialog with Save, Replace, and Cancel choices. Loading a model should become an undoable project operation or create a new project instead of clearing history.

### 2. [P1] The Play-mode Toybox also clears strokes before loading

**Evidence:** `src/components/play/Toybox.tsx:125-138` calls `engine.clearAllStrokes()` before loading a blank canvas, preset, or saved model. The Toybox displays warning text when work exists, but warning text is not equivalent to a blocking confirmation.

**Impact:** A mistaken tap can replace work. Touch devices make accidental activation more likely.

**Required fix:** Use the same Save/Replace/Cancel confirmation flow everywhere a project or base model is replaced.

### 3. [P1] There is no automated test suite

**Evidence:**

- `package.json` has no `test` script.
- Playwright remains installed, but V20 contains no active Playwright tests.
- Test and robot/audit scripts that existed around V19 were not carried into the clean V20 repository.

**Impact:** Core operations such as drawing, undo, save, model replacement, modal opening, export, and mobile layout can regress without the deployment pipeline noticing.

**Required fix:** Add smoke tests for initial render, draw/undo/redo, save/restore, safe model replacement, Play/Pro navigation if both remain, export, and key mobile breakpoints.

### 4. [P1] Deployment checks only whether the application bundles

**Evidence:** `.github/workflows/deploy.yml:37-41` runs `npm install` followed by `npm run build`. It does not run the TypeScript check or any browser tests.

**Impact:** GitHub Pages can publish a build containing behavior regressions, accessibility failures, or data-loss defects.

**Required fix:** Use `npm ci`, then run `npm run lint`, automated tests, and `npm run build` before deployment.

### 5. [P1] Brush preview images are visibly broken in the deployed mobile interface

**Evidence:** Direct V20 testing at a 412 × 915 viewport showed missing-image placeholders in all eight Sculpt brush cards. The accessibility tree reported image elements, but the displayed preview graphics failed to render.

**Impact:** Users cannot visually distinguish brushes. The broken-image icons make the product look unfinished and reduce confidence in the drawing system.

**Required fix:** Verify every brush preview source, add a deterministic local fallback glyph, and add an automated image-load assertion.

### 6. [P1] The mobile brush shelf has severe light-theme contrast failures

**Evidence:** Direct V20 testing showed the Brushes heading, category tabs, Size label, and Strength label rendered in very pale or white text against a nearly white panel. Several controls were barely visible.

**Impact:** Important controls are difficult or impossible to read. This is an accessibility and task-completion problem.

**Required fix:** Route all shelf foreground/background colors through tested theme tokens and verify WCAG AA contrast in both themes.

### 7. [P1] Top-bar touch targets are below the recommended minimum

**Evidence:** At 412 × 915, the visible top-bar icon buttons measured approximately 32 × 32 CSS pixels. The main left-side drawing controls measured 44 × 44.

**Impact:** Undo, redo, save, sessions, lighting, snapping, settings, and fullscreen are unnecessarily difficult to tap accurately on a phone or tablet.

**Required fix:** Give every touch action a minimum interactive area of 44 × 44 pixels, even if the visual icon remains smaller.

### 8. [P1] Browser zoom is explicitly disabled

**Evidence:** `index.html:5` contains `maximum-scale=1.0, user-scalable=no`.

**Impact:** Users who need magnification cannot pinch-zoom the interface. This conflicts with accessible web practice and can contribute to WCAG 1.4.4 failures.

**Required fix:** Remove `maximum-scale=1.0` and `user-scalable=no`. Prevent unwanted gesture conflicts on the canvas with scoped `touch-action` rules instead of disabling page zoom globally.

### 9. [P1] The application is not fully offline despite being presented as an installable web app

**Evidence:**

- `index.html:21-23` loads Google Fonts from the network.
- `index.html:25-26` loads Draco encoder and decoder scripts from jsDelivr.
- Local Draco assets also exist in the repository, creating two delivery paths.

**Impact:** First load or uncached use can fail or change appearance when offline, behind a firewall, or when a CDN is unavailable. External scripts also complicate privacy and security policy.

**Required fix:** Self-host the required fonts and Draco runtime, use one pinned local implementation, and test a cold offline launch.

### 10. [P1] The service worker cache has no runtime size or age limit

**Evidence:** `public/sw.js:107-139` intercepts every HTTP GET request and stores every successful status-200 response in the same cache. No maximum entry count, byte limit, age limit, or allowlist is applied.

**Impact:** Imported assets and cross-origin resources can accumulate indefinitely, consuming device storage and retaining stale resources.

**Required fix:** Cache only explicit same-origin asset classes, separate shell and runtime caches, and enforce expiration and entry limits.

### 11. [P1] Saved-library model metadata is fabricated rather than calculated

**Evidence:** `src/components/ExportModal.tsx:132-136` hardcodes zero triangles, zero vertices, one mesh, one material, and dimensions of 1 × 1 × 1 for a saved model.

**Impact:** The model library and inspector can display incorrect technical information. Features that later depend on these values may make incorrect decisions.

**Required fix:** Calculate metadata from the exported scene or reuse the engine's actual inspection result before saving.

### 12. [P1] Performance is below a dependable interactive target on tested hardware/emulation

**Evidence:** Direct testing of the substantially identical V19 engine generally showed approximately 19–31 FPS on desktop, a drop to roughly 6 FPS while loading a model, and approximately 23–28 FPS under the tested mobile viewport/emulation. The core engine and main application files were byte-for-byte unchanged when V20 was created.

**Impact:** Spatial drawing can feel laggy, model loading can appear frozen, and sustained GPU load can drain tablet batteries.

**Required fix:** Establish device-specific performance budgets, profile idle and drawing frames, suspend inactive render loops/effects, and test on the intended Android tablets and phones.

### 13. [P1] The core engine and several UI modules are very large monoliths

**Evidence:**

- `src/core/studioEngine.ts` is approximately 5,321 lines.
- `src/App.tsx` is approximately 1,673 lines.
- `src/components/ModelConverterModal.tsx` is approximately 1,457 lines.
- `src/components/TransformNavigator/Option3SphereNavigator.tsx` is approximately 1,373 lines.
- `src/components/Viewport.tsx` is approximately 1,243 lines.

**Impact:** Changes have a large blast radius, ownership is unclear, testing individual systems is difficult, and AI-generated edits are more likely to introduce unrelated regressions.

**Required fix:** Split the engine by responsibility—drawing, scene/model lifecycle, history, storage, camera, selection, and export—and split large panels into state/controllers plus focused view components.

### 14. [P1] Development server settings are unsafe if exposed outside a trusted local network

**Evidence:** `vite.config.ts` enables `host: 0.0.0.0`, broad CORS, `allowedHosts: true`, and filesystem access beyond the immediate project directory.

**Impact:** Running the development server on a shared or public network increases exposure to unwanted origins and host-header attacks. The remote/mobile server helpers further increase the chance of accidental exposure.

**Required fix:** Default to localhost, explicitly allow only required device hosts, narrow filesystem access, and make remote exposure an intentional opt-in command with clear warnings.

### 15. [P2] There is no Content Security Policy

**Evidence:** `index.html` has no CSP meta policy, and the GitHub Pages deployment does not add CSP headers.

**Impact:** The application has less protection against injected scripts and unexpected external resource execution. The current external font and Draco script dependencies make a strict policy harder to introduce.

**Required fix:** Self-host runtime assets first, then define and test a restrictive CSP compatible with workers, WASM, and required blob URLs.

### 16. [P2] The current JavaScript bundle is heavy for a mobile-first creative tool

**Evidence from the verified production build:**

- Three.js vendor chunk: approximately 978 KB uncompressed / 269 KB gzip.
- Main application JavaScript: approximately 608 KB / 163 KB gzip.
- React vendor chunk: approximately 194 KB / 61 KB gzip.
- Compact Color Studio chunk: approximately 160 KB / 34 KB gzip.
- Draco JavaScript: approximately 719 KB, plus multiple Draco/Basis WASM files.

**Impact:** Slower cold starts, greater memory pressure, and more expensive parsing on Android devices.

**Required fix:** Load conversion/rendering systems only when opened, remove duplicate codec paths, reduce the default feature surface, and measure real Android startup time and memory.

### 17. [P2] A deprecated Draco loader configuration is used

**Evidence:** The deployed V20 application logged: `THREE.DRACOLoader: setDecoderConfig ... has been deprecated and will be removed in r194.`

**Impact:** A future Three.js upgrade can break compressed model loading.

**Required fix:** Update Draco loader initialization to the current Three.js API and add a compressed-GLB loading test.

### 18. [P2] A mobile panel can reopen at a remembered scroll position that hides its header

**Evidence:** Direct mobile testing of the substantially identical V19 panel system showed the Draw panel opening partway down its content, with the title and close control outside the visible area. The relevant panel implementation was not materially changed in the initial V20 cleanup.

**Impact:** Users can become trapped or may not understand which panel is open.

**Required fix:** Reset or deliberately restore scroll position per panel, keep the header and close action sticky, and test open/close after scrolling.

### 19. [P2] Storage persistence documentation overstates browser guarantees

**Evidence:** `src/utils/storagePermission.ts:46-49` states that granted persistent storage means eviction heuristics will “never” purge the origin's data.

**Impact:** Future UI or documentation may promise stronger data durability than browsers guarantee. Device reset, user clearing, browser policy, corruption, and exceptional storage pressure still exist.

**Required fix:** Describe persistent storage as reducing automatic eviction risk, continue autosave/export recovery options, and test corrupted/outdated records.

### 20. [P2] Product and package metadata are still placeholder-quality

**Evidence:**

- `package.json` and `package-lock.json` identify the project as `react-example` version `0.0.0`.
- `index.html:15-18` and `public/manifest.webmanifest` use the old “Remix 3D Model Painting Studio” identity.
- The metadata describes a Draco compression and conversion suite rather than the clarified hobbyist spatial-drawing product.

**Impact:** Installed-app labels, browser metadata, diagnostics, package tooling, and deployment artifacts present inconsistent identities.

**Required fix:** Choose a product name, update package/PWA/browser metadata together, and introduce a real versioning scheme.

### 21. [P2] Build tooling is classified inconsistently

**Evidence:** Vite and Vite plugins are listed partly as production dependencies, and Vite is duplicated across dependency groups.

**Impact:** Production dependency installation is larger and package ownership is unclear.

**Required fix:** Keep browser runtime libraries in `dependencies` and move Vite, its plugins, TypeScript, Tailwind build tooling, and test tooling to `devDependencies` without duplication.

### 22. [P2] The clean script is not portable to the project's primary Windows environment

**Evidence:** `package.json` defines `clean` as `rm -rf dist server.js`.

**Impact:** Standard Windows command shells do not provide `rm`, so the script can fail for the project's owner and on Windows automation.

**Required fix:** Replace it with a small cross-platform Node cleanup script or a cross-platform package.

### 23. [P2] Several server launchers still carry stale V14 naming

**Evidence:** Root batch launchers such as `start-full-server.bat` and `start-mobile-server.bat` display “Sketchbook V14” even though the repository is V20 and the interface uses other names.

**Impact:** It is difficult to tell which workflow and version a launcher starts, increasing operator error during testing.

**Required fix:** Consolidate the launchers and give each remaining command current, purpose-based naming.

### 24. [P2] Compression and latency copy makes unverified technical promises

**Evidence:**

- `src/components/ModelConverterModal.tsx:1164` promises 80–95% smaller files.
- `src/components/BrushSettingsPanel.tsx:83` describes raw input as having “zero latency.”

**Impact:** Actual results vary by model, device, browser, and workload. These statements can be demonstrably false.

**Required fix:** Report measured per-file compression results and describe raw input as unfiltered rather than zero-latency.

### 25. [P2] The repository lacks basic commercial engineering documentation

**Evidence:** At the time of inspection, V20 had no root README, LICENSE, third-party notice summary, privacy statement, or release instructions. Individual imported-template license files exist, but there is no consolidated inventory.

**Impact:** A future developer cannot reliably reproduce releases or determine asset/code obligations, and users cannot evaluate local-data and network behavior.

**Required fix:** Add a developer README, release procedure, root license decision, third-party notices, and a plain-language privacy/data-storage document before distribution.

## Technical issues resolved during the V20 cleanup

These findings were confirmed and then corrected. They are listed so a reviewer knows what changed and can verify that they stay removed.

### R1. Removed unrelated system-modification script

`scripts/disable-windows-update.bat` permanently disabled Windows Update, BITS, update services, registry policy, and scheduled tasks. It was unrelated to the application and dangerous to retain. It has been removed.

### R2. Removed a broken Rust launcher

`run-rust-studio.bat` referenced `crates/remix-rust`, which did not exist in V20. It has been removed.

### R3. Removed abandoned navigator implementations

Multiple unused navigator/controller prototypes and an `Option3SphereNavigator.backup.tsx` file were not reachable from the application entry point. They have been removed while preserving the active Option 3 navigator.

### R4. Removed unreferenced generated data and shader dumps

Unused files including `featherBananaData.ts`, `summerShaders.js`, `extractedShaders.js`, `wonderlustShaders.js`, and `matcapPresets.js` were removed. Dead extracted payloads inside active preset modules were stripped while preserving the material presets actually imported by the application.

### R5. Removed captured unrelated application code from shader data

The Blobmixer extracted payload contained a captured minified application bundle with unrelated blockchain/network code and a hardcoded third-party API identifier. The payload was not present in the production bundle because tree-shaking removed it, but it remained a source-provenance and maintenance risk. It has been removed from source.

### R6. Removed duplicate legacy public files

An unreferenced `public/js/three.min.js` and duplicate `public/manifest.json` were removed. The active `manifest.webmanifest` remains.

### R7. Removed unused dependencies and dead environment boilerplate

Unused Gemini, dotenv, Express, QR-code, esbuild, TSX, and redundant type/autoprefixer dependencies were removed, along with the unused `.env.example` Gemini boilerplate. Dependencies required by the mobile server helpers were retained.

### R8. Removed dead type definitions

Types that existed only for the deleted navigator experiments were removed from `src/types.ts`.

### R9. Verified the cleanup

After cleanup:

- TypeScript validation passed with `npm run lint`.
- The production Vite build passed.
- `npm ls --depth=0` reported a healthy top-level dependency tree.
- `git diff --check` passed.
- Source volume fell from approximately 127,477 lines to approximately 53,940 lines.

## Validation context and limitations

- The V20 production build and TypeScript check passed. Passing those checks does not prove behavioral correctness.
- Direct V20 checks covered desktop initial render, browser warnings, and a 412 × 915 mobile light-theme pass of the initial canvas, brush shelf, and Preferences panel.
- Some interaction and performance observations were made against V19. Source comparison established that the core engine, `App.tsx`, model library, Toybox, export system, and storage system carried into V20 unchanged; only a small set of navigator/dock styling files differed initially.
- A full dark-theme matrix, real Android hardware battery profile, corrupted-storage migration test, offline cold-start test, complete keyboard traversal, every import format, and every export target were not completed. They are intentionally not reported above as confirmed failures.
- The attempted Impeccable helper binary was flagged by Windows Security and removed. That was an installation-environment event, not a V20 application defect, so it is not included as an app issue.
