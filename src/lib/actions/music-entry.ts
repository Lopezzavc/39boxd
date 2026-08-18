"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import type { MediaStatus } from "@/types/media";

const USER_ID = "00000000-0000-0000-0000-000000000000";

type MusicMediaRef = {
  deezerId: string;
  title: string;
  releaseDate: string | null;
  coverUrl: string | null;
  synopsis: string | null;
};

async function findOrCreateMediaId(
  admin: ReturnType<typeof createAdminClient>,
  ref: MusicMediaRef
): Promise<string> {
  const { data: existingMedia, error: findError } = await admin
    .from("media")
    .select("id")
    .eq("external_source", "deezer")
    .eq("external_id", ref.deezerId)
    .maybeSingle();

  if (findError) {
    throw new Error(findError.message);
  }

  if (existingMedia?.id) {
    return existingMedia.id;
  }

  const { data: inserted, error: insertError } = await admin
    .from("media")
    .insert({
      media_type: "album",
      title: ref.title,
      original_title: ref.title,
      cover_url: ref.coverUrl,
      release_date: ref.releaseDate,
      summary: ref.synopsis,
      external_source: "deezer",
      external_id: ref.deezerId,
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
  deezerId: string
): Promise<string | null> {
  const { data, error } = await admin
    .from("media")
    .select("id")
    .eq("external_source", "deezer")
    .eq("external_id", deezerId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data?.id ?? null;
}

export type SaveMusicEntryInput = MusicMediaRef & {
  status: MediaStatus;
  rating: number | null;
  notes?: string | null;
};

export async function saveMusicEntry(input: SaveMusicEntryInput) {
  const { deezerId, title, releaseDate, coverUrl, synopsis, status, rating, notes } = input;

  const admin = createAdminClient();
  const mediaId = await findOrCreateMediaId(admin, {
    deezerId,
    title,
    releaseDate,
    coverUrl,
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

  revalidatePath(`/music/${deezerId}`);

  return { mediaId };
}

export async function updateFavorite(deezerId: string, isFavorite: boolean) {
  const admin = createAdminClient();
  const mediaId = await findMediaId(admin, deezerId);

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

  revalidatePath(`/music/${deezerId}`);

  return { updated: true };
}