"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { logout } from "@/lib/actions/auth";
import GlassSurface from '@/components/GlassSurface'

const categories = [
  { label: "Juegos", href: "/games" },
  { label: "Películas", href: "/movies" },
  { label: "Música", href: "/music" },
];

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const navRef = useRef<HTMLDivElement>(null);
  const linkRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const [indicator, setIndicator] = useState<{ left: number; width: number; top: number; height: number } | null>(null);

  const activeHref =
    categories.find((c) => pathname.startsWith(c.href))?.href ?? "/games";

  useEffect(() => {
    const activeEl = linkRefs.current[activeHref];
    const navEl = navRef.current;
    if (!activeEl || !navEl) return;

    const navRect = navEl.getBoundingClientRect();
    const linkRect = activeEl.getBoundingClientRect();

    setIndicator({
      left: linkRect.left - navRect.left - 10,
      top: linkRect.top - navRect.top - 6,
      width: linkRect.width + 20,
      height: linkRect.height + 12,
    });
  }, [activeHref]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const base = pathname.startsWith("/movies")
      ? "/movies"
      : pathname.startsWith("/music")
        ? "/music"
        : "/games";
    router.push(`${base}?q=${encodeURIComponent(query)}`);
  }

  return (
    <div className="sticky top-4 z-50 mx-auto max-w-4xl px-4">
      <GlassSurface
        width="100%"
        height={64}
        borderRadius={32}
        borderWidth={0}
        brightness={50}
        opacity={1}
        blur={5}
        displace={3}
        backgroundOpacity={0.1}
        saturation={1}
        distortionScale={-150}
        redOffset={0}
        greenOffset={10}
        blueOffset={20}
        xChannel="R"
        yChannel="B"
        mixBlendMode="difference"
        className="!justify-start px-6"
      >
        <div className="flex w-full min-w-0 items-center gap-8">
          <span className="shrink-0 text-sm font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
            39boxd
          </span>

          <nav ref={navRef} className="relative flex shrink-0 gap-6">
            {indicator && (
              <span
                className="absolute rounded-full bg-neutral-900/10 transition-all duration-300 ease-out dark:bg-neutral-50/10"
                style={{
                  left: indicator.left,
                  top: indicator.top,
                  width: indicator.width,
                  height: indicator.height,
                }}
              />
            )}
            {categories.map((c) => {
              const active = pathname.startsWith(c.href);
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

          <form onSubmit={handleSearch} className="min-w-0 flex-1">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar..."
              className="max-w-sm rounded-full border-neutral-200 bg-neutral-50 text-sm placeholder:text-neutral-400 focus-visible:ring-1 focus-visible:ring-neutral-900 dark:border-neutral-800 dark:bg-neutral-800 dark:placeholder:text-neutral-500 dark:focus-visible:ring-neutral-50"
            />
          </form>

          <form action={logout}>
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="rounded-full text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-50"
            >
              Cerrar sesión
            </Button>
          </form>
        </div>
      </GlassSurface>
    </div>
  );
}