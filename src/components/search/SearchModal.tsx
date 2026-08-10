"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SearchResult {
  id: string | number;
  title: string;
  image?: string;
  type: "game" | "movie" | "music";
}

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  query: string;
  results: SearchResult[];
  loading: boolean;
  category: "game" | "movie" | "music";
  onCategoryChange: (val: string) => void;
  defaultCategory: "game" | "movie" | "music" | "all";
}

const categoryTitles: Record<string, string> = {
  game: "Juegos",
  movie: "Películas / Series / Animes",
  music: "Música",
};

export function SearchModal({
  isOpen,
  onClose,
  query,
  results,
  loading,
  category,
  onCategoryChange,
  defaultCategory,
}: SearchModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col bg-neutral-950/95 backdrop-blur-md text-neutral-100 overflow-y-auto scrollbar-hide"
      style={{ paddingTop: "3rem" }}
    >
      <div className="flex items-center justify-between px-8 py-4 pb-0">
        <h2 className="text-2xl font-semibold">
          {categoryTitles[category] || "Buscar"}
        </h2>
      </div>

      <div className="flex gap-3 px-8 pb-5">
        {defaultCategory === "all" && (
          <Select value={category} onValueChange={onCategoryChange}>
            <SelectTrigger className="w-[150px] bg-white/10 border-white/20 text-neutral-200">
              <SelectValue placeholder="Categoría" />
            </SelectTrigger>
            <SelectContent className="bg-neutral-900 border-white/20 text-neutral-200">
              <SelectItem value="game">Juegos</SelectItem>
              <SelectItem value="movie">Películas</SelectItem>
              <SelectItem value="music">Música</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="px-8 pb-8">
        {loading && (
          <div className="flex justify-center py-20">
            <div className="loader" />
          </div>
        )}

        {!loading && results.length === 0 && query && (
          <p className="text-center text-neutral-400 text-lg py-20">
            “{query}”
          </p>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-9 gap-6">
          {results.map((item) => (
            <button
              key={item.id}
              onClick={onClose}
              className="text-left group"
            >
              <div className="aspect-[2/3] rounded-xl overflow-hidden bg-neutral-800 border border-white/10">
                {item.image ? (
                  <img
                    src={item.image}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-neutral-500 text-sm">
                    Sin imagen
                  </div>
                )}
              </div>
              <p className="mt-2 text-sm font-medium text-neutral-200 truncate">
                {item.title}
              </p>
              <p className="text-xs text-neutral-500 capitalize">{item.type}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}