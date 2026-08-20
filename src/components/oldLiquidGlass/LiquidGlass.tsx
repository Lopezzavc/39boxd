"use client";

import React, { useEffect, useId, useRef } from "react";
import {
  SurfaceEquations,
  SurfaceType,
  calculateDisplacementMap1D,
  calculateDisplacementMap2D,
  calculateSpecularHighlight,
  imageDataToDataURL,
} from "./liquidGlassUtils";

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
  tintColor?: string;
  tintOpacity?: number;
  className?: string;
  style?: React.CSSProperties;
  /**
   * Si se define, el glass se comporta como el "Slider Demo": en reposo se muestra
   * como un color sólido (restColor) sin refracción, y al estar activo (active=true)
   * hace crossfade hacia el efecto liquid glass real (backdrop-filter). No es
   * necesario usar esta prop para el comportamiento anterior (siempre-glass).
   */
  active?: boolean;
  /** Color sólido mostrado cuando active=false. Por defecto blanco, como el thumb del slider demo. */
  restColor?: string;
  /** Duración en ms de la transición entre estado sólido y estado glass. */
  activeTransitionMs?: number;
  /**
   * Overlay de brillo al presionar/arrastrar. Se implementa como una capa blanca
   * translúcida superpuesta (opacity), NUNCA como CSS `filter` en un ancestro:
   * un `filter` en un ancestro de un elemento con `backdrop-filter` rompe la
   * captura del fondo (bug confirmado). No usar `style.filter` cerca de este
   * componente por el mismo motivo.
   */
  pressed?: boolean;
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
  tintColor = "rgb(255, 255, 255)",
  tintOpacity = 0,
  className = "",
  style = {},
  active,
  restColor = "rgb(255, 255, 255)",
  activeTransitionMs = 260,
  pressed = false,
}: LiquidGlassProps) {
  const uid = useId();
  const filterId = `liquid-glass-${uid}`;
  const hasActiveMode = active !== undefined;

  const containerRef = useRef<HTMLDivElement>(null);
  const solidLayerRef = useRef<HTMLDivElement>(null);
  const glassLayerRef = useRef<HTMLDivElement>(null);
  const tintLayerRef = useRef<HTMLDivElement>(null);
  const displacementImgRef = useRef<SVGFEImageElement>(null);
  const specularImgRef = useRef<SVGFEImageElement>(null);
  const displacementMapRef = useRef<SVGFEDisplacementMapElement>(null);
  const specularAlphaRef = useRef<SVGFEFuncAElement>(null);
  const gaussianBlurRef = useRef<SVGFEGaussianBlurElement>(null);

  const rebuild = () => {
    const rect = containerRef.current?.getBoundingClientRect();
    const w = Math.round(rect?.width || 0);
    const h = Math.round(rect?.height || 0);
    if (!w || !h) return;

    const radius = Math.min(borderRadius, w / 2, h / 2);
    const surfaceFn = SurfaceEquations[surfaceType];

    const precomputed = calculateDisplacementMap1D(glassThickness, bezelWidth, surfaceFn, refractiveIndex);
    const maximumDisplacement = Math.max(...precomputed.map(Math.abs)) || 1;

    const displacementData = calculateDisplacementMap2D(w, h, w, h, radius, bezelWidth, maximumDisplacement, precomputed);
    const specularData = calculateSpecularHighlight(w, h, radius, bezelWidth);

    displacementImgRef.current?.setAttribute("href", imageDataToDataURL(displacementData));
    displacementImgRef.current?.setAttribute("width", String(w));
    displacementImgRef.current?.setAttribute("height", String(h));

    specularImgRef.current?.setAttribute("href", imageDataToDataURL(specularData));
    specularImgRef.current?.setAttribute("width", String(w));
    specularImgRef.current?.setAttribute("height", String(h));

    displacementMapRef.current?.setAttribute("scale", String(maximumDisplacement * refractionScale));
    specularAlphaRef.current?.setAttribute("slope", String(specularOpacity));
    gaussianBlurRef.current?.setAttribute("stdDeviation", String(blur));
  };

  useEffect(() => {
    rebuild();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surfaceType, bezelWidth, glassThickness, refractiveIndex, refractionScale, specularOpacity, blur, borderRadius]);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(() => rebuild());
    ro.observe(containerRef.current);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Modo "slider demo": crossfade entre capa sólida y capa glass (y el tint acompaña) ──
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

  const sizeStyle: React.CSSProperties = {
    width: typeof width === "number" ? `${width}px` : width,
    height: typeof height === "number" ? `${height}px` : height,
    borderRadius: `${borderRadius}px`,
  };

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: "relative",
        overflow: "hidden",
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        ...style,
        ...sizeStyle,
        ...(hasActiveMode
          ? {}
          : {
              backdropFilter: `url(#${filterId})`,
              WebkitBackdropFilter: `url(#${filterId})`,
            }),
      }}
    >
      <svg width="0" height="0" style={{ position: "absolute" }}>
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
            <feColorMatrix in="displaced" type="saturate" values="1.3" result="displaced_saturated" />
            <feImage ref={specularImgRef} x="0" y="0" result="specular_layer" preserveAspectRatio="none" />
            <feComponentTransfer in="specular_layer" result="specular_faded">
              <feFuncA ref={specularAlphaRef} type="linear" slope={specularOpacity} />
            </feComponentTransfer>
            <feBlend in="specular_faded" in2="displaced_saturated" mode="screen" />
          </filter>
        </defs>
      </svg>

      {hasActiveMode && (
        <>
          {/* Capa sólida: visible en reposo, igual que el thumb blanco del slider demo */}
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
          {/* Capa glass: solo aplica backdrop-filter aquí, se revela al activar */}
          <div
            ref={glassLayerRef}
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "inherit",
              opacity: active ? 1 : 0,
              transition: `opacity ${activeTransitionMs}ms ease`,
              backdropFilter: `url(#${filterId})`,
              WebkitBackdropFilter: `url(#${filterId})`,
              pointerEvents: "none",
              zIndex: 0,
            }}
          />
        </>
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
      <div style={{ position: "relative", zIndex: 1, width: "100%", height: "100%", display: "flex", alignItems: "center" }}>{children}</div>
    </div>
  );
}