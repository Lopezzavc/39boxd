"use client";

import { useEffect, useRef, useState } from "react";
import LiquidGlass from "@/components/LiquidGlass";

type RatingGaugeProps = {
  initialValue?: number;
  onChange?: (value: number) => void;
  onSave?: (value: number) => void;
  size?: number;
};

const THUMB_SIZE = 45;
const THUMB_SCALE_ACTIVE = 1.18;
const MAX_SHAKE_PX = 1.5;
const MAX_SHAKE_ROTATE = 0.5;
const SHAKE_SPEED = 120;
// Qué tan rápido sube/baja la intensidad del shake por frame (0-1).
// Valores más bajos = transición más lenta y gradual.
const SHAKE_INTENSITY_EASING = 0.06;

const VALUE_NUMBER_FONT_SIZE = 80;
const VALUE_LABEL_FONT_SIZE = 23;

export default function RatingGauge({ initialValue = 0.0, onChange, onSave, size = 1 }: RatingGaugeProps) {
  const safeInitialValue = Number.isFinite(Number(initialValue)) ? Number(initialValue) : 0;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const trackRef = useRef<SVGGElement>(null);
  const progressRef = useRef<SVGPathElement>(null);
  const thumbOverlayRef = useRef<HTMLDivElement>(null);
  const thumbScaleRef = useRef<HTMLDivElement>(null);
  const thumbInnerRef = useRef<HTMLDivElement>(null);
  const knobHitRef = useRef<SVGCircleElement>(null);
  const valueNumberRef = useRef<SVGTextElement>(null);
  const valueLabelRef = useRef<SVGTextElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  // Controla si el thumb muestra el efecto liquid glass (drag o hover) o el blanco sólido en reposo
  const [thumbActive, setThumbActive] = useState(false);
  // Controla el brillo al presionar/arrastrar (overlay por opacity dentro de LiquidGlass,
  // nunca CSS filter en un ancestro: eso rompe backdrop-filter, ver LiquidGlass.tsx)
  const [thumbPressed, setThumbPressed] = useState(false);

  useEffect(() => {
    const svg = svgRef.current;
    const trackGroup = trackRef.current;
    const progressPath = progressRef.current;
    const thumbOverlay = thumbOverlayRef.current;
    const thumbScale = thumbScaleRef.current;
    const thumbInner = thumbInnerRef.current;
    const knobHit = knobHitRef.current;
    const valueNumber = valueNumberRef.current;
    const valueLabel = valueLabelRef.current;
    if (
      !svg ||
      !trackGroup ||
      !progressPath ||
      !thumbOverlay ||
      !thumbScale ||
      !thumbInner ||
      !knobHit ||
      !valueNumber ||
      !valueLabel
    )
      return;

    const cx = 240,
      cy = 210,
      r = 170;
    const SEPARACION_GRADOS = 10;
    let value = safeInitialValue;
    let displayedValue = safeInitialValue;
    let dragging = false;
    let hovering = false;
    let currentPoint = { x: 0, y: 0 };
    let rafLoop = 0;
    const shakeSeed = Math.random() * 1000;
    // Intensidad actual del shake, animada suavemente entre 0 (estático) y 1 (shake completo)
    let shakeIntensity = 0;

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

    const totalArcLength = Math.PI * r;

    function updateProgressPath() {
      const start = polarToCartesian(180);
      const end = polarToCartesian(0);
      progressPath!.setAttribute(
        "d",
        `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 0 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`
      );
      progressPath!.setAttribute("stroke-dasharray", `${totalArcLength}`);
    }

    function valueToAngle(v: number) {
      return 180 - (v / 10) * 180;
    }

    function viewBoxPointToScreenPx(p: { x: number; y: number }) {
      const svgRect = svg!.getBoundingClientRect();
      const wrapperRect = wrapperRef.current!.getBoundingClientRect();
      const scaleX = svgRect.width / 480;
      const scaleY = svgRect.height / 260;
      return {
        left: svgRect.left - wrapperRect.left + p.x * scaleX,
        top: svgRect.top - wrapperRect.top + p.y * scaleY,
        scale: scaleX,
      };
    }

    let lastSizePx = -1;

    function positionOverlay() {
      if (!svg || !wrapperRef.current || !thumbOverlay || !thumbScale) return;
      const screen = viewBoxPointToScreenPx(currentPoint);
      const activeScale = dragging || hovering ? THUMB_SCALE_ACTIVE : 1;

      // Tamaño real (px) del contenedor: solo se toca cuando cambia de verdad
      // (redondeado a entero) para no disparar el ResizeObserver de LiquidGlass
      // en cada frame de drag.
      const sizePx = Math.round(THUMB_SIZE * screen.scale);
      if (sizePx !== lastSizePx) {
        thumbOverlay!.style.width = `${sizePx}px`;
        thumbOverlay!.style.height = `${sizePx}px`;
        lastSizePx = sizePx;
      }

      // Posición vía transform (no left/top): left/top fuerza reflow en cada
      // frame, y backdrop-filter con filtro SVG pierde la captura del backdrop
      // si el elemento sufre reflow mientras se recompone — es lo que hacía
      // desaparecer la distorsión al arrastrar. transform es solo composición.
      const x = screen.left - sizePx / 2;
      const y = screen.top - sizePx / 2;
      thumbOverlay!.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px)`;

      // La escala de hover/drag vive en un wrapper aparte, también vía transform,
      // así el tamaño real (observado por LiquidGlass) permanece estable.
      thumbScale!.style.transform = `scale(${activeScale})`;
    }

    function tick() {
      const diff = value - displayedValue;
      if (Math.abs(diff) > 0.0005) {
        displayedValue += diff * 0.22;
      } else {
        displayedValue = value;
      }

      const angle = valueToAngle(displayedValue);
      const p = polarToCartesian(angle);
      currentPoint = p;

      knobHit!.setAttribute("cx", p.x.toFixed(2));
      knobHit!.setAttribute("cy", p.y.toFixed(2));

      const progressRatio = displayedValue / 10;
      const offset = totalArcLength * (1 - progressRatio);
      progressPath!.style.strokeDashoffset = `${offset}`;

      // La intensidad del shake se anima suavemente hacia 1 (dragging) o 0 (estático),
      // en vez de saltar de golpe. Así la transición de estático -> shake y de
      // shake -> estático es gradual.
      const targetIntensity = dragging ? 1 : 0;
      const intensityDiff = targetIntensity - shakeIntensity;
      if (Math.abs(intensityDiff) > 0.0005) {
        shakeIntensity += intensityDiff * SHAKE_INTENSITY_EASING;
      } else {
        shakeIntensity = targetIntensity;
      }

      if (shakeIntensity > 0.0005) {
        const valueFactor = displayedValue / 10;
        const intensity = valueFactor * shakeIntensity;
        const t = performance.now() / 1000;
        const shakeX = Math.sin(t * SHAKE_SPEED + shakeSeed) * MAX_SHAKE_PX * intensity;
        const shakeY = Math.cos(t * (SHAKE_SPEED - 5) + shakeSeed) * (MAX_SHAKE_PX * 0.6) * intensity;
        const shakeRot = Math.sin(t * (SHAKE_SPEED - 10) + shakeSeed) * MAX_SHAKE_ROTATE * intensity;
        valueNumber!.style.transform = `translate(${shakeX.toFixed(2)}px, ${shakeY.toFixed(
          2
        )}px) rotate(${shakeRot.toFixed(2)}deg)`;
      } else {
        valueNumber!.style.transform = "translate(0px, 0px) rotate(0deg)";
      }

      positionOverlay();
      rafLoop = requestAnimationFrame(tick);
    }

    function updateTexts() {
      const displayValue = value === 10 ? "10" : value.toFixed(1);
      valueNumber!.textContent = displayValue;

      const label = labelFor(value);
      valueLabel!.textContent = label;

      svg!.setAttribute("aria-valuenow", displayValue);
      svg!.setAttribute("aria-valuetext", displayValue + ", " + label);

      onChangeRef.current?.(value);
    }

    function pulseValue() {
      valueNumber!.style.transition = "transform 260ms cubic-bezier(0.34, 1.56, 0.64, 1)";
      valueNumber!.style.transform = "scale(1.08)";
      requestAnimationFrame(() => {
        valueNumber!.style.transform = "scale(1)";
      });
      window.setTimeout(() => {
        valueNumber!.style.transition = "";
      }, 280);
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
      const next = Math.max(0, Math.min(10, clientToValue(e.clientX, e.clientY)));
      if (next !== value) {
        value = next;
        updateTexts();
      }
    }

    function onPointerDown(e: PointerEvent) {
      dragging = true;
      knobHit!.setPointerCapture(e.pointerId);
      svg!.focus();
      setThumbActive(true);
      setThumbPressed(true);
    }

    function onPointerMove(e: PointerEvent) {
      if (!dragging) return;
      setValueFromPointer(e);
    }

    function onPointerUp() {
      if (!dragging) return;
      dragging = false;
      pulseValue();
      if (!hovering) setThumbActive(false);
      setThumbPressed(false);
      onSaveRef.current?.(value);
    }

    function onPointerEnter() {
      hovering = true;
      knobHit!.style.cursor = "grab";
      setThumbActive(true);
    }

    function onPointerLeave() {
      hovering = false;
      if (!dragging) setThumbActive(false);
    }

    function onKeyDown(e: KeyboardEvent) {
      const step = e.shiftKey ? 1 : 0.1;
      let changed = false;
      if (e.key === "ArrowRight" || e.key === "ArrowUp") {
        value = Math.min(10, value + step);
        changed = true;
        e.preventDefault();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
        value = Math.max(0, value - step);
        changed = true;
        e.preventDefault();
      } else if (e.key === "Home") {
        value = 0;
        changed = true;
        e.preventDefault();
      } else if (e.key === "End") {
        value = 10;
        changed = true;
        e.preventDefault();
      }
      if (changed) {
        updateTexts();
        pulseValue();
        onSaveRef.current?.(value);
      }
    }

    knobHit.addEventListener("pointerdown", onPointerDown);
    knobHit.addEventListener("pointermove", onPointerMove);
    knobHit.addEventListener("pointerup", onPointerUp);
    knobHit.addEventListener("pointercancel", onPointerUp);
    knobHit.addEventListener("pointerenter", onPointerEnter);
    knobHit.addEventListener("pointerleave", onPointerLeave);
    svg.addEventListener("keydown", onKeyDown);

    const resizeObserver = new ResizeObserver(() => positionOverlay());
    resizeObserver.observe(svg);

    buildTrack();
    updateProgressPath();
    updateTexts();
    rafLoop = requestAnimationFrame(tick);
    const rafId = requestAnimationFrame(() => positionOverlay());

    return () => {
      knobHit.removeEventListener("pointerdown", onPointerDown);
      knobHit.removeEventListener("pointermove", onPointerMove);
      knobHit.removeEventListener("pointerup", onPointerUp);
      knobHit.removeEventListener("pointercancel", onPointerUp);
      knobHit.removeEventListener("pointerenter", onPointerEnter);
      knobHit.removeEventListener("pointerleave", onPointerLeave);
      svg.removeEventListener("keydown", onKeyDown);
      resizeObserver.disconnect();
      cancelAnimationFrame(rafId);
      cancelAnimationFrame(rafLoop);
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
        aria-valuenow={0}
        aria-valuetext="0.0, Basura"
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
          <filter id="progressGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g
          ref={trackRef}
          id="track"
          fill="none"
          stroke="url(#trackGradient)"
          strokeWidth="20"
          strokeLinecap="round"
          opacity={0.22}
        />

        <path
          ref={progressRef}
          id="progress"
          fill="none"
          stroke="url(#trackGradient)"
          strokeWidth="20"
          strokeLinecap="round"
          filter="url(#progressGlow)"
          style={{ transition: "stroke-dashoffset 60ms linear" }}
        />

        <text
          ref={valueNumberRef}
          x="240"
          y="185"
          textAnchor="middle"
          fontWeight={700}
          fontSize={VALUE_NUMBER_FONT_SIZE}
          letterSpacing="-1px"
          fill="#ffffff"
          style={{ transformOrigin: "240px 205px" }}
        >
          0.0
        </text>
        <text
          ref={valueLabelRef}
          x="240"
          y="220"
          textAnchor="middle"
          fontWeight={400}
          fontSize={VALUE_LABEL_FONT_SIZE}
          letterSpacing="0.5px"
          fill="#ffffff"
        >
          Basura
        </text>

        <circle
          ref={knobHitRef}
          cx="70"
          cy="210"
          r="34"
          fill="transparent"
          style={{ cursor: "grab", outline: "none" }}
        />
      </svg>

      <div
        ref={thumbOverlayRef}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          pointerEvents: "none",
          willChange: "transform",
        }}
      >
        <div
          ref={thumbScaleRef}
          style={{
            width: "100%",
            height: "100%",
            willChange: "transform",
            transition: "transform 180ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          <div ref={thumbInnerRef} style={{ width: "100%", height: "100%" }}>
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
              blur={0}
              active={thumbActive}
              pressed={thumbPressed}
              restColor="rgb(255, 255, 255)"
              activeTransitionMs={220}
              tintColor="rgb(40, 40, 40)"
              tintOpacity={0.2}
              className="!p-0"
              style={{ boxShadow: "0 4px 14px rgba(0,0,0,0.35)" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}