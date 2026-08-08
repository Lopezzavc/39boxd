import { NextRequest, NextResponse } from "next/server";
import { searchIgdbGames } from "@/lib/igdb/search";

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q");

  if (!query) {
    return NextResponse.json({ error: "Missing query param 'q'" }, { status: 400 });
  }

  const games = await searchIgdbGames(query);
  return NextResponse.json(games);
}