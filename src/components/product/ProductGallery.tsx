import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ImageOff,
  Maximize2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

import type { ProductGalleryItem } from "@/lib/product-images";

interface ProductGalleryProps {
  images: ProductGalleryItem[];
  productName: string;
  unavailable?: boolean;
}

const SWIPE_THRESHOLD = 42;

export default function ProductGallery({
  images,
  productName,
  unavailable = false,
}: ProductGalleryProps) {
  const preferredImageId = useMemo(
    () => images.find((image) => image.isPrimary)?.id ?? images[0]?.id ?? null,
    [images],
  );
  const [activeImageId, setActiveImageId] = useState<string | null>(preferredImageId);
  const [failedImageIds, setFailedImageIds] = useState<Set<string>>(new Set());
  const [viewerOpen, setViewerOpen] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    setActiveImageId(preferredImageId);
  }, [preferredImageId]);

  useEffect(() => {
    if (!viewerOpen) setZoomed(false);
  }, [viewerOpen]);

  useEffect(() => {
    if (!viewerOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setViewerOpen(false);
      if (event.key === "ArrowLeft") move(-1);
      if (event.key === "ArrowRight") move(1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const usableImages = images.filter((image) => !failedImageIds.has(image.id));
  const activeImage =
    usableImages.find((image) => image.id === activeImageId) ?? usableImages[0] ?? null;
  const activeIndex = activeImage
    ? Math.max(
        0,
        usableImages.findIndex((image) => image.id === activeImage.id),
      )
    : 0;

  const markFailed = (imageId: string) => {
    setFailedImageIds((current) => new Set(current).add(imageId));
  };

  const move = (direction: -1 | 1) => {
    if (usableImages.length < 2) return;
    const nextIndex = (activeIndex + direction + usableImages.length) % usableImages.length;
    setActiveImageId(usableImages[nextIndex]?.id ?? null);
    setZoomed(false);
  };

  const onTouchStart = (event: React.TouchEvent) => {
    touchStartX.current = event.touches[0]?.clientX ?? null;
  };

  const onTouchEnd = (event: React.TouchEvent) => {
    const start = touchStartX.current;
    const end = event.changedTouches[0]?.clientX ?? null;
    touchStartX.current = null;
    if (start === null || end === null) return;
    const distance = end - start;
    if (Math.abs(distance) < SWIPE_THRESHOLD) return;
    move(distance > 0 ? -1 : 1);
  };

  return (
    <section aria-label={`Galeria de ${productName}`}>
      <div
        className="relative flex aspect-square touch-pan-y items-center justify-center overflow-hidden rounded-xl border border-gray-100 bg-gray-50 shadow-sm sm:aspect-[4/5]"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {activeImage ? (
          <button
            type="button"
            onClick={() => setViewerOpen(true)}
            className="group h-full w-full cursor-zoom-in"
            aria-label={`Ampliar imagem ${activeIndex + 1} de ${productName}`}
          >
            <img
              key={activeImage.id}
              src={activeImage.url}
              alt={activeImage.alt}
              width={1200}
              height={1500}
              sizes="(max-width: 1023px) 92vw, 600px"
              fetchPriority="high"
              decoding="async"
              onError={() => markFailed(activeImage.id)}
              className="h-full w-full object-contain p-5 transition-transform duration-200 group-hover:scale-[1.01] sm:p-10"
            />
          </button>
        ) : (
          <div className="flex flex-col items-center gap-3 px-6 text-center text-gray-400">
            <ImageOff className="h-10 w-10" aria-hidden="true" />
            <span className="text-sm font-medium">Imagem indisponível</span>
          </div>
        )}

        {activeImage ? (
          <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2">
            <span className="rounded-full bg-black/75 px-2.5 py-1 text-xs font-bold text-white sm:hidden">
              {activeIndex + 1} / {usableImages.length}
            </span>
            <span className="hidden items-center gap-1 rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-bold text-white sm:flex">
              <Maximize2 className="h-3 w-3" /> Ampliar
            </span>
          </div>
        ) : null}

        {usableImages.length > 1 ? (
          <>
            <button
              type="button"
              onClick={() => move(-1)}
              className="absolute left-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/90 p-2 text-gray-800 shadow transition hover:bg-white sm:block"
              aria-label="Imagem anterior"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => move(1)}
              className="absolute right-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/90 p-2 text-gray-800 shadow transition hover:bg-white sm:block"
              aria-label="Próxima imagem"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        ) : null}

        {unavailable ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-[2px]">
            <span className="rounded-full bg-black px-6 py-2 font-black uppercase tracking-tight text-white">
              Combinação indisponível
            </span>
          </div>
        ) : null}
      </div>

      {images.length > 1 ? (
        <div className="mt-4 hidden grid-cols-4 gap-3 sm:grid sm:grid-cols-5">
          {images.map((image, index) => {
            const failed = failedImageIds.has(image.id);
            const active = activeImage?.id === image.id;

            return (
              <button
                key={image.id}
                type="button"
                onClick={() => setActiveImageId(image.id)}
                className={`flex aspect-square items-center justify-center overflow-hidden rounded-md border bg-gray-50 transition-colors ${
                  active
                    ? "border-red-600 ring-1 ring-red-600"
                    : "border-gray-200 hover:border-gray-400"
                }`}
                aria-label={`Ver imagem ${index + 1} de ${productName}`}
                aria-pressed={active}
              >
                {!failed ? (
                  <img
                    src={image.thumbUrl}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    width={180}
                    height={180}
                    sizes="96px"
                    onError={() => markFailed(image.id)}
                    className="h-full w-full object-contain p-1"
                  />
                ) : (
                  <ImageOff className="h-5 w-5 text-gray-300" aria-hidden="true" />
                )}
              </button>
            );
          })}
        </div>
      ) : null}

      {viewerOpen && activeImage ? (
        <div
          className="fixed inset-0 z-[100] flex flex-col bg-black/95"
          role="dialog"
          aria-modal="true"
          aria-label={`Visualização ampliada de ${productName}`}
        >
          <div className="flex items-center justify-between px-4 py-3 text-white">
            <span className="text-sm font-bold">
              {activeIndex + 1} / {usableImages.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setZoomed((current) => !current)}
                className="rounded-full bg-white/10 p-2 hover:bg-white/20"
                aria-label={zoomed ? "Reduzir imagem" : "Ampliar imagem"}
              >
                {zoomed ? <ZoomOut className="h-5 w-5" /> : <ZoomIn className="h-5 w-5" />}
              </button>
              <button
                type="button"
                onClick={() => setViewerOpen(false)}
                className="rounded-full bg-white/10 p-2 hover:bg-white/20"
                aria-label="Fechar imagem ampliada"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div
            className="relative flex min-h-0 flex-1 touch-pan-y items-center justify-center overflow-auto p-4"
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            <button
              type="button"
              onClick={() => setZoomed((current) => !current)}
              className="flex min-h-full min-w-full items-center justify-center"
              aria-label={zoomed ? "Reduzir zoom" : "Aumentar zoom"}
            >
              <img
                src={activeImage.url}
                alt={activeImage.alt}
                className={`max-h-[82vh] max-w-[94vw] object-contain transition-transform duration-200 ${
                  zoomed ? "scale-[1.75] cursor-zoom-out" : "scale-100 cursor-zoom-in"
                }`}
              />
            </button>

            {usableImages.length > 1 && !zoomed ? (
              <>
                <button
                  type="button"
                  onClick={() => move(-1)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
                  aria-label="Imagem anterior"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <button
                  type="button"
                  onClick={() => move(1)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
                  aria-label="Próxima imagem"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
