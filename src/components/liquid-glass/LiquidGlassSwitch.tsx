"use client";

import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { Spring, computeGlassMaps, safeNumber } from "./liquidGlassUtils";
import GlassContentClone, { GlassContentCloneHandle } from "./GlassContentClone";

/**
 * 1:1 behavioral port of the original demo's Switch Demo
 * (`switchConfig` / `switchState` / `switchSprings` / `initSwitchDemo` /
 * `switchAnimationLoop`). Like the Slider, this always renders through the
 * clone + SVG-`filter` path (the original never gives the switch thumb a
 * native `backdrop-filter` option).
 */

const CONFIG_BASE = {
  trackWidth: 160,
  trackHeight: 67,
  thumbWidth: 146,
  thumbHeight: 92,
  thumbRadius: 46,
  bezelWidth: 19,
  glassThickness: 47,
  refractiveIndex: 1.5,
  THUMB_REST_SCALE: 0.65,
  THUMB_ACTIVE_SCALE: 0.9,
};

const THUMB_REST_OFFSET = ((1 - CONFIG_BASE.THUMB_REST_SCALE) * CONFIG_BASE.thumbWidth) / 2;
const TRAVEL =
  CONFIG_BASE.trackWidth - CONFIG_BASE.trackHeight - (CONFIG_BASE.thumbWidth - CONFIG_BASE.thumbHeight) * CONFIG_BASE.THUMB_REST_SCALE;

const CONFIG = { ...CONFIG_BASE, THUMB_REST_OFFSET, TRAVEL } as const;

const OFF_COLOR = { r: 148, g: 148, b: 159, a: 0.47 };
const ON_COLOR = { r: 59, g: 191, b: 78, a: 0.93 };

export interface LiquidGlassSwitchProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  forceActive?: boolean;
  disabled?: boolean;
  /** feFuncA linear slope. Default 0.5 (matches `switchState.specularOpacity`). */
  specularOpacity?: number;
  /** feColorMatrix saturate value. Default 6 (matches `switchState.specularSaturation`). */
  specularSaturation?: number;
  /** Multiplier feeding the dynamic displacement scale spring target. Default 1. */
  refractionBase?: number;
  /** feGaussianBlur stdDeviation. Default 0.2. */
  blur?: number;
  className?: string;
  style?: React.CSSProperties;
  "aria-label"?: string;
}

export default function LiquidGlassSwitch({
  checked,
  defaultChecked = true,
  onChange,
  forceActive = false,
  disabled = false,
  specularOpacity = 0.5,
  specularSaturation = 6,
  refractionBase = 1,
  blur = 0.2,
  className = "",
  style = {},
  ...aria
}: LiquidGlassSwitchProps) {
  const isControlled = checked !== undefined;
  const [internalChecked, setInternalChecked] = useState(defaultChecked);
  const currentChecked = isControlled ? (checked as boolean) : internalChecked;
  const checkedRef = useRef(currentChecked);
  checkedRef.current = currentChecked;

  const rawId = useId();
  const filterId = `lgsw-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;

  const trackLayerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const cloneRef = useRef<GlassContentCloneHandle>(null);
  const cloneWrapperRef = useRef<HTMLDivElement>(null);

  const displacementImgRef = useRef<SVGFEImageElement>(null);
  const specularImgRef = useRef<SVGFEImageElement>(null);
  const displacementMapRef = useRef<SVGFEDisplacementMapElement>(null);
  const saturationRef = useRef<SVGFEColorMatrixElement>(null);
  const specularAlphaRef = useRef<SVGFEFuncAElement>(null);
  const blurRef = useRef<SVGFEGaussianBlurElement>(null);

  const maximumDisplacementRef = useRef(1);
  const pointerDownRef = useRef(false);
  const forceActiveRef = useRef(forceActive);
  forceActiveRef.current = forceActive;

  const configRef = useRef({ specularOpacity, specularSaturation, refractionBase, blur });
  configRef.current = { specularOpacity, specularSaturation, refractionBase, blur };

  const dragRef = useRef({
    initialPointerX: 0,
    xDragRatio: currentChecked ? 1 : 0,
  });

  const springsRef = useRef({
    xRatio: new Spring(currentChecked ? 1 : 0, 1000, 80),
    scale: new Spring(CONFIG.THUMB_REST_SCALE, 2000, 80),
    backgroundOpacity: new Spring(1, 2000, 80),
    trackColor: new Spring(currentChecked ? 1 : 0, 1000, 80),
    scaleRatio: new Spring(0.4, 100, 10),
  });

  const animationFrameRef = useRef<number | null>(null);

  // ── Static-geometry maps, built once. ──
  useEffect(() => {
    const maps = computeGlassMaps({
      width: CONFIG.thumbWidth,
      height: CONFIG.thumbHeight,
      radius: CONFIG.thumbRadius,
      bezelWidth: CONFIG.bezelWidth,
      glassThickness: CONFIG.glassThickness,
      refractiveIndex: CONFIG.refractiveIndex,
      surfaceType: "convex_squircle",
    });
    if (!maps) return;
    maximumDisplacementRef.current = maps.maximumDisplacement;
    displacementImgRef.current?.setAttribute("href", maps.displacementDataURL);
    displacementImgRef.current?.setAttribute("width", String(CONFIG.thumbWidth));
    displacementImgRef.current?.setAttribute("height", String(CONFIG.thumbHeight));
    specularImgRef.current?.setAttribute("href", maps.specularDataURL);
    specularImgRef.current?.setAttribute("width", String(CONFIG.thumbWidth));
    specularImgRef.current?.setAttribute("height", String(CONFIG.thumbHeight));
  }, []);

  useEffect(() => {
    saturationRef.current?.setAttribute("values", String(safeNumber(specularSaturation, 6, 0, 100)));
  }, [specularSaturation]);
  useEffect(() => {
    specularAlphaRef.current?.setAttribute("slope", String(safeNumber(specularOpacity, 0.5, 0, 4)));
  }, [specularOpacity]);
  useEffect(() => {
    blurRef.current?.setAttribute("stdDeviation", String(safeNumber(blur, 0.2, 0, 200)));
  }, [blur]);

  const getActive = useCallback(() => forceActiveRef.current || pointerDownRef.current, []);

  const animate = useCallback(() => {
    const dt = Math.min(0.032, 1 / 60);
    const springs = springsRef.current;
    const ds = dragRef.current;
    const isActive = getActive();
    const cfg = configRef.current;

    springs.scale.setTarget(isActive ? CONFIG.THUMB_ACTIVE_SCALE : CONFIG.THUMB_REST_SCALE);
    springs.backgroundOpacity.setTarget(isActive ? 0.1 : 1);
    const pressMultiplier = isActive ? 0.9 : 0.4;
    springs.scaleRatio.setTarget(pressMultiplier * cfg.refractionBase);

    if (!pointerDownRef.current) {
      springs.xRatio.setTarget(checkedRef.current ? 1 : 0);
    }

    const considerChecked = pointerDownRef.current ? (ds.xDragRatio > 0.5 ? 1 : 0) : checkedRef.current ? 1 : 0;
    springs.trackColor.setTarget(considerChecked);

    const xRatio = springs.xRatio.update(dt);
    const scale = springs.scale.update(dt);
    const backgroundOpacity = springs.backgroundOpacity.update(dt);
    const trackColorT = springs.trackColor.update(dt);
    const scaleRatio = springs.scaleRatio.update(dt);

    const cloneOpacity = 1 - backgroundOpacity;
    if (cloneWrapperRef.current) cloneWrapperRef.current.style.opacity = String(cloneOpacity);

    const marginLeft = -CONFIG.THUMB_REST_OFFSET + (CONFIG.trackHeight - CONFIG.thumbHeight * CONFIG.THUMB_REST_SCALE) / 2;
    const thumbX = marginLeft + xRatio * CONFIG.TRAVEL;

    const thumb = thumbRef.current;
    if (thumb) {
      thumb.style.left = `${thumbX}px`;
      thumb.style.transform = `translateY(-50%) scale(${scale})`;
      thumb.style.backgroundColor = `rgba(255, 255, 255, ${backgroundOpacity})`;
      thumb.style.boxShadow = pointerDownRef.current
        ? "0 4px 22px rgba(0,0,0,0.1), inset 2px 7px 24px rgba(0,0,0,0.09), inset -2px -7px 24px rgba(255,255,255,0.09)"
        : "0 4px 22px rgba(0,0,0,0.1)";
    }

    const r = Math.round(OFF_COLOR.r + (ON_COLOR.r - OFF_COLOR.r) * trackColorT);
    const g = Math.round(OFF_COLOR.g + (ON_COLOR.g - OFF_COLOR.g) * trackColorT);
    const b = Math.round(OFF_COLOR.b + (ON_COLOR.b - OFF_COLOR.b) * trackColorT);
    const a = OFF_COLOR.a + (ON_COLOR.a - OFF_COLOR.a) * trackColorT;
    const trackBgColor = `rgba(${r}, ${g}, ${b}, ${a})`;
    if (trackRef.current) trackRef.current.style.backgroundColor = trackBgColor;

    cloneRef.current?.reposition(false);

    const dynamicScale = maximumDisplacementRef.current * scaleRatio;
    displacementMapRef.current?.setAttribute("scale", String(Number.isFinite(dynamicScale) ? dynamicScale : 0));

    const allSettled = Object.values(springs).every((s) => s.isSettled());
    if (!allSettled) {
      animationFrameRef.current = requestAnimationFrame(animate);
    } else {
      animationFrameRef.current = null;
    }
  }, [getActive]);

  const startAnimation = useCallback(() => {
    if (animationFrameRef.current === null) {
      animationFrameRef.current = requestAnimationFrame(animate);
    }
  }, [animate]);

  useEffect(() => {
    startAnimation();
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    startAnimation();
  }, [forceActive, currentChecked, startAnimation]);

  const commitChecked = useCallback(
    (next: boolean) => {
      if (!isControlled) setInternalChecked(next);
      onChange?.(next);
    },
    [isControlled, onChange]
  );

  useEffect(() => {
    if (disabled) return;
    const onPointerMove = (e: PointerEvent) => {
      if (!pointerDownRef.current) return;
      const ds = dragRef.current;
      const baseRatio = checkedRef.current ? 1 : 0;
      const displacementX = e.clientX - ds.initialPointerX;
      let ratio = baseRatio + displacementX / CONFIG.TRAVEL;

      const overflow = ratio < 0 ? -ratio : ratio > 1 ? ratio - 1 : 0;
      const overflowSign = ratio < 0 ? -1 : 1;
      const dampedOverflow = (overflowSign * overflow) / 22;
      ds.xDragRatio = Math.min(1, Math.max(0, ratio)) + dampedOverflow;

      springsRef.current.xRatio.setTarget(ds.xDragRatio);
      startAnimation();
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!pointerDownRef.current) return;
      pointerDownRef.current = false;

      const ds = dragRef.current;
      const distance = Math.abs(e.clientX - ds.initialPointerX);
      const next = distance < 4 ? !checkedRef.current : ds.xDragRatio > 0.5;
      commitChecked(next);
      startAnimation();
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [disabled, commitChecked, startAnimation]);

  const onThumbPointerDown = (e: React.PointerEvent) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    pointerDownRef.current = true;
    dragRef.current.initialPointerX = e.clientX;
    dragRef.current.xDragRatio = checkedRef.current ? 1 : 0;
    startAnimation();
  };

  const onTrackClick = (e: React.MouseEvent) => {
    if (disabled) return;
    if (e.target !== trackRef.current) return;
    commitChecked(!checkedRef.current);
    startAnimation();
  };

  const filterUrl = `url(#${filterId})`;

  return (
    <div
      className={className}
      style={{ position: "relative", width: CONFIG.trackWidth, height: CONFIG.trackHeight, ...style }}
    >
      <div ref={trackLayerRef} aria-hidden style={{ position: "absolute", inset: 0 }}>
        <div
          ref={trackRef}
          role="switch"
          aria-checked={currentChecked}
          aria-disabled={disabled || undefined}
          aria-label={aria["aria-label"] ?? "Switch"}
          tabIndex={disabled ? -1 : 0}
          onClick={onTrackClick}
          onKeyDown={(e) => {
            if (disabled) return;
            if (e.key === " " || e.key === "Enter") {
              e.preventDefault();
              commitChecked(!checkedRef.current);
              startAnimation();
            }
          }}
          style={{
            display: "inline-block",
            position: "relative",
            width: CONFIG.trackWidth,
            height: CONFIG.trackHeight,
            backgroundColor: "#94949f77",
            borderRadius: CONFIG.trackHeight / 2,
            cursor: disabled ? "default" : "pointer",
          }}
        />
      </div>

      <div
        ref={thumbRef}
        onPointerDown={onThumbPointerDown}
        style={{
          position: "absolute",
          width: CONFIG.thumbWidth,
          height: CONFIG.thumbHeight,
          borderRadius: CONFIG.thumbRadius,
          top: CONFIG.trackHeight / 2,
          transform: `translateY(-50%) scale(${CONFIG.THUMB_REST_SCALE})`,
          transformOrigin: "center center",
          cursor: disabled ? "default" : "pointer",
          touchAction: "none",
          userSelect: "none",
          backgroundColor: "rgba(255, 255, 255, 1)",
          boxShadow: "0 4px 22px rgba(0, 0, 0, 0.1)",
          overflow: "hidden",
          willChange: "transform, left, background-color, box-shadow",
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <svg width="0" height="0" style={{ position: "absolute", overflow: "hidden", pointerEvents: "none" }}>
          <defs>
            <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%" colorInterpolationFilters="sRGB">
              <feGaussianBlur ref={blurRef} in="SourceGraphic" stdDeviation={blur} result="blurred_source" />
              <feImage ref={displacementImgRef} x="0" y="0" result="displacement_map" preserveAspectRatio="none" />
              <feDisplacementMap
                ref={displacementMapRef}
                in="blurred_source"
                in2="displacement_map"
                xChannelSelector="R"
                yChannelSelector="G"
                result="displaced"
              />
              <feColorMatrix ref={saturationRef} in="displaced" type="saturate" values={String(specularSaturation)} result="displaced_saturated" />
              <feImage ref={specularImgRef} x="0" y="0" result="specular_layer" preserveAspectRatio="none" />
              <feComposite in="displaced_saturated" in2="specular_layer" operator="in" result="specular_saturated" />
              <feComponentTransfer in="specular_layer" result="specular_faded">
                <feFuncA ref={specularAlphaRef} type="linear" slope={specularOpacity} />
              </feComponentTransfer>
              <feBlend in="specular_saturated" in2="displaced" mode="normal" result="withSaturation" />
              <feBlend in="specular_faded" in2="withSaturation" mode="normal" />
            </filter>
          </defs>
        </svg>

        <div ref={cloneWrapperRef} style={{ position: "absolute", inset: 0, opacity: 0 }}>
          <GlassContentClone
            ref={cloneRef}
            backgroundRef={trackLayerRef}
            glassRef={thumbRef}
            filterUrl={filterUrl}
            active
            borderRadius={CONFIG.thumbRadius}
          />
        </div>
      </div>
    </div>
  );
}
