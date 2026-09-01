import type { CatalogProduct, Product, ProductImage } from "@/lib/products";

function normalizedBaseUrl(rawValue: string | undefined) {
  const value = rawValue?.trim();

  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);

    if (url.protocol !== "https:" && url.hostname !== "localhost") {
      return null;
    }

    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

export function getR2PublicBaseUrl() {
  return normalizedBaseUrl(import.meta.env.VITE_R2_PUBLIC_BASE_URL);
}

export function encodeR2ObjectKey(storageKey: string) {
  return storageKey
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export function buildR2PublicImageUrl(
  storageKey: string,
  baseUrl = getR2PublicBaseUrl(),
) {
  const normalizedKey = storageKey.trim().replace(/^\/+/, "");

  if (!baseUrl || !normalizedKey || normalizedKey.includes("..")) {
    return null;
  }

  return `${baseUrl}/${encodeR2ObjectKey(normalizedKey)}`;
}

export function sortReadyProductImages(images: ProductImage[]) {
  return images
    .filter((image) => image.status === "ready")
    .slice()
    .sort((left, right) => {
      const leftProductLevel = left.variant_id === null ? 0 : 1;
      const rightProductLevel = right.variant_id === null ? 0 : 1;

      if (leftProductLevel !== rightProductLevel) {
        return leftProductLevel - rightProductLevel;
      }

      if (left.is_primary !== right.is_primary) {
        return left.is_primary ? -1 : 1;
      }

      if (left.sort_order !== right.sort_order) {
        return left.sort_order - right.sort_order;
      }

      return left.created_at.localeCompare(right.created_at);
    });
}

export function getPreferredProductImage(images: ProductImage[]) {
  const readyImages = sortReadyProductImages(images);
  const productLevelPrimary = readyImages.find(
    (image) => image.variant_id === null && image.is_primary,
  );

  return productLevelPrimary ?? readyImages[0] ?? null;
}

export function getPrimaryProductImageUrl(
  product: Pick<Product, "image_url">,
  images: ProductImage[],
) {
  const preferredImage = getPreferredProductImage(images);
  const r2Url = preferredImage
    ? buildR2PublicImageUrl(preferredImage.storage_key)
    : null;

  return r2Url ?? product.image_url ?? null;
}

export function attachProductImages(
  product: Product,
  images: ProductImage[],
): CatalogProduct {
  const readyImages = sortReadyProductImages(images);

  return {
    ...product,
    images: readyImages,
    displayImageUrl: getPrimaryProductImageUrl(product, readyImages),
  };
}


export interface ProductGalleryItem {
  id: string;
  url: string;
  alt: string;
  variantId: string | null;
  isPrimary: boolean;
}

export function getProductGalleryItems(
  product: Pick<Product, "name" | "image_url">,
  images: ProductImage[],
  selectedVariantId: string | null = null,
): ProductGalleryItem[] {
  const readyImages = sortReadyProductImages(images);
  const productImages = readyImages.filter((image) => image.variant_id === null);
  const selectedVariantImages = selectedVariantId
    ? readyImages.filter((image) => image.variant_id === selectedVariantId)
    : [];

  const orderedImages = selectedVariantImages.length > 0
    ? [...selectedVariantImages, ...productImages]
    : productImages.length > 0
      ? productImages
      : readyImages;

  const seen = new Set<string>();
  const gallery = orderedImages.flatMap((image) => {
    const url = buildR2PublicImageUrl(image.storage_key);

    if (!url || seen.has(url)) {
      return [];
    }

    seen.add(url);
    return [{
      id: image.id,
      url,
      alt: image.alt_text?.trim() || product.name,
      variantId: image.variant_id,
      isPrimary: image.is_primary,
    } satisfies ProductGalleryItem];
  });

  if (product.image_url && !seen.has(product.image_url)) {
    gallery.push({
      id: "legacy-image",
      url: product.image_url,
      alt: product.name,
      variantId: null,
      isPrimary: gallery.length === 0,
    });
  }

  return gallery;
}
