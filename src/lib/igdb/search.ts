import { igdbQuery } from "./client";
import type { IgdbGame } from "./types";

export async function searchIgdbGames(query: string): Promise<IgdbGame[]> {
  const sanitized = query.replace(/"/g, '\\"');

  const body = `
    search "${sanitized}";
    fields id, name, summary, first_release_date, cover.url,
      involved_companies.company.name, involved_companies.developer,
      involved_companies.publisher, platforms.name, genres.name, total_rating;
    limit 20;
  `;

  return igdbQuery<IgdbGame[]>("games", body);
}

export async function getIgdbGameById(id: number): Promise<IgdbGame | undefined> {
  const body = `
    fields id, name, summary, first_release_date, cover.url,
      involved_companies.company.name, involved_companies.developer,
      involved_companies.publisher, platforms.name, genres.name, total_rating;
    where id = ${id};
  `;
  const results = await igdbQuery<IgdbGame[]>("games", body);
  return results[0];
}