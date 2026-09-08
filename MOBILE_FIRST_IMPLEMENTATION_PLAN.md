# V20 Mobile-First Technical Scan and Implementation Plan

Target: `E:\X\AiStudio Workflow\V20`

## Product decisions locked for this plan

- One Studio interface. Do not restore a separate Play mode.
- Phone is the primary layout, tablet is the expanded layout, and desktop browser is the wide layout.
- Android APK is the first native packaging target. Keep the interface compatible with a later iPad wrapper.
- The default mark is a flat, surface-attached stroke that follows a canvas or imported 3D model.
- Keep the fun animated shaders because they create the product's wow moment.
- Preserve the existing `Option3SphereNavigator` navigation gizmo exactly. Do not redesign, restyle, simplify, replace, or change its controls or interaction behavior.
- Choosing a shader applies the shader's authored appearance. It must not silently mix with the previously selected paint color.
- Simplicity, work safety, and drawing responsiveness outrank exposing every engine control.

## Current V20 baseline

- TypeScript check passes with zero errors.
- Production build passes.
- Current production output remains heavy for mobile: main JavaScript is about 734 KB uncompressed, Three.js about 977 KB, Motion about 127 KB, and the main CSS about 145 KB.
- `TECHNICAL_ISSUES.md` already records major release blockers, including destructive model replacement, missing automated tests, weak deployment checks, offline dependencies, unbounded service-worker caching, mobile contrast/touch problems, and performance risk.
- V20 now renders one Studio shell and the obsolete Play/Pro compatibility layer has been removed. Retained shared components use neutral Studio naming.
- The default brush already uses `profile: 'ribbon'` and `materialType: 'shadeless'`, but surface attachment is not explicit in the default object.
- `CompactColorStudioModal.tsx` explicitly applies `color: currentColor` when a shader is applied to the brush. This is the confirmed cause of the unwanted shader/color mixing.

## Priority order

1. Prevent work loss.
2. Fix the shader/material behavior and default surface stroke.
3. Replace the desktop-squeezed phone layout with a real mobile shell.
4. Simplify navigation and drawing controls through progressive disclosure.
5. Establish Android performance, offline, and storage reliability budgets.
6. Add automated protection before packaging the APK.

## Current UI implementation status (September 8, 2026)

- Implemented one mobile-first Studio shell with two distinct control areas: a centered bottom Drawing dock and a compact side Studio dock.
- Drawing dock: Draw, Erase, quick Color, Size, Brush, and Symmetry.
- Studio dock: Select, Create, Deform, and Layers. Its side can be set to Auto, Left, or Right, with optional auto-hide.
- Removed the duplicate floating zoom/reset/pan strip from every device. The existing 3D axis gizmo remains unchanged.
- Reduced the first brush picker to four plain-language essentials: Flat Ribbon, Surface Decal, 3D Tube, and Chisel Marker. Textures and effects are behind More Brushes.
- Moved fine brush controls to a separate Fine Tune screen instead of expanding an endless accordion.
- Standardized Studio and radial-menu icons; the radial center brush-size readout now opens the editable size control.
- Added a permanent quick-color entry point and removed the legacy green autosave indicator while retaining autosave behavior.
- Changed the model library to legible single-column cards at compact widths, with real model names and Add to Scene as the default UI choice.
- Remaining interface work: compact mobile lighting editor, light-theme scene texture, final phone/tablet rotation pass, and accessibility/touch QA.

## Work for Antigravity Gemini 3.8

These are bounded, mechanical tasks. Complete one phase at a time in the real V20 folder. After every phase run `npm run lint`, `npm run build`, and the relevant Playwright smoke test. Do not redesign screens or invent engine methods.

### AG-1: Remove obsolete Play/Pro compatibility residue (completed)

- Replace `uiModeStore.ts` with only the still-needed onboarding/preferences state, or move that state to a clearly named store.
- Remove `setUiMode`, `useUiMode`, `ProSurface`, `proSurface`, and the `__testApp.setUiMode` hook.
- Remove obsolete Play/Pro wiring from the surrounding application. For `Option3SphereNavigator.tsx`, preserve its current rendered design and behavior exactly; only remove dead mode plumbing when it can be proven to cause no visual or interaction change.
- Keep the currently shipped Studio behavior while deleting unreachable Play branches and unused Play-only components.
- Rename retained shared files by responsibility when safe: top bar, settings sheet, importer, sheet store. Do not do blind global replacements.
- Acceptance: no `play | pro` mode union remains; app opens directly into the single Studio shell; no feature disappears from the current Studio surface.

### AG-2: Release-safety basics

- Change GitHub deployment to `npm ci`, `npm run lint`, smoke tests, then `npm run build`.
- Add Playwright smoke coverage for initial render, opening every main mode, opening/closing settings, draw/undo/redo, save/restore, and phone/tablet/desktop viewport shells.
- Remove `maximum-scale=1.0` and `user-scalable=no` from `index.html`; keep gesture suppression scoped to the drawing canvas.
- Increase every top-bar and menu touch target to at least 44 by 44 CSS pixels.
- Add deterministic fallbacks and load assertions for every brush preview image.
- Acceptance: CI refuses a broken type-check, smoke flow, image preview, or production build.

### AG-3: Offline and dependency cleanup

- Self-host the two fonts and Draco runtime already required by the application.
- Remove the Google Fonts and jsDelivr runtime tags from `index.html` and from the service-worker manifest.
- Use one local Draco path rather than parallel CDN and local paths.
- Split service-worker caches into application shell and bounded runtime assets; add an allowlist, maximum entries, and expiration.
- Move Vite and build-only packages entirely to `devDependencies` and remove duplicates.
- Update placeholder package, manifest, browser title, and launcher metadata only after the product name is chosen.
- Acceptance: a cold offline launch reaches the canvas and can reopen an existing local project without external requests.

### AG-4: Mechanical performance cleanup

- Hide FPS diagnostics by default and expose them only through a diagnostics setting.
- Lazy-load conversion, AR, advanced render settings, large model tools, and the full shader gallery only when opened.
- Pause animated preview canvases, timers, and render loops when hidden or offscreen.
- Remove the deprecated Three.js shadow-map setting and deprecated Draco configuration using current supported APIs.
- Record bundle sizes after each change; do not claim a gain without measurements.
- Acceptance: no idle background preview loop runs while its panel is closed; initial chunks are smaller than the current baseline.

### AG-5: Documentation and packaging preparation

- Add a developer README, release checklist, privacy/storage explanation, and third-party notices.
- Consolidate stale server launchers and remove V14 wording.
- Document the Android test matrix: small phone, large phone, Tab S6 Lite, modern tablet, rotation, background/resume, low storage, offline, and stylus/no-stylus.
- Do not package the APK until the Codex redesign phases and release gates below pass.

## Work reserved for Codex: interface and interaction redesign

These phases require product and visual judgment. They should not be reduced to mechanical restyling.

### CX-1: One adaptive workspace system

Use one information architecture with three responsive presentations:

| Device | Primary navigation | Context controls |
|---|---|---|
| Phone | Bottom Drawing dock plus compact right Studio dock | Full-width bottom sheet with sticky title and primary action |
| Tablet | Bottom Drawing dock plus compact left Studio dock | Right-side panel, sized to preserve a large drawing viewport |
| Desktop | Same two-dock model with mouse and keyboard affordances | Docked right inspector with optional keyboard shortcuts |

Rules:

- Never shrink the desktop layout to fit a phone.
- The existing `Option3SphereNavigator` is a protected component. Responsive layout work may reserve space around it, but may not change its appearance, position logic, menus, controls, motion, or interaction behavior.
- Keep primary actions in the lower thumb zone on phones.
- Use safe-area insets on every screen edge and `100dvh` for the workspace.
- Only one contextual panel may be open at a time.
- Closing and reopening a panel resets to its top unless the user is returning immediately to an unfinished subtask.
- The canvas remains visible enough to preview changes while editing settings.

### CX-2: Simplify the top bar

- Phone at rest: project/model, undo, redo, and one More button.
- Put Save, Sessions, Lighting, Shape tools, Settings, Fullscreen, diagnostics, and secondary project actions into the More sheet or their relevant mode.
- Tablet and desktop may expose Save plus one or two frequent actions when space permits.
- Show autosave state as quiet text feedback, not another permanent button.
- Keep Camera Recovery contextual: it appears only when recovery is actually needed.

### CX-3: Redesign Draw around the first useful stroke

The first visible Draw sheet contains only:

1. Draw, Erase, Sample.
2. Draw on Surface or Draw in Space.
3. Flat or Round.
4. Color and Look as separate controls.
5. Brush size and opacity.
6. A small curated brush row.

Everything else moves under Advanced: smoothing algorithm, detailed profiles, PBR controls, patterns, pressure tuning, shape recognition sensitivity, cutout eraser, and technical surface settings.

Default state and model-loading state must explicitly set:

```ts
{
  tool: 'brush',
  drawingMode: 'surface',
  profile: 'ribbon',
  materialType: 'shadeless',
  patternType: 'none'
}
```

When an imported model becomes the drawing surface, the next stroke must attach to it without another setting change. Free-space drawing stays one clear tap away.

### CX-4: Separate Color from Look and fix shaders

Current defect: `CompactColorStudioModal.tsx` passes `color: currentColor` into shader brush settings. That makes an authored shader inherit and mix with the old paint color.

Redesign:

- Color changes solid paint color only.
- Look selects Flat Paint, Lit, Glow, MatCap, or Animated FX.
- Each shader preset owns a complete `BrushLookPreset`: material type, shader, authored base color, roughness, metalness, emissive strength, transparency, and any supported uniforms.
- Applying a shader replaces the complete look atomically. Do not merge it into arbitrary previous material state.
- Preserve the user's last solid color separately so returning to Flat Paint restores it.
- Add an optional `Tint with my color` control only for shaders explicitly marked `supportsTint`; default it off.
- Show a clear active-look chip beside the color swatch, for example `Lava`, rather than implying that the current hex color fully describes the brush.
- Apply to Brush and Apply to Model remain separate, explicit actions.

Keep a curated first page of high-impact effects: Inferno, Lava, Neon Rim, Ocean/Water, Sparkle, Rainbow, Hologram, Slime, and Aurora. Keep the remaining effects under `All Effects`; do not delete working shaders merely to simplify the first screen.

Acceptance:

- Select blue, then select Lava: the next stroke uses authored Lava, not blue-tinted Lava.
- Return to Flat Paint: the prior blue color returns.
- Select a tint-capable effect and explicitly enable tint: only then may blue influence it.
- Shader cards preview the same result produced on the stroke.

### CX-5: Protect work during project/model changes

- Replace warning text and browser `confirm()` calls with one shared Save, Replace, Cancel decision sheet.
- Use it for model library selection, import, blank canvas, project restore, and every path that clears strokes/history.
- Default focus/action must be Cancel; destructive replacement cannot happen from a single accidental tap.
- Save creates a recoverable session before replacement.
- Long-term goal: make model replacement a project-level undo operation where technically safe.

### CX-6: First-run and empty-state redesign

- Do not restore the old Play tutorial.
- Use a short Studio introduction that teaches by action: choose Surface or Space, make one stroke, move the camera, then show Save.
- On phones without a detected stylus, explain finger drawing and camera gestures before the first conflicting gesture.
- Empty Canvas and imported-model starts are equal first-class choices.
- The intro is skippable and can be reopened from Help.

### CX-7: Visual system and accessibility

- Define semantic tokens for canvas chrome, panels, text, muted text, borders, selection, danger, success, and focus in light and dark themes.
- Remove one-off hard-coded foreground/background combinations from active UI.
- Use a strong visible focus ring and correct dialog semantics, focus trapping, Escape behavior, and focus restoration.
- Do not rely on hover, color alone, or unlabeled icons.
- Minimum touch target is 44 by 44; preferred primary phone actions are 48 to 56 high.
- Respect reduced motion with intentional state changes rather than a global near-zero-duration kill.

## Release gates before Android APK work

- No known P0 or P1 work-loss issue remains.
- Core draw, undo, save, restore, model replacement, and export smoke tests pass.
- Phone layouts pass at 360x800, 390x844, and 412x915 in both themes.
- Tablet layouts pass at 1024x768 and the real Galaxy Tab S6 Lite in both orientations.
- Surface-attached Flat is the verified default on blank canvas and imported models.
- Shader replacement/tint behavior passes the four acceptance cases above.
- Cold offline launch and service-worker update recovery are verified.
- Real-device drawing latency, sustained FPS, memory growth, battery temperature, and background/resume behavior are recorded against explicit budgets.
- GLB and high-resolution image export are verified; secondary export formats may remain under Advanced.

## Recommended execution sequence

1. CX-5 work-loss protection.
2. AG-1 compatibility cleanup.
3. CX-4 shader/material state correction.
4. CX-1 responsive shell.
5. CX-2 top bar and CX-3 Draw workflow.
6. CX-6 onboarding and CX-7 design/accessibility system.
7. AG-2 tests and deployment gates.
8. AG-3 offline reliability and AG-4 measured performance cleanup.
9. AG-5 documentation and Android packaging preparation.

Do not combine phases. Re-test the real drawing gesture after every phase, not only whether the panel opens.
