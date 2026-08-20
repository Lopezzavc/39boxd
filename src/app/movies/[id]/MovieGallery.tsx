"use client";

import { useEffect, useState, useCallback } from "react";
import { LiquidGlass } from "@/components/liquid-glass";

function IconChevronLeft() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function IconChevronRight() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

export default function MovieGallery({ images }: { images: string[] }) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [thumbnailHover, setThumbnailHover] = useState(false);

  useEffect(() => {
    const event = new CustomEvent("gallery-state", {
      detail: {
        isOpen: open,
        currentIndex: index,
        total: images.length,
      },
    });
    document.dispatchEvent(event);
  }, [open, index, images.length]);

  const goPrev = useCallback(() => {
    setIndex((i) => (i - 1 + images.length) % images.length);
  }, [images.length]);

  const goNext = useCallback(() => {
    setIndex((i) => (i + 1) % images.length);
  }, [images.length]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, goPrev, goNext]);

  if (images.length === 0) return null;

  const openAt = (i: number) => {
    setIndex(i);
    setOpen(true);
  };

  const stackLayers = images.slice(1, 4);

  return (
    <>
      <div className="relative w-full">
        <button
          type="button"
          onClick={() => openAt(0)}
          onMouseEnter={() => setThumbnailHover(true)}
          onMouseLeave={() => setThumbnailHover(false)}
          className="group relative block aspect-video w-full"
          aria-label="Ver galería de imágenes"
        >
          {stackLayers.map((src, i) => {
            const depth = i + 1;
            const scale = 1 - depth * 0.035;
            const offsetY = depth * 12;
            const rotate = depth % 2 === 0 ? depth * 1.6 : -depth * 1.6;
            const opacity = 1 - depth * 0.16;

            return (
              <div
                key={src + i}
                className="absolute inset-0 overflow-hidden rounded-2xl ring-1 ring-white/[0.1] transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-y-[-2px]"
                style={{
                  transform: `translateY(${offsetY}px) scale(${scale}) rotate(${rotate}deg)`,
                  opacity,
                  zIndex: 10 - depth,
                }}
              >
                <img src={src} alt="" className="h-full w-full object-cover" />
              </div>
            );
          })}

          <div className="absolute inset-0 z-20 overflow-hidden rounded-2xl bg-white/5 ring-1 ring-white/[0.12] shadow-[0_25px_60px_-20px_rgba(0,0,0,0.85)] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.015] group-active:scale-[0.99]">
            <img
              src={images[0]}
              alt=""
              className="h-full w-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

            {images.length > 1 && (
              <div className="absolute bottom-3 right-3">
                <LiquidGlass
                  width={110}
                  height={32}
                  borderRadius={16}
                  surfaceType="convex_squircle"
                  bezelWidth={16}
                  glassThickness={30}
                  refractiveIndex={1.5}
                  refractionScale={1.5}
                  specularOpacity={0.5}
                  blur={1.5}
                  tintColor="rgb(40, 40, 40)"
                  tintOpacity={0.5}
                  active={thumbnailHover}
                  restColor="transparent"
                  activeTransitionMs={300}
                  className="!justify-center items-center"
                >
                  <span
                    className="flex h-full w-full items-center justify-center whitespace-nowrap text-[11px] font-medium text-white/90 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  >
                    Ver {images.length} fotos
                  </span>
                </LiquidGlass>
              </div>
            )}
          </div>
        </button>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-xl animate-[fadeIn_0.25s_ease-out]"
          onClick={() => setOpen(false)}
        >
          {images.length > 1 && (
            <div
              className="absolute left-3 top-1/2 z-10 -translate-y-1/2 sm:left-6"
              onClick={(e) => e.stopPropagation()}
            >
              <LiquidGlass
                width={48}
                height={48}
                borderRadius={24}
                surfaceType="convex_squircle"
                bezelWidth={24}
                glassThickness={44}
                refractiveIndex={1.5}
                refractionScale={1.5}
                specularOpacity={0.5}
                blur={1.5}
                tintColor="rgb(40, 40, 40)"
                tintOpacity={0.5}
                className="!justify-center items-center cursor-pointer"
              >
                <button
                  type="button"
                  aria-label="Anterior"
                  onClick={goPrev}
                  className="flex h-full w-full items-center justify-center text-white/85 transition-all hover:text-white active:scale-95"
                >
                  <IconChevronLeft />
                </button>
              </LiquidGlass>
            </div>
          )}

          <div
            className="relative mx-16 flex max-h-[82vh] max-w-[88vw] items-center justify-center sm:mx-24"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              key={index}
              src={images[index]}
              alt=""
              className="max-h-[82vh] max-w-full rounded-xl object-contain shadow-[0_35px_90px_-20px_rgba(0,0,0,0.9)] animate-[scaleIn_0.28s_cubic-bezier(0.22,1,0.36,1)]"
            />
          </div>

          {images.length > 1 && (
            <div
              className="absolute right-3 top-1/2 z-10 -translate-y-1/2 sm:right-6"
              onClick={(e) => e.stopPropagation()}
            >
              <LiquidGlass
                width={48}
                height={48}
                borderRadius={24}
                surfaceType="convex_squircle"
                bezelWidth={24}
                glassThickness={44}
                refractiveIndex={1.5}
                refractionScale={1.5}
                specularOpacity={0.5}
                blur={1.5}
                tintColor="rgb(40, 40, 40)"
                tintOpacity={0.5}
                className="!justify-center items-center cursor-pointer"
              >
                <button
                  type="button"
                  aria-label="Siguiente"
                  onClick={goNext}
                  className="flex h-full w-full items-center justify-center text-white/85 transition-all hover:text-white active:scale-95"
                >
                  <IconChevronRight />
                </button>
              </LiquidGlass>
            </div>
          )}

          {images.length > 1 && (
            <div
              className="absolute bottom-5 left-1/2 z-10 flex max-w-[90vw] -translate-x-1/2 items-center gap-2 overflow-x-auto px-2 py-1"
              onClick={(e) => e.stopPropagation()}
            >
              {images.map((src, i) => (
                <button
                  key={src + i}
                  type="button"
                  aria-label={`Ir a la imagen ${i + 1}`}
                  onClick={() => setIndex(i)}
                  className={`h-1.5 shrink-0 rounded-full transition-all duration-300 ${
                    i === index ? "w-6 bg-white" : "w-1.5 bg-white/30 hover:bg-white/50"
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <style jsx global>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.96);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </>
  );
}