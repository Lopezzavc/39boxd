// src/components/RefractionFilter.tsx
"use client";
import React from "react";
import manifest from "@/generated/refraction-manifest.json";

function stableHash(params: any) {
  // Debe coincidir con hashParams del script
  const s = JSON.stringify(params);
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h).toString(16).slice(0, 12);
}

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
  blur?: number | number;
  scaleRatio?: number; // 0..1
  specularOpacity?: number; // 0..1
  specularSaturation?: number; // multiplier
  withSvgWrapper?: boolean;
};

export const RefractionFilter: React.FC<Props> = ({
  id,
  preset,
  blur = 1,
  scaleRatio = 1,
  specularOpacity = 0.4,
  specularSaturation = 6,
}) => {
  // calc key exactly like the generator
  const key = ((): string => {
    for (const k of Object.keys(manifest)) {
      const entry = (manifest as any)[k];
      if (entry?.params?.name === preset.name) return k;
    }
    // fallback: first available
    return Object.keys(manifest)[0] ?? "";
  })();
  
  const entry = (manifest as any)[key];
  if (!key || !entry) {
    return null;
  }

  const dispUrl = entry.displacement;
  const specUrl = entry.specular;
  const maxDisp = entry.maxDisplacement ?? preset.maxDisplacement ?? 200;

  // scale for feDisplacementMap. feDisplacementMap "scale" is in CSS px relative units; we map scaleRatio 0..1 to [0..maxDisp].
  const scale = Number(scaleRatio) * Number(maxDisp);

  // Saturation as feColorMatrix: approximate by scaling RGB by factor (simple approach)
  // A better approach is to create an HSL-based map on generation time; for now apply feColorMatrix to specular.
  // We will create a color matrix that increases saturation (basic approximation)
  const sat = specularSaturation;

  // Color matrix for saturation (approx): use luminance matrix + scale blends
  const a = 0.213 + 0.787 * sat;
  const b = 0.715 - 0.715 * sat;
  const c = 0.072 - 0.072 * sat;

  return (
    <svg style={{ position: "absolute", width: 0, height: 0 }} aria-hidden>
      <defs>
        <filter id={id} x="-50%" y="-50%" width="200%" height="200%" colorInterpolationFilters="sRGB">
          {/* feImage for displacement */}
          <feImage xlinkHref={dispUrl} result="disp" />

          {/* feImage for specular */}
          <feImage xlinkHref={specUrl} result="spec" />

          {/* Blur the source (background) before displacement */}
          <feGaussianBlur in="SourceGraphic" stdDeviation={blur} result="blurred" />

          {/* Apply displacement: in2=disp, use channels R/G */}
          <feDisplacementMap in="blurred" in2="disp" scale={scale} xChannelSelector="R" yChannelSelector="G" result="refracted" />

          {/* Adjust specular saturation using feColorMatrix (approx) and opacity via feComponentTransfer */}
          <feColorMatrix
            in="spec"
            type="matrix"
            values={`${a} ${b} ${c} 0 0 ${b} ${a} ${c} 0 0 ${c} ${b} ${a} 0 0 0 0 0 1 0`}
            result="specSat"
          />
          <feComponentTransfer in="specSat" result="specAlpha">
            <feFuncA type="table" tableValues={`0 ${specularOpacity}`} />
          </feComponentTransfer>

          {/* Composite specular over refracted */}
          <feBlend mode="screen" in="refracted" in2="specAlpha" result="out" />

          <feComposite in="out" in2="SourceGraphic" operator="over" />
        </filter>
      </defs>
    </svg>
  );
};

export default RefractionFilter;