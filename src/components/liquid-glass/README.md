# Liquid Glass — React/Next.js port

A behavior-equivalent port of `liquid_glass_unified.html` (the standalone
Interactive Magnifying Glass + Slider + Switch demo) to React/TypeScript,
built on top of the pre-existing `LiquidGlass.tsx` / `liquidGlassUtils.ts`.

```
liquid-glass/
├── liquidGlassUtils.ts        # math (unchanged) + Spring + validation + map cache
├── useLiquidGlassSupport.ts   # backdrop-filter:url() feature detection
├── GlassContentClone.tsx      # generic DOM-clone fallback renderer
├── LiquidGlass.tsx            # main component (surface mode + draggable lens mode)
├── LiquidGlassSlider.tsx      # 1:1 port of the Slider Demo
├── LiquidGlassSwitch.tsx      # 1:1 port of the Switch Demo
└── index.ts                   # barrel export
```

## Quick usage

```tsx
import { LiquidGlass, LiquidGlassSlider, LiquidGlassSwitch } from "@/components/liquid-glass";

// Static glass surface (nav bar pill, button, etc.)
<LiquidGlass width={220} height={56} borderRadius={28}>
  <span style={{ padding: "0 20px" }}>Glass button</span>
</LiquidGlass>

// Interactive Magnifying Glass — draggable, refracts `backgroundRef`'s content
function Lens() {
  const sceneRef = useRef<HTMLDivElement>(null);
  return (
    <div ref={sceneRef} style={{ position: "relative", height: 500 }}>
      {/* ...page content that sits "under" the glass... */}
      <LiquidGlass
        draggable
        backgroundRef={sceneRef}
        width={200}
        height={140}
        borderRadius={70}
        initialPosition={{ x: 40, y: 40 }}
      />
    </div>
  );
}

// Slider / Switch — fully self-contained, no backgroundRef needed
<LiquidGlassSlider defaultValue={10} onChange={(v) => console.log(v)} />
<LiquidGlassSwitch defaultChecked onChange={(checked) => console.log(checked)} />
```

## Equivalence matrix (original → port)

| Original (`liquid_glass_unified.html`)                         | Port                                                                 | Notes |
|---|---|---|
| `SurfaceEquations`                                              | `liquidGlassUtils.ts › SurfaceEquations`                             | Verbatim |
| `class Spring`                                                  | `liquidGlassUtils.ts › Spring`                                       | Verbatim (`+reset()` added) |
| `calculateDisplacementMap1D/2D`, `calculateSpecularHighlight`, `imageDataToDataURL` | `liquidGlassUtils.ts`                          | Verbatim math, wrapped by `computeGlassMaps()` for validation + caching |
| `detectBackdropFilterSupport` / `useBackdropFilter` / `toggleRenderMode` | `useLiquidGlassSupport.ts`                          | SSR-safe, per-instance `mode`, `renderMode` prop for manual override |
| `updateContentClonePosition`, rect cache, throttle              | `GlassContentClone.tsx`                                              | Generalized to clone **any** DOM subtree (`backgroundRef`) instead of a hardcoded page copy; adds `MutationObserver` + `ResizeObserver` so it stays correct as content/layout change |
| `updateFilter` / SVG `<filter id="liquidGlassFilter">`          | `LiquidGlass.tsx` inline `<filter>` + `rebuild()`                    | Same primitive order: blur → feImage(disp) → feDisplacementMap → feColorMatrix(1.3) → feImage(spec) → feComponentTransfer → feBlend(screen) |
| `animationLoop` (scale/scaleX/scaleY/shadow*/refractionBoost springs, squish) | `LiquidGlass.tsx` `animate()` (draggable mode)          | Verbatim formulas, driven imperatively (direct DOM mutation) to avoid React re-renders every frame |
| `initDragging` / `startDrag` / `drag` / `endDrag`               | `LiquidGlass.tsx` pointer-event handlers                             | Pointer Events instead of separate mouse/touch listeners (single code path for mouse/touch/pen); window listeners attached only for the duration of a drag instead of permanently |
| `sliderConfig` / `sliderState` / `sliderSprings` / `sliderAnimationLoop` / `initSliderDemo` | `LiquidGlassSlider.tsx`                        | Verbatim constants and spring formulas. Thumb-position math (`x0`/`x100`/`thumbCenterX`) preserved exactly |
| `switchConfig` / `switchState` / `switchSprings` / `switchAnimationLoop` / `initSwitchDemo` | `LiquidGlassSwitch.tsx`                        | Verbatim constants, `THUMB_REST_OFFSET`/`TRAVEL` derivation, damped-overflow drag math, click-vs-drag `distance < 4` threshold, track-color interpolation |
| `liquidGlassFilter` (lens) SVG graph                             | `LiquidGlass.tsx`                                                     | Same 7-primitive graph, fixed `saturate(1.3)` |
| `sliderGlassFilter` / `switchGlassFilter` SVG graph (composite + double blend) | `LiquidGlassSlider.tsx` / `LiquidGlassSwitch.tsx`         | Same 9-primitive graph (differs from the lens graph on purpose — the original uses two distinct filter recipes; the port does not collapse them into one) |
| `radius = Math.min(borderRadius, w/2, h/2)` vs. CSS `border-radius` mismatch | `LiquidGlass.tsx` `getEffectiveRadius()`                | Fixed: the *same* effective radius is used for both the CSS `border-radius` and the map geometry |
| `ResizeObserver` in `useEffect(..., [])` closing over first-render props | `LiquidGlass.tsx` `rebuild` (`useCallback` w/ deps) + `rebuildRef` | Fixed: `ResizeObserver` always calls the latest `rebuild` via a ref; `rebuild` itself is a memoized callback that changes identity (and re-runs) whenever a geometry-affecting prop changes |
| Global `#id` DOM lookups (`document.getElementById`)             | React refs, one set per component instance                           | No global IDs; `useId()` (sanitized) makes every filter/clone fully instance-scoped, safe for many simultaneous instances |
| No prop validation (`NaN`/negative values could corrupt the filter) | `safeNumber`, `safeRefractiveIndex`, `safeDisplacementScale` in `liquidGlassUtils.ts` | Defensive clamping everywhere a prop feeds the math |

## Known, deliberate deviations from the standalone demo

1. **Fallback clone is generic, not hardcoded markup.** The original demo's
   `#glassContentClone` is a *second, hand-duplicated copy* of the page
   markup (checkerboard grid + text + image), CSS-translated to line up
   with the glass. That only works because the demo's background is
   static and known at authoring time. A reusable component can't assume
   that, so `GlassContentClone` performs a **live `cloneNode(true)`** of
   whatever DOM sits under `backgroundRef`, kept in sync with a
   `MutationObserver` + `ResizeObserver`. This is strictly more general
   (works with arbitrary React content, including content that changes
   after mount) at the cost of not preserving *live widget state* inside
   the cloned subtree — canvases, video playback position, and scroll
   offsets are not carried over into the clone. Text, images (including
   ones that finish loading after mount, since the clone points at the
   same `src` and hits the browser cache), and nested layout all clone
   correctly. This only matters for browsers without
   `backdrop-filter: url()` support (effectively: everything except
   Chromium); Chromium always takes the native path and never touches the
   clone.
2. **Slider/Switch always use the clone/`filter` path**, never
   `backdrop-filter` — this matches the original exactly (it never gives
   those two demos a `.use-backdrop-filter` variant; only the main lens
   toggles).
3. **Pointer Events, not separate mouse/touch listeners.** Functionally
   identical gesture handling, one code path instead of three
   (`mousedown`/`touchstart`, etc.), and listeners for `pointermove`/`up`
   are only attached for the duration of an active drag rather than for
   the lifetime of the page.
4. **`active` / `restColor` / `activeTransitionMs` on `LiquidGlass`** is
   kept as a lightweight, backward-compatible convenience (simple
   solid↔glass crossfade). It is **not** a port of the Slider physics —
   use `LiquidGlassSlider` for that. This mirrors the original request's
   guidance: extend the API with explicit variants rather than overload
   one prop to do everything.
5. **Map memoization.** `computeGlassMaps()` caches by a key of
   `(width, height, radius, bezelWidth, glassThickness, refractiveIndex,
   surfaceType, specularAngle)` with a bounded LRU-style cache (96
   entries), so multiple instances sharing identical geometry (e.g. many
   `LiquidGlassSwitch`es on one page) reuse the same generated
   displacement/specular images instead of recomputing per-pixel math
   redundantly.

## SSR / Next.js notes

- All three components are `"use client"`.
- No `window`/`document`/`ImageData`/`canvas`/`ResizeObserver` access
  happens at module scope or during the initial render — `computeGlassMaps`
  returns `null` outside the browser, and every DOM-touching effect is
  gated behind `typeof window !== "undefined"` / `typeof ResizeObserver !==
  "undefined"` checks where relevant.
- Verified safe under React Strict Mode's double mount/unmount: all
  `ResizeObserver`/`MutationObserver`/`requestAnimationFrame`/pointer
  listeners are created and torn down inside the same effect, and springs
  live in `useRef` (not recreated on re-render), so a mount → unmount →
  remount cycle never leaves an orphaned animation loop or duplicate
  listener.

## Multi-instance safety

Every instance gets its own sanitized `useId()`-derived filter id (colons
stripped, since `useId()` can return something like `:r0:` which is legal
inside `url(#...)` but is unnecessary risk to carry through string
concatenation into CSS/SVG attribute contexts). No `document.getElementById`
calls exist anywhere in the port — all references are instance-local React
refs — so any number of `LiquidGlass`/`LiquidGlassSlider`/`LiquidGlassSwitch`
instances can coexist on one page without collisions.
