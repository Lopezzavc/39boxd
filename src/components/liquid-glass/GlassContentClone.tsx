"use client";

import React, { useEffect, useImperativeHandle, useRef } from "react";

export interface GlassContentCloneHandle {
  /** Re-measure and reposition the clone immediately (bypasses the ~16ms
   * throttle when `force` is true). Callers driving their own rAF loop
   * (e.g. the draggable lens, Slider, Switch) should call this directly
   * instead of relying on React state/props so repositioning never causes
   * a re-render. */
  reposition: (force?: boolean) => void;
  /** Force a fresh `cloneNode(true)` + reposition. */
  reclone: () => void;
}

export interface GlassContentCloneProps {
  /** The element whose rendered DOM subtree sits "beneath" the glass and
   * must be refracted when native `backdrop-filter` isn't available. This
   * is typically the positioned ancestor the glass element is dragged
   * within (the original demo's `#demoArea` / `#sliderDemoArea` /
   * `#switchDemoArea`). If omitted, the clone renders empty (the glass
   * still works, it just won't refract anything in fallback browsers). */
  backgroundRef: React.RefObject<HTMLElement | null>;
  /** The glass element itself — used to compute where, within
   * `backgroundRef`'s box, the clone's inner content must be shifted to so
   * it lines up with the real content underneath (inverse translate, same
   * technique as the original `updateContentClonePosition`). */
  glassRef: React.RefObject<HTMLElement | null>;
  /** `url(#filterId)` (or "none") applied to this clone's `filter`
   * property. Never applied as `backdrop-filter` — the clone shows an
   * actual copy of the content, so a regular `filter` is what warps it. */
  filterUrl: string;
  /** Only clone/observe/update while true. Lets callers skip all of this
   * work entirely when running in "backdrop" mode. */
  active: boolean;
  borderRadius?: number;
  className?: string;
  style?: React.CSSProperties;
  /** Bump this to force an immediate re-clone + reposition (e.g. after a
   * drag ends, or when the caller knows content changed in a way the
   * MutationObserver might have coalesced away). */
  updateToken?: number;
}

const POSITION_UPDATE_THROTTLE_MS = 16; // ~60fps, matches the original demo
const RECT_CACHE_DURATION_MS = 100; // matches the original demo

/**
 * Fallback renderer for browsers without `backdrop-filter: url(#id)`
 * support. Ports `updateContentClonePosition` from the original demo: it
 * keeps a live DOM clone of `backgroundRef`'s subtree, positioned with an
 * inverse translate so panning/dragging the glass reveals the correct
 * portion of the background, and re-clones on structural mutation or
 * resize.
 *
 * Known limitation vs. a truly pixel-identical clone: `cloneNode(true)`
 * copies markup/attributes, not live widget state — canvases, video
 * playback position, and scroll offsets inside the background subtree are
 * not preserved. Text, images (including ones that load after mount),
 * layout, and nested elements all clone correctly. This only matters in
 * the fallback path; browsers that support native `backdrop-filter` never
 * hit this component.
 */
const GlassContentClone = React.forwardRef<GlassContentCloneHandle, GlassContentCloneProps>(function GlassContentClone(
  { backgroundRef, glassRef, filterUrl, active, borderRadius = 0, className = "", style = {}, updateToken = 0 },
  forwardedRef
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);

  const cachedRectRef = useRef<DOMRect | null>(null);
  const lastRectUpdateRef = useRef(0);
  const lastPositionUpdateRef = useRef(0);
  const pendingRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const mutationObserverRef = useRef<MutationObserver | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  const getBackgroundRect = () => {
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    const bg = backgroundRef.current;
    if (!bg) return null;
    if (!cachedRectRef.current || now - lastRectUpdateRef.current > RECT_CACHE_DURATION_MS) {
      cachedRectRef.current = bg.getBoundingClientRect();
      lastRectUpdateRef.current = now;
    }
    return cachedRectRef.current;
  };

  const cloneBackground = () => {
    const bg = backgroundRef.current;
    const mirror = mirrorRef.current;
    if (!bg || !mirror) return;
    const clone = bg.cloneNode(true) as HTMLElement;
    // The clone must not be interactive or affect layout/AT — it exists
    // purely as filtered pixels.
    clone.setAttribute("aria-hidden", "true");
    clone.style.position = "absolute";
    clone.style.top = "0";
    clone.style.left = "0";
    clone.style.margin = "0";
    clone.style.pointerEvents = "none";
    // Strip ids from the clone so it never collides with the live subtree
    // (duplicate ids would confuse `getElementById`/CSS elsewhere).
    clone.removeAttribute("id");
    clone.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"));
    mirror.replaceChildren(clone);
  };

  const updatePosition = (force = false) => {
    if (!active) return;
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    if (!force && now - lastPositionUpdateRef.current < POSITION_UPDATE_THROTTLE_MS) {
      if (!pendingRef.current) {
        pendingRef.current = true;
        rafRef.current = requestAnimationFrame(() => {
          pendingRef.current = false;
          updatePosition(true);
        });
      }
      return;
    }
    lastPositionUpdateRef.current = now;

    const bgRect = getBackgroundRect();
    const glass = glassRef.current;
    const mirror = mirrorRef.current;
    if (!bgRect || !glass || !mirror) return;

    const glassRect = glass.getBoundingClientRect();
    const offsetLeft = glassRect.left - bgRect.left;
    const offsetTop = glassRect.top - bgRect.top;

    mirror.style.width = `${bgRect.width}px`;
    mirror.style.height = `${bgRect.height}px`;
    mirror.style.transform = `translate(${-offsetLeft}px, ${-offsetTop}px)`;
  };

  // (Re)clone + attach observers whenever we enter "active" (clone) mode.
  useEffect(() => {
    if (!active) return;
    const bg = backgroundRef.current;
    if (!bg) return;

    cloneBackground();
    updatePosition(true);

    const scheduleReclone = () => {
      if (pendingRef.current) return;
      pendingRef.current = true;
      rafRef.current = requestAnimationFrame(() => {
        pendingRef.current = false;
        cloneBackground();
        updatePosition(true);
      });
    };

    if (typeof MutationObserver !== "undefined") {
      const mo = new MutationObserver(scheduleReclone);
      mo.observe(bg, { childList: true, subtree: true, attributes: true, characterData: true });
      mutationObserverRef.current = mo;
    }

    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(() => {
        cachedRectRef.current = null;
        scheduleReclone();
      });
      ro.observe(bg);
      resizeObserverRef.current = ro;
    }

    return () => {
      mutationObserverRef.current?.disconnect();
      mutationObserverRef.current = null;
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      pendingRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, backgroundRef.current]);

  // Reposition on every render where the caller signals movement (drag
  // frames) via updateToken, without tearing down/rebuilding observers.
  useEffect(() => {
    if (!active) return;
    updatePosition(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, updateToken]);

  // Global resize/orientation change invalidates the cached rect, same as
  // the original demo's `window.addEventListener("resize", ...)`.
  useEffect(() => {
    if (!active || typeof window === "undefined") return;
    const onResize = () => {
      cachedRectRef.current = null;
      updatePosition(true);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  useImperativeHandle(
    forwardedRef,
    () => ({
      reposition: (force = false) => updatePosition(force),
      reclone: () => {
        cloneBackground();
        updatePosition(true);
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [active]
  );

  return (
    <div
      ref={containerRef}
      aria-hidden
      className={className}
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        borderRadius,
        contain: "strict",
        pointerEvents: "none",
        willChange: "filter",
        filter: active ? filterUrl : "none",
        display: active ? "block" : "none",
        ...style,
      }}
    >
      <div ref={mirrorRef} style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }} />
    </div>
  );
});

export default GlassContentClone;
