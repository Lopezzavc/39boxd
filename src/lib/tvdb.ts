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
  tokenExpiresAt = Date.now() + 29 * 24 * 60 * 60 * 1000;

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

export async function getTvdbEpisodeStills(tvdbId: string): Promise<string[]> {
  const json = await tvdbFetch(`/series/${tvdbId}/episodes/default`);
  const episodes: any[] = json.data?.episodes || [];

  return episodes
    .map((ep) => ep.image)
    .filter((img: string | null): img is string => Boolean(img));
}

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

export interface TvdbExtendedMetadata {
  subGenres: string[];
  contentWarnings: string[];
  timePeriod: string | null;
  boxOffice: string | null;
  boxOfficeUS: string | null;
  averageRuntime: number | null;   // ← nuevo campo
}

export async function getTvdbExtendedMetadata(
  tvdbId: string,
  type: "movie" | "tv"
): Promise<TvdbExtendedMetadata | null> {
  try {
    const endpoint =
      type === "tv"
        ? `/series/${tvdbId}/extended`
        : `/movies/${tvdbId}/extended`;

    const json = await tvdbFetch(endpoint);
    const data = json.data;

    const tags: any[] = data.tags ?? [];

    const subGenres = tags
      .filter((t) => t.tagName === "Sub-Genre")
      .map((t) => t.name)
      .filter(Boolean);

    const contentWarnings = tags
      .filter((t) => t.tagName === "Sensitive Content & Trigger Warnings")
      .map((t) => t.name)
      .filter(Boolean);

    const timePeriodTags = tags.filter((t) => t.tagName === "Time Period");
    let timePeriod: string | null = null;
    if (timePeriodTags.length > 0) {
      timePeriod = timePeriodTags[0].name;
    } else if (data.firstAired) {
      const year = new Date(data.firstAired).getFullYear();
      if (!isNaN(year)) timePeriod = year.toString();
    }

    const boxOfficeRaw: string | undefined = data.boxOffice;
    let boxOffice: string | null = null;
    if (boxOfficeRaw && boxOfficeRaw.trim() !== "") {
      boxOffice = boxOfficeRaw;
    }

    const boxOfficeUSRaw: string | undefined = data.boxOfficeUS;
    let boxOfficeUS: string | null = null;
    if (boxOfficeUSRaw && boxOfficeUSRaw.trim() !== "") {
      boxOfficeUS = boxOfficeUSRaw;
    }

    // ── Extraer averageRuntime, si existe ──
    const averageRuntime: number | null =
      typeof data.averageRuntime === "number" ? data.averageRuntime : null;

    return {
      subGenres,
      contentWarnings,
      timePeriod,
      boxOffice,
      boxOfficeUS,
      averageRuntime,
    };
  } catch {
    return null;
  }
}

export async function getRealPhotoGallery(
  tmdbId: string,
  mediaType: "movie" | "tv",
  fallback: string[],
  tvdbId?: string | null
): Promise<string[]> {
  try {
    const resolvedTvdbId = tvdbId ?? (await getTvdbIdFromTmdb(tmdbId, mediaType));
    if (!resolvedTvdbId) return fallback;

    if (mediaType === "tv") {
      const stills = await getTvdbEpisodeStills(resolvedTvdbId);
      if (stills.length > 0) return stills.slice(0, 12);

      const backgrounds = await getTvdbGallery(resolvedTvdbId, "series");
      return backgrounds.length > 0 ? backgrounds : fallback;
    }

    const backgrounds = await getTvdbGallery(resolvedTvdbId, "movies");
    return backgrounds.length > 0 ? backgrounds : fallback;
  } catch {
    return fallback;
  }
}