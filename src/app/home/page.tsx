import { createAdminClient } from "@/lib/supabase/admin";
import HomeSections from "./HomeSections";

export const metadata = {
  title: "DATA - Home",
};

const USER_ID = "00000000-0000-0000-0000-000000000000";

export type HomeMediaType = "game" | "movie" | "series" | "album";
export type HomeContentType = "movie" | "tv_live_action" | "tv_animated" | "anime";

export type HomeItem = {
  id: string;
  title: string;
  coverUrl: string | null;
  backdropUrl: string | null;
  externalId: string;
  mediaType: HomeMediaType;
  contentType: HomeContentType | null;
  rating: number | null;
  finishedAt: string | null;
  isFavorite: boolean;
};

type MediaRelation = {
  id: string;
  media_type: HomeMediaType;
  content_type: HomeContentType | null;
  title: string;
  cover_url: string | null;
  backdrop_url: string | null;
  external_id: string;
};

// Supabase tipa la relación embebida `media:media_id (...)` como array
// (aunque en runtime sea un único registro por la FK), así que aceptamos
// ambas formas y normalizamos.
type EntryRow = {
  id: string;
  rating: number | null;
  finished_at: string | null;
  is_favorite: boolean | null;
  media: MediaRelation | MediaRelation[] | null;
};

function toExternalId(row: EntryRow): HomeItem | null {
  const media = Array.isArray(row.media) ? row.media[0] : row.media;
  if (!media) return null;

  return {
    id: row.id,
    title: media.title,
    coverUrl: media.cover_url,
    backdropUrl: media.backdrop_url,
    externalId: media.external_id,
    mediaType: media.media_type,
    contentType: media.content_type,
    rating: row.rating,
    finishedAt: row.finished_at,
    isFavorite: row.is_favorite ?? false,
  };
}

export default async function HomePage() {
  const admin = createAdminClient();

  const baseSelect = `
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
      external_id
    )
  `;

  const [wishlistRes, recentRes, favoritesRes] = await Promise.all([
    admin
      .from("user_media_entries")
      .select(baseSelect)
      .eq("user_id", USER_ID)
      .eq("status", "backlog")
      .order("updated_at", { ascending: true }),
    admin
      .from("user_media_entries")
      .select(baseSelect)
      .eq("user_id", USER_ID)
      .eq("status", "completed")
      .not("rating", "is", null)
      .order("updated_at", { ascending: false, nullsFirst: false }),
    admin
      .from("user_media_entries")
      .select(baseSelect)
      .eq("user_id", USER_ID)
      .eq("is_favorite", true)
      .not("rating", "is", null)
      .order("rating", { ascending: false, nullsFirst: false }),
  ]);

  if (wishlistRes.error) throw new Error(wishlistRes.error.message);
  if (recentRes.error) throw new Error(recentRes.error.message);
  if (favoritesRes.error) throw new Error(favoritesRes.error.message);

  const wishlist = ((wishlistRes.data ?? []) as unknown as EntryRow[])
    .map(toExternalId)
    .filter((x): x is HomeItem => x !== null);
  const recent = ((recentRes.data ?? []) as unknown as EntryRow[])
    .map(toExternalId)
    .filter((x): x is HomeItem => x !== null);
  const favorites = ((favoritesRes.data ?? []) as unknown as EntryRow[])
    .map(toExternalId)
    .filter((x): x is HomeItem => x !== null);

  return <HomeSections wishlist={wishlist} recent={recent} favorites={favorites} />;
}