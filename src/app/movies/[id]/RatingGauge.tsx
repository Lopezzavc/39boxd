"use client";

import { useEffect, useRef, useState } from "react";
import LiquidGlass from "@/components/LiquidGlass";

type RatingGaugeProps = {
  initialValue?: number;
  onChange?: (value: number) => void;
  /** Multiplicador de tamaño. 1 = tamaño base (480px de ancho máximo). 1.3 = 30% más grande, etc. */
  size?: number;
};

const THUMB_SIZE = 45; // diámetro del thumb en unidades de viewBox (r=18 * 2)

export default function RatingGauge({ initialValue = 1.5, onChange, size = 1 }: RatingGaugeProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const trackRef = useRef<SVGGElement>(null);
  const thumbOverlayRef = useRef<HTMLDivElement>(null);
  const knobHitRef = useRef<SVGCircleElement>(null);
  const valueNumberRef = useRef<SVGTextElement>(null);
  const valueLabelRef = useRef<SVGTextElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const svg = svgRef.current;
    const trackGroup = trackRef.current;
    const thumbOverlay = thumbOverlayRef.current;
    const knobHit = knobHitRef.current;
    const valueNumber = valueNumberRef.current;
    const valueLabel = valueLabelRef.current;
    if (!svg || !trackGroup || !thumbOverlay || !knobHit || !valueNumber || !valueLabel) return;

    const cx = 240,
      cy = 210,
      r = 170;
    const SEPARACION_GRADOS = 10;
    let value = initialValue;
    let dragging = false;
    let currentPoint = { x: 0, y: 0 };

    const ranges = [
      { max: 2.0, label: "Basura" },
      { max: 3.0, label: "Muy mala" },
      { max: 4.0, label: "Mala" },
      { max: 5.0, label: "Mediocre" },
      { max: 6.0, label: "Regular" },
      { max: 7.0, label: "Buena" },
      { max: 8.0, label: "Muy buena" },
      { max: 9.0, label: "Excelente" },
      { max: 10.0, label: "Obra maestra" },
    ];

    function labelFor(v: number) {
      return ranges.find((seg) => v <= seg.max)!.label;
    }

    function polarToCartesian(angleDeg: number) {
      const rad = (angleDeg * Math.PI) / 180;
      return {
        x: cx + r * Math.cos(rad),
        y: cy - r * Math.sin(rad),
      };
    }

    function buildTrack() {
      const segmentCount = 5;
      const gapDeg = SEPARACION_GRADOS;
      const totalAngle = 180;
      const segmentSpan = (totalAngle - gapDeg * (segmentCount - 1)) / segmentCount;

      trackGroup!.innerHTML = "";

      for (let i = 0; i < segmentCount; i++) {
        const startAngle = totalAngle - i * (segmentSpan + gapDeg);
        const endAngle = startAngle - segmentSpan;

        const start = polarToCartesian(startAngle);
        const end = polarToCartesian(endAngle);

        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute(
          "d",
          `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 0 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`
        );
        trackGroup!.appendChild(path);
      }
    }

    function valueToAngle(v: number) {
      return 180 - (v / 10) * 180;
    }

    // Convierte un punto en coordenadas del viewBox (480x260) a px reales de pantalla,
    // relativo a wrapperRef (que es el offsetParent del overlay HTML).
    function viewBoxPointToScreenPx(p: { x: number; y: number }) {
      const svgRect = svg!.getBoundingClientRect();
      const wrapperRect = wrapperRef.current!.getBoundingClientRect();
      const scaleX = svgRect.width / 480;
      const scaleY = svgRect.height / 260;
      return {
        left: svgRect.left - wrapperRect.left + p.x * scaleX,
        top: svgRect.top - wrapperRect.top + p.y * scaleY,
        scale: scaleX, // asumimos escala uniforme (viewBox preserveAspectRatio por defecto)
      };
    }

    function positionOverlay() {
      // Guard: el ResizeObserver o un rAF encolado pueden dispararse después
      // del unmount, cuando los refs ya son null. Salimos sin hacer nada.
      if (!svg || !wrapperRef.current || !thumbOverlay) return;
      const screen = viewBoxPointToScreenPx(currentPoint);
      const sizePx = THUMB_SIZE * screen.scale;
      thumbOverlay!.style.width = `${sizePx}px`;
      thumbOverlay!.style.height = `${sizePx}px`;
      thumbOverlay!.style.left = `${screen.left - sizePx / 2}px`;
      thumbOverlay!.style.top = `${screen.top - sizePx / 2}px`;
    }

    function render() {
      const angle = valueToAngle(value);
      const p = polarToCartesian(angle);
      currentPoint = p;

      knobHit!.setAttribute("cx", p.x.toFixed(2));
      knobHit!.setAttribute("cy", p.y.toFixed(2));

      positionOverlay();

      const displayValue = value === 10 ? "10" : value.toFixed(1);
      valueNumber!.textContent = displayValue;

      const label = labelFor(value);
      valueLabel!.textContent = label;

      svg!.setAttribute("aria-valuenow", displayValue);
      svg!.setAttribute("aria-valuetext", displayValue + ", " + label);

      onChangeRef.current?.(value);
    }

    function clientToValue(clientX: number, clientY: number) {
      const rect = svg!.getBoundingClientRect();
      const scaleX = 480 / rect.width;
      const scaleY = 260 / rect.height;
      const x = (clientX - rect.left) * scaleX;
      const y = (clientY - rect.top) * scaleY;

      let angle = Math.atan2(-(y - cy), x - cx) * (180 / Math.PI);
      if (angle < 0) angle = x - cx >= 0 ? 0 : 180;
      angle = Math.max(0, Math.min(180, angle));

      const rawValue = ((180 - angle) / 180) * 10;
      return Math.round(rawValue * 10) / 10;
    }

    function setValueFromPointer(e: PointerEvent) {
      value = Math.max(0, Math.min(10, clientToValue(e.clientX, e.clientY)));
      render();
    }

    function onPointerDown(e: PointerEvent) {
      dragging = true;
      knobHit!.setPointerCapture(e.pointerId);
      svg!.focus();
    }

    function onPointerMove(e: PointerEvent) {
      if (!dragging) return;
      setValueFromPointer(e);
    }

    function onPointerUp() {
      dragging = false;
    }

    function onKeyDown(e: KeyboardEvent) {
      const step = e.shiftKey ? 1 : 0.1;
      if (e.key === "ArrowRight" || e.key === "ArrowUp") {
        value = Math.min(10, value + step);
        render();
        e.preventDefault();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
        value = Math.max(0, value - step);
        render();
        e.preventDefault();
      } else if (e.key === "Home") {
        value = 0;
        render();
        e.preventDefault();
      } else if (e.key === "End") {
        value = 10;
        render();
        e.preventDefault();
      }
    }

    knobHit.addEventListener("pointerdown", onPointerDown);
    knobHit.addEventListener("pointermove", onPointerMove);
    knobHit.addEventListener("pointerup", onPointerUp);
    knobHit.addEventListener("pointercancel", onPointerUp);
    svg.addEventListener("keydown", onKeyDown);

    // Reposicionar el overlay cuando el SVG cambia de tamaño en pantalla (responsive)
    const resizeObserver = new ResizeObserver(() => positionOverlay());
    resizeObserver.observe(svg);

    buildTrack();
    render();
    // Un frame extra para asegurar medidas correctas tras el primer layout
    const rafId = requestAnimationFrame(() => positionOverlay());

    return () => {
      knobHit.removeEventListener("pointerdown", onPointerDown);
      knobHit.removeEventListener("pointermove", onPointerMove);
      knobHit.removeEventListener("pointerup", onPointerUp);
      knobHit.removeEventListener("pointercancel", onPointerUp);
      svg.removeEventListener("keydown", onKeyDown);
      resizeObserver.disconnect();
      cancelAnimationFrame(rafId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={wrapperRef} style={{ position: "relative", width: "100%", maxWidth: `${480 * size}px` }}>
      <svg
        ref={svgRef}
        className="gauge"
        viewBox="0 0 480 260"
        role="slider"
        tabIndex={0}
        aria-label="Índice de Miedo y Avaricia"
        aria-valuemin={0}
        aria-valuemax={10}
        aria-valuenow={1.5}
        aria-valuetext="1.5, Basura"
        style={{
          width: "100%",
          display: "block",
          touchAction: "none",
          userSelect: "none",
          outline: "none",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        <defs>
          <linearGradient id="trackGradient" gradientUnits="userSpaceOnUse" x1="70" y1="210" x2="410" y2="210">
            <stop offset="0%" stopColor="#FF6B57" />
            <stop offset="25%" stopColor="#FF9F40" />
            <stop offset="50%" stopColor="#F6D746" />
            <stop offset="75%" stopColor="#B4DE4C" />
            <stop offset="100%" stopColor="#5FD9B0" />
          </linearGradient>
        </defs>

        <g ref={trackRef} id="track" fill="none" stroke="url(#trackGradient)" strokeWidth="20" strokeLinecap="round" />

        <text ref={valueNumberRef} x="240" y="190" textAnchor="middle" fontWeight={700} fontSize={58} letterSpacing="-1px" fill="#ffffff">
          1.5
        </text>
        <text ref={valueLabelRef} x="240" y="220" textAnchor="middle" fontWeight={400} fontSize={19} letterSpacing="0.5px" fill="#ffffff">
          Basura
        </text>

        {/* Hitbox invisible que maneja el drag; el thumb visual vive fuera del SVG (ver overlay HTML abajo) */}
        <circle
          ref={knobHitRef}
          cx="88.53"
          cy="132.82"
          r="34"
          fill="transparent"
          style={{ cursor: "grab", outline: "none" }}
        />
      </svg>

      {/* Overlay HTML posicionado absolutamente sobre el SVG. Vive en contexto DOM normal
          para que LiquidGlass pueda medir su tamaño real con getBoundingClientRect/ResizeObserver. */}
      <div
        ref={thumbOverlayRef}
        style={{
          position: "absolute",
          pointerEvents: "none",
          willChange: "left, top, width, height",
        }}
      >
        <LiquidGlass
          width="100%"
          height="100%"
          borderRadius={THUMB_SIZE / 2}
          surfaceType="convex_squircle"
          bezelWidth={THUMB_SIZE / 2}
          glassThickness={THUMB_SIZE}
          refractiveIndex={1.2}
          refractionScale={1.2}
          specularOpacity={0.65}
          blur={3}
          tintColor="rgb(40, 40, 40)"
          tintOpacity={0.2}
          className="!p-0"
          style={{ boxShadow: "0 4px 14px rgba(0,0,0,0.35)" }}
        />
      </div>
    </div>
  );
}