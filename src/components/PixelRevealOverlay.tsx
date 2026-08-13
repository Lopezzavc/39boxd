"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

class Pixel {
  width: number;
  height: number;
  ctx: CanvasRenderingContext2D;
  x: number;
  y: number;
  color: string;
  speed: number;
  size: number;
  sizeStep: number;
  minSize: number;
  maxSizeInteger: number;
  maxSize: number;
  delay: number;
  counter: number;
  counterStep: number;
  isDone: boolean;

  constructor(
    canvas: HTMLCanvasElement,
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    color: string,
    speed: number,
    delay: number
  ) {
    this.width = canvas.width;
    this.height = canvas.height;
    this.ctx = context;
    this.x = x;
    this.y = y;
    this.color = color;
    this.speed = this.getRandomValue(0.1, 0.9) * speed;
    this.size = 0;
    // Piso mínimo (0.15) para que ningún píxel tarde una eternidad en crecer.
    this.sizeStep = this.getRandomValue(0.15, 0.55);
    this.minSize = 0.5;
    this.maxSizeInteger = 2;
    this.maxSize = this.getRandomValue(this.minSize, this.maxSizeInteger);
    this.delay = delay;
    this.counter = 0;
    this.counterStep = Math.random() * 4 + (this.width + this.height) * 0.01;
    this.isDone = false;
  }

  getRandomValue(min: number, max: number) {
    return Math.random() * (max - min) + min;
  }

  draw() {
    const centerOffset = this.maxSizeInteger * 0.5 - this.size * 0.5;
    this.ctx.fillStyle = this.color;
    this.ctx.fillRect(this.x + centerOffset, this.y + centerOffset, this.size, this.size);
  }

  // Port de appear(): solo crece hasta maxSize y se marca isDone.
  // Sin shimmer/loop infinito, porque acá la animación es de un solo disparo.
  appear() {
    if (this.counter <= this.delay) {
      this.counter += this.counterStep;
      return;
    }
    if (this.size >= this.maxSize) {
      this.size = this.maxSize;
      this.isDone = true;
    } else {
      this.size += this.sizeStep;
    }
    this.draw();
  }
}

function getEffectiveSpeed(value: number, reducedMotion: boolean) {
  const min = 0;
  const max = 100;
  const throttle = 0.001;

  if (value <= min || reducedMotion) {
    return min;
  } else if (value >= max) {
    return max * throttle;
  } else {
    return value * throttle;
  }
}

function pickColor(colorsArray: string[]): string {
  return colorsArray[Math.floor(Math.random() * colorsArray.length)] ?? "#f8fafc";
}

export interface PixelRevealHandle {
  play: (onComplete: () => void) => void;
}

interface PixelRevealOverlayProps {
  gap?: number;
  speed?: number;
  colors?: string;
  // Color hacia el que se funde la imagen (capa intermedia).
  fadeColor?: string;
  // Techo de opacidad del fade (0 a 1). No es "negro absoluto":
  // 1 = negro sólido, 0.7 = deja traslucir un 30% de la imagen debajo.
  maxFadeOpacity?: number;
}

// Variante "default" de PixelCard.
const DEFAULT_GAP = 5;
const DEFAULT_SPEED = 35;
const DEFAULT_COLORS = "#f8fafc,#f1f5f9,#cbd5e1";
const DEFAULT_FADE_COLOR = "#000000";
const DEFAULT_MAX_FADE_OPACITY = 0.7;

// Red de seguridad: si la animación no termina "orgánicamente" (miles de
// píxeles, tab en background pausando rAF, etc.), forzamos el onComplete
// a los 900ms para que la navegación nunca quede bloqueada.
const MAX_DURATION_MS = 900;

const PixelRevealOverlay = forwardRef<PixelRevealHandle, PixelRevealOverlayProps>(
  (
    {
      gap = DEFAULT_GAP,
      speed = DEFAULT_SPEED,
      colors = DEFAULT_COLORS,
      fadeColor = DEFAULT_FADE_COLOR,
      maxFadeOpacity = DEFAULT_MAX_FADE_OPACITY,
    },
    ref
  ) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fadeRef = useRef<HTMLDivElement>(null);
    const pixelsRef = useRef<Pixel[]>([]);
    const animationRef = useRef<number | null>(null);
    const timePreviousRef = useRef(performance.now());
    const reducedMotion = useRef(
      typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ).current;

    const initPixels = () => {
      const canvas = canvasRef.current;
      const parent = canvas?.parentElement;
      if (!canvas || !parent) return;

      const rect = parent.getBoundingClientRect();
      const width = Math.floor(rect.width);
      const height = Math.floor(rect.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      canvas.width = width;
      canvas.height = height;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      const colorsArray = colors.split(",");
      const step = Math.max(1, Math.round(gap));
      const pxs: Pixel[] = [];
      for (let x = 0; x < width; x += step) {
        for (let y = 0; y < height; y += step) {
          const color = pickColor(colorsArray);
          const dx = x - width / 2;
          const dy = y - height / 2;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const delay = reducedMotion ? 0 : distance;
          pxs.push(
            new Pixel(canvas, ctx, x, y, color, getEffectiveSpeed(speed, reducedMotion), delay)
          );
        }
      }
      pixelsRef.current = pxs;
    };

    useImperativeHandle(ref, () => ({
      play: (onComplete: () => void) => {
        if (reducedMotion) {
          if (fadeRef.current) fadeRef.current.style.opacity = String(maxFadeOpacity);
          onComplete();
          return;
        }

        initPixels();

        if (animationRef.current !== null) {
          cancelAnimationFrame(animationRef.current);
        }

        // Reinicio del fade por si esta instancia se reutiliza (sin remount)
        // entre dos reproducciones consecutivas.
        if (fadeRef.current) fadeRef.current.style.opacity = "0";

        let completed = false;
        const startTime = performance.now();
        timePreviousRef.current = startTime;

        const finish = () => {
          if (completed) return;
          completed = true;
          if (animationRef.current !== null) {
            cancelAnimationFrame(animationRef.current);
          }
          // Asegura el techo de opacidad al terminar, incluso si el corte
          // fue forzado por MAX_DURATION_MS antes de que algún píxel
          // remoto llegara a isDone.
          if (fadeRef.current) fadeRef.current.style.opacity = String(maxFadeOpacity);
          onComplete();
        };

        const tick = () => {
          animationRef.current = requestAnimationFrame(tick);
          const timeNow = performance.now();
          const timePassed = timeNow - timePreviousRef.current;
          const timeInterval = 1000 / 60;

          if (timePassed < timeInterval) return;
          timePreviousRef.current = timeNow - (timePassed % timeInterval);

          const canvas = canvasRef.current;
          const ctx = canvas?.getContext("2d");
          if (!ctx || !canvas) return;

          ctx.clearRect(0, 0, canvas.width, canvas.height);

          let allDone = true;
          let totalSize = 0;
          let totalMax = 0;

          for (const pixel of pixelsRef.current) {
            pixel.appear();
            if (!pixel.isDone) allDone = false;
            totalSize += pixel.size;
            totalMax += pixel.maxSize;
          }

          // El fade usa el mismo criterio de "qué tan revelados están los
          // píxeles" para sincronizar su duración con la animación de
          // píxeles, y se escala por maxFadeOpacity para no llegar a negro
          // absoluto (o a lo que definas como techo).
          if (fadeRef.current) {
            const progress = totalMax > 0 ? totalSize / totalMax : 1;
            const opacity = Math.min(maxFadeOpacity, progress * maxFadeOpacity);
            fadeRef.current.style.opacity = opacity.toFixed(3);
          }

          if (allDone) {
            finish();
            return;
          }

          if (timeNow - startTime >= MAX_DURATION_MS) {
            finish();
          }
        };

        animationRef.current = requestAnimationFrame(tick);
      },
    }));

    useEffect(() => {
      return () => {
        if (animationRef.current !== null) {
          cancelAnimationFrame(animationRef.current);
        }
      };
    }, []);

    return (
      <>
        {/* Capa intermedia: transparente -> negro (hasta maxFadeOpacity), por debajo de los píxeles y encima de la imagen */}
        <div
          ref={fadeRef}
          className="pointer-events-none absolute inset-0 z-[5]"
          style={{ backgroundColor: fadeColor, opacity: 0 }}
        />
        <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 z-10" />
      </>
    );
  }
);

PixelRevealOverlay.displayName = "PixelRevealOverlay";

export default PixelRevealOverlay;