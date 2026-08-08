"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { igdbQuery } from "@/lib/igdb/client";
import { mapIgdbGameToMedia } from "@/lib/igdb/mapper";
import { addMediaEntrySchema, type AddMediaEntryInput } from "@/types/add-media-entry";
import type { IgdbGame } from "@/lib/igdb/types";
import { revalidatePath } from "next/cache";

export async function addMediaEntry(input: AddMediaEntryInput) {
  const parsed = addMediaEntrySchema.parse(input);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  const admin = createAdminClient();

  const { data: existingMedia } = await admin
    .from("media")
    .select("id")
    .eq("external_source", "igdb")
    .eq("external_id", String(parsed.igdbGameId))
    .maybeSingle();

  let mediaId = existingMedia?.id;

  if (!mediaId) {
    const games = await igdbQuery<IgdbGame[]>(
      "games",
      `where id = ${parsed.igdbGameId}; fields id, name, summary, first_release_date, cover.url, involved_companies.company.name, involved_companies.developer, involved_companies.publisher, platforms.name, genres.name, total_rating; limit 1;`
    );

    const game = games[0];
    if (!game) {
      throw new Error("Game not found in IGDB");
    }

    const mapped = mapIgdbGameToMedia(game);

    const { data: inserted, error: insertError } = await admin
      .from("media")
      .upsert(mapped, { onConflict: "external_source,external_id" })
      .select("id")
      .single();

    if (insertError || !inserted) {
      throw new Error(insertError?.message ?? "Failed to insert media");
    }

    mediaId = inserted.id;
  }

  const { error: entryError } = await supabase.from("user_media_entries").upsert(
    {
      media_id: mediaId,
      user_id: user.id,
      status: parsed.status,
      rating: parsed.rating ?? null,
      notes: parsed.notes ?? null,
      is_favorite: parsed.isFavorite,
    },
    { onConflict: "media_id,user_id" }
  );

  if (entryError) {
    throw new Error(entryError.message);
  }

  revalidatePath("/");

  return { mediaId };
}