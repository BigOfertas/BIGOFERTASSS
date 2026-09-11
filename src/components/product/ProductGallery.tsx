import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight, ImageOff, Maximize2, X, ZoomIn, ZoomOut } from "lucide-react";

import Lens from "@/components/ui/magnifier-lens";
import type { ProductGalleryItem } from "@/lib/product-images";

interface ProductGalleryProps {
  images: ProductGalleryItem[];
  productName: string;
  unavailable?: boolean;
}

const CAROUSEL_DURATION = 24;

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
  const activeImageIdRef = useRef<string | null>(preferredImageId);

  const usableImages = useMemo(
    () => images.filter((image) => !failedImageIds.has(image.id)),
    [failedImageIds, images],
  );

  const [mainViewportRef, mainEmbla] = useEmblaCarousel({
    loop: usableImages.length > 1,
    align: "start",
    duration: CAROUSEL_DURATION,
  });
  const [viewerViewportRef, viewerEmbla] = useEmblaCarousel({
    loop: usableImages.length > 1,
    align: "start",
    duration: CAROUSEL_DURATION,
    watchDrag: !zoomed,
  });

  const activeImage =
    usableImages.find((image) => image.id === activeImageId) ?? usableImages[0] ?? null;
  const activeIndex = activeImage
    ? Math.max(
        0,
        usableImages.findIndex((image) => image.id === activeImage.id),
      )
    : 0;

  useEffect(() => {
    activeImageIdRef.current = activeImageId;
  }, [activeImageId]);

  useEffect(() => {
    const nextImage = usableImages.find((image) => image.id === preferredImageId) ?? usableImages[0];
    const nextId = nextImage?.id ?? null;
    activeImageIdRef.current = nextId;
    setActiveImageId(nextId);
  }, [preferredImageId, usableImages]);

  useEffect(() => {
    if (!viewerOpen) setZoomed(false);
  }, [viewerOpen]);

  useEffect(() => {
    for (const image of usableImages) {
      const preloader = new Image();
      preloader.decoding = "async";
      preloader.src = image.url;
      void preloader.decode().catch(() => undefined);
    }
  }, [usableImages]);

  useEffect(() => {
    if (!mainEmbla) return;

    const onSelect = () => {
      const index = mainEmbla.selectedScrollSnap();
      const image = usableImages[index];
      if (!image) return;
      activeImageIdRef.current = image.id;
      setActiveImageId(image.id);
      setZoomed(false);
      if (viewerEmbla && viewerEmbla.selectedScrollSnap() !== index) {
        viewerEmbla.scrollTo(index, true);
      }
    };

    mainEmbla.on("select", onSelect);
    return () => {
      mainEmbla.off("select", onSelect);
    };
  }, [mainEmbla, usableImages, viewerEmbla]);

  useEffect(() => {
    if (!viewerEmbla) return;

    const onSelect = () => {
      const index = viewerEmbla.selectedScrollSnap();
      const image = usableImages[index];
      if (!image) return;
      activeImageIdRef.current = image.id;
      setActiveImageId(image.id);
      setZoomed(false);
      if (mainEmbla && mainEmbla.selectedScrollSnap() !== index) {
        mainEmbla.scrollTo(index, true);
      }
    };

    viewerEmbla.on("select", onSelect);
    return () => {
      viewerEmbla.off("select", onSelect);
    };
  }, [mainEmbla, usableImages, viewerEmbla]);

  useEffect(() => {
    const currentId = activeImageIdRef.current;
    const currentIndex = Math.max(
      0,
      usableImages.findIndex((image) => image.id === currentId),
    );

    mainEmbla?.reInit({
      loop: usableImages.length > 1,
      align: "start",
      duration: CAROUSEL_DURATION,
    });
    viewerEmbla?.reInit({
      loop: usableImages.length > 1,
      align: "start",
      duration: CAROUSEL_DURATION,
      watchDrag: !zoomed,
    });
    mainEmbla?.scrollTo(currentIndex, true);
    viewerEmbla?.scrollTo(currentIndex, true);
  }, [mainEmbla, usableImages, viewerEmbla, zoomed]);

  useEffect(() => {
    if (!viewerOpen || !viewerEmbla) return;
    viewerEmbla.scrollTo(activeIndex, true);
  }, [activeIndex, viewerEmbla, viewerOpen]);

  const move = useCallback(
    (direction: -1 | 1) => {
      if (usableImages.length < 2) return;
      setZoomed(false);
      const api = viewerOpen ? viewerEmbla : mainEmbla;
      if (!api) return;
      if (direction < 0) api.scrollPrev();
      else api.scrollNext();
    },
    [mainEmbla, usableImages.length, viewerEmbla, viewerOpen],
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
    const index = usableImages.findIndex((image) => image.id === imageId);
    if (index < 0 || imageId === activeImage?.id) return;
    activeImageIdRef.current = imageId;
    setActiveImageId(imageId);
    setZoomed(false);
    mainEmbla?.scrollTo(index);
    viewerEmbla?.scrollTo(index, true);
  };

  return (
    <section aria-label={`Galeria de ${productName}`}>
      <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-xl border border-gray-100 bg-gray-50 shadow-sm sm:aspect-[4/5]">
        {usableImages.length > 0 ? (
          <div ref={mainViewportRef} className="h-full w-full overflow-hidden touch-pan-y">
            <div data-product-gallery-track className="flex h-full w-full">
              {usableImages.map((image, index) => (
                <div key={image.id} className="relative min-w-0 flex-[0_0_100%]">
                  <button
                    type="button"
                    onClick={() => setViewerOpen(true)}
                    className="group h-full w-full cursor-zoom-in"
                    aria-label={`Ampliar imagem ${index + 1} de ${productName}`}
                  >
                    <Lens zoomFactor={2.5} lensSize={180} className="h-full w-full rounded-none">
                      <img
                        src={image.url}
                        alt={image.alt}
                        width={1200}
                        height={1500}
                        sizes="(max-width: 1023px) 92vw, 600px"
                        loading={index === 0 ? "eager" : "lazy"}
                        fetchPriority={index === activeIndex ? "high" : "auto"}
                        decoding="async"
                        onError={() => markFailed(image.id)}
                        className="h-full w-full object-contain"
                      />
                    </Lens>
                  </button>
                </div>
              ))}
            </div>
          </div>
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
              onClick={() => move(-1)}
              className="absolute left-2 top-1/2 z-30 hidden -translate-y-1/2 rounded-full bg-white/90 p-2 text-gray-800 shadow transition hover:bg-white sm:block"
              aria-label="Imagem anterior"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => move(1)}
              className="absolute right-2 top-1/2 z-30 hidden -translate-y-1/2 rounded-full bg-white/90 p-2 text-gray-800 shadow transition hover:bg-white sm:block"
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
                className={`flex aspect-square items-center justify-center overflow-hidden rounded-md border bg-gray-50 transition-colors ${
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
                className="rounded-full bg-white/10 p-2 transition-colors hover:bg-white/20"
                aria-label={zoomed ? "Reduzir imagem" : "Ampliar imagem"}
              >
                {zoomed ? <ZoomOut className="h-5 w-5" /> : <ZoomIn className="h-5 w-5" />}
              </button>
              <button
                type="button"
                onClick={() => setViewerOpen(false)}
                className="rounded-full bg-white/10 p-2 transition-colors hover:bg-white/20"
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
            <div ref={viewerViewportRef} className="h-full w-full overflow-hidden touch-pan-y">
              <div className="flex h-full w-full">
                {usableImages.map((image) => (
                  <div
                    key={`viewer-${image.id}`}
                    className="flex min-w-0 flex-[0_0_100%] items-center justify-center"
                  >
                    <button
                      type="button"
                      onClick={() => setZoomed((current) => !current)}
                      className="flex h-full w-full items-center justify-center"
                      aria-label={zoomed ? "Reduzir zoom" : "Aumentar zoom"}
                    >
                      <Lens
                        zoomFactor={zoomed ? 3.25 : 2.5}
                        lensSize={220}
                        className="flex h-full w-full items-center justify-center rounded-none"
                      >
                        <img
                          src={image.url}
                          alt={image.alt}
                          width={1600}
                          height={2000}
                          decoding="async"
                          onError={() => markFailed(image.id)}
                          className={`h-full w-full object-contain transition-transform duration-200 ease-out motion-reduce:transition-none ${
                            zoomed ? "scale-[1.55]" : "scale-100"
                          }`}
                        />
                      </Lens>
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {usableImages.length > 1 && !zoomed ? (
              <>
                <button
                  type="button"
                  onClick={() => move(-1)}
                  className="absolute left-3 top-1/2 z-[110] -translate-y-1/2 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
                  aria-label="Imagem anterior"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <button
                  type="button"
                  onClick={() => move(1)}
                  className="absolute right-3 top-1/2 z-[110] -translate-y-1/2 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
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
