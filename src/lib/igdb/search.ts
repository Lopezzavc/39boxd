import { igdbQuery } from "./client";
import type { IgdbGame, IgdbTimeToBeat } from "./types";

export async function searchIgdbGames(query: string): Promise<IgdbGame[]> {
  const sanitized = query.replace(/"/g, '\\"');

  const body = `
    search "${sanitized}";
    fields id, name, cover.url, total_rating;
    where total_rating != null;
    limit 50;
  `;

  return igdbQuery<IgdbGame[]>("games", body);
}

export async function getIgdbGameById(id: number): Promise<IgdbGame | undefined> {
  const body = `
    fields id, name, summary, first_release_date, cover.url,
      involved_companies.company.name, involved_companies.developer,
      involved_companies.publisher, platforms.name, genres.name, total_rating,
      artworks.url, artworks.width, artworks.height, artworks.image_type.name,
      screenshots.url, screenshots.width, screenshots.height;
    where id = ${id};
  `;
  const results = await igdbQuery<IgdbGame[]>("games", body);
  return results[0];
}

export async function getIgdbTimeToBeat(gameId: number): Promise<IgdbTimeToBeat | undefined> {
  const body = `
    fields hastily, normally, completely;
    where game_id = ${gameId};
  `;
  const results = await igdbQuery<IgdbTimeToBeat[]>("game_time_to_beats", body);
  return results[0];
}