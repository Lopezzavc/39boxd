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
  artworks?: {
    url: string
    width: number
    height: number
    image_type?: { id: number; name: string }
  }[]
  screenshots?: { url: string; width: number; height: number }[]
}

export interface IgdbTimeToBeat {
  hastily?: number
  normally?: number
  completely?: number
}