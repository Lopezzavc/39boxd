import { GameSearch } from "@/components/media/game-search";

export default async function GamesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  return <GameSearch initialQuery={q ?? ""} />;
}