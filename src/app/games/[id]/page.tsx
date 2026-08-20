import { notFound } from "next/navigation";
import { LiquidGlass } from "@/components/liquid-glass";
import { createAdminClient } from "@/lib/supabase/admin";
import { saveGameEntry } from "@/lib/actions/game-entry";
import { getIgdbGameById, getIgdbTimeToBeat } from "@/lib/igdb/search";
import type { IgdbGame } from "@/lib/igdb/types";
import MovieGallery from "../../movies/[id]/MovieGallery";
import KeycapButton from "./IgdbKeycapButton";
import RatingGauge from "../../movies/[id]/RatingGauge";
import GameActionButtons from "./GameActionButtons";

const USER_ID = "00000000-0000-0000-0000-000000000000";

const LABEL = "text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500";

const IGDB_IMG_BASE = "https://images.igdb.com/igdb/image/upload";

type Game = {
  title: string;
  year: number | undefined;
  developer: string;
  publisher: string;
  platforms: string[];
  genres: string[];
  synopsis: string;
  cover: string;
  coverUrl: string | null;
  backdrop: string;
  releaseDate: string;
  releaseDateRaw: string | null;
  gallery: string[];
  communityRating: number;
  personalRating: number | null;
  favorite: boolean;
  watched: boolean;
  pending: boolean;
  dateAdded: string | null;
  dateWatched: string | null;
};

function igdbImageUrl(url: string | undefined, size: string): string | null {
  if (!url) return null;
  const path = url.replace("//images.igdb.com/igdb/image/upload/", "").replace(/^t_[a-z0-9_]+\//, "");
  return `${IGDB_IMG_BASE}/${size}/${path}`;
}

function formatReleaseDate(timestamp?: number): string {
  if (!timestamp) return "N/D";
  try {
    return new Intl.DateTimeFormat("es", { day: "numeric", month: "long", year: "numeric" }).format(
      new Date(timestamp * 1000)
    );
  } catch {
    return "N/D";
  }
}

function formatSimpleDate(dateStr?: string | null): string | null {
  if (!dateStr) return null;
  try {
    return new Intl.DateTimeFormat("es", { day: "numeric", month: "long", year: "numeric" }).format(
      new Date(dateStr)
    );
  } catch {
    return dateStr;
  }
}

function formatHours(seconds?: number): string | null {
  if (!seconds) return null;
  const hours = seconds / 3600;
  return `${hours % 1 === 0 ? hours.toFixed(0) : hours.toFixed(1)}h`;
}

function mapIgdbToGame(data: IgdbGame): Game {
  const developer =
    data.involved_companies?.find((c) => c.developer)?.company.name || "Desconocido";
  const publisher =
    data.involved_companies?.find((c) => c.publisher)?.company.name || "N/D";

  const platforms: string[] = (data.platforms || []).map((p) => p.name);
  const genres: string[] = (data.genres || []).map((g) => g.name);

  const coverUrl = igdbImageUrl(data.cover?.url, "t_1080p");
  const releaseDateRaw = data.first_release_date
    ? new Date(data.first_release_date * 1000).toISOString().slice(0, 10)
    : null;

  const artworks = data.artworks || [];
  const keyArtNoLogo = artworks.find((a) => a.image_type?.name === "Key art without logo");
  const keyArtWithLogo = artworks.find((a) => a.image_type?.name === "Key art with logo");
  const genericArtworksLandscape = artworks.filter(
    (a) => a.image_type?.name === "Artwork" && a.width > a.height
  );
  const randomGenericArtwork = genericArtworksLandscape.length
    ? genericArtworksLandscape[Math.floor(Math.random() * genericArtworksLandscape.length)]
    : undefined;
  const screenshotUrls = (data.screenshots || [])
    .slice(0, 4)
    .map((s) => igdbImageUrl(s.url, "t_1080p"))
    .filter((url): url is string => url !== null);

  const chosenBackdrop = keyArtNoLogo || keyArtWithLogo || randomGenericArtwork || null;
  const randomScreenshot = screenshotUrls.length
    ? screenshotUrls[Math.floor(Math.random() * screenshotUrls.length)]
    : undefined;
  const backdropUrl = chosenBackdrop
    ? igdbImageUrl(chosenBackdrop.url, "t_1080p")
    : randomScreenshot || coverUrl;

  return {
    title: data.name || "Sin título",
    year: data.first_release_date
      ? new Date(data.first_release_date * 1000).getFullYear()
      : undefined,
    developer,
    publisher,
    platforms: platforms.length ? platforms : ["N/D"],
    genres: genres.length ? genres : ["N/D"],
    synopsis: data.summary || "Sin sinopsis disponible.",
    cover: coverUrl || "/assets/no-poster.png",
    coverUrl,
    backdrop: backdropUrl || "/assets/no-backdrop.png",
    releaseDate: formatReleaseDate(data.first_release_date),
    releaseDateRaw,
    gallery: screenshotUrls,
    communityRating: data.total_rating || 0,
    personalRating: null,
    favorite: false,
    watched: false,
    pending: false,
    dateAdded: null,
    dateWatched: null,
  };
}

export default async function GameDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getIgdbGameById(Number(id));
  if (!data) notFound();

  const game = mapIgdbToGame(data);

  try {
    const admin = createAdminClient();
    const { data: mediaRow } = await admin
      .from("media")
      .select("id")
      .eq("external_source", "igdb")
      .eq("external_id", id)
      .maybeSingle();

    if (mediaRow?.id) {
      const { data: entry } = await admin
        .from("user_media_entries")
        .select("rating, is_favorite, status, created_at, finished_at")
        .eq("media_id", mediaRow.id)
        .eq("user_id", USER_ID)
        .maybeSingle();

      if (entry) {
        game.personalRating = entry.rating !== null && entry.rating !== undefined ? Number(entry.rating) : null;
        game.favorite = entry.is_favorite ?? false;
        game.watched = entry.status === "completed";
        game.pending = entry.status === "backlog";
        game.dateAdded = formatSimpleDate(entry.created_at);
        game.dateWatched = formatSimpleDate(entry.finished_at);
      }
    }
  } catch {
    // Si falla la carga de la entrada, se continúa con los valores por defecto.
  }

  const timeToBeat = await getIgdbTimeToBeat(Number(id)).catch(() => undefined);

  const timeToBeatItems = [
    { label: "Rápido", value: formatHours(timeToBeat?.hastily) },
    { label: "Normal", value: formatHours(timeToBeat?.normally) },
    { label: "Completo", value: formatHours(timeToBeat?.completely) },
  ];
  const hasTimeToBeat = timeToBeatItems.some((t) => t.value !== null);

  const baseFields: { label: string; value: string }[] = [
    { label: "Desarrolladora", value: game.developer },
    { label: "Publisher", value: game.publisher },
    { label: "Plataformas", value: game.platforms.join(", ") },
    { label: "Lanzamiento", value: game.releaseDate },
    { label: "Géneros", value: game.genres.join(", ") },
  ];

  return (
    <div className="-mt-[50px] min-h-screen bg-black text-white">
      <section className="relative h-[75vh] min-h-[460px] w-full overflow-hidden">
        <img src={game.backdrop} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/5" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-transparent to-transparent" />

        <div className="relative z-10 mx-auto flex h-full max-w-6xl flex-col justify-end px-6 pb-28 sm:px-8 sm:pb-60">
          <div className="flex flex-col gap-8 sm:flex-row sm:items-end">
            <div className="w-36 shrink-0 overflow-hidden rounded-2xl ring-1 ring-white/10 shadow-[0_25px_60px_-20px_rgba(0,0,0,0.85)] sm:w-48">
              <img src={game.cover} alt={game.title} className="aspect-[2/3] w-full object-cover" />
            </div>

            <div className="flex flex-1 flex-col gap-2 pb-0">
              <div className="pb-0">
                <div className="flex items-center gap-3">
                  <h1 className="text-4xl font-semibold leading-[0.7] tracking-[-0.02em] text-white sm:text-[2.75rem]">
                    {game.title}
                  </h1>
                  <KeycapButton
                    href={`https://www.metacritic.com/search/${encodeURIComponent(game.title)}/`}
                  />
                </div>
                <p className="mt-2.5 text-[15px] font-medium text-neutral-400">
                  {game.year ?? "—"} · {game.developer}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-1">
                {game.genres.map((g) => (
                  <LiquidGlass
                    key={g}
                    width="fit-content"
                    height={26}
                    surfaceType="convex_squircle"
                    bezelWidth={14}
                    glassThickness={30}
                    refractiveIndex={1.5}
                    refractionScale={1.5}
                    specularOpacity={0.5}
                    blur={1.5}
                    tintColor="rgb(40, 40, 40)"
                    tintOpacity={0.4}
                    className="!justify-center items-center px-3"
                    borderRadius={13}
                  >
                    <span className="text-[11px] font-medium tracking-wide text-neutral-300">{g}</span>
                  </LiquidGlass>
                ))}
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-1">
                <GameActionButtons
                  igdbId={id}
                  title={game.title}
                  releaseDate={game.releaseDateRaw}
                  coverUrl={game.coverUrl}
                  backdropUrl={game.backdrop}
                  synopsis={game.synopsis}
                  rating={game.personalRating}
                  initialFavorite={game.favorite}
                  initialWatched={game.watched}
                  initialPending={game.pending}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="relative z-10 mx-auto max-w-6xl px-6 -mt-24 pb-20 pt-0 sm:px-8 sm:-mt-45">
        <div className="grid gap-16 lg:grid-cols-3">
          <aside className="space-y-8 lg:col-span-1">
            <LiquidGlass
              width="100%"
              height="auto"
              borderRadius={20}
              surfaceType="convex_squircle"
              bezelWidth={25}
              glassThickness={50}
              refractiveIndex={1.5}
              refractionScale={1.5}
              specularOpacity={0.5}
              blur={1.5}
              tintColor="rgb(40, 40, 40)"
              tintOpacity={0.2}
              className="!p-0"
            >
              <div className="p-7 pb-6 w-full">
                <h2 className={LABEL}>Mi biblioteca</h2>

                <div className="mt-2 flex justify-center overflow-visible">
                  <RatingGauge
                    initialValue={game.personalRating ?? 0.0}
                    size={1}
                    onSave={async (value) => {
                      "use server";
                      await saveGameEntry({
                        igdbId: id,
                        title: game.title,
                        releaseDate: game.releaseDateRaw,
                        coverUrl: game.coverUrl,
                        backdropUrl: game.backdrop,
                        synopsis: game.synopsis,
                        status: game.watched ? "completed" : "backlog",
                        rating: value,
                      });
                    }}
                  />
                </div>

                <div className="mt-2 space-y-1 border-t border-white/[0.06] pt-5 text-[13px] text-neutral-500">
                  {game.dateAdded ? (
                    <p>Añadido el {game.dateAdded}</p>
                  ) : (
                    <p>Aún no está en tu biblioteca</p>
                  )}
                  {game.dateWatched && <p>Completado el {game.dateWatched}</p>}
                </div>
              </div>
            </LiquidGlass>

            {hasTimeToBeat && (
              <section>
                <h2 className={LABEL}>Time to beat</h2>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {timeToBeatItems.map((t) => (
                    <LiquidGlass
                      key={t.label}
                      width="100%"
                      height="auto"
                      borderRadius={16}
                      surfaceType="convex_squircle"
                      bezelWidth={18}
                      glassThickness={36}
                      refractiveIndex={1.5}
                      refractionScale={1.5}
                      specularOpacity={0.5}
                      blur={1.5}
                      tintColor="rgb(40, 40, 40)"
                      tintOpacity={0.3}
                      className="!p-0"
                    >
                      <div className="flex flex-col items-center justify-center gap-1 px-2 py-4 w-full">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-500">
                          {t.label}
                        </span>
                        <span className="text-xl font-semibold tabular-nums text-white">
                          {t.value ?? "N/D"}
                        </span>
                      </div>
                    </LiquidGlass>
                  ))}
                </div>
              </section>
            )}

            <section>
              <h2 className={LABEL}>Comunidad</h2>
              <div className="mt-4 space-y-2.5">
                <div className="flex items-baseline gap-2.5">
                  <span className="text-2xl font-medium tabular-nums text-white">
                    {game.communityRating.toFixed(1)}
                  </span>
                  <span className="text-[13px] text-neutral-500">(IGDB)</span>
                </div>
              </div>
            </section>
          </aside>

          <div className="space-y-14 lg:col-span-2">
            <section>
              <h2 className={LABEL}>Sinopsis</h2>
              <p className="mt-3 max-w-2xl text-[15px] leading-[1.7] text-neutral-300">{game.synopsis}</p>
            </section>

            <section>
              <h2 className={LABEL}>Ficha técnica</h2>
              <div className="mt-5 grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-3">
                {baseFields.map((f) => (
                  <div key={f.label}>
                    <h3 className={LABEL}>{f.label}</h3>
                    <p className="mt-1.5 text-[14px] leading-snug text-neutral-300">{f.value}</p>
                  </div>
                ))}
              </div>
            </section>

            {game.gallery.length > 0 && (
              <section>
                <h2 className={LABEL}>Galería</h2>
                <div className="mt-4">
                  <MovieGallery images={game.gallery} />
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}