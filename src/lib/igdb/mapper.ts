import type { IgdbGame } from './types'
import { gameMetadataSchema, type GameMetadata } from '@/types/media'

export interface MappedMedia {
  media_type: 'game'
  title: string
  original_title: string | null
  cover_url: string | null
  release_date: string | null
  summary: string | null
  external_source: 'igdb'
  external_id: string
  metadata: GameMetadata
}

function mapCoverUrl(url?: string): string | null {
  if (!url) return null
  return `https:${url.replace('t_thumb', 't_cover_big')}`
}

function mapReleaseDate(unixTimestamp?: number): string | null {
  if (!unixTimestamp) return null
  return new Date(unixTimestamp * 1000).toISOString().split('T')[0] ?? null
}

export function mapIgdbGameToMedia(game: IgdbGame): MappedMedia {
  const developer = game.involved_companies?.find((c) => c.developer)?.company.name
  const publisher = game.involved_companies?.find((c) => c.publisher)?.company.name

  const rawMetadata = {
    developer,
    publisher,
    platforms: game.platforms?.map((p) => p.name) ?? [],
    genres: game.genres?.map((g) => g.name) ?? [],
    igdb_rating: game.total_rating,
  }

  const metadata = gameMetadataSchema.parse(rawMetadata)

  return {
    media_type: 'game',
    title: game.name,
    original_title: null,
    cover_url: mapCoverUrl(game.cover?.url),
    release_date: mapReleaseDate(game.first_release_date),
    summary: game.summary ?? null,
    external_source: 'igdb',
    external_id: String(game.id),
    metadata,
  }
}