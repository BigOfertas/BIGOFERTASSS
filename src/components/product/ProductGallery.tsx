import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ImageOff, ZoomIn, ZoomOut } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ProductGalleryItem } from "@/lib/product-images";

interface ProductGalleryProps {
  images: ProductGalleryItem[];
  productName: string;
  unavailable?: boolean;
}

const SWIPE_THRESHOLD = 45;
const ZOOM_LEVELS = [1, 1.5, 2, 2.5] as const;

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
  const [zoomIndex, setZoomIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    setActiveImageId(preferredImageId);
    setZoomIndex(0);
  }, [preferredImageId]);

  const availableImages = images.filter((image) => !failedImageIds.has(image.id));
  const activeImage =
    availableImages.find((image) => image.id === activeImageId) ?? availableImages[0] ?? null;
  const activeIndex = activeImage
    ? Math.max(
        0,
        availableImages.findIndex((image) => image.id === activeImage.id),
      )
    : -1;

  const markFailed = (imageId: string) => {
    setFailedImageIds((current) => new Set(current).add(imageId));
  };

  const move = (direction: -1 | 1) => {
    if (availableImages.length <= 1 || activeIndex < 0) return;
    const nextIndex = (activeIndex + direction + availableImages.length) % availableImages.length;
    setActiveImageId(availableImages[nextIndex]?.id ?? null);
    setZoomIndex(0);
  };

  const handleTouchStart = (event: React.TouchEvent) => {
    touchStartX.current = event.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (event: React.TouchEvent) => {
    const startX = touchStartX.current;
    touchStartX.current = null;
    if (startX === null) return;

    const endX = event.changedTouches[0]?.clientX ?? startX;
    const delta = endX - startX;
    if (Math.abs(delta) < SWIPE_THRESHOLD) return;
    move(delta > 0 ? -1 : 1);
  };

  const zoom = ZOOM_LEVELS[zoomIndex] ?? 1;

  return (
    <section aria-label={`Galeria de ${productName}`}>
      <div
        className="relative flex aspect-square touch-pan-y items-center justify-center overflow-hidden rounded-xl border border-gray-100 bg-gray-50 shadow-sm sm:aspect-[4/5]"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {activeImage ? (
          <button
            type="button"
            className="h-full w-full cursor-zoom-in"
            onClick={() => {
              setZoomIndex(0);
              setViewerOpen(true);
            }}
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
              draggable={false}
              onError={() => markFailed(activeImage.id)}
              className="h-full w-full select-none object-contain p-5 sm:p-10"
            />
          </button>
        ) : (
          <div className="flex flex-col items-center gap-3 px-6 text-center text-gray-400">
            <ImageOff className="h-10 w-10" aria-hidden="true" />
            <span className="text-sm font-medium">Imagem indisponível</span>
          </div>
        )}

        {availableImages.length > 1 ? (
          <>
            <button
              type="button"
              onClick={() => move(-1)}
              className="absolute left-3 top-1/2 hidden -translate-y-1/2 rounded-full border border-gray-200 bg-white/90 p-2 text-gray-800 shadow-sm hover:bg-white sm:inline-flex"
              aria-label="Imagem anterior"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => move(1)}
              className="absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-full border border-gray-200 bg-white/90 p-2 text-gray-800 shadow-sm hover:bg-white sm:inline-flex"
              aria-label="Próxima imagem"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            <span className="absolute bottom-3 right-3 rounded-full bg-black/70 px-2.5 py-1 text-xs font-bold text-white sm:hidden">
              {activeIndex + 1} / {availableImages.length}
            </span>
          </>
        ) : null}

        {unavailable ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-[2px]">
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
                    src={image.thumbnailUrl}
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

      <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
        <DialogContent className="h-[92dvh] max-w-[96vw] overflow-hidden border-0 bg-black p-0 text-white sm:max-w-[94vw]">
          <DialogTitle className="sr-only">Imagem ampliada de {productName}</DialogTitle>
          <div
            className="relative flex h-full touch-pan-y items-center justify-center overflow-auto p-4 sm:p-10"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {activeImage ? (
              <img
                src={activeImage.url}
                alt={activeImage.alt}
                draggable={false}
                className="max-h-full max-w-full select-none object-contain transition-transform duration-150"
                style={{ transform: `scale(${zoom})` }}
              />
            ) : null}

            {availableImages.length > 1 ? (
              <>
                <button
                  type="button"
                  onClick={() => move(-1)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/15 p-3 text-white backdrop-blur hover:bg-white/25"
                  aria-label="Imagem anterior"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <button
                  type="button"
                  onClick={() => move(1)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/15 p-3 text-white backdrop-blur hover:bg-white/25"
                  aria-label="Próxima imagem"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
              </>
            ) : null}

            <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/70 px-3 py-2">
              <button
                type="button"
                disabled={zoomIndex === 0}
                onClick={() => setZoomIndex((current) => Math.max(0, current - 1))}
                className="rounded-full p-2 disabled:opacity-30"
                aria-label="Diminuir zoom"
              >
                <ZoomOut className="h-5 w-5" />
              </button>
              <span className="min-w-14 text-center text-xs font-bold">{Math.round(zoom * 100)}%</span>
              <button
                type="button"
                disabled={zoomIndex === ZOOM_LEVELS.length - 1}
                onClick={() =>
                  setZoomIndex((current) => Math.min(ZOOM_LEVELS.length - 1, current + 1))
                }
                className="rounded-full p-2 disabled:opacity-30"
                aria-label="Aumentar zoom"
              >
                <ZoomIn className="h-5 w-5" />
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
