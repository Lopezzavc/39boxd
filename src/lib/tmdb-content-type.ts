// Agregar en algún archivo compartido, ej. src/lib/tmdb.ts, o directamente
// arriba de mapTmdbToMovie en movies/[id]/page.tsx.

export type ContentType = "movie" | "tv_live_action" | "tv_animated" | "anime";

const ANIMATION_GENRE_ID = 16;

/**
 * Determina el content_type a partir de la respuesta cruda de TMDB.
 * - movie: mediaType === "movie"
 * - anime: es TV, tiene género Animation (id 16) y origin_country incluye "JP"
 * - tv_animated: es TV, tiene género Animation, pero no es japonés
 * - tv_live_action: es TV sin género Animation
 *
 * IMPORTANTE: se compara por id (16), no por g.name === "Animation", porque
 * el nombre del género viene traducido según el `language` pedido a TMDB
 * (ej. "Animación" en es) y la comparación por nombre en inglés siempre
 * fallaba silenciosamente, clasificando todo como tv_live_action.
 */
export function getContentType(data: any, mediaType: "movie" | "tv"): ContentType {
  if (mediaType === "movie") {
    return data.original_language === "ja" ? "anime" : "movie";
  }

  const genres: { id: number; name: string }[] = data.genres || [];
  const isAnimated = genres.some((g) => g.id === ANIMATION_GENRE_ID);

  const originCountries: string[] = data.origin_country || [];
  const isJapanese = originCountries.includes("JP");

  if (isAnimated && isJapanese) {
    return "anime";
  }

  if (isAnimated) {
    return "tv_animated";
  }

  return "tv_live_action";
}