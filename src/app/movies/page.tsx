import { createAdminClient } from "@/lib/supabase/admin";
import MoviesGrid from "./MoviesGrid";

const USER_ID = "00000000-0000-0000-0000-000000000000";

export default async function MoviesPage() {
  const admin = createAdminClient();

  const { data: entries, error } = await admin
    .from("user_media_entries")
    .select(
      `
      id,
      status,
      rating,
      is_favorite,
      finished_at,
      media:media_id (
        id,
        media_type,
        content_type,
        title,
        cover_url,
        backdrop_url,
        release_date,
        external_id
      )
    `
    )
    .eq("user_id", USER_ID)
    .in("media.media_type", ["movie", "series"])
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const movies = (entries ?? [])
    .filter((e) => e.media !== null)
    .map((e) => ({
      id: e.id,
      isFavorite: e.is_favorite,
      isCompleted: e.status === "completed",
      isPending: e.status === "backlog",
      rating: e.rating,
      title: e.media!.title,
      coverUrl: e.media!.cover_url,
      backdropUrl: e.media!.backdrop_url,
      externalId: e.media!.external_id,
      mediaType: e.media!.media_type as "movie" | "series",
      contentType: e.media!.content_type as "movie" | "tv_live_action" | "tv_animated" | "anime" | null,
    }));

  return (
    <div className="container mx-auto max-w-[1400px] px-4 py-8">
      {movies.length === 0 ? (
        <div className="rounded-2xl border border-neutral-200 bg-white p-8 dark:border-neutral-800 dark:bg-neutral-950">
          <p className="text-center text-sm text-neutral-400">
            Aquí verás las películas y series que has añadido. Usa la lupa del header para buscar y agregar nuevas.
          </p>
        </div>
      ) : (
        <MoviesGrid movies={movies} />
      )}
    </div>
  );
}