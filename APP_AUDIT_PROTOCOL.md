# APP_AUDIT_PROTOCOL.md — The Master 12-Layer Real-World App Audit

> **Rule for the AI**: Whenever the user asks you to "scan for bugs", "audit the app", or "check if everything works", you must **NOT** just run a compiler or check for console errors. You MUST run this 12-layer real-world audit across visual, layout, touch, and runtime performance.

---

## Why Standard "Bug Scans" Fail
Compilers and error logs only check for code crashes. They are blind to the most common real-world bugs:
- **Ghost Objects**: Code that runs cleanly, but displays leftover visual artifacts or shapes from an older design.
- **Top-Left Jumps / Flash of Unanchored Content**: Elements that flash at position `(0, 0)` on reload before JavaScript moves them.
- **Silent Blank Screens**: A canvas or container that exists in code with zero errors, but renders 100% transparent or empty.
- **OS Theme Clashes**: A tool turning dark on a light background because the user's tablet has Dark Mode enabled in system settings.
- **Touch & Gesture Traps**: Dragging a tool on mobile causes the whole browser page to scroll or pull-to-refresh.
- **Battery Burners & Memory Leaks**: Listeners and timers piling up over time, dropping frame rates from 60 FPS to 15 FPS.

---

## The 12 Universal Audits for ANY App

### 1. The "Ghost & Leftover" Inventory Audit
*Check for old code that is still drawing on screen.*
- **The Rule**: Every visual element, icon, helper, or 3D mesh on screen must belong to the **current** design.
- **What to Audit**:
  1. Inspect the visual tree (DOM or 3D scene hierarchy).
  2. Flag any orphaned elements, leftover debug markers, test shapes, or old arrows that were replaced by newer tools.
  3. Check for **competing duplicate controls** (e.g. two separate buttons in different corners both trying to minimize/restore the same tool).

### 2. The "Frame-Zero" Layout & Anchoring Audit
*Check what happens at the exact millisecond the page loads.*
- **The Rule**: No floating menu, card, toolbar, or panel may ever appear in the top-left corner `(0, 0)` on reload unless that is its permanent home.
- **What to Audit**:
  1. Examine default CSS before any JavaScript runs.
  2. Does the element have a hard CSS dock (e.g. `right: 12px; bottom: 12px;`)?
  3. If an element depends on JavaScript `requestAnimationFrame` or `useEffect` to find its corner, it will flash at `(0, 0)` on reload. Anchor it in CSS first.

### 3. The "Silent Blank Render" Pixel Audit
*Check that active visual tools actually display graphics, not empty space.*
- **The Rule**: If a tool, canvas, chart, preview, or image is supposed to be open, it must have visible content inside it.
- **What to Audit**:
  1. Never trust that a container is working just because `display != none`.
  2. Inspect the content: Are there actual colored pixels drawn? Or is the canvas transparent/empty?
  3. Check math formulas for edge cases: Did an aspect-ratio calculation produce `NaN`, zero width, or project coordinates outside the visible boundary?

### 4. The 4-Way Device & Theme Matrix
*Never test only on a desktop in one theme.*
Every visual feature must be verified against all 4 combinations:
1. **Desktop + Light Theme**
2. **Desktop + Dark Theme**
3. **Mobile / Tablet (Touchscreen) + Light Theme**
4. **Mobile / Tablet (Touchscreen) + Dark Theme**
- **Specific Mobile/Tablet Checks**:
  - Does the tool respect the app's chosen theme even if the tablet's OS has "System Dark Mode" turned on?
  - Are touch targets at least 40px to 44px so fingers can tap them accurately?

### 5. The Stacking & Clickability (Z-Index) Audit
*Check that buttons are actually clickable and not blocked by invisible walls.*
- **The Rule**: An element that looks interactive must respond when clicked or tapped.
- **What to Audit**:
  1. Are there invisible transparent full-screen overlays (`position: fixed; inset: 0`) swallowing pointer clicks?
  2. Does the overlay root use `pointer-events: none` on the container, and `pointer-events: auto` only on the interactive children?
  3. Are dropdown menus or tooltips clipped by a parent with `overflow: hidden`?

### 6. The State & Reset Audit (Fold, Reopen, Refresh)
*Check that the tool behaves when toggled or reloaded.*
- **The Rule**: Minimizing, tucking away, reopening, or refreshing must never leave the app in a half-broken state.
- **What to Audit**:
  1. Minimize the tool: Does the folded puck/icon appear in the correct corner?
  2. Click the folded puck: Does it expand back to the exact correct size and place?
  3. Hard reload the page (`F5` / browser refresh): Does the tool come back in the expected state without glitches?

### 7. The Touch, Gesture & Scrolling Trap Audit
*Check that touch events don't break page behavior on mobile/tablet.*
- **The Rule**: Interacting with on-screen tools must never trigger accidental browser navigation.
- **What to Audit**:
  1. Interactive canvases and drag handles must have `touch-action: none` so dragging doesn't trigger browser pull-to-refresh or page panning.
  2. Double-tap zoom must be disabled on rapid-click buttons (`touch-action: manipulation`).
  3. Hover states (`:hover`) must not get permanently stuck after a finger lifts off the screen.

### 8. The Mobile Keyboard Squeeze Audit
*Check what happens when an on-screen keyboard appears.*
- **The Rule**: Typing into an input must not break the app layout or trigger hotkeys.
- **What to Audit**:
  1. When the virtual keyboard opens (screen height drops by 40-50%), do bottom buttons get squished or pushed out of reach?
  2. When typing inside an input box, do single-key shortcuts (like pressing "M" for Move or "Z" for Undo) accidentally fire?

### 9. Screen Cutouts, Notches & Safe Areas
*Check that device bezels don't bite into the UI.*
- **The Rule**: Critical buttons must never be obscured by hardware cutouts or system navigation bars.
- **What to Audit**:
  1. Do corner buttons maintain safe distance from iOS Home Indicator bars and Android system navigation buttons?
  2. Does the viewport account for dynamic mobile address bars showing and hiding (`dvh` units vs `vh`)?

### 10. The Zombie Listener & Battery Burner Audit
*Check for memory leaks and runaway CPU loops.*
- **The Rule**: Closing a tool must clean up all background activity.
- **What to Audit**:
  1. Every `addEventListener` must have a corresponding `removeEventListener` on cleanup.
  2. Every `requestAnimationFrame` loop or `setInterval` timer must cancel when its component unmounts.
  3. Idle check: When no user interaction is happening, does the app drop to resting CPU/GPU usage instead of burning battery?
  4. 3D/WebGL: Are deleted geometries, textures, and materials properly disposed of (`.dispose()`)?

### 11. The Storage Amnesia & Corruption Audit
*Check that local data doesn't crash the app.*
- **The Rule**: Corrupted or outdated saved data must never cause a white screen of death.
- **What to Audit**:
  1. All `localStorage` / `sessionStorage` reads must be wrapped in `try / catch` blocks.
  2. If the user has saved data from an older version of the app with an outdated shape, does the code safely fall back to default settings?

### 12. The Network Drop & Asset Fallback Audit
*Check that temporary connection drops don't freeze the screen.*
- **The Rule**: A failed image, font, or 3D model load must fail gracefully, not hang the app.
- **What to Audit**:
  1. If a 3D model, texture, or icon 404s or times out, does the app show an informative fallback rather than freezing on an infinite spinner?
  2. Do clipboard actions (`navigator.clipboard`) handle insecure contexts (HTTP) or permission denials without throwing unhandled exceptions?

---

## Ready-to-Use Master Audit Prompt for AI Chats

Copy and paste this prompt to any AI whenever you want a real, thorough bug sweep:

```text
Run a full real-world visual, touch, and runtime audit based on APP_AUDIT_PROTOCOL.md in this folder.
Do NOT just check for syntax errors or compile errors.
Specifically inspect:
1. Inventory: Any ghost objects, leftover debug shapes, or competing duplicate controls.
2. Frame-Zero Layout: Make sure no floating panels flash in the top-left corner on reload.
3. Content: Confirm all active canvases, previews, and icons are actually drawing visible content.
4. Device & Theme Matrix: Verify Light vs Dark mode, and verify that mobile/tablet OS dark mode does not clash with the app.
5. Touch & Gestures: Ensure touch-action is set so dragging doesn't scroll the page or pull-to-refresh.
6. Safe Areas & Keyboards: Confirm buttons don't get trapped behind virtual keyboards or home bars.
7. Zombie Listeners & Battery: Verify all event listeners and animation loops clean up properly on close.
8. Storage & Reset: Confirm folding, reopening, and reloading the page behaves cleanly without corruption.
Show me the exact results of all checks.
```
