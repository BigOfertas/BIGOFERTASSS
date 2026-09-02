import { useEffect, useMemo, useState } from "react";
import { ImageOff } from "lucide-react";

import type { ProductGalleryItem } from "@/lib/product-images";

interface ProductGalleryProps {
  images: ProductGalleryItem[];
  productName: string;
  unavailable?: boolean;
}

export default function ProductGallery({
  images,
  productName,
  unavailable = false,
}: ProductGalleryProps) {
  const preferredImageId = useMemo(
    () => images.find((image) => image.isPrimary)?.id ?? images[0]?.id ?? null,
    [images],
  );
  const [activeImageId, setActiveImageId] = useState<string | null>(
    preferredImageId,
  );
  const [failedImageIds, setFailedImageIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setActiveImageId(preferredImageId);
  }, [preferredImageId]);

  const activeImage =
    images.find(
      (image) =>
        image.id === activeImageId && !failedImageIds.has(image.id),
    ) ?? images.find((image) => !failedImageIds.has(image.id)) ?? null;

  const markFailed = (imageId: string) => {
    setFailedImageIds((current) => new Set(current).add(imageId));
  };

  return (
    <section aria-label={`Galeria de ${productName}`}>
      <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-xl border border-gray-100 bg-gray-50 shadow-sm sm:aspect-[4/5]">
        {activeImage ? (
          <img
            key={activeImage.id}
            src={activeImage.url}
            alt={activeImage.alt}
            onError={() => markFailed(activeImage.id)}
            className="h-full w-full object-contain p-5 sm:p-10"
          />
        ) : (
          <div className="flex flex-col items-center gap-3 px-6 text-center text-gray-400">
            <ImageOff className="h-10 w-10" aria-hidden="true" />
            <span className="text-sm font-medium">Imagem indisponível</span>
          </div>
        )}

        {unavailable ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-[2px]">
            <span className="rounded-full bg-black px-6 py-2 font-black uppercase tracking-tight text-white">
              Combinação indisponível
            </span>
          </div>
        ) : null}
      </div>

      {images.length > 1 ? (
        <div className="mt-4 grid grid-cols-4 gap-3 sm:grid-cols-5">
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
                    src={image.url}
                    alt=""
                    loading="lazy"
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
    </section>
  );
}
