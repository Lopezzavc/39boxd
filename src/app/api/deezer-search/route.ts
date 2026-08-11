import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q");
  if (!q) return NextResponse.json({ results: [] });

  try {
    const res = await fetch(`https://api.deezer.com/search/album?q=${encodeURIComponent(q)}&limit=20`);
    const data = await res.json();

    const results = (data.data || []).map((album: any) => ({
      id: album.id,
      title: album.title,
      artist: album.artist?.name,
      image: album.cover_medium || album.cover_big || null,
      type: "music" as const,
    }));

    return NextResponse.json({ results });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ results: [] });
  }
}