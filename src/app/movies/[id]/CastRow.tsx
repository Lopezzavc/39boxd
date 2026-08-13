"use client";

import { useRef, useState, useEffect, useCallback, MouseEvent, UIEvent } from "react";

type CastCard = {
  name: string;
  role: string;
  imageUrl: string | null;
};

export default function CastRow({ cast }: { cast: CastCard[] }) {
  const [showFadeLeft, setShowFadeLeft] = useState(false);
  const [showFadeRight, setShowFadeRight] = useState(false);
  const [hasOverflow, setHasOverflow] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [thumb, setThumb] = useState({ widthPct: 100, leftPct: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ startX: number; startScrollLeft: number } | null>(null);

  if (cast.length === 0) return null;

  const updateFadeVisibility = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const hasOverflow = el.scrollWidth > el.clientWidth + 1;
    const atStart = el.scrollLeft <= 1;
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1;
    setHasOverflow(hasOverflow);
    setShowFadeLeft(hasOverflow && !atStart);
    setShowFadeRight(hasOverflow && !atEnd);
  }, []);

  const updateThumb = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollWidth, clientWidth, scrollLeft } = el;
    if (scrollWidth <= clientWidth) {
      setThumb({ widthPct: 100, leftPct: 0 });
      return;
    }
    const widthPct = (clientWidth / scrollWidth) * 100;
    const maxScroll = scrollWidth - clientWidth;
    const leftPct = (scrollLeft / maxScroll) * (100 - widthPct);
    setThumb({ widthPct, leftPct });
  }, []);

  useEffect(() => {
    updateFadeVisibility();
    updateThumb();
    const el = scrollRef.current;
    if (!el) return;

    const handleResize = () => {
      updateFadeVisibility();
      updateThumb();
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(el);
    window.addEventListener("resize", handleResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", handleResize);
    };
  }, [updateFadeVisibility, updateThumb]);

  function handleScroll(_e: UIEvent<HTMLDivElement>) {
    updateFadeVisibility();
    updateThumb();
  }

  function handleTrackPointerDown(e: MouseEvent<HTMLDivElement>) {
    const track = e.currentTarget;
    const el = scrollRef.current;
    if (!el) return;
    const rect = track.getBoundingClientRect();
    const clickRatio = (e.clientX - rect.left) / rect.width;
    const maxScroll = el.scrollWidth - el.clientWidth;
    el.scrollLeft = clickRatio * el.scrollWidth - el.clientWidth / 2;
    el.scrollLeft = Math.max(0, Math.min(maxScroll, el.scrollLeft));
  }

  function handleThumbPointerDown(e: MouseEvent<HTMLDivElement>) {
    e.stopPropagation();
    e.preventDefault();
    const el = scrollRef.current;
    if (!el) return;
    dragStartRef.current = { startX: e.clientX, startScrollLeft: el.scrollLeft };
    setIsDragging(true);
  }

  useEffect(() => {
    if (!isDragging) return;

    function handlePointerMove(e: globalThis.MouseEvent) {
      const el = scrollRef.current;
      const start = dragStartRef.current;
      if (!el || !start) return;
      const trackWidth = el.clientWidth;
      const maxScroll = el.scrollWidth - el.clientWidth;
      const deltaX = e.clientX - start.startX;
      const scrollDelta = (deltaX / trackWidth) * el.scrollWidth;
      el.scrollLeft = Math.max(0, Math.min(maxScroll, start.startScrollLeft + scrollDelta));
    }

    function handlePointerUp() {
      setIsDragging(false);
      dragStartRef.current = null;
    }

    window.addEventListener("mousemove", handlePointerMove);
    window.addEventListener("mouseup", handlePointerUp);
    return () => {
      window.removeEventListener("mousemove", handlePointerMove);
      window.removeEventListener("mouseup", handlePointerUp);
    };
  }, [isDragging]);

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="flex gap-5 py-1 px-1">
          {cast.map((actor) => (
            <div key={actor.name} className="flex shrink-0 flex-col items-center gap-2 w-[88px]">
              {/* Cambio aquí: contenedor rectangular vertical (w-16 h-24) con rounded-lg */}
              <div className="w-24 h-35 rounded-lg overflow-hidden bg-neutral-800">
                <img
                  src={actor.imageUrl || "/assets/no-actor.png"}
                  alt={actor.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <p className="text-[13px] font-medium text-neutral-200 text-center leading-tight">
                {actor.name}
              </p>
              <p className="text-[11px] text-neutral-500 text-center leading-tight">
                {actor.role}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Degradados laterales */}
      <div
        aria-hidden
        className={`pointer-events-none absolute left-0 top-0 h-full w-16 bg-gradient-to-r from-black to-transparent transition-opacity duration-200 ${
          showFadeLeft ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        aria-hidden
        className={`pointer-events-none absolute right-0 top-0 h-full w-16 bg-gradient-to-l from-black to-transparent transition-opacity duration-200 ${
          showFadeRight ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Scrollbar personalizada */}
      {hasOverflow && (
        <div
          onMouseDown={handleTrackPointerDown}
          className="relative mt-3 h-[5px] w-full cursor-pointer rounded-full bg-white/[0.06]"
        >
          <div
            onMouseDown={handleThumbPointerDown}
            className={`absolute top-0 h-full rounded-full bg-white/25 transition-colors hover:bg-white/40 ${
              isDragging ? "bg-white/45" : ""
            }`}
            style={{ width: `${thumb.widthPct}%`, left: `${thumb.leftPct}%` }}
          />
        </div>
      )}
    </div>
  );
}