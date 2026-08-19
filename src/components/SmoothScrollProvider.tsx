"use client";

import { useEffect } from "react";
import Lenis from "lenis";

const LENIS_DURATION = 1.1;
const LENIS_EASING = (t: number): number => 1 - Math.pow(1 - t, 3);
const LENIS_WHEEL_MULTIPLIER = 1;
const LENIS_TOUCH_MULTIPLIER = 1;

export default function SmoothScrollProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const lenis = new Lenis({
      duration: LENIS_DURATION,
      easing: LENIS_EASING,
      wheelMultiplier: LENIS_WHEEL_MULTIPLIER,
      touchMultiplier: LENIS_TOUCH_MULTIPLIER,
      syncTouch: false,
    });

    function raf(time: number) {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    }

    let rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, []);

  return <>{children}</>;
}