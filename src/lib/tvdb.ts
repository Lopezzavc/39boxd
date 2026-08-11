// src/lib/tvdb.ts

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

export async function getTvdbToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }

  const res = await fetch("https://api4.thetvdb.com/v4/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apikey: process.env.TVDB_API_KEY }),
  });

  if (!res.ok) throw new Error("TVDB login failed");

  const json = await res.json();
  cachedToken = json.data.token as string;
  tokenExpiresAt = Date.now() + 29 * 24 * 60 * 60 * 1000; // ~29 días (expira al mes)

  return cachedToken;
}

export async function tvdbFetch(path: string) {
  const token = await getTvdbToken();

  const res = await fetch(`https://api4.thetvdb.com/v4${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 3600 },
  });

  if (!res.ok) throw new Error(`TVDB fetch failed: ${path}`);
  return res.json();
}

// ── Artwork types: TVDB no garantiza IDs fijos, hay que resolverlos por slug ──
// Ojo: el mismo slug (ej. "backgrounds") se repite para distintos recordType
// (series / movie / season), así que se indexa por "recordType:slug".
let artworkTypeCache: Record<string, number> | null = null;

async function getArtworkTypeId(
  recordType: string,
  slug: string
): Promise<number | null> {
  if (!artworkTypeCache) {
    const json = await tvdbFetch("/artwork/types");
    artworkTypeCache = {};
    for (const t of json.data) {
      artworkTypeCache[`${t.recordType}:${t.slug}`] = t.id;
    }
  }
  return artworkTypeCache[`${recordType}:${slug}`] ?? null;
}

// Fondos/fanart estilo poster grande (NO son fotos de escenas reales)
export async function getTvdbGallery(
  tvdbId: string,
  entity: "series" | "movies"
): Promise<string[]> {
  const recordType = entity === "movies" ? "movie" : "series";
  const backgroundTypeId = await getArtworkTypeId(recordType, "backgrounds");
  const json = await tvdbFetch(`/${entity}/${tvdbId}/extended`);

  const artworks: any[] = json.data?.artworks || [];
  return artworks
    .filter((a) => a.type === backgroundTypeId)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .map((a) => a.image);
}

// Fotos reales: capturas de cada episodio (screencaps), solo aplica a series.
// Trae los episodios de la temporada default y devuelve su imagen si tienen.
export async function getTvdbEpisodeStills(tvdbId: string): Promise<string[]> {
  const json = await tvdbFetch(`/series/${tvdbId}/episodes/default`);
  const episodes: any[] = json.data?.episodes || [];

  return episodes
    .map((ep) => ep.image)
    .filter((img: string | null): img is string => Boolean(img));
}

// Mapea un ID de TMDB al ID interno de TVDB
export async function getTvdbIdFromTmdb(
  tmdbId: string,
  mediaType: "movie" | "tv"
): Promise<string | null> {
  const json = await tvdbFetch(`/search/remoteid/${tmdbId}`);
  const wantedType = mediaType === "tv" ? "series" : "movie";

  const match = (json.data || []).find(
    (r: any) => r[wantedType]?.id !== undefined
  );

  return match ? String(match[wantedType].id) : null;
}