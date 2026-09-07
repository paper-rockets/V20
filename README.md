# Remix 3D Studio (V20 Mobile-First)

Target directory: `E:\X\AiStudio Workflow\V20`

3D spatial and surface painting studio built for touch devices, tablets, and desktop browsers, with native Android APK packaging as the primary distribution target.

---

## 1. Quick Start & Developer Workflows

### Prerequisites
- Node.js 20+ (recommended: Node.js 22 LTS)
- npm 10+

### Installation
```bash
npm ci
```

### Running the Development Server
Starts the Vite server bound to `0.0.0.0:3000` so both your desktop browser and phone on the same Wi-Fi can reach it:
```bash
npm run dev
```
- **On this computer:** `http://localhost:3000`
- **On your phone (same Wi-Fi):** `http://<your-local-ip>:3000` (e.g. `http://192.168.0.22:3000`)

### Verification & Testing
Always run these three commands before committing or deploying:
```bash
# 1. Type check
npm run lint

# 2. Automated Playwright smoke test across Phone, Tablet, and Desktop viewports
npm test

# 3. Production bundle build
npm run build
```

---

## 2. Architecture & Key Systems

- **Canvas & Rendering Engine**: High-performance Three.js WebGL rendering with surface conformal snapping, dynamic tessellation, and procedural shader materials.
- **Protected Navigation Gizmo**: `src/components/TransformNavigator/Option3SphereNavigator.tsx` is an established, protected orientation controller. Its design and interactions are preserved.
- **Single Studio Shell**: Single adaptive spatial studio. No legacy play/pro split.
- **Touch Targets**: Minimum 44x44 CSS pixels across all primary actions, top strip buttons, and sheets.
- **Self-Hosted Offline Runtime**: Completely self-contained. Google Fonts (`Plus Jakarta Sans`, `JetBrains Mono`) and Draco runtime scripts are self-hosted locally in `public/fonts/` and `public/draco/`. Cold launch requires zero external network requests.
- **Deferred Module Loading**: Heavy tools (Illumination Studio, Model Converter, Studio Importer, Color Studio Shaders, AR Viewer) are loaded on demand via `React.lazy` and `DeferredPanel`, reducing the initial JS chunk from >733 KB to ~556 KB.

---

## 3. Privacy, Storage & Autosave

### Storage Architecture
1. **Local Sessions**: Projects and undo history are saved in IndexedDB (`idbKeyval` / `remix3d_sessions`).
2. **Offline Assets**: The Service Worker (`public/sw.js`) caches the application shell and up to 80 recent runtime assets with LRU eviction.
3. **No External Tracking**: No telemetry, ads, or third-party user data collection is present. All computation and storage remain strictly on-device.

### Storage Persistence Guarantee Note
- `navigator.storage.persist()` requests persistent storage permissions from the browser.
- **Durability Reality**: Granted persistent storage significantly reduces the risk of automatic browser cache eviction under storage pressure. However, it is not an indestructible guarantee against manual browser clearing, device resets, or OS-level storage exhaustion. Users should use **Export GLB** or project session downloads for long-term archiving.

---

## 4. Android Test Matrix & Verification Protocol

Before generating an APK wrapper, the web application must pass testing across this device matrix:

| Device Class | Resolution | Target Specs | Key Verification Points |
|---|---|---|---|
| **Small Phone** | 360x800 / 390x844 | Low-to-mid Mali/Adreno | No top-bar clipping, 44px touch targets, lower thumb zone usability |
| **Large Phone** | 412x915 / 1440x3120 | Galaxy S24/S25 Ultra, Pixel | High DPI stroke crispness, 60-120 FPS sustained drawing |
| **Budget Tablet** | 1200x2000 | Galaxy Tab S6 Lite (Mali-G72) | Memory < 450 MB, tile cache MSAA, zero frame lag during fast spinning |
| **Modern Tablet** | 1024x768 / 1600x2560 | iPad / Tab S9 | Orientation change, expanded side panel docking |

### Critical Mobile Interaction Scenarios
1. **Screen Rotation**: Rotate between portrait and landscape during active drawing. Camera aspect ratio and canvas viewport must update immediately without stroke distortion.
2. **Background & Resume**: Switch away from the app while drawing, open other apps, and resume. WebGL context must remain valid and undo/redo stacks preserved.
3. **Cold Offline Launch**: Turn on Airplane mode (disable Wi-Fi and Cellular). Launch the app. The canvas, tools, and local models must render immediately from service worker cache.
4. **Stylus vs. Finger Input**: Test with active stylus (S-Pen / Apple Pencil) and capacitive touch. Finger drawing toggle in Settings must suppress unwanted palm marks while allowing camera rotation.
5. **Fast Drawing / Spinning**: Fast multi-stroke and rapid circular strokes must retain high geometric resolution without reverting to straight chord approximations.

---

## 5. Release Checklist & APK Packaging Gate

Do **NOT** package the Android APK until all of the following conditions are met:
- [ ] TypeScript check passes with zero errors (`npm run lint`).
- [ ] Playwright automated smoke suite passes across all 3 viewports (`npm test`).
- [ ] Production build succeeds with initial JS bundle within budget (`npm run build`).
- [ ] Cold offline launch verified with 0 external network requests.
- [ ] No P0/P1 work-loss bugs remain on model replacement.
- [ ] All top-bar and menu touch targets verified at >= 44x44 CSS px.
- [ ] Option3SphereNavigator gizmo functions properly without visual regression.

---

## 6. Third-Party Notices & Licenses

This project incorporates the following open-source software:
- **Three.js**: MIT License (Copyright (c) 2010-2026 Three.js Authors)
- **three-mesh-bvh**: MIT License (Copyright (c) 2018 Garrett Johnson)
- **Google Draco**: Apache License 2.0 (Copyright (c) 2016 Google Inc.)
- **Lucide Icons**: ISC License (Copyright (c) 2022-2026 Lucide Contributors)
- **JSZip**: MIT / Dual GPLv3 License (Copyright (c) 2009-2026 Stuart Knightley)
- **Motion**: MIT License (Copyright (c) 2020-2026 Matt Perry)
- **Plus Jakarta Sans**: SIL Open Font License 1.1 (Copyright (c) 2020 Tokotype)
- **JetBrains Mono**: Apache License 2.0 (Copyright (c) 2020 JetBrains s.r.o.)
