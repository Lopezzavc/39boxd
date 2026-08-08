import { z } from 'zod'

export const mediaTypeSchema = z.enum(['game', 'movie', 'series', 'album', 'ep'])
export type MediaType = z.infer<typeof mediaTypeSchema>

export const mediaStatusSchema = z.enum([
  'backlog',
  'in_progress',
  'completed',
  'dropped',
  'on_hold',
])
export type MediaStatus = z.infer<typeof mediaStatusSchema>

export const gameMetadataSchema = z.object({
  developer: z.string().optional(),
  publisher: z.string().optional(),
  platforms: z.array(z.string()).default([]),
  genres: z.array(z.string()).default([]),
  igdb_rating: z.number().optional(),
})
export type GameMetadata = z.infer<typeof gameMetadataSchema>

export const movieMetadataSchema = z.object({
  director: z.string().optional(),
  runtime_minutes: z.number().optional(),
  budget: z.number().optional(),
  genres: z.array(z.string()).default([]),
})
export type MovieMetadata = z.infer<typeof movieMetadataSchema>

export const seriesMetadataSchema = z.object({
  creator: z.string().optional(),
  episode_count: z.number().optional(),
  seasons_count: z.number().optional(),
  genres: z.array(z.string()).default([]),
})
export type SeriesMetadata = z.infer<typeof seriesMetadataSchema>

export const mediaSchema = z.object({
  id: z.string().uuid(),
  media_type: mediaTypeSchema,
  title: z.string(),
  original_title: z.string().nullable(),
  cover_url: z.string().nullable(),
  release_date: z.string().nullable(),
  summary: z.string().nullable(),
  external_source: z.string(),
  external_id: z.string(),
  metadata: z.record(z.string(), z.unknown()),
  created_at: z.string(),
  updated_at: z.string(),
})
export type Media = z.infer<typeof mediaSchema>

export function parseMediaMetadata(mediaType: MediaType, metadata: unknown) {
  switch (mediaType) {
    case 'game':
      return gameMetadataSchema.parse(metadata)
    case 'movie':
      return movieMetadataSchema.parse(metadata)
    case 'series':
      return seriesMetadataSchema.parse(metadata)
    default:
      throw new Error(`Metadata schema not implemented for media_type: ${mediaType}`)
  }
}