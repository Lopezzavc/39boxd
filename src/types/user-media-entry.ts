import { z } from 'zod'
import { mediaStatusSchema } from './media'

export const userMediaEntrySchema = z.object({
  id: z.string().uuid(),
  media_id: z.string().uuid(),
  status: mediaStatusSchema,
  rating: z.number().min(1).max(10).nullable(),
  started_at: z.string().nullable(),
  finished_at: z.string().nullable(),
  is_favorite: z.boolean(),
  notes: z.string().nullable(),
  review: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
})
export type UserMediaEntry = z.infer<typeof userMediaEntrySchema>