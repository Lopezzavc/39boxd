"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import type { MediaStatus } from "@/types/media";

const USER_ID = "00000000-0000-0000-0000-000000000000";
const TMDB_IMG_BASE = "https://image.tmdb.org/t/p/w500";
const TMDB_BACKDROP_BASE = "https://image.tmdb.org/t/p/original";

type ContentType = "movie" | "tv_live_action" | "tv_animated" | "anime";

type MovieMediaRef = {
  tmdbId: string;
  mediaType: "movie" | "series";
  contentType: ContentType;
  title: string;
  releaseDate: string | null;
  posterPath: string | null;
  backdropPath: string | null;
  synopsis: string | null;
};

/**
 * Busca el media_id correspondiente a un tmdbId. Si no existe el registro en
 * `media`, lo crea. Si ya existe, actualiza cover_url/backdrop_url (mismo
 * patrón que game-entry.ts). Usado por saveMovieEntry, que sí puede crear
 * entradas.
 */
async function findOrCreateMediaId(
  admin: ReturnType<typeof createAdminClient>,
  ref: MovieMediaRef
): Promise<string> {
  const { data: existingMedia, error: findError } = await admin
    .from("media")
    .select("id")
    .eq("external_source", "tmdb")
    .eq("external_id", ref.tmdbId)
    .maybeSingle();

  if (findError) {
    throw new Error(findError.message);
  }

  const coverUrl = ref.posterPath ? `${TMDB_IMG_BASE}${ref.posterPath}` : null;
  const backdropUrl = ref.backdropPath ? `${TMDB_BACKDROP_BASE}${ref.backdropPath}` : null;

  if (existingMedia?.id) {
    await admin
      .from("media")
      .update({
        cover_url: coverUrl,
        backdrop_url: backdropUrl,
        content_type: ref.contentType,
      })
      .eq("id", existingMedia.id);

    return existingMedia.id;
  }

  const { data: inserted, error: insertError } = await admin
    .from("media")
    .insert({
      media_type: ref.mediaType,
      content_type: ref.contentType,
      title: ref.title,
      original_title: ref.title,
      cover_url: coverUrl,
      backdrop_url: backdropUrl,
      release_date: ref.releaseDate,
      summary: ref.synopsis,
      external_source: "tmdb",
      external_id: ref.tmdbId,
      metadata: {},
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    throw new Error(insertError?.message ?? "Failed to insert media");
  }

  return inserted.id;
}

/**
 * Solo busca el media_id existente, sin crear nada. Usado por updateFavorite,
 * que nunca debe crear una entrada nueva.
 */
async function findMediaId(
  admin: ReturnType<typeof createAdminClient>,
  tmdbId: string
): Promise<string | null> {
  const { data, error } = await admin
    .from("media")
    .select("id")
    .eq("external_source", "tmdb")
    .eq("external_id", tmdbId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data?.id ?? null;
}

export type SaveMovieEntryInput = MovieMediaRef & {
  status: MediaStatus;
  rating: number | null;
  notes?: string | null;
};

/**
 * Crea o actualiza la entrada de biblioteca (rating y/o status). Dispara en:
 * - Soltar el slider de calificación (guarda rating).
 * - Botón "Vista" (status = 'completed').
 * - Botón "Pendiente" (status = 'backlog', sin rating).
 *
 * Nunca toca is_favorite: ese campo se gestiona exclusivamente vía
 * updateFavorite, para no pisar su valor en cada guardado de rating/status.
 */
export async function saveMovieEntry(input: SaveMovieEntryInput) {
  const {
    tmdbId,
    mediaType,
    contentType,
    title,
    releaseDate,
    posterPath,
    backdropPath,
    synopsis,
    status,
    rating,
    notes,
  } = input;

  const admin = createAdminClient();
  const mediaId = await findOrCreateMediaId(admin, {
    tmdbId,
    mediaType,
    contentType,
    title,
    releaseDate,
    posterPath,
    backdropPath,
    synopsis,
  });

  const finishedAt = status === "completed" ? new Date().toISOString().slice(0, 10) : null;

  // Traemos is_favorite actual (si existe entrada) para no pisarlo con el
  // upsert: sin esto, un upsert sin is_favorite explícito lo reiniciaría a su
  // default en vez de conservar el valor guardado por updateFavorite.
  const { data: existingEntry } = await admin
    .from("user_media_entries")
    .select("is_favorite")
    .eq("media_id", mediaId)
    .eq("user_id", USER_ID)
    .maybeSingle();

  const { error: entryError } = await admin.from("user_media_entries").upsert(
    {
      media_id: mediaId,
      user_id: USER_ID,
      status,
      rating: rating ?? null,
      finished_at: finishedAt,
      is_favorite: existingEntry?.is_favorite ?? false,
      notes: notes ?? null,
    },
    { onConflict: "media_id,user_id" }
  );

  if (entryError) {
    throw new Error(entryError.message);
  }

  revalidatePath(`/movies/${tmdbId}`);
  revalidatePath("/movies");

  return { mediaId };
}

/**
 * Actualiza is_favorite. NUNCA crea una entrada nueva: si no existe fila en
 * user_media_entries para este medio, no hace nada (el usuario debe primero
 * calificar, marcar Vista, o marcar Pendiente).
 */
export async function updateFavorite(tmdbId: string, isFavorite: boolean) {
  const admin = createAdminClient();
  const mediaId = await findMediaId(admin, tmdbId);

  if (!mediaId) {
    // No hay entrada previa: Favorito no persiste nada.
    return { updated: false };
  }

  const { data: existingEntry } = await admin
    .from("user_media_entries")
    .select("id")
    .eq("media_id", mediaId)
    .eq("user_id", USER_ID)
    .maybeSingle();

  if (!existingEntry) {
    return { updated: false };
  }

  const { error } = await admin
    .from("user_media_entries")
    .update({ is_favorite: isFavorite })
    .eq("media_id", mediaId)
    .eq("user_id", USER_ID);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/movies/${tmdbId}`);
  revalidatePath("/movies");

  return { updated: true };
}