export interface IgdbGame {
  id: number
  name: string
  summary?: string
  first_release_date?: number
  cover?: { url: string }
  involved_companies?: {
    company: { name: string }
    developer: boolean
    publisher: boolean
  }[]
  platforms?: { name: string }[]
  genres?: { name: string }[]
  total_rating?: number
}