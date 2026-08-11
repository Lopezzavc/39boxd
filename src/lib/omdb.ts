// src/lib/omdb.ts

export type OmdbRatings = {
  imdbRating: string | null; // ej. "8.4"
  imdbVotes: string | null; // ej. "1,234,567"
  rottenTomatoes: string | null; // ej. "94%"
  metascore: string | null; // ej. "78"
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