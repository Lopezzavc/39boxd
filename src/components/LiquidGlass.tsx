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
}: LiquidGlassProps) {
  const uid = useId();
  const filterId = `liquid-glass-${uid}`;

  const containerRef = useRef<HTMLDivElement>(null);
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

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: "relative",
        overflow: "hidden",
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        ...style,
        width: typeof width === "number" ? `${width}px` : width,
        height: typeof height === "number" ? `${height}px` : height,
        borderRadius: `${borderRadius}px`,
        backdropFilter: `url(#${filterId})`,
        WebkitBackdropFilter: `url(#${filterId})`,
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
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "inherit",
          backgroundColor: tintColor,
          opacity: tintOpacity,
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
      <div style={{ position: "relative", zIndex: 1, width: "100%", height: "100%", display: "flex", alignItems: "center" }}>{children}</div>
    </div>
  );
}