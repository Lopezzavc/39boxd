"use client";

import { useCallback, useMemo, useState } from "react";
import { LiquidGlass } from "@/components/liquid-glass";
import { saveGameEntry, updateFavorite } from "@/lib/actions/game-entry";
import type { MediaStatus } from "@/types/media";

function IconStar({ filled }: { filled: boolean }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round">
      <path d="M12 3.5l2.6 5.4 5.9.7-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.6l5.9-.7L12 3.5z" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function IconClock() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  );
}

const FAVORITE_TEXT_ACTIVE_RGB = "rgb(228, 255, 106)";
const FAVORITE_TEXT_INACTIVE_RGB = "rgb(163, 163, 163)";
const FAVORITE_TEXT_HOVER_RGB = "rgb(229, 229, 229)";
const FAVORITE_RING_ACTIVE = "ring-1 ring-[#c9a15b]/25";
const FAVORITE_RING_INACTIVE = "ring-1 ring-white/[0.08] hover:ring-white/[0.14]";
const FAVORITE_TINT_ACTIVE = "rgb(40, 40, 40)";
const FAVORITE_TINT_INACTIVE = "rgb(40, 40, 40)";
const FAVORITE_TINT_OPACITY_ACTIVE = 0.5;
const FAVORITE_TINT_OPACITY_INACTIVE = 0.5;

const WATCHED_TEXT_ACTIVE_RGB = "rgb(101, 252, 109)";
const WATCHED_TEXT_INACTIVE_RGB = "rgb(163, 163, 163)";
const WATCHED_TEXT_HOVER_RGB = "rgb(229, 229, 229)";
const WATCHED_RING_ACTIVE = "ring-1 ring-[#6fae7c]/25";
const WATCHED_RING_INACTIVE = "ring-1 ring-white/[0.08] hover:ring-white/[0.14]";
const WATCHED_TINT_ACTIVE = "rgb(40, 40, 40)";
const WATCHED_TINT_INACTIVE = "rgb(40, 40, 40)";
const WATCHED_TINT_OPACITY_ACTIVE = 0.5;
const WATCHED_TINT_OPACITY_INACTIVE = 0.5;

const PENDING_TEXT_ACTIVE_RGB = "rgb(255, 166, 64)";
const PENDING_TEXT_INACTIVE_RGB = "rgb(163, 163, 163)";
const PENDING_TEXT_HOVER_RGB = "rgb(229, 229, 229)";
const PENDING_RING_ACTIVE = "ring-1 ring-[#5b9ac9]/25";
const PENDING_RING_INACTIVE = "ring-1 ring-white/[0.08] hover:ring-white/[0.14]";
const PENDING_TINT_ACTIVE = "rgb(40, 40, 40)";
const PENDING_TINT_INACTIVE = "rgb(40, 40, 40)";
const PENDING_TINT_OPACITY_ACTIVE = 0.5;
const PENDING_TINT_OPACITY_INACTIVE = 0.5;

const FAVORITE_GLOW_BLUR_PX = 8;
const FAVORITE_GLOW_ALPHA = 0.3;
const WATCHED_GLOW_BLUR_PX = 8;
const WATCHED_GLOW_ALPHA = 0.3;
const PENDING_GLOW_BLUR_PX = 8;
const PENDING_GLOW_ALPHA = 0.3;

function toGlowShadow(rgb: string, blurPx: number, alpha: number) {
  const channels = rgb.replace("rgb(", "").replace(")", "");
  return [
    `0 0 ${blurPx}px rgba(${channels}, ${alpha})`,
    `0 0 ${blurPx * 2}px rgba(${channels}, ${alpha * 0.6})`,
    `0 0 ${blurPx * 3}px rgba(${channels}, ${alpha * 0.35})`,
  ].join(", ");
}

type GameActionButtonsProps = {
  initialFavorite: boolean;
  initialWatched: boolean;
  initialPending?: boolean;
  igdbId: string;
  title: string;
  releaseDate: string | null;
  coverUrl: string | null;
  backdropUrl: string | null;
  synopsis: string | null;
  rating: number | null;
};

export default function GameActionButtons({
  initialFavorite,
  initialWatched,
  initialPending,
  igdbId,
  title,
  releaseDate,
  coverUrl,
  backdropUrl,
  synopsis,
  rating,
}: GameActionButtonsProps) {
  const [favorite, setFavorite] = useState(initialFavorite);
  const [watched, setWatched] = useState(initialWatched);
  const [pending, setPending] = useState(initialPending ?? false);

  const persistStatus = useCallback(
    async (next: { watched: boolean; pending: boolean }) => {
      const status: MediaStatus = next.watched ? "completed" : "backlog";
      const ratingToSave = next.watched ? rating : null;

      try {
        await saveGameEntry({
          igdbId,
          title,
          releaseDate,
          coverUrl,
          backdropUrl,
          synopsis,
          status,
          rating: ratingToSave,
        });
      } catch (err) {
        console.error("Failed to save game entry", err);
      }
    },
    [igdbId, title, releaseDate, coverUrl, backdropUrl, synopsis, rating]
  );

  const persistFavorite = useCallback(
    async (next: boolean) => {
      try {
        await updateFavorite(igdbId, next);
      } catch (err) {
        console.error("Failed to update favorite", err);
      }
    },
    [igdbId]
  );

  const handleFavoriteClick = useCallback(() => {
    const next = !favorite;
    setFavorite(next);
    persistFavorite(next);
  }, [favorite, persistFavorite]);

  // FIX: Ya no anidamos setState dentro de otro updater function.
  // Calculamos los próximos valores primero (usando el estado actual del
  // closure), actualizamos ambos estados, y SOLO DESPUÉS llamamos a
  // persistStatus como efecto colateral normal del click handler.
  const handleWatchedClick = useCallback(() => {
    const nextWatched = !watched;
    const nextPending = nextWatched ? false : pending;

    setWatched(nextWatched);
    setPending(nextPending);
    persistStatus({ watched: nextWatched, pending: nextPending });
  }, [watched, pending, persistStatus]);

  const handlePendingClick = useCallback(() => {
    const nextPending = !pending;
    const nextWatched = nextPending ? false : watched;

    setPending(nextPending);
    setWatched(nextWatched);
    persistStatus({ watched: nextWatched, pending: nextPending });
  }, [watched, pending, persistStatus]);

  const favoriteColor = favorite ? FAVORITE_TEXT_ACTIVE_RGB : FAVORITE_TEXT_INACTIVE_RGB;
  const watchedColor = watched ? WATCHED_TEXT_ACTIVE_RGB : WATCHED_TEXT_INACTIVE_RGB;
  const pendingColor = pending ? PENDING_TEXT_ACTIVE_RGB : PENDING_TEXT_INACTIVE_RGB;

  const favoriteShadow = useMemo(
    () => (favorite ? toGlowShadow(FAVORITE_TEXT_ACTIVE_RGB, FAVORITE_GLOW_BLUR_PX, FAVORITE_GLOW_ALPHA) : "none"),
    [favorite]
  );
  const watchedShadow = useMemo(
    () => (watched ? toGlowShadow(WATCHED_TEXT_ACTIVE_RGB, WATCHED_GLOW_BLUR_PX, WATCHED_GLOW_ALPHA) : "none"),
    [watched]
  );
  const pendingShadow = useMemo(
    () => (pending ? toGlowShadow(PENDING_TEXT_ACTIVE_RGB, PENDING_GLOW_BLUR_PX, PENDING_GLOW_ALPHA) : "none"),
    [pending]
  );

  const handleFavoriteMouseEnter = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      if (!favorite) e.currentTarget.style.color = FAVORITE_TEXT_HOVER_RGB;
    },
    [favorite]
  );
  const handleFavoriteMouseLeave = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      if (!favorite) e.currentTarget.style.color = FAVORITE_TEXT_INACTIVE_RGB;
    },
    [favorite]
  );

  const handleWatchedMouseEnter = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      if (!watched) e.currentTarget.style.color = WATCHED_TEXT_HOVER_RGB;
    },
    [watched]
  );
  const handleWatchedMouseLeave = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      if (!watched) e.currentTarget.style.color = WATCHED_TEXT_INACTIVE_RGB;
    },
    [watched]
  );

  const handlePendingMouseEnter = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      if (!pending) e.currentTarget.style.color = PENDING_TEXT_HOVER_RGB;
    },
    [pending]
  );
  const handlePendingMouseLeave = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      if (!pending) e.currentTarget.style.color = PENDING_TEXT_INACTIVE_RGB;
    },
    [pending]
  );

  return (
    <>
      <div className="relative" style={{ width: "fit-content" }}>
        {favorite && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 px-4 text-[13px] font-medium"
            style={{ color: FAVORITE_TEXT_ACTIVE_RGB, zIndex: 0 }}
          >
            <IconStar filled={false} />
            Favorito
          </div>
        )}

        <LiquidGlass
          width="fit-content"
          height={40}
          borderRadius={20}
          surfaceType="convex_squircle"
          bezelWidth={20}
          glassThickness={44}
          refractiveIndex={1.5}
          refractionScale={1.5}
          specularOpacity={0.3}
          blur={1.5}
          tintColor={favorite ? FAVORITE_TINT_ACTIVE : FAVORITE_TINT_INACTIVE}
          tintOpacity={favorite ? FAVORITE_TINT_OPACITY_ACTIVE : FAVORITE_TINT_OPACITY_INACTIVE}
          className="!p-0 relative z-[1] transition-transform duration-150 ease-out active:scale-[0.96]"
        >
          <button
            type="button"
            onClick={handleFavoriteClick}
            aria-pressed={favorite}
            style={{
              color: favoriteColor,
              textShadow: favoriteShadow,
              transition: "color 150ms ease, text-shadow 250ms ease",
            }}
            onMouseEnter={handleFavoriteMouseEnter}
            onMouseLeave={handleFavoriteMouseLeave}
            className={`flex h-full w-full items-center justify-center gap-2 px-4 text-[13px] font-medium transition-colors ${
              favorite ? FAVORITE_RING_ACTIVE : FAVORITE_RING_INACTIVE
            }`}
          >
            <IconStar filled={favorite} />
            Favorito
          </button>
        </LiquidGlass>
      </div>

      <div className="relative" style={{ width: "fit-content" }}>
        {watched && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 px-4 text-[13px] font-medium"
            style={{ color: WATCHED_TEXT_ACTIVE_RGB, zIndex: 0 }}
          >
            <IconCheck />
            Completado
          </div>
        )}

        <LiquidGlass
          width="fit-content"
          height={40}
          borderRadius={20}
          surfaceType="convex_squircle"
          bezelWidth={20}
          glassThickness={44}
          refractiveIndex={1.5}
          refractionScale={1.5}
          specularOpacity={0.3}
          blur={1.5}
          tintColor={watched ? WATCHED_TINT_ACTIVE : WATCHED_TINT_INACTIVE}
          tintOpacity={watched ? WATCHED_TINT_OPACITY_ACTIVE : WATCHED_TINT_OPACITY_INACTIVE}
          className="!p-0 relative z-[1] transition-transform duration-150 ease-out active:scale-[0.96]"
        >
          <button
            type="button"
            onClick={handleWatchedClick}
            aria-pressed={watched}
            style={{
              color: watchedColor,
              textShadow: watchedShadow,
              transition: "color 150ms ease, text-shadow 250ms ease",
            }}
            onMouseEnter={handleWatchedMouseEnter}
            onMouseLeave={handleWatchedMouseLeave}
            className={`flex h-full w-full items-center justify-center gap-2 px-4 text-[13px] font-medium transition-colors ${
              watched ? WATCHED_RING_ACTIVE : WATCHED_RING_INACTIVE
            }`}
          >
            <IconCheck />
            Completado
          </button>
        </LiquidGlass>
      </div>

      <div className="relative" style={{ width: "fit-content" }}>
        {pending && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 px-4 text-[13px] font-medium"
            style={{ color: PENDING_TEXT_ACTIVE_RGB, zIndex: 0 }}
          >
            <IconClock />
            Pendiente
          </div>
        )}

        <LiquidGlass
          width="fit-content"
          height={40}
          borderRadius={20}
          surfaceType="convex_squircle"
          bezelWidth={20}
          glassThickness={44}
          refractiveIndex={1.5}
          refractionScale={1.5}
          specularOpacity={0.3}
          blur={1.5}
          tintColor={pending ? PENDING_TINT_ACTIVE : PENDING_TINT_INACTIVE}
          tintOpacity={pending ? PENDING_TINT_OPACITY_ACTIVE : PENDING_TINT_OPACITY_INACTIVE}
          className="!p-0 relative z-[1] transition-transform duration-150 ease-out active:scale-[0.96]"
        >
          <button
            type="button"
            onClick={handlePendingClick}
            aria-pressed={pending}
            style={{
              color: pendingColor,
              textShadow: pendingShadow,
              transition: "color 150ms ease, text-shadow 250ms ease",
            }}
            onMouseEnter={handlePendingMouseEnter}
            onMouseLeave={handlePendingMouseLeave}
            className={`flex h-full w-full items-center justify-center gap-2 px-4 text-[13px] font-medium transition-colors ${
              pending ? PENDING_RING_ACTIVE : PENDING_RING_INACTIVE
            }`}
          >
            <IconClock />
            Pendiente
          </button>
        </LiquidGlass>
      </div>
    </>
  );
}