import { z } from "zod";
import { mediaStatusSchema } from "./media";

export const addMediaEntrySchema = z.object({
  igdbGameId: z.number().int().positive(),
  status: mediaStatusSchema,
  rating: z.number().min(1).max(10).multipleOf(0.5).nullable().optional(),
  notes: z.string().nullable().optional(),
  isFavorite: z.boolean().optional().default(false),
});

export type AddMediaEntryInput = z.infer<typeof addMediaEntrySchema>;