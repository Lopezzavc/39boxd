import { notFound } from "next/navigation";
import { LiquidGlass } from "@/components/liquid-glass";
import { createAdminClient } from "@/lib/supabase/admin";
import { saveMovieEntry } from "@/lib/actions/movie-entry";
import {
  getTvdbIdFromTmdb,
  getRealPhotoGallery,
  getTvdbExtendedMetadata,
} from "@/lib/tvdb";
import { getOmdbRatings, getOmdbSeasonRatings, type EpisodeRating } from "@/lib/omdb";
import EpisodeRatingsHeatmap, {
  type HeatmapEpisodeCell,
  type HeatmapSeasonRow,
} from "./EpisodeRatingsHeatmap";
import MovieGallery from "./MovieGallery";
import CastRow from "./CastRow";
import KeycapButton from "./KeycapButton";
import RatingGauge from "./RatingGauge";
import MovieActionButtons from "./MovieActionButtons";
import { getContentType } from "@/lib/tmdb-content-type";

const USER_ID = "00000000-0000-0000-0000-000000000000";

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

const PILL_TEXT_ACTIVE = "text-[#c9a15b] ring-1 ring-[#c9a15b]/25";
const PILL_TEXT_INACTIVE = "text-neutral-400 ring-1 ring-white/[0.08] hover:text-neutral-200 hover:ring-white/[0.14]";

const LABEL = "text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500";

const IMG_BASE = "https://image.tmdb.org/t/p";

type CastMember = { name: string; role: string; profilePath: string | null };

type Movie = {
  title: string;
  year: number | undefined;
  director: string;
  writers: string[];
  producers: string[];
  duration: string;
  genres: string[];
  countries: string[];
  cast: CastMember[];
  synopsis: string;
  poster: string;
  posterPath: string | null;
  backdrop: string;
  budget: string;
  boxOffice: string;
  releaseDate: string;
  releaseDateRaw: string | null;
  gallery: string[];
  communityRating: number;
  communityVotes: number;
  imdbId: string | null;
  personalRating: number | null;
  favorite: boolean;
  watched: boolean;
  pending: boolean;
  dateAdded: string | null;
  dateWatched: string | null;
};

type SeasonMeta = { number: number; episodeCount: number };
type TmdbEpisodeStats = { voteAverage: number; voteCount: number };

function formatMoney(n?: number): string {
  if (!n) return "N/D";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

function formatRuntime(minutes?: number): string {
  if (!minutes) return "N/D";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

function formatReleaseDate(dateStr?: string): string {
  if (!dateStr) return "N/D";
  try {
    return new Intl.DateTimeFormat("es", { day: "numeric", month: "long", year: "numeric" }).format(new Date(dateStr));
  } catch {
    return dateStr;
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

async function fetchTmdbDetail(id: string, mediaType: "movie" | "tv") {
  const res = await fetch(
    `https://api.themoviedb.org/3/${mediaType}/${id}?language=es&append_to_response=credits,images,external_ids`,
    {
      headers: { Authorization: `Bearer ${process.env.TMDB_ACCESS_TOKEN}` },
      next: { revalidate: 3600 },
    }
  );

  if (!res.ok) return null;
  return res.json();
}

function mapTmdbToMovie(data: any, mediaType: "movie" | "tv"): Movie {
  const isTv = mediaType === "tv";
  const title: string = isTv ? data.name : data.title;
  const releaseDateRaw: string | undefined = isTv ? data.first_air_date : data.release_date;
  const runtimeMinutes: number | undefined = isTv ? data.episode_run_time?.[0] : data.runtime;

  const crew: { name: string; job: string }[] = data.credits?.crew || [];
  const castRaw: { name: string; character: string; profile_path: string | null }[] = data.credits?.cast || [];

  const director =
    crew.find((c) => c.job === "Director")?.name ||
    data.created_by?.[0]?.name ||
    "Desconocido";

  const writerJobs = new Set(["Writer", "Screenplay", "Story", "Author"]);
  const writers = Array.from(new Set(crew.filter((c) => writerJobs.has(c.job)).map((c) => c.name)));

  const producers: string[] = (data.production_companies || []).map((p: any) => p.name);
  const genres: string[] = (data.genres || []).map((g: any) => g.name);
  const countries: string[] = (data.production_countries || []).map((c: any) => c.name);

  const cast: CastMember[] = castRaw.slice(0, 8).map((c) => ({
    name: c.name,
    role: c.character,
    profilePath: c.profile_path || null,
  }));

  const gallery: string[] = (data.images?.backdrops || [])
    .slice(0, 4)
    .map((img: any) => `${IMG_BASE}/w780${img.file_path}`);

  return {
    title: title || "Sin título",
    year: releaseDateRaw ? new Date(releaseDateRaw).getFullYear() : undefined,
    director,
    writers: writers.length ? writers : ["Desconocido"],
    producers: producers.length ? producers : ["N/D"],
    duration: formatRuntime(runtimeMinutes),
    genres: genres.length ? genres : ["N/D"],
    countries: countries.length ? countries : ["N/D"],
    cast,
    synopsis: data.overview || "Sin sinopsis disponible.",
    poster: data.poster_path ? `${IMG_BASE}/w500${data.poster_path}` : "/assets/no-poster.png",
    posterPath: data.poster_path || null,
    backdrop: data.backdrop_path
      ? `${IMG_BASE}/original${data.backdrop_path}`
      : data.poster_path
      ? `${IMG_BASE}/original${data.poster_path}`
      : "/assets/no-backdrop.png",
    budget: isTv ? "N/D" : formatMoney(data.budget),
    boxOffice: isTv ? "N/D" : formatMoney(data.revenue),
    releaseDate: formatReleaseDate(releaseDateRaw),
    releaseDateRaw: releaseDateRaw || null,
    gallery,
    communityRating: data.vote_average || 0,
    communityVotes: data.vote_count || 0,
    imdbId: (isTv ? data.external_ids?.imdb_id : data.imdb_id) || null,
    personalRating: null,
    favorite: false,
    watched: false,
    pending: false,
    dateAdded: null,
    dateWatched: null,
  };
}

function getRegularSeasons(data: any): SeasonMeta[] {
  const seasons: any[] = data.seasons || [];
  return seasons
    .filter((s) => s.season_number > 0 && s.episode_count > 0)
    .map((s) => ({ number: s.season_number, episodeCount: s.episode_count }));
}

async function getSeasonEpisodeRatings(
  seriesImdbId: string | null,
  seasonNumber: number
): Promise<EpisodeRating[]> {
  if (!seriesImdbId) return [];
  try {
    return await getOmdbSeasonRatings(seriesImdbId, seasonNumber);
  } catch {
    return [];
  }
}

async function getTmdbSeasonEpisodeStats(
  tvId: string,
  seasonNumber: number
): Promise<Record<number, TmdbEpisodeStats>> {
  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/tv/${tvId}/season/${seasonNumber}?language=es`,
      {
        headers: { Authorization: `Bearer ${process.env.TMDB_ACCESS_TOKEN}` },
        next: { revalidate: 3600 },
      }
    );
    if (!res.ok) return {};
    const data = await res.json();
    const episodes: any[] = data.episodes || [];
    const map: Record<number, TmdbEpisodeStats> = {};
    for (const ep of episodes) {
      map[ep.episode_number] = {
        voteAverage: ep.vote_average || 0,
        voteCount: ep.vote_count || 0,
      };
    }
    return map;
  } catch {
    return {};
  }
}

function buildSeasonRows(
  seasons: SeasonMeta[],
  episodeRatingsBySeason: EpisodeRating[][],
  tmdbStatsBySeason: Record<number, TmdbEpisodeStats>[]
): HeatmapSeasonRow[] {
  return seasons.map((season, i) => {
    const omdbEpisodes = episodeRatingsBySeason[i] ?? [];
    const tmdbStats = tmdbStatsBySeason[i] ?? {};

    const episodes: HeatmapEpisodeCell[] = omdbEpisodes.map((ep) => {
      const stats = tmdbStats[ep.episode as keyof typeof tmdbStats];
      const hasTmdbRating = typeof stats?.voteAverage === "number" && stats.voteAverage > 0;
      const hasTmdbVotes = typeof stats?.voteCount === "number" && stats.voteCount > 0;

      const ratingDisplay = ep.imdbRating ?? (hasTmdbRating ? stats!.voteAverage.toFixed(1) : null);
      const votes = ep.imdbVotes ?? (hasTmdbVotes ? String(stats!.voteCount) : null);

      const ratingNum = ratingDisplay !== null ? Number(ratingDisplay) : null;
      const rating = ratingNum !== null && Number.isFinite(ratingNum) ? ratingNum : null;

      return {
        episode: ep.episode,
        title: ep.title,
        rating,
        ratingDisplay,
        votes,
        ratingIsFallback: !ep.imdbRating && hasTmdbRating,
        votesIsFallback: !ep.imdbVotes && hasTmdbVotes,
      };
    });

    const validRatings = episodes.map((e) => e.rating).filter((r): r is number => r !== null);
    const average = validRatings.length
      ? validRatings.reduce((a, b) => a + b, 0) / validRatings.length
      : null;

    return { season: season.number, episodes, average };
  });
}

export default async function MovieDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const { id } = await params;
  const { type } = await searchParams;
  const mediaType: "movie" | "tv" = type === "tv" ? "tv" : "movie";
  const data = await fetchTmdbDetail(id, mediaType);
  if (!data) notFound();

  const movie = mapTmdbToMovie(data, mediaType);
  const regularSeasons = mediaType === "tv" ? getRegularSeasons(data) : [];

  // ── Cargar entrada persistida desde Supabase ──
  try {
    const admin = createAdminClient();
    const { data: mediaRow } = await admin
      .from("media")
      .select("id")
      .eq("external_source", "tmdb")
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
        movie.personalRating = entry.rating !== null && entry.rating !== undefined ? Number(entry.rating) : null;
        movie.favorite = entry.is_favorite ?? false;
        movie.watched = entry.status === "completed";
        movie.pending = entry.status === "backlog";
        movie.dateAdded = formatSimpleDate(entry.created_at);
        movie.dateWatched = formatSimpleDate(entry.finished_at);
      }
    }
  } catch {
    // Si falla la carga de la entrada, se continúa con los valores por defecto.
  }

  let tvdbId: string | null = null;
  if (mediaType === "tv" && data.external_ids?.tvdb_id) {
    tvdbId = String(data.external_ids.tvdb_id);
  } else {
    try {
      tvdbId = await getTvdbIdFromTmdb(id, mediaType);
    } catch {}
  }

  const [
    gallery,
    omdbRatings,
    episodeRatingsBySeason,
    tmdbStatsBySeason,
    tvdbMeta,
  ] = await Promise.all([
    getRealPhotoGallery(id, mediaType, movie.gallery, tvdbId),
    movie.imdbId ? getOmdbRatings(movie.imdbId).catch(() => null) : null,
    Promise.all(regularSeasons.map((s) => getSeasonEpisodeRatings(movie.imdbId, s.number))),
    Promise.all(regularSeasons.map((s) => getTmdbSeasonEpisodeStats(id, s.number))),
    tvdbId ? getTvdbExtendedMetadata(tvdbId, mediaType).catch(() => null) : null,
  ]);

  movie.gallery = gallery;

  let boxOfficeWorldwide = movie.boxOffice;
  let boxOfficeUS: string | null = null;

  if (tvdbMeta) {
    if (tvdbMeta.boxOffice && tvdbMeta.boxOffice.trim() !== "") {
      const num = parseFloat(tvdbMeta.boxOffice);
      if (!isNaN(num)) {
        boxOfficeWorldwide = formatMoney(num);
      }
    }
    if (tvdbMeta.boxOfficeUS && tvdbMeta.boxOfficeUS.trim() !== "") {
      const num = parseFloat(tvdbMeta.boxOfficeUS);
      if (!isNaN(num)) {
        boxOfficeUS = formatMoney(num);
      }
    }
  }

  const allGenres = [...movie.genres];
  if (tvdbMeta?.subGenres.length) {
    for (const sub of tvdbMeta.subGenres) {
      if (!allGenres.some((g) => g.toLowerCase() === sub.toLowerCase())) {
        allGenres.push(sub);
      }
    }
  }

  const seasonRows = buildSeasonRows(regularSeasons, episodeRatingsBySeason, tmdbStatsBySeason);

  // ── Duración media para series (TMDB + fallback TVDB) ──
  let seriesAvgRuntime: string | null = null;
  if (mediaType === "tv") {
    const tmdbMinutes = data.episode_run_time?.[0] ?? null;
    const tvdbMinutes = tvdbMeta?.averageRuntime ?? null;
    const finalMinutes = tmdbMinutes ?? tvdbMinutes;
    seriesAvgRuntime = finalMinutes ? formatRuntime(finalMinutes) : "N/D";
  }

  // ── Red y estado para series ──
  const networkNames =
    mediaType === "tv" && data.networks
      ? data.networks.map((n: any) => n.name).join(", ")
      : null;
  const seriesStatus = mediaType === "tv" ? data.status : null;

  // ── Construcción condicional de la ficha técnica ──
  const baseFields: { label: string; value: string }[] = [
    { label: "Director", value: movie.director },
    { label: "Guion", value: movie.writers.join(", ") },
    { label: "Productoras", value: movie.producers.join(", ") },
  ];

  if (mediaType === "tv") {
    baseFields.push(
      { label: "Cadena", value: networkNames || "N/D" },
      { label: "Duración media", value: seriesAvgRuntime || "N/D" },
      { label: "Estado", value: seriesStatus || "N/D" },
      { label: "Estreno", value: movie.releaseDate }
    );
  } else {
    baseFields.push(
      { label: "Duración", value: movie.duration },
      { label: "Estreno", value: movie.releaseDate },
      { label: "Presupuesto", value: movie.budget },
      { label: "Recaudación (Mundial)", value: boxOfficeWorldwide }
    );
    if (boxOfficeUS) {
      baseFields.push({ label: "Recaudación (EE. UU.)", value: boxOfficeUS });
    }
  }

  baseFields.push(
    { label: "Países", value: movie.countries.join(", ") },
    { label: "Géneros", value: movie.genres.join(", ") }
  );

  if (tvdbMeta?.contentWarnings.length) {
    baseFields.push({
      label: "Advertencias",
      value: tvdbMeta.contentWarnings.join(", "),
    });
  }

  const castWithImages = movie.cast.map((c) => ({
    name: c.name,
    role: c.role,
    imageUrl: c.profilePath ? `${IMG_BASE}/w185${c.profilePath}` : null,
  }));

  const entryMediaType: "movie" | "series" = mediaType === "tv" ? "series" : "movie";
  const contentType = getContentType(data, mediaType);

  return (
    <div className="-mt-[50px] min-h-screen bg-black text-white">
      <section className="relative h-[75vh] min-h-[460px] w-full overflow-hidden">
        <img src={movie.backdrop} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/5" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-transparent to-transparent" />

        <div className="relative z-10 mx-auto flex h-full max-w-6xl flex-col justify-end px-6 pb-28 sm:px-8 sm:pb-60">
          <div className="flex flex-col gap-8 sm:flex-row sm:items-end">
            <div className="w-36 shrink-0 overflow-hidden rounded-2xl ring-1 ring-white/10 shadow-[0_25px_60px_-20px_rgba(0,0,0,0.85)] sm:w-48">
              <img src={movie.poster} alt={movie.title} className="aspect-[2/3] w-full object-cover" />
            </div>

            <div className="flex flex-1 flex-col gap-2 pb-0">
              <div className="pb-0">
                <div className="flex items-center gap-3">
                  <h1 className="text-4xl font-semibold leading-[0.7] tracking-[-0.02em] text-white sm:text-[2.75rem]">
                    {movie.title}
                  </h1>
                  <KeycapButton
                    href={movie.imdbId ? `https://www.imdb.com/title/${movie.imdbId}` : undefined}
                  />
                </div>
                <p className="mt-2.5 text-[15px] font-medium text-neutral-400">
                  {movie.year ?? "—"} · {movie.director} · {mediaType === "tv" ? seriesAvgRuntime : movie.duration}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-1">
                {allGenres.map((g) => (
                  <LiquidGlass
                    key={g}
                    width="fit-content"
                    height={26}
                    borderRadius={13}
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
                  >
                    <span className="text-[11px] font-medium tracking-wide text-neutral-300">{g}</span>
                  </LiquidGlass>
                ))}
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-1">
                <MovieActionButtons
                  tmdbId={id}
                  mediaType={entryMediaType}
                  contentType={contentType}
                  title={movie.title}
                  releaseDate={movie.releaseDateRaw}
                  posterPath={movie.posterPath}
                  backdropPath={data.backdrop_path ?? null}
                  synopsis={movie.synopsis}
                  rating={movie.personalRating}
                  initialFavorite={movie.favorite}
                  initialWatched={movie.watched}
                  initialPending={movie.pending}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="relative z-10 mx-auto max-w-6xl px-6 -mt-24 pb-20 pt-0 sm:px-8 sm:-mt-45">
        <div className="grid gap-16 lg:grid-cols-3">
          <aside className="space-y-14 lg:col-span-1">
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
                    initialValue={movie.personalRating ?? 0.0}
                    size={1}
                    onSave={async (value) => {
                      "use server";
                      await saveMovieEntry({
                        tmdbId: id,
                        mediaType: entryMediaType,
                        contentType,
                        title: movie.title,
                        releaseDate: movie.releaseDateRaw,
                        posterPath: movie.posterPath,
                        backdropPath: data.backdrop_path ?? null,
                        synopsis: movie.synopsis,
                        status: movie.watched ? "completed" : "backlog",
                        rating: value,
                      });
                    }}
                  />
                </div>

                <div className="mt-2 space-y-1 border-t border-white/[0.06] pt-5 text-[13px] text-neutral-500">
                  {movie.dateAdded ? (
                    <p>Añadida el {movie.dateAdded}</p>
                  ) : (
                    <p>Aún no está en tu biblioteca</p>
                  )}
                  {movie.dateWatched && <p>Vista el {movie.dateWatched}</p>}
                </div>
              </div>
            </LiquidGlass>

            <section>
              <h2 className={LABEL}>Comunidad</h2>
              <div className="mt-4 space-y-2.5">
                <div className="flex items-baseline gap-2.5">
                  <span className="text-2xl font-medium tabular-nums text-white">
                    {movie.communityRating.toFixed(1)}
                  </span>
                  <span className="text-[13px] text-neutral-500">
                    {movie.communityVotes.toLocaleString("es-CO")} valoraciones (TMDB)
                  </span>
                </div>

                {omdbRatings?.imdbRating && (
                  <div className="flex items-baseline gap-2.5">
                    <span className="text-2xl font-medium tabular-nums text-white">
                      {omdbRatings.imdbRating}
                    </span>
                    <span className="text-[13px] text-neutral-500">
                      {omdbRatings.imdbVotes ? `${omdbRatings.imdbVotes} valoraciones ` : ""}(IMDb)
                    </span>
                  </div>
                )}

                {omdbRatings?.rottenTomatoes && (
                  <div className="flex items-baseline gap-2.5">
                    <span className="text-2xl font-medium tabular-nums text-white">
                      {omdbRatings.rottenTomatoes}
                    </span>
                    <span className="text-[13px] text-neutral-500">(Rotten Tomatoes)</span>
                  </div>
                )}

                {omdbRatings?.metascore && (
                  <div className="flex items-baseline gap-2.5">
                    <span className="text-2xl font-medium tabular-nums text-white">
                      {omdbRatings.metascore}
                    </span>
                    <span className="text-[13px] text-neutral-500">(Metascore)</span>
                  </div>
                )}
              </div>
            </section>
          </aside>

          <div className="space-y-14 lg:col-span-2">
            <section>
              <h2 className={LABEL}>Sinopsis</h2>
              <p className="mt-3 max-w-2xl text-[15px] leading-[1.7] text-neutral-300">{movie.synopsis}</p>
            </section>

            <section>
              <h2 className={LABEL}>Reparto</h2>
              <div className="mt-4">
                <CastRow cast={castWithImages} />
              </div>
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

            {seasonRows.length > 0 && (
              <section>
                <h2 className={LABEL}>Calificaciones por temporada</h2>
                <div className="mt-4">
                  <EpisodeRatingsHeatmap seasons={seasonRows} />
                </div>
              </section>
            )}

            {movie.gallery.length > 0 && (
              <section>
                <h2 className={LABEL}>Galería</h2>
                <div className="mt-4">
                  <MovieGallery images={movie.gallery} />
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}