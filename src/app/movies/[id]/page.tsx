// src/app/movies/[id]/page.tsx

import { notFound } from "next/navigation";
import LiquidGlass from "@/components/LiquidGlass";
import { getTvdbIdFromTmdb, getTvdbGallery, getTvdbEpisodeStills } from "@/lib/tvdb";
import { getOmdbRatings } from "@/lib/omdb";

// ────────────────────────────────────────────────────────────────────────────
// Iconografía mínima
// ────────────────────────────────────────────────────────────────────────────
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

function IconPencil() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

const PILL_TEXT_ACTIVE = "text-[#c9a15b] ring-1 ring-[#c9a15b]/25";
const PILL_TEXT_INACTIVE = "text-neutral-400 ring-1 ring-white/[0.08] hover:text-neutral-200 hover:ring-white/[0.14]";

const LABEL = "text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500";

const IMG_BASE = "https://image.tmdb.org/t/p";

// ────────────────────────────────────────────────────────────────────────────
// Tipos
// ────────────────────────────────────────────────────────────────────────────
type CastMember = { name: string; role: string };

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
  backdrop: string;
  budget: string;
  boxOffice: string;
  releaseDate: string;
  gallery: string[];
  communityRating: number;
  communityVotes: number;
  imdbId: string | null;
  // Datos de tu propia biblioteca — pendientes de conectar con tu sistema de usuarios
  personalRating: number | null;
  favorite: boolean;
  watched: boolean;
  dateAdded: string | null;
  dateWatched: string | null;
};

// ────────────────────────────────────────────────────────────────────────────
// Helpers de formato
// ────────────────────────────────────────────────────────────────────────────
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
    return new Intl.DateTimeFormat("es", { month: "long", year: "numeric" }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Fetch a TMDB
// ────────────────────────────────────────────────────────────────────────────
async function fetchTmdbDetail(id: string, mediaType: "movie" | "tv") {
  const res = await fetch(
    `https://api.themoviedb.org/3/${mediaType}/${id}?language=es&append_to_response=credits,images,external_ids`,
    {
      headers: { Authorization: `Bearer ${process.env.TMDB_ACCESS_TOKEN}` },
      next: { revalidate: 3600 }, // cachea 1h, ajusta a gusto
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
  const castRaw: { name: string; character: string }[] = data.credits?.cast || [];

  const director =
    crew.find((c) => c.job === "Director")?.name ||
    data.created_by?.[0]?.name ||
    "Desconocido";

  const writerJobs = new Set(["Writer", "Screenplay", "Story", "Author"]);
  const writers = Array.from(new Set(crew.filter((c) => writerJobs.has(c.job)).map((c) => c.name)));

  const producers: string[] = (data.production_companies || []).map((p: any) => p.name);
  const genres: string[] = (data.genres || []).map((g: any) => g.name);
  const countries: string[] = (data.production_countries || []).map((c: any) => c.name);

  const cast: CastMember[] = castRaw.slice(0, 8).map((c) => ({ name: c.name, role: c.character }));

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
    backdrop: data.backdrop_path
      ? `${IMG_BASE}/original${data.backdrop_path}`
      : data.poster_path
      ? `${IMG_BASE}/original${data.poster_path}`
      : "/assets/no-backdrop.png",
    budget: isTv ? "N/D" : formatMoney(data.budget),
    boxOffice: isTv ? "N/D" : formatMoney(data.revenue),
    releaseDate: formatReleaseDate(releaseDateRaw),
    gallery,
    communityRating: data.vote_average || 0,
    communityVotes: data.vote_count || 0,
    imdbId: (isTv ? data.external_ids?.imdb_id : data.imdb_id) || null,

    // Pendiente de tu propio sistema de biblioteca/usuarios
    personalRating: null,
    favorite: false,
    watched: false,
    dateAdded: null,
    dateWatched: null,
  };
}

// TVDB da fotos reales; si algo falla (id no encontrado, API caída),
// no rompe la página, simplemente se queda con la galería de TMDB.
async function getRealPhotoGallery(
  tmdbId: string,
  mediaType: "movie" | "tv",
  fallback: string[]
): Promise<string[]> {
  try {
    const tvdbId = await getTvdbIdFromTmdb(tmdbId, mediaType);
    if (!tvdbId) return fallback;

    if (mediaType === "tv") {
      // Series: capturas reales por episodio, son "fotos" de verdad
      const stills = await getTvdbEpisodeStills(tvdbId);
      if (stills.length > 0) return stills.slice(0, 12);

      // Si la serie no tiene stills cargados, cae a backgrounds
      const backgrounds = await getTvdbGallery(tvdbId, "series");
      return backgrounds.length > 0 ? backgrounds : fallback;
    }

    // Películas: TVDB no tiene "escenas" por película, solo backgrounds/fanart
    const backgrounds = await getTvdbGallery(tvdbId, "movies");
    return backgrounds.length > 0 ? backgrounds : fallback;
  } catch {
    return fallback;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Página
// ────────────────────────────────────────────────────────────────────────────
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
  const [gallery, omdbRatings] = await Promise.all([
    getRealPhotoGallery(id, mediaType, movie.gallery),
    movie.imdbId ? getOmdbRatings(movie.imdbId).catch(() => null) : Promise.resolve(null),
  ]);
  movie.gallery = gallery;

  const infoFields: { label: string; value: string }[] = [
    { label: "Director", value: movie.director },
    { label: "Guion", value: movie.writers.join(", ") },
    { label: "Productoras", value: movie.producers.join(", ") },
    { label: "Duración", value: movie.duration },
    { label: "Estreno", value: movie.releaseDate },
    { label: "Presupuesto", value: movie.budget },
    { label: "Recaudación", value: movie.boxOffice },
    { label: "Países", value: movie.countries.join(", ") },
    { label: "Géneros", value: movie.genres.join(", ") },
  ];

  return (
    <div className="-mt-[50px] min-h-screen bg-black text-white">
      {/* ── Hero ── */}
      <section className="relative h-[75vh] min-h-[460px] w-full overflow-hidden">
        <img src={movie.backdrop} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/5" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-transparent to-transparent" />

        <div className="relative z-10 mx-auto flex h-full max-w-6xl flex-col justify-end px-6 pb-28 sm:px-8 sm:pb-60">
          <div className="flex flex-col gap-8 sm:flex-row sm:items-end">
            <div className="w-36 shrink-0 overflow-hidden rounded-2xl ring-1 ring-white/10 shadow-[0_25px_60px_-20px_rgba(0,0,0,0.85)] sm:w-48">
              <img src={movie.poster} alt={movie.title} className="aspect-[2/3] w-full object-cover" />
            </div>

            <div className="flex flex-1 flex-col gap-1 pb-1">
              <div>
                <h1 className="text-4xl font-semibold leading-[1.05] tracking-[-0.02em] text-white sm:text-[2.75rem]">
                  {movie.title}
                </h1>
                <p className="mt-2.5 text-[15px] font-medium text-neutral-400">
                  {movie.year ?? "—"} · {movie.director} · {movie.duration}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-1">
                {movie.genres.map((g) => (
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
                <LiquidGlass
                  width="fit-content"
                  height={40}
                  borderRadius={20}
                  surfaceType="convex_squircle"
                  bezelWidth={20}
                  glassThickness={44}
                  refractiveIndex={1.5}
                  refractionScale={1.5}
                  specularOpacity={0.5}
                  blur={1.5}
                  tintColor={movie.favorite ? "rgb(201, 161, 91)" : "rgb(40, 40, 40)"}
                  tintOpacity={movie.favorite ? 0.18 : 0.5}
                  className="!p-0"
                >
                  <div
                    className={`flex h-full w-full items-center justify-center gap-2 px-4 text-[13px] font-medium transition-colors ${
                      movie.favorite ? PILL_TEXT_ACTIVE : PILL_TEXT_INACTIVE
                    }`}
                  >
                    <IconStar filled={movie.favorite} />
                    Favorito
                  </div>
                </LiquidGlass>

                <LiquidGlass
                  width="fit-content"
                  height={40}
                  borderRadius={20}
                  surfaceType="convex_squircle"
                  bezelWidth={20}
                  glassThickness={44}
                  refractiveIndex={1.5}
                  refractionScale={1.5}
                  specularOpacity={0.5}
                  blur={1.5}
                  tintColor={movie.watched ? "rgb(201, 161, 91)" : "rgb(40, 40, 40)"}
                  tintOpacity={movie.watched ? 0.18 : 0.5}
                  className="!p-0"
                >
                  <div
                    className={`flex h-full w-full items-center justify-center gap-2 px-4 text-[13px] font-medium transition-colors ${
                      movie.watched ? PILL_TEXT_ACTIVE : PILL_TEXT_INACTIVE
                    }`}
                  >
                    <IconCheck />
                    Vista
                  </div>
                </LiquidGlass>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Cuerpo ── */}
      <div className="relative z-10 mx-auto max-w-6xl px-6 -mt-24 pb-20 pt-0 sm:px-8 sm:-mt-45">
        <div className="grid gap-16 lg:grid-cols-3">
          {/* Columna izquierda — mi experiencia personal */}
          <aside className="space-y-14 lg:col-span-1">
            {/* Mi biblioteca con LiquidGlass */}
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
              <div className="p-7 w-full">
                <h2 className={LABEL}>Mi biblioteca</h2>

                <div className="mt-7 flex items-end gap-2">
                  {movie.personalRating !== null ? (
                    <>
                      <span className="text-[3.25rem] font-light leading-none tracking-[-0.03em] tabular-nums text-white">
                        {movie.personalRating.toFixed(1)}
                      </span>
                      <span className="pb-1.5 text-base text-neutral-500">/ 10</span>
                    </>
                  ) : (
                    <span className="pb-1 text-sm text-neutral-500">Sin valorar todavía</span>
                  )}
                  <button
                    type="button"
                    aria-label="Editar valoración"
                    className="ml-auto flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 ring-1 ring-white/10 transition-colors hover:text-white hover:ring-white/20"
                  >
                    <IconPencil />
                  </button>
                </div>

                <div className="mt-6 space-y-1 border-t border-white/[0.06] pt-5 text-[13px] text-neutral-500">
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

          {/* Columna derecha — información de la película */}
          <div className="space-y-16 lg:col-span-2">
            <section>
              <h2 className={LABEL}>Sinopsis</h2>
              <p className="mt-3 max-w-2xl text-[15px] leading-[1.7] text-neutral-300">{movie.synopsis}</p>
            </section>

            <section>
              <h2 className={LABEL}>Reparto</h2>
              <div className="mt-4 grid grid-cols-1 gap-x-10 gap-y-2.5 sm:grid-cols-2">
                {movie.cast.map((c) => (
                  <div key={c.name} className="flex items-baseline justify-between border-b border-white/[0.05] pb-2.5">
                    <span className="text-[14px] text-neutral-200">{c.name}</span>
                    <span className="text-[13px] text-neutral-500">{c.role}</span>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 className={LABEL}>Ficha técnica</h2>
              <div className="mt-5 grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-3">
                {infoFields.map((f) => (
                  <div key={f.label}>
                    <h3 className={LABEL}>{f.label}</h3>
                    <p className="mt-1.5 text-[14px] leading-snug text-neutral-300">{f.value}</p>
                  </div>
                ))}
              </div>
            </section>

            {movie.gallery.length > 0 && (
              <section>
                <h2 className={LABEL}>Galería</h2>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {movie.gallery.map((src) => (
                    <div key={src} className="aspect-video overflow-hidden rounded-xl bg-white/5 ring-1 ring-white/[0.06]">
                      <img src={src} alt="" className="h-full w-full object-cover" />
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}