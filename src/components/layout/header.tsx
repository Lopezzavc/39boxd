"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useLayoutEffect } from "react";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";
import { LiquidGlass, Spring } from "@/components/liquid-glass";
import { SearchModal } from "@/components/search/SearchModal";

const categories = [
  { label: "Home", href: "/" },
  { label: "Juegos", href: "/games" },
  { label: "Películas", href: "/movies" },
  { label: "Música", href: "/music" },
];

interface SearchResult {
  id: string | number;
  title: string;
  image?: string;
  type: "game" | "movie" | "music";
  media_type?: "movie" | "tv";
}

interface GalleryEventDetail {
  isOpen: boolean;
  currentIndex: number;
  total: number;
}

type NavTarget = { left: number; top: number; width: number; height: number };

function NavPill({
  navRef,
  linkRefs,
  activeHref,
  navOffsetRef,
  activeLabel,
}: {
  navRef: React.RefObject<HTMLDivElement | null>;
  linkRefs: React.RefObject<Record<string, HTMLAnchorElement | null>>;
  activeHref: string;
  navOffsetRef: React.RefObject<{ left: number; top: number }>;
  activeLabel: string;
}) {
  const springsRef = useRef({
    left: new Spring(0, 260, 14),
    top: new Spring(0, 260, 14),
    width: new Spring(0, 260, 14),
    height: new Spring(0, 260, 14),
  });
  const initializedRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const [, forceRender] = useState(0);

  const getTargetForActive = useCallback((): NavTarget | null => {
    const activeEl = linkRefs.current[activeHref];
    const navEl = navRef.current;
    if (!activeEl || !navEl) return null;
    const navRect = navEl.getBoundingClientRect();
    const linkRect = activeEl.getBoundingClientRect();
    return {
      left: linkRect.left - navRect.left - 10,
      top: linkRect.top - navRect.top - 6,
      width: linkRect.width + 20,
      height: linkRect.height + 12,
    };
  }, [activeHref, linkRefs, navRef]);

  const startLoop = useCallback(() => {
    if (rafRef.current != null) return;
    let last = performance.now();

    const loop = (now: number) => {
      const dt = Math.min(0.032, (now - last) / 1000);
      last = now;
      const s = springsRef.current;

      s.left.update(dt);
      s.top.update(dt);
      s.width.update(dt);
      s.height.update(dt);

      forceRender((t) => t + 1);

      const allSettled = Object.values(s).every((sp) => sp.isSettled());
      if (!allSettled) {
        rafRef.current = requestAnimationFrame(loop);
      } else {
        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(loop);
  }, []);

  useEffect(() => {
    const target = getTargetForActive();
    if (!target) return;

    const s = springsRef.current;
    if (!initializedRef.current) {
      s.left.value = s.left.target = target.left;
      s.top.value = s.top.target = target.top;
      s.width.value = s.width.target = target.width;
      s.height.value = s.height.target = target.height;
      initializedRef.current = true;
      forceRender((t) => t + 1);
    } else {
      s.left.setTarget(target.left);
      s.top.setTarget(target.top);
      s.width.setTarget(target.width);
      s.height.setTarget(target.height);
    }

    startLoop();

    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [activeHref, getTargetForActive, startLoop]);

  const s = springsRef.current;

  if (!initializedRef.current) return null;

  return (
    <>
      <div
        className="absolute pointer-events-none"
        style={{
          left: navOffsetRef.current.left + s.left.value,
          top: navOffsetRef.current.top + s.top.value,
          width: s.width.value,
          height: s.height.value,
          zIndex: 0,
        }}
      >
        <span
          className="absolute inset-0 flex items-center justify-center text-sm font-medium blur-[2px] opacity-0 text-neutral-900 dark:text-neutral-50 pointer-events-none select-none"
          aria-hidden="true"
        >
          {activeLabel}
        </span>
      </div>

      <div
        className="absolute rounded-full bg-white/15 backdrop-blur-md dark:bg-white/10"
        style={{
          left: s.left.value,
          top: s.top.value,
          width: s.width.value,
          height: s.height.value,
          zIndex: 0,
        }}
      />
    </>
  );
}

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchCategory, setSearchCategory] = useState<"game" | "movie" | "music">("game");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  const [galleryState, setGalleryState] = useState<GalleryEventDetail>({
    isOpen: false,
    currentIndex: 0,
    total: 0,
  });

  const navRef = useRef<HTMLDivElement>(null);
  const outerRef = useRef<HTMLDivElement>(null);
  const linkRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const debounceRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const navOffsetRef = useRef({ left: 0, top: 0 });
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<GalleryEventDetail>).detail;
      setGalleryState(detail);
    };
    document.addEventListener("gallery-state", handler);
    return () => document.removeEventListener("gallery-state", handler);
  }, []);

  useEffect(() => {
    const openSearch = searchParams.get("openSearch");
    if (openSearch === "true") {
      setIsSearchOpen(true);
      const newUrl = window.location.pathname;
      window.history.replaceState(null, "", newUrl);
    }
  }, [searchParams]);

  const handleCloseModal = useCallback(() => {
    setIsSearchOpen(false);
    setSearchQuery("");
    setResults([]);
  }, []);

  useEffect(() => {
    if (!isSearchOpen) return;

    if (pathname?.startsWith("/games")) {
      setSearchCategory("game");
    } else if (pathname?.startsWith("/movies")) {
      setSearchCategory("movie");
    } else if (pathname?.startsWith("/music")) {
      setSearchCategory("music");
    } else {
      handleCloseModal();
    }
  }, [pathname, isSearchOpen, handleCloseModal]);

  const activeHref = useMemo(() => {
    if (!pathname || pathname === "/" || pathname === "/home") return "/";
    const match = categories.find(
      (c) => c.href !== "/" && pathname.startsWith(c.href)
    );
    return match?.href ?? "/";
  }, [pathname]);

  const defaultCategory = pathname?.startsWith("/movies")
    ? "movie"
    : pathname?.startsWith("/music")
    ? "music"
    : "game";

  useLayoutEffect(() => {
    const updateOffset = () => {
      const outer = outerRef.current;
      const nav = navRef.current;
      if (!outer || !nav) return;
      const outerRect = outer.getBoundingClientRect();
      const navRect = nav.getBoundingClientRect();
      navOffsetRef.current = {
        left: navRect.left - outerRect.left,
        top: navRect.top - outerRect.top,
      };
    };
    updateOffset();
    window.addEventListener("resize", updateOffset);
    return () => window.removeEventListener("resize", updateOffset);
  }, [activeHref, pathname]);

  const performSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    if (searchCategory === "music") {
      setLoading(true);
      try {
        const res = await fetch(`/api/deezer-search?q=${encodeURIComponent(searchQuery)}`, {
          signal: controller.signal,
        });
        const data = await res.json();
        if (!controller.signal.aborted) setResults(data.results || []);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error(err);
          setResults([]);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
      return;
    }

    setLoading(true);
    try {
      if (searchCategory === "game") {
        const res = await fetch(`/api/igdb-search?q=${encodeURIComponent(searchQuery)}`, {
          signal: controller.signal,
        });
        const data = await res.json();
        const games = (data.results || data).map((item: any) => ({
          id: item.id,
          title: item.name,
          image: item.cover?.url?.replace("t_thumb", "t_cover_big") || "",
          type: "game" as const,
        }));
        if (!controller.signal.aborted) setResults(games);
      } else if (searchCategory === "movie") {
        const res = await fetch(`/api/tmdb-search?q=${encodeURIComponent(searchQuery)}`, {
          signal: controller.signal,
        });
        const data = await res.json();
        if (!controller.signal.aborted) setResults(data.results || []);
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        console.error(err);
        setResults([]);
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [searchQuery, searchCategory]);

  useEffect(() => {
    if (!isSearchOpen) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      performSearch();
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery, searchCategory, isSearchOpen, performSearch]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  function handleInputClick() {
    if (
      !pathname?.startsWith("/games") &&
      !pathname?.startsWith("/movies") &&
      !pathname?.startsWith("/music")
    ) {
      router.push("/games?openSearch=true");
      return;
    }

    if (!isSearchOpen) {
      setSearchCategory(defaultCategory as "game" | "movie" | "music");
      setIsSearchOpen(true);
    }
  }

  function handleCategoryChange(val: string) {
    setSearchCategory(val as "game" | "movie" | "music");
  }

  const { isOpen: isGalleryOpen, currentIndex, total } = galleryState;

  const activeLabel = categories.find((c) => c.href === activeHref)?.label ?? "";

  return (
    <>
      <div className="sticky top-4 z-50 w-full">
        <div className="flex justify-center">
          <div className="relative inline-flex" ref={outerRef}>
            <LiquidGlass
              width="fit-content"
              height={50}
              borderRadius={50 / 2}
              surfaceType="convex_squircle"
              bezelWidth={25}
              glassThickness={50}
              refractiveIndex={1.5}
              refractionScale={1.5}
              specularOpacity={0.3}
              blur={1}
              tintColor="rgb(40, 40, 40)"
              tintOpacity={0.4}
              className="pl-6 pr-[9.3px]"
              saturation={1}
            >
              <div className="flex items-center translate-y-[0.5px]">
                <div className="flex items-center gap-7">
                  <div className="flex items-center gap-3 translate-y-[0px]">
                    <img
                      src="/assets/iconwhite.webp"
                      alt="App icon"
                      className="mr-0 h-7 w-7"
                    />
                    <span className="shrink-0 text-sm font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
                      DATA
                    </span>
                  </div>

                  <nav ref={navRef} className="relative flex shrink-0 gap-6">
                    <NavPill
                      navRef={navRef}
                      linkRefs={linkRefs}
                      activeHref={activeHref}
                      navOffsetRef={navOffsetRef}
                      activeLabel={activeLabel}
                    />

                    {categories.map((c) => {
                      const active =
                        c.href === "/"
                          ? pathname === "/" || pathname === "/home"
                          : pathname?.startsWith(c.href);
                      return (
                        <Link
                          key={c.href}
                          href={c.href}
                          ref={(el) => {
                            linkRefs.current[c.href] = el;
                          }}
                          className={
                            active
                              ? "relative z-10 text-sm font-medium text-neutral-900 dark:text-neutral-50"
                              : "relative z-10 text-sm font-medium text-neutral-500 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-50"
                          }
                        >
                          {c.label}
                        </Link>
                      );
                    })}
                  </nav>
                </div>

                <div className="ml-7 w-56 shrink-0 ">
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onClick={handleInputClick}
                    placeholder="Buscar..."
                    className="rounded-full border-neutral-200 bg-neutral-50 text-sm placeholder:text-neutral-400 focus-visible:ring-1 focus-visible:ring-neutral-900 dark:border-neutral-800 dark:bg-neutral-800 dark:placeholder:text-neutral-500 dark:focus-visible:ring-neutral-50"
                  />
                </div>
              </div>
            </LiquidGlass>

            {isGalleryOpen && total > 0 && (
              <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2">
                <div className="relative">
                  <span
                    className="absolute inset-0 flex items-center justify-center text-sm font-medium blur-[1px] opacity-50 text-neutral-900 dark:text-neutral-50 pointer-events-none select-none"
                    aria-hidden="true"
                  >
                    {currentIndex + 1}/{total}
                  </span>
                  <LiquidGlass
                    width={80}
                    height={50}
                    borderRadius={25}
                    surfaceType="convex_squircle"
                    bezelWidth={25}
                    glassThickness={50}
                    refractiveIndex={1.5}
                    refractionScale={1.5}
                    specularOpacity={0.3}
                    blur={1.5}
                    tintColor="rgb(40, 40, 40)"
                    tintOpacity={0.5}
                    className="flex justify-center items-center"
                  >
                    <span className="text-sm font-medium tabular-nums text-neutral-900 dark:text-neutral-50 w-full text-center">
                      {currentIndex + 1}/{total}
                    </span>
                  </LiquidGlass>
                </div>
              </div>
            )}
          </div>
        </div>

        {isSearchOpen && (
          <div className="absolute right-4 top-0 flex items-center h-full">
            <LiquidGlass
              width={50}
              height={50}
              borderRadius={50 / 2}
              surfaceType="convex_squircle"
              bezelWidth={25}
              glassThickness={50}
              refractiveIndex={1.5}
              refractionScale={1.5}
              specularOpacity={0.3}
              blur={1.5}
              tintColor="rgb(40, 40, 40)"
              tintOpacity={0.5}
              className="flex justify-center items-center cursor-pointer"
            >
              <button
                onClick={handleCloseModal}
                aria-label="Cerrar búsqueda"
                className="flex items-center justify-center w-full h-full"
              >
                <X className="w-6 h-6 text-neutral-200" />
              </button>
            </LiquidGlass>
          </div>
        )}
      </div>

      <SearchModal
        isOpen={isSearchOpen}
        onClose={handleCloseModal}
        query={searchQuery}
        results={results}
        loading={loading}
        category={searchCategory}
        onCategoryChange={handleCategoryChange}
        defaultCategory={defaultCategory}
      />
    </>
  );
}