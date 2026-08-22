import { getTwitchToken } from './auth'

const IGDB_BASE_URL = 'https://api.igdb.com/v4'

export async function igdbQuery<T>(endpoint: string, query: string): Promise<T> {
  const token = await getTwitchToken()

  const res = await fetch(`${IGDB_BASE_URL}/${endpoint}`, {
    method: 'POST',
    headers: {
      'Client-ID': process.env.TWITCH_CLIENT_ID!,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'text/plain',
    },
    body: query,
    next: { revalidate: 3600 },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`IGDB query failed: ${res.status} ${text}`)
  }

  return res.json() as Promise<T>
}