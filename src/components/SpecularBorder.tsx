"use client";

import React, { useEffect, useId, useRef } from "react";
import { calculateSpecularHighlight, imageDataToDataURL } from "./liquidGlassUtils";

export interface SpecularBorderProps {
  children?: React.ReactNode;
  borderRadius?: number;
  bezelWidth?: number;
  specularOpacity?: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Envuelve contenido (p. ej. una card) y dibuja únicamente el highlight
 * especular tipo "liquid glass" en el borde, sin blur ni displacement.
 */
export default function SpecularBorder({
  children,
  borderRadius = 12,
  bezelWidth = 12,
  specularOpacity = 1,
  className = "",
  style = {},
}: SpecularBorderProps) {
  const uid = useId();
  const filterId = `specular-border-${uid}`;

  const containerRef = useRef<HTMLDivElement>(null);
  const specularImgRef = useRef<SVGFEImageElement>(null);
  const specularAlphaRef = useRef<SVGFEFuncAElement>(null);

  const rebuild = () => {
    const rect = containerRef.current?.getBoundingClientRect();
    const w = Math.round(rect?.width || 0);
    const h = Math.round(rect?.height || 0);
    if (!w || !h) return;

    const radius = Math.min(borderRadius, w / 2, h / 2);
    const specularData = calculateSpecularHighlight(w, h, radius, bezelWidth);

    specularImgRef.current?.setAttribute("href", imageDataToDataURL(specularData));
    specularImgRef.current?.setAttribute("width", String(w));
    specularImgRef.current?.setAttribute("height", String(h));
    specularAlphaRef.current?.setAttribute("slope", String(specularOpacity));
  };

  useEffect(() => {
    rebuild();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [borderRadius, bezelWidth, specularOpacity]);

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
        borderRadius: `${borderRadius}px`,
        ...style,
      }}
    >
      <svg width="0" height="0" style={{ position: "absolute" }}>
        <defs>
          <filter id={filterId} x="-10%" y="-10%" width="120%" height="120%" colorInterpolationFilters="sRGB">
            <feImage ref={specularImgRef} x="0" y="0" result="specular_layer" preserveAspectRatio="none" />
            <feComponentTransfer in="specular_layer" result="specular_faded">
              <feFuncA ref={specularAlphaRef} type="linear" slope={specularOpacity} />
            </feComponentTransfer>
          </filter>
        </defs>
      </svg>

      {children}

      {/* Capa del highlight especular, superpuesta encima del contenido, sin afectar su render */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "inherit",
          pointerEvents: "none",
          zIndex: 2,
          filter: `url(#${filterId})`,
          backgroundColor: "#000",
        }}
      />
    </div>
  );
}