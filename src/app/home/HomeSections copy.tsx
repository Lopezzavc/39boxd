"use client";

import type { CSSProperties, MouseEvent, UIEvent } from "react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import LiquidGlass from "@/components/LiquidGlass";
import type { HomeContentType, HomeItem, HomeMediaType } from "./page";

const PAGE_BG_RGB = "rgb(6, 6, 6)";
const TITLE_COLOR_RGB = "rgb(240, 240, 240)";
const SUBTITLE_COLOR_RGB = "rgb(148, 148, 148)";
const SECTION_LABEL_COLOR_RGB = "rgb(235, 235, 235)";
const GROUP_LABEL_COLOR_RGB = "rgb(160, 160, 160)";
const PLACEHOLDER_BG_RGB = "rgb(28, 28, 28)";
const PLACEHOLDER_TEXT_RGB = "rgb(150, 150, 150)";
const EMPTY_TEXT_RGB = "rgb(105, 105, 105)";
const HERO_META_RGB = "rgb(210, 210, 210)";
const DIVIDER_RGB = "rgba(255, 255, 255, 0.1)";

const HOVER_GRADIENT_OPACITY = 0.95;
const HOVER_GRADIENT_HEIGHT_PERCENT = 55;
const HOVER_TRANSITION_MS = 350;

const CATEGORY_LABEL_RGB = "rgb(115, 115, 115)";
const FAVORITE_COLOR_RGB = "rgb(255, 218, 98)";

const CATEGORY_LABEL_BY_MEDIA_TYPE: Record<Exclude<HomeMediaType, "movie" | "series">, string> = {
  game: "Juego",
  album: "Álbum",
};

function resolveCategoryLabel(item: HomeItem): string {
  if (item.mediaType === "game" || item.mediaType === "album") {
    return CATEGORY_LABEL_BY_MEDIA_TYPE[item.mediaType];
  }
  const contentType: HomeContentType | null = item.contentType;
  if (contentType === "anime") return "Anime";
  if (contentType === "movie") return "Película";
  if (contentType === "tv_live_action" || contentType === "tv_animated") return "Serie";
  return item.mediaType === "series" ? "Serie" : "Película";
}

const COMPLETED_LABEL: Record<HomeMediaType, string> = {
  movie: "Visto",
  series: "Visto",
  game: "Completado",
  album: "Escuchado",
};

const STATUS_SWAP_TRANSITION_MS = 300;
const COMPLETED_COLOR_RGB = "rgb(101, 252, 109)";
const PENDING_COLOR_RGB = "rgb(255, 166, 64)";
const RATING_COLOR_RGB = "rgb(255, 255, 255)";

const RATING_COLOR_STOPS: { offset: number; rgb: string }[] = [
  { offset: 0, rgb: "rgb(255, 107, 87)" },
  { offset: 2.5, rgb: "rgb(255, 159, 64)" },
  { offset: 5, rgb: "rgb(246, 215, 70)" },
  { offset: 7.5, rgb: "rgb(180, 222, 76)" },
  { offset: 9.9, rgb: "rgb(114, 245, 96)" },
  { offset: 10, rgb: "rgb(84, 175, 250)" },
];

const MEDIA_TYPE_LABEL: Record<HomeMediaType, string> = {
  movie: "Película",
  series: "Serie",
  game: "Juego",
  album: "Álbum",
};

function parseRgb(rgb: string): [number, number, number] {
  const match = rgb.match(/\d+/g);
  const [r, g, b] = match ? match.map(Number) : [0, 0, 0];
  return [r ?? 0, g ?? 0, b ?? 0];
}

function getRatingColor(rating: number): string {
  const clamped = Math.min(10, Math.max(0, rating));
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
      return `rgb(${r}, ${g}, ${b})`;
    }
  }
  return RATING_COLOR_STOPS[RATING_COLOR_STOPS.length - 1]!.rgb;
}

function formatRating(rating: number): string {
  return rating === 10 ? "10" : rating.toFixed(1);
}

function hrefFor(item: HomeItem): string {
  if (item.mediaType === "game") return `/games/${item.externalId}`;
  if (item.mediaType === "series") return `/movies/${item.externalId}?type=tv`;
  if (item.mediaType === "movie") return `/movies/${item.externalId}`;
  return `/music/${item.externalId}`;
}

const GROUP_ORDER: HomeMediaType[] = ["movie", "series", "game", "album"];
const GROUP_LABELS: Record<HomeMediaType, string> = {
  movie: "Películas",
  series: "Series",
  game: "Juegos",
  album: "Música",
};

type GroupKey = HomeMediaType | "screen";

const SCREEN_LABEL = "Películas, Series y Animes";
const MERGED_GROUP_ORDER: GroupKey[] = ["game", "screen", "album"];

function groupByMediaType(
  items: HomeItem[],
  limit?: number,
  sortByRating?: boolean
): { type: HomeMediaType; items: HomeItem[] }[] {
  return GROUP_ORDER.map((type) => {
    let filtered = items.filter((i) => i.mediaType === type);
    if (sortByRating) {
      filtered = [...filtered].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    }
    return { type, items: limit ? filtered.slice(0, limit) : filtered };
  }).filter((g) => g.items.length > 0);
}

function groupByMediaTypeMerged(
  items: HomeItem[],
  limit?: number
): { key: GroupKey; label: string; items: HomeItem[] }[] {
  return MERGED_GROUP_ORDER.map((key) => {
    const filtered =
      key === "screen"
        ? items.filter((i) => i.mediaType === "movie" || i.mediaType === "series")
        : items.filter((i) => i.mediaType === key);
    const label = key === "screen" ? SCREEN_LABEL : GROUP_LABELS[key as HomeMediaType];
    return { key, label, items: limit ? filtered.slice(0, limit) : filtered };
  }).filter((g) => g.items.length > 0);
}

type ScreenTypeFilter = "movie" | "anime" | "series";

function matchesTypeFilter(contentType: HomeContentType | null, filter: ScreenTypeFilter): boolean {
  if (filter === "movie") return contentType === "movie";
  if (filter === "anime") return contentType === "anime";
  return contentType === "tv_live_action" || contentType === "tv_animated";
}

type SplitGroupKey = "game" | "movie" | "anime" | "series" | "album";

const SPLIT_GROUP_ORDER: SplitGroupKey[] = ["game", "movie", "anime", "series", "album"];
const SPLIT_GROUP_LABELS: Record<SplitGroupKey, string> = {
  game: "Juegos",
  movie: "Películas",
  anime: "Animes",
  series: "Series",
  album: "Música",
};

function groupByMediaTypeSplitScreen(
  items: HomeItem[],
  limit?: number,
  sortByRating?: boolean
): { key: SplitGroupKey; label: string; items: HomeItem[] }[] {
  return SPLIT_GROUP_ORDER.map((key) => {
    let filtered: HomeItem[];
    if (key === "game" || key === "album") {
      filtered = items.filter((i) => i.mediaType === key);
    } else {
      filtered = items.filter(
        (i) =>
          (i.mediaType === "movie" || i.mediaType === "series") &&
          matchesTypeFilter(i.contentType, key)
      );
    }
    if (sortByRating) {
      filtered = [...filtered].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    }
    return { key, label: SPLIT_GROUP_LABELS[key], items: limit ? filtered.slice(0, limit) : filtered };
  }).filter((g) => g.items.length > 0);
}

function usePreloadImages(urls: (string | null)[]) {
  useEffect(() => {
    const unique = Array.from(new Set(urls.filter((u): u is string => !!u)));
    unique.forEach((src) => {
      const img = new window.Image();
      img.src = src;
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

const ItemCard = memo(function ItemCard({
  item,
  index,
  showRating,
}: {
  item: HomeItem;
  index: number;
  showRating: boolean;
}) {
  const isAlbum = item.mediaType === "album";
  const width = isAlbum ? 168 : 156;

  return (
    <Link
      href={hrefFor(item)}
      className={`group relative block shrink-0 select-none ${isAlbum ? "self-end" : ""}`}
      style={{ width }}
    >
      <div
        className={`relative overflow-hidden rounded-2xl ${isAlbum ? "aspect-square" : "aspect-[2/3]"}`}
        style={{ backgroundColor: PLACEHOLDER_BG_RGB }}
      >
        {item.coverUrl ? (
          <Image
            src={item.coverUrl}
            alt={item.title}
            fill
            priority={index === 0}
            sizes="168px"
            className="object-cover"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center px-2 text-center text-xs"
            style={{ color: PLACEHOLDER_TEXT_RGB }}
          >
            {item.title}
          </div>
        )}

        {showRating && (
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 opacity-0 transition-opacity group-hover:opacity-100"
            style={{
              height: `${HOVER_GRADIENT_HEIGHT_PERCENT}%`,
              transitionDuration: `${HOVER_TRANSITION_MS}ms`,
              transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
              background: `linear-gradient(to top, rgba(0,0,0,${HOVER_GRADIENT_OPACITY}), rgba(0,0,0,0))`,
            }}
          />
        )}

        {showRating && item.rating !== null && (
          <div
            className="absolute bottom-2 right-2.5 flex origin-bottom-right scale-[0.6] items-center gap-1 opacity-0 transition-all group-hover:scale-100 group-hover:opacity-100"
            style={{
              transitionDuration: `${HOVER_TRANSITION_MS}ms`,
              transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            <span
              className="text-2xl font-semibold leading-none tracking-tight drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]"
              style={{ color: RATING_COLOR_RGB }}
            >
              {formatRating(item.rating)}
            </span>

            {item.isFavorite && (
              <StarIcon
                className="h-[18px] w-[18px] drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]"
                style={{ color: FAVORITE_COLOR_RGB }}
              />
            )}
          </div>
        )}
      </div>

      <p className="mt-2.5 truncate text-[13px] font-medium" style={{ color: TITLE_COLOR_RGB }}>
        {item.title}
      </p>

      {showRating ? (
        <div className="relative mt-0.5 h-[18px]">
          <p
            className="absolute inset-0 flex translate-y-0 scale-100 items-center justify-between text-xs font-medium opacity-100 transition-all group-hover:translate-y-[2px] group-hover:scale-[0.96] group-hover:opacity-0"
            style={{
              transitionDuration: `${STATUS_SWAP_TRANSITION_MS}ms`,
              transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            <span style={{ color: CATEGORY_LABEL_RGB }}>{resolveCategoryLabel(item)}</span>
            {item.rating !== null && (
              <span className="tabular-nums" style={{ color: getRatingColor(item.rating) }}>
                {formatRating(item.rating)}
              </span>
            )}
          </p>
          <p
            className="absolute inset-0 flex -translate-y-[2px] scale-[0.96] items-center gap-1 text-xs font-medium opacity-0 transition-all group-hover:translate-y-0 group-hover:scale-100 group-hover:opacity-100"
            style={{
              color: item.rating !== null ? getRatingColor(item.rating) : COMPLETED_COLOR_RGB,
              transitionDuration: `${STATUS_SWAP_TRANSITION_MS}ms`,
              transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            {COMPLETED_LABEL[item.mediaType]}
            <CheckIcon className="h-3 w-3" />
          </p>
        </div>
      ) : (
        <p className="mt-0.5 flex items-center gap-1 text-xs font-medium" style={{ color: PENDING_COLOR_RGB }}>
          {resolveCategoryLabel(item)} pendiente
          <ClockIcon className="h-3 w-3" />
        </p>
      )}
    </Link>
  );
});

const FADE_MAX_WIDTH = 64;

function MediaRow({
  label,
  items,
  showRating,
}: {
  label: string;
  items: HomeItem[];
  showRating: boolean;
}) {
  const [fadeLeftOffset, setFadeLeftOffset] = useState(-FADE_MAX_WIDTH);
  const [fadeRightOffset, setFadeRightOffset] = useState(FADE_MAX_WIDTH);
  const [hasOverflow, setHasOverflow] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [thumb, setThumb] = useState({ widthPct: 100, leftPct: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ startX: number; startScrollLeft: number } | null>(null);

  const updateFadeVisibility = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const overflow = el.scrollWidth > el.clientWidth + 1;
    setHasOverflow(overflow);

    if (!overflow) {
      setFadeLeftOffset(-FADE_MAX_WIDTH);
      setFadeRightOffset(FADE_MAX_WIDTH);
      return;
    }

    const maxScroll = el.scrollWidth - el.clientWidth;
    const distFromStart = el.scrollLeft;
    const distFromEnd = maxScroll - el.scrollLeft;

    const leftProgress = Math.max(0, Math.min(1, distFromStart / FADE_MAX_WIDTH));
    const rightProgress = Math.max(0, Math.min(1, distFromEnd / FADE_MAX_WIDTH));

    setFadeLeftOffset(-FADE_MAX_WIDTH * (1 - leftProgress));
    setFadeRightOffset(FADE_MAX_WIDTH * (1 - rightProgress));
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
    const el = scrollRef.current;
    if (!el) return;

    updateFadeVisibility();
    updateThumb();

    const raf = requestAnimationFrame(() => {
      updateFadeVisibility();
      updateThumb();
    });

    const handleResize = () => {
      updateFadeVisibility();
      updateThumb();
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(el);
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      window.removeEventListener("resize", handleResize);
    };
  }, [updateFadeVisibility, updateThumb, items]);

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
    <div>
      {label && (
        <div className="mb-3.5 flex items-center gap-2">
          <span className="h-3 w-[3px] rounded-full" style={{ backgroundColor: GROUP_LABEL_COLOR_RGB }} />
          <h3 className="text-[13px] font-semibold uppercase tracking-[0.06em]" style={{ color: GROUP_LABEL_COLOR_RGB }}>
            {label}
          </h3>
        </div>
      )}

      <div className="relative">
        <div className="relative overflow-hidden">
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="flex items-end gap-5 overflow-x-auto px-1 pb-3 pt-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          >
            {items.map((item, index) => (
              <ItemCard key={item.id} item={item} index={index} showRating={showRating} />
            ))}
          </div>

          <div
            aria-hidden
            className="pointer-events-none absolute left-0 top-0 h-full transition-transform duration-150 ease-out"
            style={{
              width: FADE_MAX_WIDTH,
              transform: `translateX(${fadeLeftOffset}px)`,
              background: `linear-gradient(to right, ${PAGE_BG_RGB}, transparent)`,
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute right-0 top-0 h-full transition-transform duration-150 ease-out"
            style={{
              width: FADE_MAX_WIDTH,
              transform: `translateX(${fadeRightOffset}px)`,
              background: `linear-gradient(to left, ${PAGE_BG_RGB}, transparent)`,
            }}
          />
        </div>

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
    </div>
  );
}

function Hero({ item, contextLabel }: { item: HomeItem; contextLabel: string }) {
  const backgroundUrl = item.backdropUrl ?? item.coverUrl;
  return (
    <Link href={hrefFor(item)} className="group relative block overflow-hidden rounded-[28px]">
      <div className="relative aspect-[21/9] w-full sm:aspect-[3/1]" style={{ backgroundColor: PLACEHOLDER_BG_RGB }}>
        {backgroundUrl && (
          <Image
            src={backgroundUrl}
            alt={item.title}
            fill
            priority
            sizes="1400px"
            className={item.mediaType === "album" ? "object-cover blur-2xl scale-110 opacity-70" : "object-cover"}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-black/10" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-transparent to-transparent" />

        {item.mediaType === "album" && item.coverUrl && (
          <div className="absolute bottom-6 left-6 h-28 w-28 overflow-hidden rounded-xl shadow-2xl ring-1 ring-white/10 sm:h-36 sm:w-36">
            <Image src={item.coverUrl} alt="" fill sizes="144px" className="object-cover" />
          </div>
        )}

        <div className="absolute inset-x-6 bottom-6 sm:inset-x-8 sm:bottom-8">
          <LiquidGlass
            width="fit-content"
            height="auto"
            borderRadius={20}
            surfaceType="convex_squircle"
            bezelWidth={22}
            glassThickness={44}
            refractiveIndex={1.5}
            refractionScale={1.6}
            specularOpacity={0.3}
            blur={1.6}
            tintColor="rgb(20, 20, 20)"
            tintOpacity={0.42}
            className={item.mediaType === "album" ? "!p-0 ml-32 sm:ml-40" : "!p-0"}
          >
            <div className="px-6 py-4 sm:px-7 sm:py-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: SUBTITLE_COLOR_RGB }}>
                {MEDIA_TYPE_LABEL[item.mediaType]} · {contextLabel}
              </p>
              <h2
                className="mt-1 max-w-xl text-2xl font-semibold leading-[1.05] tracking-[-0.02em] sm:text-3xl"
                style={{ color: TITLE_COLOR_RGB }}
              >
                {item.title}
              </h2>
              {item.rating !== null && (
                <p className="mt-2 text-lg font-semibold tabular-nums" style={{ color: getRatingColor(item.rating) }}>
                  {formatRating(item.rating)}
                  <span className="ml-1 text-sm font-medium" style={{ color: HERO_META_RGB }}>
                    / 10
                  </span>
                </p>
              )}
            </div>
          </LiquidGlass>
        </div>
      </div>
    </Link>
  );
}

function Section({
  label,
  description,
  items,
  showRating,
  emptyMessage,
  heroItem,
  showDivider,
  railLimit,
  railSortByRating,
  mergeScreenTypes,
  splitScreenTypes,
  singleRow,
  singleRowLabel,
}: {
  label: string;
  description: string;
  items: HomeItem[];
  showRating: boolean;
  emptyMessage: string;
  heroItem?: HomeItem;
  showDivider?: boolean;
  railLimit?: number;
  railSortByRating?: boolean;
  mergeScreenTypes?: boolean;
  splitScreenTypes?: boolean;
  singleRow?: boolean;
  singleRowLabel?: string;
}) {
  const railItems = heroItem ? items.filter((i) => i.id !== heroItem.id) : items;

  const mergedGroups = useMemo(
    () => (mergeScreenTypes ? groupByMediaTypeMerged(railItems, railLimit) : null),
    [railItems, railLimit, mergeScreenTypes]
  );
  const splitGroups = useMemo(
    () =>
      splitScreenTypes
        ? groupByMediaTypeSplitScreen(railItems, railLimit, railSortByRating)
        : null,
    [railItems, railLimit, railSortByRating, splitScreenTypes]
  );
  const plainGroups = useMemo(
    () =>
      mergeScreenTypes || splitScreenTypes || singleRow
        ? null
        : groupByMediaType(railItems, railLimit, railSortByRating),
    [railItems, railLimit, railSortByRating, mergeScreenTypes, splitScreenTypes, singleRow]
  );

  const rows = singleRow
    ? [{ key: "all", label: singleRowLabel ?? "", items: railLimit ? railItems.slice(0, railLimit) : railItems }]
    : mergedGroups
      ? mergedGroups.map((g) => ({ key: g.key, label: g.label, items: g.items }))
      : splitGroups
        ? splitGroups.map((g) => ({ key: g.key, label: g.label, items: g.items }))
        : (plainGroups ?? []).map((g) => ({ key: g.type, label: GROUP_LABELS[g.type], items: g.items }));

  return (
    <section>
      <div className="px-5">
        {showDivider && <div className="mb-8 mt-10 h-px w-full" style={{ backgroundColor: DIVIDER_RGB }} />}
      </div>

      <div className="mb-7 px-0">
        <h2 className="text-[32px] font-bold tracking-[-0.025em]" style={{ color: SECTION_LABEL_COLOR_RGB }}>
          {label}
        </h2>
        <p className="mt-0 text-[14px] leading-snug" style={{ color: SUBTITLE_COLOR_RGB }}>
          {description}
        </p>
      </div>

      {items.length > 0 ? (
        <div className="space-y-8">
          {rows.length > 0 && (
            <div className="space-y-9">
              {rows.map((row) => (
                <MediaRow key={row.key} label={row.label} items={row.items} showRating={showRating} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <p className="px-1 text-sm" style={{ color: EMPTY_TEXT_RGB }}>
          {emptyMessage}
        </p>
      )}
    </section>
  );
}

export default function HomeSections({
  wishlist,
  recent,
  favorites,
}: {
  wishlist: HomeItem[];
  recent: HomeItem[];
  favorites: HomeItem[];
}) {
  const preloadUrls = useMemo(
    () => [...wishlist, ...recent, ...favorites].map((i) => i.coverUrl),
    [wishlist, recent, favorites]
  );
  usePreloadImages(preloadUrls);

  const heroItem = wishlist.find((i) => i.mediaType !== "album");

  return (
    <div className="relative min-h-screen" style={{ backgroundColor: PAGE_BG_RGB }}>
      <div className="container mx-auto max-w-[1400px] px-6 pb-24 pt-8 sm:px-10">
        <div className="space-y-5">
          <div className="pt-0">
            {heroItem && <Hero item={heroItem} contextLabel="Pendiente" />}
          </div>

          <Section
            label="Calificados recientemente"
            description="Lo último que terminaste y puntuaste."
            items={recent}
            showRating
            emptyMessage="Todavía no has calificado nada."
            railLimit={20}
            mergeScreenTypes
          />

          <Section
            label="Pendientes"
            description="Lo que tienes en cola para ver, jugar o escuchar."
            items={wishlist}
            showRating={false}
            emptyMessage="No tienes nada pendiente por ahora."
            showDivider
            singleRow
            railLimit={20}
          />

          <Section
            label="Favoritos"
            description="Tus obras mejor puntuadas y marcadas como favoritas."
            items={favorites}
            showRating
            emptyMessage="Aún no tienes favoritos marcados."
            showDivider
            railLimit={10}
            railSortByRating
            splitScreenTypes
          />
        </div>
      </div>
    </div>
  );
}