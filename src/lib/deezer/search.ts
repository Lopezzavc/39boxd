import type { DeezerAlbum } from "./types";

export async function getDeezerAlbumById(id: number): Promise<DeezerAlbum | null> {
  const res = await fetch(`https://api.deezer.com/album/${id}`, {
    next: { revalidate: 3600 },
  });

  if (!res.ok) return null;

  const data = await res.json();
  if (data.error) return null;

  return data as DeezerAlbum;
}