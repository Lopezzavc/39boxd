// src/components/RefractionFilter.tsx
"use client";
import React from "react";
import manifest from "@/generated/refraction-manifest.json";

type Props = {
  id: string;
  preset: {
    name: string;
    width: number;
    height: number;
    radius?: number;
    bezelWidth?: number;
    glassThickness?: number;
    refractiveIndex?: number;
    bezelType?: string;
    maxDisplacement?: number;
  };
  blur?: number; // base blur
  scaleRatio?: number; // 0..1
  specularOpacity?: number; // 0..1
  specularSaturation?: number; // typical range 0..2 (1 = identity)
  progressiveBlurStrength?: number; // 0..10 (multiplier for layered blurs)
};

export const RefractionFilter: React.FC<Props> = ({
  id,
  preset,
  blur = 1,
  scaleRatio = 1,
  specularOpacity = 0.4,
  specularSaturation = 1,
  progressiveBlurStrength = 1,
}) => {
  const key = (() => {
    for (const k of Object.keys(manifest)) {
      const entry = (manifest as any)[k];
      if (entry?.params?.name === preset.name) return k;
    }
    return Object.keys(manifest)[0] ?? "";
  })();

  const entry = (manifest as any)[key];
  if (!key || !entry) return null;

  const dispUrl = entry.displacement;
  const specUrl = entry.specular;
  const maxDisp = entry.maxDisplacement ?? preset.maxDisplacement ?? 200;
  const scale = Number(scaleRatio) * Number(maxDisp);

  // Saturation matrix (standard approach): s=1 identity, 0=grayscale, >1 oversaturated
  const s = Number(specularSaturation);
  const Lr = 0.2126;
  const Lg = 0.7152;
  const Lb = 0.0722;
  const a = (1 - s) * Lr + s;
  const b = (1 - s) * Lg;
  const c = (1 - s) * Lb;

  // progressive blur: 3 layers with increasing stdDeviation
  const blurBase = Number(blur) || 0;
  const pb = Number(progressiveBlurStrength) || 1;
  const blur1 = blurBase * Math.max(0.125, pb * 0.5);
  const blur2 = blurBase * Math.max(0.5, pb * 1.0);
  const blur3 = blurBase * Math.max(1.0, pb * 2.0);

  return (
    <svg style={{ position: "absolute", width: 0, height: 0 }} aria-hidden>
      <defs>
        <filter id={id} x="-50%" y="-50%" width="200%" height="200%" colorInterpolationFilters="sRGB">
          <feImage href={dispUrl} result="disp" />
          <feImage href={specUrl} result="spec" />

          <feGaussianBlur in="SourceGraphic" stdDeviation={blur1} result="b1" />
          <feGaussianBlur in="SourceGraphic" stdDeviation={blur2} result="b2" />
          <feGaussianBlur in="SourceGraphic" stdDeviation={blur3} result="b3" />
          <feMerge result="blurred">
            <feMergeNode in="b1" />
            <feMergeNode in="b2" />
            <feMergeNode in="b3" />
          </feMerge>

          <feDisplacementMap
            in="blurred"
            in2="disp"
            scale={scale}
            xChannelSelector="R"
            yChannelSelector="G"
            result="refracted"
          />

          <feColorMatrix
            in="spec"
            type="matrix"
            values={`${a} ${b} ${c} 0 0 ${b} ${a} ${c} 0 0 ${c} ${b} ${a} 0 0 0 0 0 1 0`}
            result="specSat"
          />
          <feComponentTransfer in="specSat" result="specAlpha">
            <feFuncA type="table" tableValues={`0 ${specularOpacity}`} />
          </feComponentTransfer>

          <feBlend mode="screen" in="refracted" in2="specAlpha" result="out" />
          <feComposite in="out" in2="SourceGraphic" operator="over" result="final" />
        </filter>
      </defs>
    </svg>
  );
};

export default RefractionFilter;