import { getTwitchToken } from './auth'

const IGDB_BASE_URL = 'https://api.igdb.com/v4'

export async function igdbQuery<T>(endpoint: string, query: string): Promise<T> {
  const token = await getTwitchToken()

  console.log('--- IGDB QUERY ---')
  console.log(query)

  const res = await fetch(`${IGDB_BASE_URL}/${endpoint}`, {
    method: 'POST',
    headers: {
      'Client-ID': process.env.TWITCH_CLIENT_ID!,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'text/plain',
    },
    body: query,
  })

  const text = await res.text()
  console.log('--- IGDB RESPONSE STATUS ---', res.status)
  console.log('--- IGDB RESPONSE BODY ---')
  console.log(text)

  if (!res.ok) {
    throw new Error(`IGDB query failed: ${res.status} ${text}`)
  }

  return JSON.parse(text) as T
}