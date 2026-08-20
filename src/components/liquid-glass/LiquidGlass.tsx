"use client";

import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  SurfaceType,
  Spring,
  computeGlassMaps,
  safeNumber,
  safeRefractiveIndex,
  safeDisplacementScale,
} from "./liquidGlassUtils";
import { useLiquidGlassSupport, GlassRenderMode } from "./useLiquidGlassSupport";
import GlassContentClone, { GlassContentCloneHandle } from "./GlassContentClone";

export interface LiquidGlassProps {
  children?: React.ReactNode;
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  surfaceType?: SurfaceType;
  bezelWidth?: number;
  glassThickness?: number;
  refractiveIndex?: number;
  refractionScale?: number;
  specularOpacity?: number;
  blur?: number;
  /** feColorMatrix `saturate` value applied to the refracted layer.
   * BUGFIX: this existed in the original demo (`saturation` slider ->
   * `filterSaturate`) but was dropped in the initial port — the value was
   * hardcoded to `DEFAULT_LENS_SATURATION` (1.3) directly in JSX with no
   * prop and no ref, so callers had no way to change it. Now configurable,
   * default unchanged. */
  saturation?: number;
  tintColor?: string;
  tintOpacity?: number;
  className?: string;
  style?: React.CSSProperties;

  /**
   * Legacy simple crossfade mode (pre-existing API, kept for backward
   * compatibility): when defined, the glass rests as a flat `restColor`
   * and crossfades to the real glass effect when `active` is true. This is
   * a lightweight convenience, NOT a port of the Slider/Switch physics —
   * use `LiquidGlassSlider` / `LiquidGlassSwitch` for a 1:1 reproduction
   * of those demos.
   */
  active?: boolean;
  restColor?: string;
  activeTransitionMs?: number;
  /**
   * Simple pressed overlay (translucent white layer). Independent of, and
   * layered on top of, the dynamic drag shadow used in `draggable` mode.
   */
  pressed?: boolean;

  /**
   * Enables the full "Interactive Magnifying Glass" behavior from the
   * original demo: spring-driven scale/squish/shadow physics and
   * pointer/touch/mouse dragging with damped overscroll, bounded by
   * `backgroundRef` (or the element's offset parent when omitted).
   */
  draggable?: boolean;
  /**
   * The element representing the "scene" the glass drags within and whose
   * content is refracted in fallback (non-`backdrop-filter`) browsers.
   * Required for a correct fallback render in `draggable` mode; strongly
   * recommended whenever the glass should refract real page content.
   */
  backgroundRef?: React.RefObject<HTMLElement | null>;
  initialPosition?: { x: number; y: number };
  onPositionChange?: (pos: { x: number; y: number }) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  /** Force a specific renderer instead of auto-detecting. */
  renderMode?: "auto" | GlassRenderMode;
}

const DEFAULT_LENS_SATURATION = 1.3;

function getEffectiveRadius(borderRadius: number, w: number, h: number): number {
  const br = safeNumber(borderRadius, 0, 0, 100000);
  // Before the first measurement (`measured` still 0×0), fall back to the
  // raw (clamped) borderRadius instead of forcing 0 — avoids a one-frame
  // "square corners" flash on mount. Once `w`/`h` are real, clamp to
  // min(br, w/2, h/2) as before. `rebuild()` (map geometry) never calls
  // this with a degenerate size, so this branch only affects the CSS
  // fallback used for the very first paint.
  if (w <= 0 || h <= 0) return br;
  return Math.max(0, Math.min(br, w / 2, h / 2));
}

export default function LiquidGlass({
  children,
  width = "100%",
  height = 64,
  borderRadius = 32,
  surfaceType = "convex_squircle",
  bezelWidth = 30,
  glassThickness = 150,
  refractiveIndex = 1.5,
  refractionScale = 1.5,
  specularOpacity = 1,
  blur = 0.5,
  saturation = DEFAULT_LENS_SATURATION,
  tintColor = "rgb(255, 255, 255)",
  tintOpacity = 0,
  className = "",
  style = {},
  active,
  restColor = "rgb(255, 255, 255)",
  activeTransitionMs = 260,
  pressed = false,
  draggable = false,
  backgroundRef,
  initialPosition,
  onPositionChange,
  onDragStart,
  onDragEnd,
  renderMode = "auto",
}: LiquidGlassProps) {
  const rawId = useId();
  const filterId = `lg-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const hasActiveMode = active !== undefined;

  const containerRef = useRef<HTMLDivElement>(null);
  const shadowLayerRef = useRef<HTMLDivElement>(null);
  const solidLayerRef = useRef<HTMLDivElement>(null);
  const glassLayerRef = useRef<HTMLDivElement>(null);
  const tintLayerRef = useRef<HTMLDivElement>(null);
  const cloneRef = useRef<GlassContentCloneHandle>(null);

  const displacementImgRef = useRef<SVGFEImageElement>(null);
  const specularImgRef = useRef<SVGFEImageElement>(null);
  const displacementMapRef = useRef<SVGFEDisplacementMapElement>(null);
  const specularAlphaRef = useRef<SVGFEFuncAElement>(null);
  const gaussianBlurRef = useRef<SVGFEGaussianBlurElement>(null);
  const saturationRef = useRef<SVGFEColorMatrixElement>(null);

  const [measured, setMeasured] = useState({ width: 0, height: 0 });

  const forcedMode = renderMode === "auto" ? undefined : renderMode;
  const { mode } = useLiquidGlassSupport(forcedMode);
  const usingBackdrop = mode === "backdrop";

  // ── Config ref: always holds the latest props so imperative code (rAF
  // loops, ResizeObserver callbacks) never reads a stale closure. ──
  const configRef = useRef({
    surfaceType,
    bezelWidth,
    glassThickness,
    refractiveIndex,
    refractionScale,
    specularOpacity,
    blur,
    borderRadius,
  });
  configRef.current = {
    surfaceType,
    bezelWidth,
    glassThickness,
    refractiveIndex,
    refractionScale,
    specularOpacity,
    blur,
    borderRadius,
  };

  const maximumDisplacementRef = useRef(1);

  // ── Independent SVG attrs that don't affect map geometry (mirrors the
  // pattern used in LiquidGlassSlider/Switch for specularOpacity/blur). ──
  useEffect(() => {
    saturationRef.current?.setAttribute("values", String(safeNumber(saturation, DEFAULT_LENS_SATURATION, 0, 10)));
  }, [saturation]);

  // ── rebuild(): regenerates the displacement/specular maps for the
  // current measured size + current config. Depends only on the config
  // values that actually affect map geometry so unrelated prop changes
  // (e.g. `pressed`, `active`, `tintOpacity`) never trigger a rebuild.
  //
  // ROOT-CAUSE FIX: this used to measure via `el.getBoundingClientRect()`,
  // which returns the element's POST-TRANSFORM box in viewport pixels — if
  // any ancestor (or the element itself) has an in-flight CSS `transform`
  // (e.g. a carousel animating `scale(...)` on the card this glass lives
  // in), `getBoundingClientRect()` reports whatever intermediate visual
  // size that transform produces at the instant it's called. That
  // intermediate size gets baked into the generated displacement/specular
  // canvases and the `feImage`/`feDisplacementMap` width/height — and
  // because `ResizeObserver` (below) only fires on actual LAYOUT size
  // changes, not on ancestor transforms, nothing ever corrects it. This is
  // the exact bug: SVG distortion/blur "not appearing" until the card's
  // slide transform finishes, and the specular map looking undersized
  // relative to the final rendered box.
  //
  // The correct measurement for map geometry is the element's LAYOUT box
  // (CSS width/height as resolved by the box model), which is completely
  // unaffected by `transform` on the element or any ancestor — exactly
  // what `ResizeObserver` itself watches. `offsetWidth`/`offsetHeight`
  // give that (border-box, integer, transform-immune) without an extra
  // reflow-forcing `getBoundingClientRect()` call, so `rebuild()` and
  // `ResizeObserver` are now measuring the exact same quantity and can
  // never disagree or go stale relative to each other. ──
  const rebuild = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    if (w <= 0 || h <= 0) return;

    setMeasured((prev) => (prev.width === w && prev.height === h ? prev : { width: w, height: h }));

    const cfg = configRef.current;
    const effectiveRadius = getEffectiveRadius(cfg.borderRadius, w, h);

    const maps = computeGlassMaps({
      width: w,
      height: h,
      radius: effectiveRadius,
      bezelWidth: cfg.bezelWidth,
      glassThickness: cfg.glassThickness,
      refractiveIndex: cfg.refractiveIndex,
      surfaceType: cfg.surfaceType,
    });
    if (!maps) return;

    maximumDisplacementRef.current = maps.maximumDisplacement;

    displacementImgRef.current?.setAttribute("href", maps.displacementDataURL);
    displacementImgRef.current?.setAttribute("width", String(w));
    displacementImgRef.current?.setAttribute("height", String(h));

    specularImgRef.current?.setAttribute("href", maps.specularDataURL);
    specularImgRef.current?.setAttribute("width", String(w));
    specularImgRef.current?.setAttribute("height", String(h));

    const scaleAttr = safeDisplacementScale(maps.maximumDisplacement, cfg.refractionScale * refractionBoostRef.current);
    displacementMapRef.current?.setAttribute("scale", String(scaleAttr));
    specularAlphaRef.current?.setAttribute("slope", String(safeNumber(cfg.specularOpacity, 1, 0, 4)));
    gaussianBlurRef.current?.setAttribute("stdDeviation", String(safeNumber(cfg.blur, 0, 0, 200)));

    cloneRef.current?.reposition(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surfaceType, bezelWidth, glassThickness, refractiveIndex, refractionScale, specularOpacity, blur, borderRadius]);

  const rebuildRef = useRef(rebuild);
  rebuildRef.current = rebuild;

  // Rebuild whenever a geometry/filter-affecting prop changes.
  useEffect(() => {
    rebuild();
  }, [rebuild]);

  // Rebuild on resize — always calls the *latest* rebuild via the ref, so
  // this observer never needs to be re-created and never closes over stale
  // props (fixes the stale-closure bug in the original port).
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => rebuildRef.current());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ─────────────────────────────────────────────────────────────────────
  // Physics: springs + refractionBoost, driven by drag state when
  // `draggable`; otherwise a single rest frame (no animation loop needed).
  // ─────────────────────────────────────────────────────────────────────
  const refractionBoostRef = useRef(draggable ? 0.8 : 1);

  const springsRef = useRef({
    scale: new Spring(0.85, 400, 25),
    scaleX: new Spring(1, 400, 30),
    scaleY: new Spring(1, 400, 30),
    shadowOffsetX: new Spring(0, 400, 30),
    shadowOffsetY: new Spring(4, 400, 30),
    shadowBlur: new Spring(12, 400, 30),
    shadowAlpha: new Spring(0.15, 300, 25),
    refractionBoost: new Spring(0.8, 300, 18),
  });

  const dragRef = useRef({
    isDragging: false,
    dragOffsetX: 0,
    dragOffsetY: 0,
    velocityX: 0,
    velocityY: 0,
    lastX: 0,
    lastY: 0,
    lastTime: 0,
  });

  const positionRef = useRef({ x: initialPosition?.x ?? 40, y: initialPosition?.y ?? 40 });
  const animationFrameRef = useRef<number | null>(null);

  const getBoundsElement = useCallback((): HTMLElement | null => {
    return backgroundRef?.current ?? containerRef.current?.parentElement ?? null;
  }, [backgroundRef]);

  // BUGFIX: previously, the clone-fallback renderer only mounted when the
  // caller explicitly passed `backgroundRef`. In `draggable` mode that's
  // fine (drag bounds already fall back to `parentElement`), but in the
  // common static case — "swap a normal container for <LiquidGlass>" —
  // omitting `backgroundRef` silently meant NO refraction at all on any
  // non-Chromium browser (the `clone` renderer never ran, so the SVG
  // filter had nothing to distort). We now fall back to the element's own
  // parent, mirroring the drag-bounds fallback, so the fallback path works
  // out of the box without requiring the caller to know about it.
  const [autoBackgroundEl, setAutoBackgroundEl] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (backgroundRef) return; // explicit ref always wins
    setAutoBackgroundEl(containerRef.current?.parentElement ?? null);
  }, [backgroundRef]);
  const autoBackgroundRef = useRef<HTMLElement | null>(null);
  autoBackgroundRef.current = autoBackgroundEl;
  const effectiveBackgroundRef = backgroundRef ?? autoBackgroundRef;

  // Dev-only warning (hook always runs — condition is inside the callback,
  // not around the hook — to respect the rules of hooks).
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    if (!backgroundRef && !containerRef.current?.parentElement) {
      // eslint-disable-next-line no-console
      console.warn(
        "[LiquidGlass] No `backgroundRef` was provided and no parent element could be found to refract. " +
          "The glass will render with no visible distortion on browsers without native `backdrop-filter: url()` support (i.e. everything but Chromium)."
      );
    }
  }, [backgroundRef]);

  const applyPosition = useCallback((x: number, y: number) => {
    const el = containerRef.current;
    if (!el) return;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  }, []);

  const animate = useCallback(() => {
    const dt = Math.min(0.032, 1 / 60);
    const springs = springsRef.current;
    const ds = dragRef.current;

    if (ds.isDragging) {
      springs.scale.setTarget(1.0);
      springs.shadowOffsetX.setTarget(4);
      springs.shadowOffsetY.setTarget(16);
      springs.shadowBlur.setTarget(24);
      springs.shadowAlpha.setTarget(0.22);
      springs.refractionBoost.setTarget(1.0);
    } else {
      springs.scale.setTarget(0.85);
      springs.shadowOffsetX.setTarget(0);
      springs.shadowOffsetY.setTarget(4);
      springs.shadowBlur.setTarget(12);
      springs.shadowAlpha.setTarget(0.15);
      springs.refractionBoost.setTarget(0.8);
    }

    const velocityMagnitude = Math.sqrt(ds.velocityX ** 2 + ds.velocityY ** 2);
    const squishAmount = Math.min(0.15, velocityMagnitude / 3000);
    if (velocityMagnitude > 50) {
      const vxNorm = ds.velocityX / velocityMagnitude;
      const vyNorm = ds.velocityY / velocityMagnitude;
      springs.scaleX.setTarget(1 + squishAmount * Math.abs(vxNorm) - squishAmount * 0.5 * Math.abs(vyNorm));
      springs.scaleY.setTarget(1 + squishAmount * Math.abs(vyNorm) - squishAmount * 0.5 * Math.abs(vxNorm));
    } else {
      springs.scaleX.setTarget(1);
      springs.scaleY.setTarget(1);
    }

    const scale = springs.scale.update(dt);
    const scaleX = springs.scaleX.update(dt);
    const scaleY = springs.scaleY.update(dt);
    const shadowOffsetX = springs.shadowOffsetX.update(dt);
    const shadowOffsetY = springs.shadowOffsetY.update(dt);
    const shadowBlur = springs.shadowBlur.update(dt);
    const shadowAlpha = springs.shadowAlpha.update(dt);
    const refractionBoost = springs.refractionBoost.update(dt);
    refractionBoostRef.current = refractionBoost;

    const el = containerRef.current;
    if (el) el.style.transform = `scale(${scale * scaleX}, ${scale * scaleY})`;

    const shadowLayer = shadowLayerRef.current;
    if (shadowLayer) {
      const insetAlpha = shadowAlpha * 0.6;
      shadowLayer.style.boxShadow = `${shadowOffsetX}px ${shadowOffsetY}px ${shadowBlur}px rgba(0, 0, 0, ${shadowAlpha}), inset ${shadowOffsetX * 0.3}px ${shadowOffsetY * 0.4}px 16px rgba(0, 0, 0, ${insetAlpha}), inset ${-shadowOffsetX * 0.3}px ${-shadowOffsetY * 0.4}px 16px rgba(255, 255, 255, ${insetAlpha * 0.8})`;
    }

    const cfg = configRef.current;
    const dynamicRefractionScale = cfg.refractionScale * refractionBoost;
    const scaleAttr = safeDisplacementScale(maximumDisplacementRef.current, dynamicRefractionScale);
    displacementMapRef.current?.setAttribute("scale", String(scaleAttr));

    if (!ds.isDragging) {
      ds.velocityX *= 0.95;
      ds.velocityY *= 0.95;
    }

    const allSettled =
      Object.values(springs).every((s) => s.isSettled()) && Math.abs(ds.velocityX) < 1 && Math.abs(ds.velocityY) < 1;

    if (!allSettled) {
      animationFrameRef.current = requestAnimationFrame(animate);
    } else {
      animationFrameRef.current = null;
    }
  }, []);

  const startAnimation = useCallback(() => {
    if (animationFrameRef.current === null) {
      animationFrameRef.current = requestAnimationFrame(animate);
    }
  }, [animate]);

  // Kick the loop once on mount so the resting spring values settle even
  // without user interaction (e.g. entering from scale 1 -> 0.85).
  useEffect(() => {
    if (!draggable) return;
    applyPosition(positionRef.current.x, positionRef.current.y);
    startAnimation();
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draggable]);

  // ── Pointer Events based dragging (mouse + touch + pen in one path) ──
  useEffect(() => {
    if (!draggable) return;
    const el = containerRef.current;
    if (!el || typeof window === "undefined") return;

    const onPointerMove = (e: PointerEvent) => {
      const ds = dragRef.current;
      if (!ds.isDragging) return;

      const bounds = getBoundsElement();
      if (!bounds) return;
      const areaRect = bounds.getBoundingClientRect();

      const now = performance.now();
      const dt = Math.max(1, now - ds.lastTime) / 1000;
      ds.velocityX = (e.clientX - ds.lastX) / dt;
      ds.velocityY = (e.clientY - ds.lastY) / dt;
      ds.lastX = e.clientX;
      ds.lastY = e.clientY;
      ds.lastTime = now;

      let newX = e.clientX - areaRect.left - ds.dragOffsetX;
      let newY = e.clientY - areaRect.top - ds.dragOffsetY;

      const objW = measured.width || 0;
      const objH = measured.height || 0;
      const maxX = areaRect.width - objW;
      const maxY = areaRect.height - objH;

      if (newX < 0) newX = newX * 0.3;
      else if (newX > maxX) newX = maxX + (newX - maxX) * 0.3;

      if (newY < 0) newY = newY * 0.3;
      else if (newY > maxY) newY = maxY + (newY - maxY) * 0.3;

      positionRef.current = { x: newX, y: newY };
      applyPosition(newX, newY);
      cloneRef.current?.reposition(false);
      onPositionChange?.({ x: newX, y: newY });
    };

    const endDrag = () => {
      const ds = dragRef.current;
      if (!ds.isDragging) return;
      ds.isDragging = false;

      const bounds = getBoundsElement();
      if (bounds) {
        const areaRect = bounds.getBoundingClientRect();
        const objW = measured.width || 0;
        const objH = measured.height || 0;
        const maxX = areaRect.width - objW;
        const maxY = areaRect.height - objH;
        const clampedX = Math.max(0, Math.min(positionRef.current.x, maxX));
        const clampedY = Math.max(0, Math.min(positionRef.current.y, maxY));
        positionRef.current = { x: clampedX, y: clampedY };
        applyPosition(clampedX, clampedY);
        onPositionChange?.({ x: clampedX, y: clampedY });
      }

      cloneRef.current?.reposition(true);
      startAnimation();
      onDragEnd?.();
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
    };

    const onPointerDown = (e: PointerEvent) => {
      e.preventDefault();
      const ds = dragRef.current;
      ds.isDragging = true;

      const rect = el.getBoundingClientRect();
      const currentScale = springsRef.current.scale.value || 1;
      ds.dragOffsetX = (e.clientX - rect.left) / currentScale;
      ds.dragOffsetY = (e.clientY - rect.top) / currentScale;

      ds.lastX = e.clientX;
      ds.lastY = e.clientY;
      ds.lastTime = performance.now();
      ds.velocityX = 0;
      ds.velocityY = 0;

      startAnimation();
      onDragStart?.();

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", endDrag);
      window.addEventListener("pointercancel", endDrag);
    };

    el.addEventListener("pointerdown", onPointerDown);
    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draggable, measured.width, measured.height, getBoundsElement, applyPosition, startAnimation, onPositionChange, onDragStart, onDragEnd]);

  // ── Legacy "active" crossfade mode (unchanged behavior, kept for
  // backward compatibility with the existing API). ──
  useEffect(() => {
    if (!hasActiveMode || !solidLayerRef.current || !glassLayerRef.current) return;
    const solidOpacity = active ? 0 : 1;
    const glassOpacity = active ? 1 : 0;
    solidLayerRef.current.style.opacity = String(solidOpacity);
    glassLayerRef.current.style.opacity = String(glassOpacity);
    if (tintLayerRef.current) {
      tintLayerRef.current.style.opacity = String(active ? tintOpacity : 0);
    }
  }, [active, hasActiveMode, tintOpacity]);

  // BUGFIX: this used to recompute the radius with a slightly different
  // fallback (`|| safeNumber(...)`) than the one `rebuild()` uses for map
  // geometry, so the very first paint (before `measured` is populated)
  // could show a CSS radius that didn't match the displacement map's
  // radius. Now both paths go through the exact same function with the
  // exact same fallback semantics (0×0 -> 0, matching `getEffectiveRadius`
  // itself), so there is a single source of truth.
  const effectiveRadius = getEffectiveRadius(borderRadius, measured.width, measured.height);

  const sizeStyle: React.CSSProperties = {
    width: typeof width === "number" ? `${width}px` : width,
    height: typeof height === "number" ? `${height}px` : height,
    borderRadius: `${effectiveRadius}px`,
  };

  const filterUrl = `url(#${filterId})`;
  const hasBackground = Boolean(backgroundRef) || Boolean(autoBackgroundEl);
  const clonePositionActive = !usingBackdrop && (draggable || hasBackground);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: draggable ? "absolute" : "relative",
        overflow: "hidden",
        touchAction: draggable ? "none" : undefined,
        userSelect: draggable ? "none" : undefined,
        cursor: draggable ? "grab" : undefined,
        willChange: draggable ? "transform" : undefined,
        ...style,
        ...sizeStyle,
        ...(usingBackdrop && !hasActiveMode
          ? { backdropFilter: filterUrl, WebkitBackdropFilter: filterUrl }
          : {}),
      }}
    >
      <svg width="0" height="0" style={{ position: "absolute", overflow: "hidden", pointerEvents: "none" }}>
        <defs>
          <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%" colorInterpolationFilters="sRGB">
            <feGaussianBlur ref={gaussianBlurRef} in="SourceGraphic" stdDeviation={blur} result="blurred" />
            <feImage ref={displacementImgRef} x="0" y="0" result="displacement_map" preserveAspectRatio="none" />
            <feDisplacementMap
              ref={displacementMapRef}
              in="blurred"
              in2="displacement_map"
              xChannelSelector="R"
              yChannelSelector="G"
              result="displaced"
            />
            <feColorMatrix ref={saturationRef} in="displaced" type="saturate" values={String(saturation)} result="displaced_saturated" />
            <feImage ref={specularImgRef} x="0" y="0" result="specular_layer" preserveAspectRatio="none" />
            <feComponentTransfer in="specular_layer" result="specular_faded">
              <feFuncA ref={specularAlphaRef} type="linear" slope={specularOpacity} />
            </feComponentTransfer>
            <feBlend in="specular_faded" in2="displaced_saturated" mode="screen" />
          </filter>
        </defs>
      </svg>

      {/* Fallback clone renderer — only does work while active (non-backdrop
          mode). Uses the explicit `backgroundRef` when given, otherwise
          auto-falls-back to the container's own parent element so the
          fallback path works without any extra prop (see `hasBackground`
          above). */}
      {hasBackground && (
        <GlassContentClone
          ref={cloneRef}
          backgroundRef={effectiveBackgroundRef}
          glassRef={containerRef}
          filterUrl={filterUrl}
          active={clonePositionActive}
          borderRadius={effectiveRadius}
        />
      )}

      {hasActiveMode && (
        <>
          <div
            ref={solidLayerRef}
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "inherit",
              backgroundColor: restColor,
              opacity: active ? 0 : 1,
              transition: `opacity ${activeTransitionMs}ms ease`,
              pointerEvents: "none",
              zIndex: 0,
            }}
          />
          <div
            ref={glassLayerRef}
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "inherit",
              opacity: active ? 1 : 0,
              transition: `opacity ${activeTransitionMs}ms ease`,
              backdropFilter: usingBackdrop ? filterUrl : undefined,
              WebkitBackdropFilter: usingBackdrop ? filterUrl : undefined,
              pointerEvents: "none",
              zIndex: 0,
            }}
          />
        </>
      )}

      {/* Dynamic drag shadow layer (draggable mode only — separate from the
          `pressed` overlay below, matching the original's `glassInner`). */}
      {draggable && (
        <div
          ref={shadowLayerRef}
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "inherit",
            pointerEvents: "none",
            zIndex: 2,
          }}
        />
      )}

      <div
        ref={tintLayerRef}
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "inherit",
          backgroundColor: tintColor,
          opacity: hasActiveMode ? (active ? tintOpacity : 0) : tintOpacity,
          transition: hasActiveMode ? `opacity ${activeTransitionMs}ms ease` : undefined,
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "inherit",
          backgroundColor: "rgb(255, 255, 255)",
          opacity: pressed ? 0.12 : 0,
          transition: "opacity 150ms ease",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
      <div style={{ position: "relative", zIndex: 1, width: "100%", height: "100%", display: "flex", alignItems: "center" }}>
        {children}
      </div>
    </div>
  );
}