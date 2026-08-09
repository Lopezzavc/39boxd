"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addMediaEntry } from "@/lib/actions/add-media-entry";
import type { IgdbGame } from "@/lib/igdb/types";

const STATUS_OPTIONS = [
  { value: "backlog", label: "Backlog" },
  { value: "in_progress", label: "Jugando" },
  { value: "completed", label: "Completado" },
  { value: "dropped", label: "Abandonado" },
] as const;

export function GameResultCard({ game }: { game: IgdbGame }) {
  const [status, setStatus] = useState<string>("backlog");
  const [isPending, startTransition] = useTransition();
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const coverUrl = game.cover?.url
    ? `https:${game.cover.url.replace("t_thumb", "t_cover_big")}`
    : null;

  function handleAdd() {
    setError(null);
    startTransition(async () => {
      try {
        await addMediaEntry({
          igdbGameId: game.id,
          status: status as any,
          isFavorite: false,
        });
        setAdded(true);
      } catch {
        setError("Error al agregar");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-md bg-neutral-100 dark:bg-neutral-800">
        {coverUrl ? (
          <Image
            src={coverUrl} alt={game.name} fill sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw" className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-neutral-400 dark:text-neutral-500">
            Sin portada
          </div>
        )}
      </div>

      <p className="line-clamp-2 text-sm font-medium text-neutral-900 dark:text-neutral-50">{game.name}</p>

      <Select value={status} onValueChange={setStatus}>
        <SelectTrigger className="h-8 text-xs dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100">
          {STATUS_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        size="sm"
        variant={added ? "secondary" : "default"}
        disabled={isPending || added}
        onClick={handleAdd}
        className="dark:disabled:opacity-50"
      >
        {added ? "Agregado" : isPending ? "Agregando..." : "Agregar"}
      </Button>

      {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}
    </div>
  );
}