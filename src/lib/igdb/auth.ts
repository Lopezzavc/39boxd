let cachedToken: { access_token: string; expires_at: number } | null = null

export async function getTwitchToken(): Promise<string> {
  if (cachedToken && cachedToken.expires_at > Date.now()) {
    return cachedToken.access_token
  }

  const res = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${process.env.TWITCH_CLIENT_ID}&client_secret=${process.env.TWITCH_CLIENT_SECRET}&grant_type=client_credentials`,
    { method: 'POST' }
  )

  if (!res.ok) {
    throw new Error(`Twitch auth failed: ${res.status}`)
  }

  const data = (await res.json()) as { access_token: string; expires_in: number }

  cachedToken = {
    access_token: data.access_token,
    expires_at: Date.now() + data.expires_in * 1000 - 60_000,
  }

  return cachedToken.access_token
}