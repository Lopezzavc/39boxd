"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import SpecularBorder from "@/components/SpecularBorder";
import PixelRevealOverlay, { PixelRevealHandle } from "@/components/PixelRevealOverlay";

interface SearchResult {
  id: string | number;
  title: string;
  image?: string;
  type: "game" | "movie" | "music";
  media_type?: "movie" | "tv";
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
  const scriptInjected = useRef(false);
  const router = useRouter();

  // Refs de la animación por card (una por resultado, indexadas por id).
  const pixelRefs = useRef<Map<string | number, PixelRevealHandle | null>>(new Map());
  // Id de la card que está animando/navegando, para bloquear clicks concurrentes.
  const [navigatingId, setNavigatingId] = useState<string | number | null>(null);

  useEffect(() => {
    if (!scriptInjected.current) {
      const script = document.createElement("script");
      script.type = "speculationrules";
      script.textContent = JSON.stringify({
        prerender: [
          {
            source: "document",
            where: { selector: "a[data-prerender]" },
            eagerness: "moderate",
          },
        ],
      });
      document.head.appendChild(script);
      scriptInjected.current = true;

      return () => {
        script.remove();
        scriptInjected.current = false;
      };
    }
  }, []);

  // Red de seguridad adicional: como este componente vive en el layout raíz
  // y nunca se desmonta entre búsquedas/navegaciones, cada vez que el modal
  // se cierra reseteamos el "lock" de navegación. Esto cubre cualquier
  // camino (incluido el fallback) que pudiera dejarlo pegado en un id viejo.
  useEffect(() => {
    if (!isOpen) {
      setNavigatingId(null);
    }
  }, [isOpen]);

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
          {results.map((item) => {
            const href =
              item.type === "movie"
                ? `/movies/${item.id}?type=${item.media_type === "tv" ? "tv" : "movie"}`
                : item.type === "game"
                ? `/games/${item.id}`
                : item.type === "music"
                ? `/music/${item.id}`
                : "#";
            const isPrerenderable = item.type === "movie" || item.type === "game" || item.type === "music";
            const isNavigating = navigatingId === item.id;

            return (
              <Link
                key={item.id}
                href={isPrerenderable ? href : "#"}
                data-prerender={isPrerenderable ? "true" : undefined}
                aria-disabled={navigatingId !== null && !isNavigating ? true : undefined}
                onClick={(e) => {
                  if (!isPrerenderable) {
                    e.preventDefault();
                    onClose();
                    return;
                  }

                  // Siempre bloqueamos la navegación por defecto de next/link:
                  // primero se reproduce la animación sobre la card, y recién
                  // al terminar se navega manualmente vía router.push.
                  e.preventDefault();

                  if (navigatingId !== null) return; // evita doble click

                  setNavigatingId(item.id);
                  const overlay = pixelRefs.current.get(item.id);

                  if (!overlay) {
                    // Fallback por si el overlay no montó: navega igual,
                    // pero liberamos el lock para no dejarlo pegado.
                    setNavigatingId(null);
                    onClose();
                    router.push(href);
                    return;
                  }

                  overlay.play(() => {
                    // Liberamos el lock ANTES de navegar/cerrar, así el
                    // próximo click (nueva búsqueda incluida) queda libre
                    // sin depender de que el componente se remonte.
                    setNavigatingId(null);
                    onClose();
                    router.push(href);
                  });
                }}
                className="text-left group block transition-transform duration-200 hover:scale-108"
              >
                <SpecularBorder borderRadius={12} bezelWidth={12} specularOpacity={0.5}>
                  <div
                    className={
                      (item.type === "music"
                        ? "aspect-square"
                        : "aspect-[2/3]") +
                      " relative rounded-xl overflow-hidden bg-neutral-800 border border-white/10"
                    }
                  >
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-neutral-500 text-sm">
                        Sin imagen
                      </div>
                    )}

                    {isPrerenderable && (
                      <PixelRevealOverlay
                        maxFadeOpacity={0.9}
                        ref={(node) => {
                          if (node) pixelRefs.current.set(item.id, node);
                          else pixelRefs.current.delete(item.id);
                        }}
                      />
                    )}
                  </div>
                </SpecularBorder>
                <p className="mt-2 text-sm font-medium text-neutral-200 truncate">
                  {item.title}
                </p>
                <p className="text-xs text-neutral-500 capitalize">{item.type}</p>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}