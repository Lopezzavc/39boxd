export interface DeezerTrack {
  id: number;
  title: string;
  duration: number; // segundos
  explicit_lyrics?: boolean;
}

export interface DeezerGenre {
  id: number;
  name: string;
}

export interface DeezerAlbum {
  id: number;
  title: string;
  artist: {
    id: number;
    name: string;
  };
  label?: string;
  release_date?: string; // "YYYY-MM-DD"
  record_type?: string; // "album" | "ep" | "single" | etc.
  genres?: {
    data: DeezerGenre[];
  };
  nb_tracks: number;
  duration: number; // segundos totales
  cover_xl?: string;
  tracks: {
    data: DeezerTrack[];
  };
}