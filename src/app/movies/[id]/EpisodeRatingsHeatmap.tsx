"use client";

import { useRef, useState, useEffect, useCallback, type MouseEvent, type UIEvent } from "react";
import LiquidGlass from "@/components/LiquidGlass";

export type HeatmapEpisodeCell = {
  episode: number;
  title: string;
  rating: number | null;
  ratingDisplay: string | null;
  votes: string | null;
  ratingIsFallback: boolean;
  votesIsFallback: boolean;
};

export type HeatmapSeasonRow = {
  season: number;
  episodes: HeatmapEpisodeCell[];
  average: number | null;
};

type HoverState = {
  cell: HeatmapEpisodeCell;
  season: number;
  x: number;
  y: number;
};

// ────────────────────────────────────────────────────────────────────────────
// Colores por rango de rating (0.0 → 10.0)
// ────────────────────────────────────────────────────────────────────────────
function getRatingColor(rating: number | null): { bg: string; text: string } {
  if (rating === null) return { bg: "#2a2a2a", text: "#6b6b6b" };

  if (rating === 10) return { bg: "rgb(29, 161, 242)", text: "#ffffff" };
  if (rating >= 9.0) return { bg: "rgb(24, 106, 59)", text: "#ffffff" };
  if (rating >= 8.0) return { bg: "rgb(40, 180, 99)", text: "#0a0a0a" };
  if (rating >= 7.0) return { bg: "rgb(244, 208, 63)", text: "#0a0a0a" };
  if (rating >= 6.0) return { bg: "rgb(243, 156, 18)", text: "#0a0a0a" };
  if (rating >= 4.0) return { bg: "rgb(231, 76, 60)", text: "#ffffff" };
  return { bg: "rgb(91, 53, 107)", text: "#ffffff" };
}

export default function EpisodeRatingsHeatmap({ seasons }: { seasons: HeatmapSeasonRow[] }) {
  const [hovered, setHovered] = useState<HoverState | null>(null);
  const [showFadeRight, setShowFadeRight] = useState(false);
  const [showFadeLeft, setShowFadeLeft] = useState(false);
  const [hasOverflow, setHasOverflow] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  if (seasons.length === 0) return null;

  const maxEpisodes = Math.max(...seasons.map((s) => s.episodes.length));
  const episodeCols = Array.from({ length: maxEpisodes }, (_, i) => i + 1);

  function handleMove(e: MouseEvent<HTMLDivElement>, cell: HeatmapEpisodeCell, season: number) {
    setHovered({ cell, season, x: e.clientX, y: e.clientY });
  }

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

  // ── Scrollbar custom (thumb proporcional, arrastrable) ──
  const [thumb, setThumb] = useState({ widthPct: 100, leftPct: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ startX: number; startScrollLeft: number } | null>(null);

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
        <div
          className="grid min-w-max gap-1.5"
          style={{ gridTemplateColumns: `40px repeat(${maxEpisodes}, minmax(56px, 1fr)) 56px` }}
        >
          {/* Encabezado */}
          <div />
          {episodeCols.map((n) => (
            <div key={`h-${n}`} className="pb-1 text-center text-[11px] font-medium text-neutral-500">
              E{n}
            </div>
          ))}
          <div className="pb-1 text-center text-[11px] font-medium text-neutral-500">AVG.</div>

          {/* Filas */}
          {seasons.map((row) => {
            const avgColor = getRatingColor(row.average);
            return (
              <div key={`row-${row.season}`} className="contents">
                <div className="flex items-center justify-center text-[12px] font-medium text-neutral-400">
                  S{row.season}
                </div>

                {episodeCols.map((n) => {
                  const cell = row.episodes.find((e) => e.episode === n);
                  if (!cell) {
                    return <div key={`${row.season}-${n}`} className="h-11 rounded-lg" />;
                  }
                  const color = getRatingColor(cell.rating);
                  return (
                    <div
                      key={`${row.season}-${n}`}
                      onMouseMove={(e) => handleMove(e, cell, row.season)}
                      onMouseLeave={() => setHovered(null)}
                      className="flex h-11 cursor-default items-center justify-center rounded-lg text-[14px] font-semibold tabular-nums transition-transform hover:scale-[1.04]"
                      style={{ backgroundColor: color.bg, color: color.text }}
                    >
                      {cell.ratingDisplay ?? "–"}
                    </div>
                  );
                })}

                <div
                  className="flex h-11 items-center justify-center rounded-lg text-[14px] font-semibold tabular-nums"
                  style={{ backgroundColor: avgColor.bg, color: avgColor.text }}
                >
                  {row.average !== null ? row.average.toFixed(1) : "–"}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Difuminados indicadores de scroll horizontal */}
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

      {/* Scrollbar custom — minimalista, coincide con el estilo de la página, solo si hay overflow */}
      {hasOverflow && (
        <div
          onMouseDown={handleTrackPointerDown}
          className="relative mt-2.5 h-[5px] w-full cursor-pointer rounded-full bg-white/[0.06]"
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

      {/* Tooltip flotante junto al cursor */}
      {hovered && (
        <div className="pointer-events-none fixed z-50" style={{ left: hovered.x + 16, top: hovered.y + 16 }}>
          <LiquidGlass
            width="fit-content"
            height="auto"
            borderRadius={14}
            surfaceType="convex_squircle"
            bezelWidth={16}
            glassThickness={32}
            refractiveIndex={1.5}
            refractionScale={1.5}
            specularOpacity={0.5}
            blur={1.5}
            tintColor="rgb(40, 40, 40)"
            tintOpacity={0.5}
            className="!p-0"
          >
            <div className="min-w-[170px] px-4 py-3">
              <p className="text-[12px] font-semibold text-neutral-100">
                T{hovered.season}E{hovered.cell.episode} · {hovered.cell.title}
              </p>
              <div className="mt-2 space-y-0.5 text-[12px] text-neutral-400">
                <p>
                  Rating:{" "}
                  <span className="font-medium text-white">{hovered.cell.ratingDisplay ?? "Sin datos"}</span>
                  {hovered.cell.ratingIsFallback && <span className="text-neutral-500"> (TMDB)</span>}
                </p>
                <p>
                  Votos: <span className="font-medium text-white">{hovered.cell.votes ?? "Sin datos"}</span>
                  {hovered.cell.votesIsFallback && <span className="text-neutral-500"> (TMDB)</span>}
                </p>
              </div>
            </div>
          </LiquidGlass>
        </div>
      )}
    </div>
  );
}