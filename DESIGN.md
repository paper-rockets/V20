# V20 Studio Interface

## Direction

The interface is a quiet creative instrument around a large, uninterrupted 3D canvas. Controls should feel precise and approachable, with cyan reserved for active drawing state and warm neutral surfaces separating controls from artwork. The UI must reveal depth only when the user asks for it.

## Responsive workspace

- Phone: five Studio modes in the lower thumb zone; one full-width contextual bottom sheet at a time.
- Tablet: compact left mode rail and a right-side contextual inspector.
- Desktop: persistent left rail and docked right inspector with room for shortcuts and labels.
- Preserve the existing `Option3SphereNavigator` appearance, behavior, motion, menus, and positioning logic.
- Use `100dvh` and safe-area insets. Never obtain a phone layout by squeezing desktop controls.

## Visual language

- Canvas chrome: transparent or near-transparent; no decorative container around persistent tools.
- Context panels: one opaque plane, 14–16px radius, hairline divider, soft offset shadow.
- Accent: cyan for selection, focus, and active drawing state. Amber is reserved for lighting. Red is reserved for destructive actions.
- Typography: self-hosted interface sans; 16px minimum for phone body copy, 12–14px for compact labels, clear weight changes instead of excessive capitalization.
- Icons: existing Studio icon family or Lucide, always paired with accessible names. Do not use text glyphs or emoji as controls.
- Motion: short ease-out transitions; no bounce. Respect reduced motion without eliminating meaningful state changes.

## Interaction hierarchy

- Phone top bar at rest: project/model, undo, redo, More.
- Draw begins with tool, Surface/Space, Flat/Round, Color, Look, size, opacity, and curated brushes.
- Advanced drawing mechanics remain available under progressive disclosure.
- Color controls solid paint. Look controls material/shader. Applying a shader replaces its complete authored look rather than inheriting the previous solid color.
- Every interactive target is at least 44 by 44 CSS pixels; primary phone actions prefer 48–56px.
- Focus rings, dialog names, Escape dismissal, and focus restoration remain visible and functional.

## Product defaults

The first useful stroke is:

```ts
{
  tool: 'brush',
  drawingMode: 'surface',
  profile: 'ribbon',
  materialType: 'shadeless',
  patternType: 'none'
}
```

Fun animated effects remain part of the product. The first page prioritizes Inferno, Lava, Neon Rim, Ocean/Water, Sparkle, Rainbow, Hologram, Slime, and Aurora; other working effects remain under All Effects.
