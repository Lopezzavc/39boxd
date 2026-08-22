"use client";

import type { CSSProperties } from "react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { LiquidGlass } from "@/components/liquid-glass";

type GameItem = {
  id: string;
  isFavorite: boolean;
  isCompleted: boolean;
  isPending: boolean;
  rating: number | null;
  title: string;
  coverUrl: string | null;
  backdropUrl: string | null;
  externalId: string;
};

const BACKDROP_BLUR_PX = 7;
const BACKDROP_TINT_OPACITY = 0.7;

const BACKDROP_TRANSITION_MS = 500;

const HOVER_GRADIENT_OPACITY = 0.95;
const HOVER_GRADIENT_HEIGHT_PERCENT = 55;
const HOVER_TRANSITION_MS = 350;
const STATUS_SWAP_TRANSITION_MS = 300;

const STATUS_LABEL_OPACITY = 1;
const COMPLETED_COLOR_RGB = "rgb(101, 252, 109)";
const PENDING_COLOR_RGB = "rgb(255, 166, 64)";
const FAVORITE_COLOR_RGB = "rgb(255, 218, 98)";
const TITLE_COLOR_RGB = "rgb(229, 229, 229)";
const SECTION_LABEL_COLOR_RGB = "rgb(115, 115, 115)";
const PLACEHOLDER_BG_RGB = "rgb(38, 38, 38)";
const PLACEHOLDER_TEXT_RGB = "rgb(163, 163, 163)";
const RATING_COLOR_RGB = "rgb(255, 255, 255)";
const PAGE_BG_RGB = "rgb(10, 10, 10)";

const SECTION_LABEL = "text-[11px] font-semibold uppercase tracking-[0.14em]";

const SORT_TEXT_RGB = "rgb(229, 229, 229)";
const SORT_TEXT_MUTED_RGB = "rgb(163, 163, 163)";
const SORT_BG_RGB = "rgb(38, 38, 38)";
const SORT_BG_HOVER_RGB = "rgb(50, 50, 50)";
const SORT_BORDER_OPACITY = 0.08;
const SORT_ACCENT_RGB = "rgb(101, 252, 109)";
const SORT_MENU_TRANSITION_MS = 180;

type SortOrder = "custom" | "rating-desc" | "rating-asc";

const SORT_OPTIONS: { value: SortOrder; label: string }[] = [
  { value: "custom", label: "Orden personalizado" },
  { value: "rating-desc", label: "Calificación: mayor a menor" },
  { value: "rating-asc", label: "Calificación: menor a mayor" },
];

type Layer = { url: string; visible: boolean };

function formatRating(rating: number): string {
  return rating === 10 ? "10" : rating.toFixed(1);
}

const RATING_COLOR_STOPS: { offset: number; rgb: string }[] = [
  { offset: 0, rgb: "rgb(255, 107, 87)" },
  { offset: 2.5, rgb: "rgb(255, 159, 64)" },
  { offset: 5, rgb: "rgb(246, 215, 70)" },
  { offset: 7.5, rgb: "rgb(180, 222, 76)" },
  { offset: 9.9, rgb: "rgb(114, 245, 96)" },
  { offset: 10, rgb: "rgb(84, 175, 250)" },
];

function parseRgb(rgb: string): [number, number, number] {
  const match = rgb.match(/\d+/g);
  const [r, g, b] = match ? match.map(Number) : [0, 0, 0];
  return [r ?? 0, g ?? 0, b ?? 0];
}

const ratingColorCache = new Map<number, string>();

function getRatingColor(rating: number): string {
  const clamped = Math.min(10, Math.max(0, rating));
  const cached = ratingColorCache.get(clamped);
  if (cached) return cached;

  let color = RATING_COLOR_STOPS[RATING_COLOR_STOPS.length - 1]!.rgb;
  for (let i = 0; i < RATING_COLOR_STOPS.length - 1; i++) {
    const start = RATING_COLOR_STOPS[i]!;
    const end = RATING_COLOR_STOPS[i + 1]!;
    if (clamped >= start.offset && clamped <= end.offset) {
      const t = (clamped - start.offset) / (end.offset - start.offset);
      const [sr, sg, sb] = parseRgb(start.rgb);
      const [er, eg, eb] = parseRgb(end.rgb);
      const r = Math.round(sr + (er - sr) * t);
      const g = Math.round(sg + (eg - sg) * t);
      const b = Math.round(sb + (eb - sb) * t);
      color = `rgb(${r}, ${g}, ${b})`;
      break;
    }
  }
  ratingColorCache.set(clamped, color);
  return color;
}

function usePreloadImages(urls: (string | null)[]) {
  useEffect(() => {
    const uniqueUrls = Array.from(new Set(urls.filter((u): u is string => Boolean(u))));
    uniqueUrls.forEach((url) => {
      const img = new window.Image();
      img.src = url;
    });
  }, [urls]);
}

function StarIcon({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} style={style}>
      <path d="M12 2.75l2.917 6.257 6.833.882-5.03 4.727 1.36 6.804L12 17.98l-6.08 3.44 1.36-6.804-5.03-4.727 6.833-.882L12 2.75z" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  );
}

function ChevronIcon({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function SortDropdown({
  value,
  onChange,
}: {
  value: SortOrder;
  onChange: (value: SortOrder) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const currentLabel = SORT_OPTIONS.find((o) => o.value === value)?.label ?? "";

  return (
    <div ref={containerRef} className="relative">
      <LiquidGlass
        width="fit-content"
        height={34}
        borderRadius={17}
        surfaceType="convex_squircle"
        bezelWidth={18}
        glassThickness={34}
        refractiveIndex={1.5}
        refractionScale={1.5}
        specularOpacity={0.3}
        blur={1}
        tintColor="rgb(40, 40, 40)"
        tintOpacity={isOpen ? 0.4 : 0.4}
        className="!justify-center items-center cursor-pointer"
      >
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="flex items-center gap-1.5 px-3.5 text-xs font-medium"
          style={{ color: SORT_TEXT_RGB }}
        >
          {currentLabel}
          <ChevronIcon
            className="h-3.5 w-3.5"
            style={{
              transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
              transition: `transform ${SORT_MENU_TRANSITION_MS}ms cubic-bezier(0.16, 1, 0.3, 1)`,
            }}
          />
        </button>
      </LiquidGlass>

      <div
        className="absolute right-0 top-full mt-2 w-56 origin-top-right overflow-hidden rounded-xl"
        style={{
          backgroundColor: SORT_BG_RGB,
          boxShadow: `inset 0 0 0 1px rgba(255,255,255,${SORT_BORDER_OPACITY}), 0 12px 32px rgba(0,0,0,0.5)`,
          opacity: isOpen ? 1 : 0,
          transform: isOpen ? "scale(1) translateY(0)" : "scale(0.95) translateY(-4px)",
          pointerEvents: isOpen ? "auto" : "none",
          transition: `opacity ${SORT_MENU_TRANSITION_MS}ms cubic-bezier(0.16, 1, 0.3, 1), transform ${SORT_MENU_TRANSITION_MS}ms cubic-bezier(0.16, 1, 0.3, 1)`,
          zIndex: 20,
        }}
      >
        {SORT_OPTIONS.map((option) => {
          const isActive = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className="flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left text-xs font-medium transition-colors"
              style={{ color: isActive ? SORT_ACCENT_RGB : SORT_TEXT_MUTED_RGB }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = SORT_BG_HOVER_RGB;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              {option.label}
              {isActive && <CheckIcon className="h-3.5 w-3.5" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const GameCard = memo(function GameCard({
  game,
  index,
  showGradientOnHover,
  isHovered,
  onEnter,
  onLeave,
}: {
  game: GameItem;
  index: number;
  showGradientOnHover: boolean;
  isHovered: boolean;
  onEnter: (game: GameItem) => void;
  onLeave: () => void;
}) {
  const showGradient = showGradientOnHover && isHovered;

  return (
    <Link
      href={`/games/${game.externalId}`}
      className="group relative block"
      onMouseEnter={() => onEnter(game)}
      onMouseLeave={onLeave}
    >
      <div
        className="relative aspect-[2/3] overflow-hidden rounded-xl"
        style={{
          backgroundColor: PLACEHOLDER_BG_RGB,
          zIndex: isHovered ? 10 : 1,
        }}
      >
        {game.coverUrl ? (
          <Image
            src={game.coverUrl}
            alt={game.title}
            fill
            priority={index === 0}
            sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 14vw"
            className="object-cover"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center text-xs"
            style={{ color: PLACEHOLDER_TEXT_RGB }}
          >
            {game.title}
          </div>
        )}

        {showGradientOnHover && (
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0"
            style={{
              height: `${HOVER_GRADIENT_HEIGHT_PERCENT}%`,
              opacity: showGradient ? 1 : 0,
              transition: `opacity ${HOVER_TRANSITION_MS}ms cubic-bezier(0.16, 1, 0.3, 1)`,
              background: `linear-gradient(to top, rgba(0,0,0,${HOVER_GRADIENT_OPACITY}), rgba(0,0,0,0))`,
            }}
          />
        )}

        {game.rating !== null && (
          <div
            className="absolute bottom-2 right-2.5 flex items-center gap-1"
            style={{
              opacity: showGradientOnHover ? (showGradient ? 1 : 0) : 0,
              transform: showGradientOnHover ? (showGradient ? "scale(1)" : "scale(0.6)") : "scale(0.6)",
              transformOrigin: "right bottom",
              transition: showGradientOnHover
                ? `opacity ${HOVER_TRANSITION_MS}ms cubic-bezier(0.16, 1, 0.3, 1), transform ${HOVER_TRANSITION_MS}ms cubic-bezier(0.16, 1, 0.3, 1)`
                : "none",
            }}
          >
            <span
              className="text-2xl font-semibold leading-none tracking-tight drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]"
              style={{ color: RATING_COLOR_RGB }}
            >
              {formatRating(game.rating)}
            </span>

            {game.isFavorite && (
              <StarIcon
                className="h-[18px] w-[18px] drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]"
                style={{ color: FAVORITE_COLOR_RGB }}
              />
            )}
          </div>
        )}
      </div>

      <p
        className="mt-2 truncate text-sm font-medium"
        style={{ color: TITLE_COLOR_RGB }}
      >
        {game.title}
      </p>

      {showGradientOnHover ? (
        game.isCompleted && (
          <div className="relative mt-0.5 h-[18px]">
            {game.rating !== null && (
              <p
                className="absolute inset-0 flex items-center gap-1 text-xs font-semibold tabular-nums"
                style={{
                  color: getRatingColor(game.rating),
                  opacity: showGradient ? 0 : 1,
                  transform: showGradient ? "translateY(2px) scale(0.96)" : "translateY(0) scale(1)",
                  transition: `opacity ${STATUS_SWAP_TRANSITION_MS}ms cubic-bezier(0.16, 1, 0.3, 1), transform ${STATUS_SWAP_TRANSITION_MS}ms cubic-bezier(0.16, 1, 0.3, 1)`,
                }}
              >
                {formatRating(game.rating)}
              </p>
            )}
            <p
              className="absolute inset-0 flex items-center gap-1 text-xs font-medium"
              style={{
                color: game.rating !== null ? getRatingColor(game.rating) : COMPLETED_COLOR_RGB,
                opacity: showGradient ? STATUS_LABEL_OPACITY : 0,
                transform: showGradient ? "translateY(0) scale(1)" : "translateY(-2px) scale(0.96)",
                transition: `opacity ${STATUS_SWAP_TRANSITION_MS}ms cubic-bezier(0.16, 1, 0.3, 1), transform ${STATUS_SWAP_TRANSITION_MS}ms cubic-bezier(0.16, 1, 0.3, 1)`,
              }}
            >
              Completado
              <CheckIcon className="h-3 w-3" />
            </p>
          </div>
        )
      ) : (
        game.isPending && (
          <p
            className="mt-0.5 flex items-center gap-1 text-xs font-medium"
            style={{ color: PENDING_COLOR_RGB, opacity: STATUS_LABEL_OPACITY }}
          >
            Pendiente
            <ClockIcon className="h-3 w-3" />
          </p>
        )
      )}
    </Link>
  );
});

export default function GamesGrid({ games }: { games: GameItem[] }) {
  const [hovered, setHovered] = useState<GameItem | null>(null);
  const [layerA, setLayerA] = useState<Layer | null>(null);
  const [layerB, setLayerB] = useState<Layer | null>(null);
  const [activeLayer, setActiveLayer] = useState<"a" | "b">("a");
  const backdropRafRef = useRef<{ outer: number; inner: number } | null>(null);

  const backdropUrls = useMemo(() => games.map((g) => g.backdropUrl), [games]);
  usePreloadImages(backdropUrls);

  useEffect(() => {
    return () => {
      if (backdropRafRef.current) {
        cancelAnimationFrame(backdropRafRef.current.outer);
        cancelAnimationFrame(backdropRafRef.current.inner);
      }
    };
  }, []);

  const showBackdrop = useCallback((url: string) => {
    if (backdropRafRef.current) {
      cancelAnimationFrame(backdropRafRef.current.outer);
      cancelAnimationFrame(backdropRafRef.current.inner);
      backdropRafRef.current = null;
    }

    setActiveLayer((current) => {
      if (current === "a") {
        setLayerB({ url, visible: false });
        setLayerA((prev) => (prev ? { ...prev, visible: false } : prev));
        const outer = requestAnimationFrame(() => {
          const inner = requestAnimationFrame(() => {
            setLayerB((prev) => (prev && prev.url === url ? { ...prev, visible: true } : prev));
          });
          backdropRafRef.current = { outer, inner };
        });
        backdropRafRef.current = { outer, inner: outer };
        return "b";
      } else {
        setLayerA({ url, visible: false });
        setLayerB((prev) => (prev ? { ...prev, visible: false } : prev));
        const outer = requestAnimationFrame(() => {
          const inner = requestAnimationFrame(() => {
            setLayerA((prev) => (prev && prev.url === url ? { ...prev, visible: true } : prev));
          });
          backdropRafRef.current = { outer, inner };
        });
        backdropRafRef.current = { outer, inner: outer };
        return "a";
      }
    });
  }, []);

  const handleEnter = useCallback(
    (game: GameItem) => {
      setHovered(game);
      if (game.backdropUrl) {
        showBackdrop(game.backdropUrl);
      }
    },
    [showBackdrop]
  );

  const handleLeave = useCallback(() => {
    setHovered(null);
  }, []);

  const isVisible = Boolean(hovered?.backdropUrl);

  const [sortOrder, setSortOrder] = useState<SortOrder>("rating-desc");

  const completedGames = useMemo(() => {
    const filtered = games.filter((g) => g.isCompleted);
    if (sortOrder === "rating-desc") {
      return [...filtered].sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1));
    }
    if (sortOrder === "rating-asc") {
      return [...filtered].sort((a, b) => (a.rating ?? -1) - (b.rating ?? -1));
    }
    return filtered;
  }, [games, sortOrder]);

  const pendingGames = useMemo(() => games.filter((g) => g.isPending), [games]);

  return (
    <div className="relative">
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        style={{ backgroundColor: PAGE_BG_RGB }}
      >
        {layerA && (
          <img
            src={layerA.url}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            style={{
              filter: `blur(${BACKDROP_BLUR_PX}px)`,
              opacity: layerA.visible && isVisible ? 1 : 0,
              transition: `opacity ${BACKDROP_TRANSITION_MS}ms ease`,
            }}
          />
        )}
        {layerB && (
          <img
            src={layerB.url}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            style={{
              filter: `blur(${BACKDROP_BLUR_PX}px)`,
              opacity: layerB.visible && isVisible ? 1 : 0,
              transition: `opacity ${BACKDROP_TRANSITION_MS}ms ease`,
            }}
          />
        )}
        <div
          className="absolute inset-0"
          style={{ backgroundColor: "rgb(0, 0, 0)", opacity: BACKDROP_TINT_OPACITY }}
        />
      </div>

      {completedGames.length > 0 && (
        <section className="mb-12">
          <div className="flex items-center justify-between">
            <h2 className={SECTION_LABEL} style={{ color: SECTION_LABEL_COLOR_RGB }}>
              Completados
            </h2>
            <SortDropdown value={sortOrder} onChange={setSortOrder} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
            {completedGames.map((game, index) => (
              <GameCard
                key={game.id}
                game={game}
                index={index}
                showGradientOnHover
                isHovered={hovered?.id === game.id}
                onEnter={handleEnter}
                onLeave={handleLeave}
              />
            ))}
          </div>
        </section>
      )}

      {pendingGames.length > 0 && (
        <section>
          <h2 className={SECTION_LABEL} style={{ color: SECTION_LABEL_COLOR_RGB }}>
            Pendientes
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
            {pendingGames.map((game, index) => (
              <GameCard
                key={game.id}
                game={game}
                index={index}
                showGradientOnHover={false}
                isHovered={hovered?.id === game.id}
                onEnter={handleEnter}
                onLeave={handleLeave}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}