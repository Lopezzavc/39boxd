"use client";

import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { Spring, computeGlassMaps, safeNumber } from "./liquidGlassUtils";
import GlassContentClone, { GlassContentCloneHandle } from "./GlassContentClone";

/**
 * 1:1 behavioral port of the original demo's Slider Demo
 * (`sliderConfig` / `sliderState` / `sliderSprings` / `initSliderDemo` /
 * `sliderAnimationLoop`). Unlike `LiquidGlass`, the original slider (and
 * switch) NEVER use native `backdrop-filter` — they always render through
 * the SVG-`filter` + cloned-content path, so this component intentionally
 * skips backdrop-filter support detection entirely, matching the original.
 */

const CONFIG = {
  thumbWidth: 90,
  thumbHeight: 60,
  thumbRadius: 30,
  trackWidth: 330,
  trackHeight: 14,
  bezelWidth: 16,
  glassThickness: 80,
  refractiveIndex: 1.45,
  SCALE_REST: 0.6,
  SCALE_DRAG: 1,
} as const;

const THUMB_WIDTH_REST = CONFIG.thumbWidth * CONFIG.SCALE_REST;

export interface LiquidGlassSliderProps {
  /** Controlled value, 0–100. Omit to use uncontrolled `defaultValue`. */
  value?: number;
  defaultValue?: number;
  onChange?: (value: number) => void;
  onChangeEnd?: (value: number) => void;
  /** Forces the "active" (dragged) visual state even without pointer
   * interaction — ports the original's `forceActive` checkbox. */
  forceActive?: boolean;
  disabled?: boolean;
  /** feFuncA linear slope for the specular highlight. Default 0.4 (matches `sliderState.specularOpacity`). */
  specularOpacity?: number;
  /** feColorMatrix saturate value for the refracted layer. Default 7 (matches `sliderState.specularSaturation`). */
  specularSaturation?: number;
  /** Multiplier feeding the dynamic displacement scale spring target. Default 1 (matches `sliderState.refractionBase`). */
  refractionBase?: number;
  /** feGaussianBlur stdDeviation. Default 0. */
  blur?: number;
  trackColor?: string;
  fillColor?: string;
  className?: string;
  style?: React.CSSProperties;
  "aria-label"?: string;
}

export default function LiquidGlassSlider({
  value,
  defaultValue = 10,
  onChange,
  onChangeEnd,
  forceActive = false,
  disabled = false,
  specularOpacity = 0.4,
  specularSaturation = 7,
  refractionBase = 1,
  blur = 0,
  trackColor = "#89898f66",
  fillColor = "#0377f7",
  className = "",
  style = {},
  ...aria
}: LiquidGlassSliderProps) {
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue);
  const currentValue = isControlled ? (value as number) : internalValue;
  const currentValueRef = useRef(currentValue);
  currentValueRef.current = currentValue;

  const rawId = useId();
  const filterId = `lgs-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;

  const trackLayerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
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

  const springsRef = useRef({
    scale: new Spring(CONFIG.SCALE_REST, 2000, 80),
    backgroundOpacity: new Spring(1, 2000, 80),
    scaleRatio: new Spring(0.4, 100, 10),
  });

  const animationFrameRef = useRef<number | null>(null);

  // ── Build the (static-geometry) displacement/specular maps once — the
  // thumb's physical dimensions never change, so this never needs to rerun
  // on resize the way the main lens does. ──
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

  // ── Independent SVG attrs that don't affect map geometry. ──
  useEffect(() => {
    saturationRef.current?.setAttribute("values", String(safeNumber(specularSaturation, 7, 0, 100)));
  }, [specularSaturation]);
  useEffect(() => {
    specularAlphaRef.current?.setAttribute("slope", String(safeNumber(specularOpacity, 0.4, 0, 4)));
  }, [specularOpacity]);
  useEffect(() => {
    blurRef.current?.setAttribute("stdDeviation", String(safeNumber(blur, 0, 0, 200)));
  }, [blur]);

  const getActive = useCallback(() => forceActiveRef.current || pointerDownRef.current, []);

  const updateThumbPosition = useCallback((val: number) => {
    const ratio = safeNumber(val, 0, 0, 100) / 100;
    const x0 = THUMB_WIDTH_REST / 2;
    const x100 = CONFIG.trackWidth - THUMB_WIDTH_REST / 2;
    const thumbCenterX = x0 + ratio * (x100 - x0);
    const thumbX = thumbCenterX - CONFIG.thumbWidth / 2;
    if (thumbRef.current) thumbRef.current.style.left = `${thumbX}px`;
    if (fillRef.current) fillRef.current.style.width = `${val}%`;
    cloneRef.current?.reposition(true);
  }, []);

  useEffect(() => {
    updateThumbPosition(currentValue);
  }, [currentValue, updateThumbPosition]);

  const animate = useCallback(() => {
    const dt = Math.min(0.032, 1 / 60);
    const springs = springsRef.current;
    const isActive = getActive();
    const cfg = configRef.current;

    springs.scale.setTarget(isActive ? CONFIG.SCALE_DRAG : CONFIG.SCALE_REST);
    springs.backgroundOpacity.setTarget(isActive ? 0.1 : 1);
    const pressMultiplier = isActive ? 0.9 : 0.4;
    springs.scaleRatio.setTarget(pressMultiplier * cfg.refractionBase);

    const scale = springs.scale.update(dt);
    const backgroundOpacity = springs.backgroundOpacity.update(dt);
    const scaleRatio = springs.scaleRatio.update(dt);

    const thumb = thumbRef.current;
    if (thumb) {
      thumb.style.transform = `scale(${scale})`;
      thumb.style.backgroundColor = `rgba(255, 255, 255, ${backgroundOpacity})`;
    }

    const cloneOpacity = 1 - backgroundOpacity;
    cloneRef.current?.reposition(false);
    if (cloneWrapperRef.current) cloneWrapperRef.current.style.opacity = String(cloneOpacity);

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

  // forceActive changing should (re)kick the loop even with no pointer activity.
  useEffect(() => {
    startAnimation();
  }, [forceActive, startAnimation]);

  const commitValueFromClientX = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track) return;
      const trackRect = track.getBoundingClientRect();
      const x0 = trackRect.left + THUMB_WIDTH_REST / 2;
      const x100 = trackRect.right - THUMB_WIDTH_REST / 2;
      const trackInsideWidth = x100 - x0;
      const x = Math.max(x0, Math.min(x100, clientX));
      const ratio = trackInsideWidth !== 0 ? (x - x0) / trackInsideWidth : 0;
      const nextValue = Math.max(0, Math.min(100, ratio * 100));
      if (!isControlled) setInternalValue(nextValue);
      onChange?.(nextValue);
      updateThumbPosition(nextValue);
    },
    [isControlled, onChange, updateThumbPosition]
  );

  useEffect(() => {
    if (disabled) return;
    const onPointerMove = (e: PointerEvent) => {
      if (!pointerDownRef.current) return;
      e.preventDefault();
      commitValueFromClientX(e.clientX);
    };
    const onPointerUp = () => {
      if (!pointerDownRef.current) return;
      pointerDownRef.current = false;
      onChangeEnd?.(currentValueRef.current);
      startAnimation();
    };
    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [disabled, commitValueFromClientX, onChangeEnd, startAnimation]);

  const onThumbPointerDown = (e: React.PointerEvent) => {
    if (disabled) return;
    e.preventDefault();
    pointerDownRef.current = true;
    startAnimation();
  };

  const onTrackPointerDown = (e: React.PointerEvent) => {
    if (disabled) return;
    e.preventDefault();
    pointerDownRef.current = true;
    startAnimation();
    commitValueFromClientX(e.clientX);
  };

  const filterUrl = `url(#${filterId})`;

  return (
    <div
      className={className}
      style={{ position: "relative", width: CONFIG.trackWidth, height: CONFIG.thumbHeight, ...style }}
      role="slider"
      aria-valuenow={Math.round(currentValue)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-disabled={disabled || undefined}
      aria-label={aria["aria-label"] ?? "Slider"}
    >
      {/* Real track + fill, cloned into the thumb's glass when active. */}
      <div ref={trackLayerRef} aria-hidden style={{ position: "absolute", inset: 0 }}>
        <div
          ref={trackRef}
          onPointerDown={onTrackPointerDown}
          style={{
            position: "absolute",
            width: CONFIG.trackWidth,
            height: CONFIG.trackHeight,
            left: 0,
            top: (CONFIG.thumbHeight - CONFIG.trackHeight) / 2,
            backgroundColor: trackColor,
            borderRadius: CONFIG.trackHeight / 2,
            cursor: disabled ? "default" : "pointer",
            overflow: "hidden",
          }}
        >
          <div
            ref={fillRef}
            style={{
              height: CONFIG.trackHeight,
              width: `${currentValue}%`,
              borderRadius: (CONFIG.trackHeight / 2) - 1,
              backgroundColor: fillColor,
            }}
          />
        </div>
      </div>

      <div
        ref={thumbRef}
        onPointerDown={onThumbPointerDown}
        style={{
          position: "absolute",
          width: CONFIG.thumbWidth,
          height: CONFIG.thumbHeight,
          top: 0,
          borderRadius: CONFIG.thumbRadius,
          transform: `scale(${CONFIG.SCALE_REST})`,
          transformOrigin: "center center",
          cursor: disabled ? "default" : "pointer",
          touchAction: "none",
          userSelect: "none",
          backgroundColor: "rgba(255, 255, 255, 1)",
          boxShadow: "0 3px 14px rgba(0, 0, 0, 0.1)",
          overflow: "hidden",
          willChange: "transform, background-color",
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
