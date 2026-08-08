import { createAdminClient } from '@/lib/supabase/admin'
import { mapIgdbGameToMedia } from './mapper'
import type { IgdbGame } from './types'

export async function syncIgdbGames(games: IgdbGame[]) {
  const supabase = createAdminClient()
  const mapped = games.map(mapIgdbGameToMedia)

  const { data, error } = await supabase
    .from('media')
    .upsert(mapped, { onConflict: 'external_source,external_id' })
    .select()

  if (error) {
    throw new Error(`Sync failed: ${error.message}`)
  }

  return data
}