"use client";

import { useEffect, useState, useTransition } from "react";
import { GameResultCard } from "./game-result-card";
import type { IgdbGame } from "@/lib/igdb/types";

export function GameSearch({ initialQuery }: { initialQuery: string }) {
  const [results, setResults] = useState<IgdbGame[]>([]);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!initialQuery.trim()) {
      setResults([]);
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/igdb-search?q=${encodeURIComponent(initialQuery)}`);
        if (!res.ok) throw new Error("Search failed");
        const data: IgdbGame[] = await res.json();
        setResults(data);
      } catch {
        setError("No se pudo buscar. Intenta de nuevo.");
      }
    });
  }, [initialQuery]);

  if (isPending) {
    return <p className="text-sm text-muted-foreground dark:text-neutral-400">Buscando...</p>;
  }

  if (error) {
    return <p className="text-sm text-red-500 dark:text-red-400">{error}</p>;
  }

  if (!initialQuery.trim()) {
    return (
      <p className="text-sm text-muted-foreground dark:text-neutral-400">
        Usa la barra de búsqueda para encontrar juegos.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
      {results.map((game) => (
        <GameResultCard key={game.id} game={game} />
      ))}
    </div>
  );
}