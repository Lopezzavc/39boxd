// src/lib/omdb.ts

export type OmdbRatings = {
  imdbRating: string | null;
  imdbVotes: string | null;
  rottenTomatoes: string | null;
  metascore: string | null;
};

export async function getOmdbRatings(imdbId: string): Promise<OmdbRatings | null> {
  const res = await fetch(
    `https://www.omdbapi.com/?i=${imdbId}&apikey=${process.env.OMDB_API_KEY}`,
    { next: { revalidate: 3600 } }
  );

  if (!res.ok) return null;

  const data = await res.json();
  if (data.Response === "False") return null;

  const rt = (data.Ratings || []).find(
    (r: any) => r.Source === "Rotten Tomatoes"
  );

  return {
    imdbRating: data.imdbRating !== "N/A" ? data.imdbRating : null,
    imdbVotes: data.imdbVotes !== "N/A" ? data.imdbVotes : null,
    rottenTomatoes: rt ? rt.Value : null,
    metascore: data.Metascore !== "N/A" ? data.Metascore : null,
  };
}

// ── Rating + votos por episodio ──
export type EpisodeRating = {
  season: number;
  episode: number;
  title: string;
  imdbRating: string | null;
  imdbVotes: string | null;
  imdbId: string;
  ratingIsFallback?: boolean;
  votesIsFallback?: boolean;
};

// Paso 1: trae la lista de episodios de la temporada (título + imdbID de cada uno).
// 1 sola llamada, pero sin votos todavía.
async function getSeasonEpisodeList(
  seriesImdbId: string,
  seasonNumber: number
): Promise<{ episode: number; title: string; imdbId: string }[]> {
  const res = await fetch(
    `https://www.omdbapi.com/?i=${seriesImdbId}&Season=${seasonNumber}&apikey=${process.env.OMDB_API_KEY}`,
    { next: { revalidate: 3600 } }
  );

  if (!res.ok) return [];

  const data = await res.json();
  if (data.Response === "False") return [];

  const episodes: any[] = data.Episodes || [];
  return episodes.map((ep) => ({
    episode: Number(ep.Episode),
    title: ep.Title,
    imdbId: ep.imdbID,
  }));
}

// Paso 2: por cada episodio, 1 llamada individual a OMDb para traer rating + votos.
// seriesImdbId = imdbID de la SERIE completa (ej. "tt0903747")
export async function getOmdbSeasonRatings(
  seriesImdbId: string,
  seasonNumber: number
): Promise<EpisodeRating[]> {
  const episodeList = await getSeasonEpisodeList(seriesImdbId, seasonNumber);
  if (episodeList.length === 0) return [];

  const results = await Promise.all(
    episodeList.map(async (ep) => {
      const ratings = await getOmdbRatings(ep.imdbId).catch(() => null);
      return {
        season: seasonNumber,
        episode: ep.episode,
        title: ep.title,
        imdbRating: ratings?.imdbRating ?? null,
        imdbVotes: ratings?.imdbVotes ?? null,
        imdbId: ep.imdbId,
      };
    })
  );

  return results;
}