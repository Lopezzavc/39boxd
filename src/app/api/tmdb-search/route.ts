import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q");
  if (!q) return NextResponse.json({ results: [] });

  const res = await fetch(
    `https://api.themoviedb.org/3/search/multi?query=${encodeURIComponent(q)}&language=es`,
    { headers: { Authorization: `Bearer ${process.env.TMDB_ACCESS_TOKEN}` } }
  );
  const data = await res.json();
  const results = (data.results || [])
    .filter((item: any) => item.media_type === "movie" || item.media_type === "tv")
    .map((item: any) => ({
      id: item.id,
      title: item.title || item.name,
      image: item.poster_path
        ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
        : null,
      type: "movie",
      media_type: item.media_type,
    }));
  return NextResponse.json({ results });
}