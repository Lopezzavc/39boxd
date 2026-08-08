"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { searchIgdbGames, getIgdbGameById } from "@/lib/igdb/search";
import { mapIgdbGameToMedia } from "@/lib/igdb/mapper";
import { revalidatePath } from "next/cache";

export async function searchGamesAction(query: string) {
  if (!query.trim()) return [];
  return searchIgdbGames(query);
}

export async function addGameToLibraryAction(igdbGameId: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const admin = createAdminClient();

  const games = await searchIgdbGames(`id = ${igdbGameId}`);
  const game = await getIgdbGameById(igdbGameId);
  if (!game) throw new Error("Juego no encontrado en IGDB");

  const mapped = mapIgdbGameToMedia(game);

  const { data: mediaRow, error: mediaError } = await admin
    .from("media")
    .upsert(mapped, { onConflict: "external_source,external_id" })
    .select("id")
    .single();

  if (mediaError) throw mediaError;

  const { error: entryError } = await supabase
    .from("user_media_entries")
    .insert({ media_id: mediaRow.id, status: "backlog" });

  if (entryError) throw entryError;

  revalidatePath("/library");
}