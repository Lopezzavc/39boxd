"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LogOut } from "lucide-react";
import { Input } from "@/components/ui/input";
import { logout } from "@/lib/actions/auth";
import LiquidGlass from "@/components/LiquidGlass";
import { Spring } from "@/lib/springUtils";

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

  const springsRef = useRef({
    left: new Spring(0, 260, 14),
    top: new Spring(0, 260, 14),
    width: new Spring(0, 260, 14),
    height: new Spring(0, 260, 14),
  });
  const initializedRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  const [, forceRender] = useState(0);

  const activeHref =
    categories.find((c) => pathname.startsWith(c.href))?.href ?? "/games";

  function getTargetForActive() {
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
  }

  function startLoop() {
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
  }

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const s = springsRef.current;

  return (
    <div className="sticky top-4 z-50 mx-auto flex max-w-4xl items-center justify-center gap-3 px-4">
      <LiquidGlass
        width="fit-content"
        height={50}
        borderRadius={50 / 2}
        surfaceType="convex_squircle"
        bezelWidth={25}
        glassThickness={50}
        refractiveIndex={1.5}
        refractionScale={1.5}
        specularOpacity={0.5}
        blur={1.5}
        tintColor="rgb(40, 40, 40)"
        tintOpacity={0.6}
        className="!justify-start pl-6 pr-[10px]"
      >
        <div className="flex items-center">
          <div className="flex items-center gap-8">
            <span className="shrink-0 text-sm font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
              DATA
            </span>

            <nav ref={navRef} className="relative flex shrink-0 gap-6">
              {initializedRef.current && (
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
          </div>

          <form onSubmit={handleSearch} className="ml-12 w-56 shrink-0">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar..."
              className="rounded-full border-neutral-200 bg-neutral-50 text-sm placeholder:text-neutral-400 focus-visible:ring-1 focus-visible:ring-neutral-900 dark:border-neutral-800 dark:bg-neutral-800 dark:placeholder:text-neutral-500 dark:focus-visible:ring-neutral-50"
            />
          </form>
        </div>
      </LiquidGlass>

      <LiquidGlass
        width={50}
        height={50}
        borderRadius={25}
        surfaceType="convex_squircle"
        bezelWidth={25}
        glassThickness={50}
        refractiveIndex={1.5}
        refractionScale={1.5}
        specularOpacity={0.5}
        blur={1.5}
        tintColor="rgb(40, 40, 40)"
        tintOpacity={0.6}
        className="!justify-center"
      >
        <form action={logout} className="flex h-full w-full items-center justify-center">
          <button
            type="submit"
            aria-label="Cerrar sesión"
            className="flex h-full w-full items-center justify-center text-neutral-700 transition-colors hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-neutral-50"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </form>
      </LiquidGlass>
    </div>
  );
}