"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import type { MediaStatus } from "@/types/media";

const USER_ID = "00000000-0000-0000-0000-000000000000";

type GameMediaRef = {
  igdbId: string;
  title: string;
  releaseDate: string | null;
  coverUrl: string | null;
  backdropUrl: string | null;
  synopsis: string | null;
};

async function findOrCreateMediaId(
  admin: ReturnType<typeof createAdminClient>,
  ref: GameMediaRef
): Promise<string> {
  const { data: existingMedia, error: findError } = await admin
    .from("media")
    .select("id")
    .eq("external_source", "igdb")
    .eq("external_id", ref.igdbId)
    .maybeSingle();

  if (findError) {
    throw new Error(findError.message);
  }

  if (existingMedia?.id) {
    await admin
      .from("media")
      .update({
        cover_url: ref.coverUrl,
        backdrop_url: ref.backdropUrl,
      })
      .eq("id", existingMedia.id);

    return existingMedia.id;
  }

  const { data: inserted, error: insertError } = await admin
    .from("media")
    .insert({
      media_type: "game",
      title: ref.title,
      original_title: ref.title,
      cover_url: ref.coverUrl,
      backdrop_url: ref.backdropUrl,
      release_date: ref.releaseDate,
      summary: ref.synopsis,
      external_source: "igdb",
      external_id: ref.igdbId,
      metadata: {},
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    throw new Error(insertError?.message ?? "Failed to insert media");
  }

  return inserted.id;
}

async function findMediaId(
  admin: ReturnType<typeof createAdminClient>,
  igdbId: string
): Promise<string | null> {
  const { data, error } = await admin
    .from("media")
    .select("id")
    .eq("external_source", "igdb")
    .eq("external_id", igdbId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data?.id ?? null;
}

export type SaveGameEntryInput = GameMediaRef & {
  status: MediaStatus;
  rating: number | null;
  notes?: string | null;
};

export async function saveGameEntry(input: SaveGameEntryInput) {
  const { igdbId, title, releaseDate, coverUrl, backdropUrl, synopsis, status, rating, notes } = input;

  const admin = createAdminClient();
  const mediaId = await findOrCreateMediaId(admin, {
    igdbId,
    title,
    releaseDate,
    coverUrl,
    backdropUrl,
    synopsis,
  });

  const finishedAt = status === "completed" ? new Date().toISOString().slice(0, 10) : null;

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

  revalidatePath(`/games/${igdbId}`);

  return { mediaId };
}

export async function updateFavorite(igdbId: string, isFavorite: boolean) {
  const admin = createAdminClient();
  const mediaId = await findMediaId(admin, igdbId);

  if (!mediaId) {
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

  revalidatePath(`/games/${igdbId}`);

  return { updated: true };
}

export async function updateEntryDates(
  igdbId: string,
  addedAt: string | null,
  finishedAt: string | null
) {
  const admin = createAdminClient();
  const mediaId = await findMediaId(admin, igdbId);

  if (!mediaId) {
    return { updated: false };
  }

  const { error } = await admin
    .from("user_media_entries")
    .update({
      created_at: addedAt ?? undefined,
      finished_at: finishedAt,
    })
    .eq("media_id", mediaId)
    .eq("user_id", USER_ID);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/games/${igdbId}`);

  return { updated: true };
}