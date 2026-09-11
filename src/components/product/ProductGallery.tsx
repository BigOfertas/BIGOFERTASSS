import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ImageOff, Maximize2, X, ZoomIn, ZoomOut } from "lucide-react";

import type { ProductGalleryItem } from "@/lib/product-images";

interface ProductGalleryProps {
  images: ProductGalleryItem[];
  productName: string;
  unavailable?: boolean;
}

const SWIPE_THRESHOLD_PX = 48;
const NEXT_IMAGE_PREFETCH_DELAY_MS = 150;

type PointerStart = {
  id: number;
  x: number;
  y: number;
};

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
  const [loadedImageId, setLoadedImageId] = useState<string | null>(null);
  const [failedImageIds, setFailedImageIds] = useState<Set<string>>(new Set());
  const [viewerOpen, setViewerOpen] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const pointerStartRef = useRef<PointerStart | null>(null);

  const usableImages = useMemo(
    () => images.filter((image) => !failedImageIds.has(image.id)),
    [failedImageIds, images],
  );

  const activeImage =
    usableImages.find((image) => image.id === activeImageId) ?? usableImages[0] ?? null;
  const activeIndex = activeImage
    ? Math.max(
        0,
        usableImages.findIndex((image) => image.id === activeImage.id),
      )
    : 0;

  useEffect(() => {
    const nextImage =
      usableImages.find((image) => image.id === preferredImageId) ?? usableImages[0];
    if (!nextImage) {
      setActiveImageId(null);
      return;
    }
    if (!usableImages.some((image) => image.id === activeImageId)) {
      setActiveImageId(nextImage.id);
    }
  }, [activeImageId, preferredImageId, usableImages]);

  useEffect(() => {
    if (!viewerOpen) setZoomed(false);
  }, [viewerOpen]);

  useEffect(() => {
    if (!activeImage || loadedImageId !== activeImage.id || usableImages.length < 2) return;

    const nextImage = usableImages[(activeIndex + 1) % usableImages.length];
    if (!nextImage || nextImage.id === activeImage.id) return;

    const timer = window.setTimeout(() => {
      const preloader = new Image();
      preloader.decoding = "async";
      preloader.sizes = "(max-width: 1023px) 92vw, 600px";
      if (nextImage.cardSrcSet) preloader.srcset = nextImage.cardSrcSet;
      preloader.src = nextImage.cardUrl;
    }, NEXT_IMAGE_PREFETCH_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [activeImage, activeIndex, loadedImageId, usableImages]);

  const move = useCallback(
    (direction: -1 | 1) => {
      if (usableImages.length < 2) return;
      setZoomed(false);
      setActiveImageId((currentId) => {
        const currentIndex = usableImages.findIndex((image) => image.id === currentId);
        const normalizedIndex = currentIndex >= 0 ? currentIndex : 0;
        const nextIndex = (normalizedIndex + direction + usableImages.length) % usableImages.length;
        return usableImages[nextIndex]?.id ?? currentId;
      });
    },
    [usableImages],
  );

  useEffect(() => {
    if (!viewerOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setViewerOpen(false);
      if (event.key === "ArrowLeft") move(-1);
      if (event.key === "ArrowRight") move(1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [move, viewerOpen]);

  const markFailed = (imageId: string) => {
    setFailedImageIds((current) => new Set(current).add(imageId));
  };

  const selectImage = (imageId: string) => {
    if (imageId === activeImage?.id || failedImageIds.has(imageId)) return;
    setZoomed(false);
    setActiveImageId(imageId);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    pointerStartRef.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLElement>) => {
    const start = pointerStartRef.current;
    pointerStartRef.current = null;
    if (!start || start.id !== event.pointerId || usableImages.length < 2) return;

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (Math.abs(deltaX) < SWIPE_THRESHOLD_PX || Math.abs(deltaX) <= Math.abs(deltaY)) return;
    move(deltaX < 0 ? 1 : -1);
  };

  const handleNavigationPointerDown = (
    event: React.PointerEvent<HTMLButtonElement>,
    direction: -1 | 1,
  ) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    move(direction);
  };

  const handleNavigationClick = (event: React.MouseEvent<HTMLButtonElement>, direction: -1 | 1) => {
    event.stopPropagation();
    if (event.detail === 0) move(direction);
  };

  return (
    <section aria-label={`Galeria de ${productName}`}>
      <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-xl border border-gray-100 bg-gray-50 shadow-sm sm:aspect-[4/5]">
        {activeImage ? (
          <button
            type="button"
            data-active-image-id={activeImage.id}
            onClick={() => setViewerOpen(true)}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerCancel={() => {
              pointerStartRef.current = null;
            }}
            className="h-full w-full touch-pan-y"
            aria-label={`Ampliar imagem ${activeIndex + 1} de ${productName}`}
          >
            <img
              key={activeImage.id}
              src={activeImage.cardUrl}
              srcSet={activeImage.cardSrcSet ?? undefined}
              alt={activeImage.alt}
              width={768}
              height={960}
              sizes="(max-width: 1023px) 92vw, 600px"
              loading="eager"
              fetchPriority="high"
              decoding="async"
              onLoad={() => setLoadedImageId(activeImage.id)}
              onError={(event) => {
                if (event.currentTarget.src !== activeImage.url) {
                  event.currentTarget.srcset = "";
                  event.currentTarget.src = activeImage.url;
                  return;
                }
                markFailed(activeImage.id);
              }}
              className="h-full w-full object-contain"
            />
          </button>
        ) : (
          <div className="flex flex-col items-center gap-3 px-6 text-center text-gray-400">
            <ImageOff className="h-10 w-10" aria-hidden="true" />
            <span className="text-sm font-medium">Imagem indisponível</span>
          </div>
        )}

        {activeImage ? (
          <div
            data-gallery-status-overlay
            className="pointer-events-none absolute left-3 top-3 z-30 flex items-center gap-2"
          >
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
              data-gallery-nav="previous"
              onPointerDown={(event) => handleNavigationPointerDown(event, -1)}
              onClick={(event) => handleNavigationClick(event, -1)}
              className="absolute left-2 top-1/2 z-30 hidden -translate-y-1/2 rounded-full bg-white/90 p-2 text-gray-800 shadow hover:bg-white sm:block"
              aria-label="Imagem anterior"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              data-gallery-nav="next"
              onPointerDown={(event) => handleNavigationPointerDown(event, 1)}
              onClick={(event) => handleNavigationClick(event, 1)}
              className="absolute right-2 top-1/2 z-30 hidden -translate-y-1/2 rounded-full bg-white/90 p-2 text-gray-800 shadow hover:bg-white sm:block"
              aria-label="Próxima imagem"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        ) : null}

        {unavailable ? (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-white/60 backdrop-blur-[2px]">
            <span className="rounded-full bg-black px-6 py-2 font-black uppercase tracking-tight text-white">
              Combinação indisponível
            </span>
          </div>
        ) : null}
      </div>

      {images.length > 1 ? (
        <div className="mt-4 hidden grid-cols-4 gap-3 sm:grid sm:grid-cols-5">
          {images.map((image) => {
            const failed = failedImageIds.has(image.id);
            const active = activeImage?.id === image.id;

            return (
              <button
                key={image.id}
                type="button"
                onClick={() => selectImage(image.id)}
                className={`flex aspect-square items-center justify-center overflow-hidden rounded-md border bg-gray-50 ${
                  active
                    ? "border-red-600 ring-1 ring-red-600"
                    : "border-gray-200 hover:border-gray-400"
                }`}
                aria-label={`Ver imagem de ${productName}`}
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
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-4 sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-label={`Visualização ampliada de ${productName}`}
        >
          <div className="absolute inset-x-0 top-0 z-[120] flex items-center justify-between px-4 py-3 text-white sm:px-6 sm:py-4">
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
            data-product-image-viewer-frame
            className="relative h-[75dvh] w-[92vw] max-w-[1100px] overflow-hidden sm:w-[75vw]"
          >
            <button
              type="button"
              onClick={() => setZoomed((current) => !current)}
              onPointerDown={handlePointerDown}
              onPointerUp={handlePointerUp}
              onPointerCancel={() => {
                pointerStartRef.current = null;
              }}
              className="flex h-full w-full touch-pan-y items-center justify-center overflow-hidden"
              aria-label={zoomed ? "Reduzir zoom" : "Aumentar zoom"}
            >
              <img
                key={`viewer-${activeImage.id}`}
                src={activeImage.url}
                alt={activeImage.alt}
                width={1600}
                height={2000}
                loading="eager"
                fetchPriority="high"
                decoding="async"
                onError={() => markFailed(activeImage.id)}
                className={`h-full w-full object-contain ${zoomed ? "scale-[1.55]" : "scale-100"}`}
              />
            </button>

            {usableImages.length > 1 && !zoomed ? (
              <>
                <button
                  type="button"
                  data-gallery-viewer-nav="previous"
                  onPointerDown={(event) => handleNavigationPointerDown(event, -1)}
                  onClick={(event) => handleNavigationClick(event, -1)}
                  className="absolute left-3 top-1/2 z-[110] -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
                  aria-label="Imagem anterior"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <button
                  type="button"
                  data-gallery-viewer-nav="next"
                  onPointerDown={(event) => handleNavigationPointerDown(event, 1)}
                  onClick={(event) => handleNavigationClick(event, 1)}
                  className="absolute right-3 top-1/2 z-[110] -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
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
