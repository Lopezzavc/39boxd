import { notFound } from "next/navigation";
import { LiquidGlass } from "@/components/liquid-glass";
import { createAdminClient } from "@/lib/supabase/admin";
import { saveMusicEntry } from "@/lib/actions/music-entry";
import { getDeezerAlbumById } from "@/lib/deezer/search";
import type { DeezerAlbum } from "@/lib/deezer/types";
import KeycapButton from "./DeezerKeycapButton";
import RatingGauge from "../../movies/[id]/RatingGauge";
import TrackList from "./TrackList";
import MusicActionButtons from "./MusicActionButtons";

const USER_ID = "00000000-0000-0000-0000-000000000000";

const LABEL = "text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500";

// Cantidad de blur (en px) aplicada al backdrop del álbum. Como se usa el
// mismo cover escalado como fondo (sin una imagen de alta resolución
// dedicada), el blur disimula el efecto de baja calidad al escalar.
const BACKDROP_BLUR_PX = 5;

type Album = {
  title: string;
  year: number | undefined;
  artist: string;
  label: string;
  recordType: string;
  genres: string[];
  cover: string;
  coverUrl: string | null;
  backdrop: string;
  releaseDate: string;
  releaseDateRaw: string | null;
  nbTracks: number;
  totalDuration: string;
  fans: number;
  tracks: {
    id: number;
    title: string;
    duration: number;
    explicitLyrics: boolean;
  }[];
  synopsis: string;
  personalRating: number | null;
  favorite: boolean;
  watched: boolean;
  pending: boolean;
  dateAdded: string | null;
  dateWatched: string | null;
};

function formatReleaseDate(dateStr?: string): string {
  if (!dateStr) return "N/D";
  try {
    return new Intl.DateTimeFormat("es", { day: "numeric", month: "long", year: "numeric" }).format(
      new Date(dateStr)
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

function formatTotalDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatFans(fans: number): string {
  return new Intl.NumberFormat("es").format(fans);
}

const RECORD_TYPE_LABELS: Record<string, string> = {
  album: "Álbum",
  ep: "EP",
  single: "Single",
  compile: "Recopilatorio",
};

function formatRecordType(recordType?: string): string {
  if (!recordType) return "N/D";
  return RECORD_TYPE_LABELS[recordType.toLowerCase()] || recordType;
}

function buildAotySearchUrl(artist: string, title: string): string {
  const query = `${artist} ${title}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
  return `https://www.albumoftheyear.org/search/?q=${encodeURIComponent(query)}`;
}

function mapDeezerToAlbum(data: DeezerAlbum): Album {
  const genres = (data.genres?.data || []).map((g) => g.name);
  const tracks = (data.tracks?.data || []).map((t) => ({
    id: t.id,
    title: t.title,
    duration: t.duration,
    explicitLyrics: t.explicit_lyrics ?? false,
  }));

  return {
    title: data.title || "Sin título",
    year: data.release_date ? new Date(data.release_date).getFullYear() : undefined,
    artist: data.artist?.name || "Desconocido",
    label: data.label || "N/D",
    recordType: formatRecordType(data.record_type),
    genres: genres.length ? genres : ["N/D"],
    cover: data.cover_xl || "/assets/no-poster.png",
    coverUrl: data.cover_xl || null,
    backdrop: data.cover_xl || "/assets/no-backdrop.png",
    releaseDate: formatReleaseDate(data.release_date),
    releaseDateRaw: data.release_date || null,
    nbTracks: data.nb_tracks || tracks.length,
    totalDuration: formatTotalDuration(data.duration || 0),
    fans: data.fans || 0,
    tracks,
    synopsis: `Álbum de ${data.artist?.name || "artista desconocido"}.`,
    personalRating: null,
    favorite: false,
    watched: false,
    pending: false,
    dateAdded: null,
    dateWatched: null,
  };
}

export default async function MusicDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getDeezerAlbumById(Number(id));
  if (!data) notFound();

  const album = mapDeezerToAlbum(data);

  try {
    const admin = createAdminClient();
    const { data: mediaRow } = await admin
      .from("media")
      .select("id")
      .eq("external_source", "deezer")
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
        album.personalRating = entry.rating !== null && entry.rating !== undefined ? Number(entry.rating) : null;
        album.favorite = entry.is_favorite ?? false;
        album.watched = entry.status === "completed";
        album.pending = entry.status === "backlog";
        album.dateAdded = formatSimpleDate(entry.created_at);
        album.dateWatched = formatSimpleDate(entry.finished_at);
      }
    }
  } catch {
    // Si falla la carga de la entrada, se continúa con los valores por defecto.
  }

  const baseFields: { label: string; value: string }[] = [
    { label: "Artista", value: album.artist },
    { label: "Sello", value: album.label },
    { label: "Tipo", value: album.recordType },
    { label: "Lanzamiento", value: album.releaseDate },
    { label: "Géneros", value: album.genres.join(", ") },
    { label: "N° de tracks", value: String(album.nbTracks) },
    { label: "Duración total", value: album.totalDuration },
  ];

  return (
    <div className="-mt-[50px] min-h-screen bg-black text-white">
      <section className="relative h-[75vh] min-h-[460px] w-full overflow-hidden">
        <img
          src={album.backdrop}
          alt=""
          className="absolute inset-0 h-full w-full scale-110 object-cover"
          style={{ filter: `blur(${BACKDROP_BLUR_PX}px)` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/5" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-transparent to-transparent" />

        <div className="relative z-10 mx-auto flex h-full max-w-6xl flex-col justify-end px-6 pb-28 sm:px-8 sm:pb-60">
          <div className="flex flex-col gap-8 sm:flex-row sm:items-end">
            <div className="h-[216px] shrink-0 overflow-hidden rounded-2xl ring-1 ring-white/10 shadow-[0_25px_60px_-20px_rgba(0,0,0,0.85)] sm:h-[288px]">
              <img src={album.cover} alt={album.title} className="aspect-square h-full w-auto object-cover" />
            </div>

            <div className="flex flex-1 flex-col gap-2 pb-0">
              <div className="pb-0">
                <div className="flex items-center gap-3">
                  <h1 className="text-4xl font-semibold leading-[0.7] tracking-[-0.02em] text-white sm:text-[2.75rem]">
                    {album.title}
                  </h1>
                  <KeycapButton
                    href={buildAotySearchUrl(album.artist, album.title)}
                  />
                </div>
                <p className="mt-2.5 text-[15px] font-medium text-neutral-400">
                  {album.year ?? "—"} · {album.artist} · {album.totalDuration}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-1">
                {album.genres.map((g) => (
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
                <MusicActionButtons
                  deezerId={id}
                  title={album.title}
                  releaseDate={album.releaseDateRaw}
                  coverUrl={album.coverUrl}
                  synopsis={album.synopsis}
                  rating={album.personalRating}
                  initialFavorite={album.favorite}
                  initialWatched={album.watched}
                  initialPending={album.pending}
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
                    initialValue={album.personalRating ?? 0.0}
                    size={1}
                    onSave={async (value) => {
                      "use server";
                      await saveMusicEntry({
                        deezerId: id,
                        title: album.title,
                        releaseDate: album.releaseDateRaw,
                        coverUrl: album.coverUrl,
                        synopsis: album.synopsis,
                        status: album.watched ? "completed" : "backlog",
                        rating: value,
                      });
                    }}
                  />
                </div>

                <div className="mt-2 space-y-1 border-t border-white/[0.06] pt-5 text-[13px] text-neutral-500">
                  {album.dateAdded ? (
                    <p>Añadido el {album.dateAdded}</p>
                  ) : (
                    <p>Aún no está en tu biblioteca</p>
                  )}
                  {album.dateWatched && <p>Escuchado el {album.dateWatched}</p>}
                </div>
              </div>
            </LiquidGlass>

            <section>
              <h2 className={LABEL}>Comunidad</h2>
              <div className="mt-5">
                <h3 className={LABEL}>Fans</h3>
                <p className="mt-1.5 text-[14px] leading-snug text-neutral-300">{formatFans(album.fans)}</p>
              </div>
            </section>
          </aside>

          <div className="space-y-14 lg:col-span-2">
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

            {album.tracks.length > 0 && (
              <section>
                <h2 className={LABEL}>Tracklist</h2>
                <div className="mt-4">
                  <TrackList tracks={album.tracks} />
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}