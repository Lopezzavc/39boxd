"use client";

import { useEffect, useState } from "react";

export type GlassRenderMode = "backdrop" | "clone";

// Module-level cache: the answer can't change within a single page session,
// so every LiquidGlass/Slider/Switch instance shares one detection pass
// instead of touching the DOM per-instance.
let cachedSupport: boolean | null = null;

function detectBackdropFilterUrlSupport(): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  if (cachedSupport !== null) return cachedSupport;

  try {
    // The original demo's heuristic: `url(#id)` backdrop-filter values are
    // (at the time of writing) only honored by Chromium-based browsers, and
    // even there only if the browser actually keeps the `url(...)` token
    // instead of dropping the whole declaration as invalid.
    const isChromium = !!(window as unknown as { chrome?: unknown }).chrome;
    const testEl = document.createElement("div");
    testEl.style.backdropFilter = "url(#test)";
    const supportsUrl = testEl.style.backdropFilter.includes("url");
    cachedSupport = isChromium && supportsUrl;
  } catch {
    cachedSupport = false;
  }

  return cachedSupport;
}

/** Exposed for tests / for callers that want to force re-detection (e.g.
 * after a browser update in a long-lived SPA session — not needed in
 * practice but kept for parity with how the original demo's detection is
 * a plain function that could be re-invoked). */
export function resetLiquidGlassSupportCache() {
  cachedSupport = null;
}

export interface UseLiquidGlassSupportResult {
  /** Whether the browser genuinely supports `backdrop-filter: url(#id)`. */
  supported: boolean;
  /** Which renderer is currently active. Defaults to "backdrop" when
   * supported, "clone" otherwise — matching `useBackdropFilter = backdropFilterSupported`
   * in the original demo. */
  mode: GlassRenderMode;
  /** Manually override the renderer (mirrors the original's #modeToggle /
   * `toggleRenderMode()`). Ignored while `forcedMode` is passed. */
  setMode: (mode: GlassRenderMode) => void;
  /** True once client-side detection has run at least once. Before that,
   * `mode` defaults to "clone" so SSR/first paint never assumes a
   * capability it hasn't verified yet. */
  ready: boolean;
}

/**
 * Client-only feature detection + renderer selection, ported from the
 * original demo's `detectBackdropFilterSupport` / `useBackdropFilter` /
 * `toggleRenderMode`.
 *
 * @param forcedMode  When provided, always use this renderer regardless of
 *                     detection (useful for testing the fallback path in a
 *                     Chromium browser, or forcing "clone" for visual
 *                     consistency across browsers).
 */
export function useLiquidGlassSupport(forcedMode?: GlassRenderMode): UseLiquidGlassSupportResult {
  const [supported, setSupported] = useState(false);
  const [mode, setMode] = useState<GlassRenderMode>("clone");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const isSupported = detectBackdropFilterUrlSupport();
    setSupported(isSupported);
    if (!forcedMode) {
      setMode(isSupported ? "backdrop" : "clone");
    }
    setReady(true);
    // Intentionally only re-runs when `forcedMode` changes; detection
    // itself is stable for the lifetime of the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forcedMode]);

  useEffect(() => {
    if (forcedMode) setMode(forcedMode);
  }, [forcedMode]);

  return { supported, mode, setMode, ready };
}
