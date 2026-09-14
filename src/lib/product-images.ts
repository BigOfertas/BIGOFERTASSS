import type { CatalogProduct, Product, ProductImage } from "@/lib/products";

type RuntimeProductImage = Omit<ProductImage, "storage_key"> & {
  storage_key: string | null;
  card_storage_key?: string | null;
  thumb_storage_key?: string | null;
  external_url?: string | null;
  image_source?: "r2" | "google_photos" | "external" | string | null;
};

const GOOGLE_MEDIA_HOST_RE = /(^|\.)(googleusercontent\.com|usercontent\.google\.com|ggpht\.com)$/i;
export const PRODUCT_CARD_RESPONSIVE_WIDTHS = [320, 480, 640, 768] as const;

function runtimeImage(image: ProductImage): RuntimeProductImage {
  return image as unknown as RuntimeProductImage;
}

function normalizedBaseUrl(rawValue: string | undefined) {
  const value = rawValue?.trim();
  if (!value) return null;

  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.hostname !== "localhost") return null;
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function normalizedExternalUrl(rawValue: string | null | undefined) {
  const value = rawValue?.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function isGoogleMediaUrl(rawValue: string | null | undefined) {
  const external = normalizedExternalUrl(rawValue);
  if (!external) return false;
  try {
    return GOOGLE_MEDIA_HOST_RE.test(new URL(external).hostname);
  } catch {
    return false;
  }
}

export function buildOptimizedExternalImageUrl(rawValue: string | null | undefined, size = 1600) {
  const external = normalizedExternalUrl(rawValue);
  if (!external) return null;

  try {
    const url = new URL(external);
    if (!GOOGLE_MEDIA_HOST_RE.test(url.hostname)) return external;

    const safeSize = Math.min(2400, Math.max(160, Math.round(size)));
    const pathname = url.pathname
      .replace(/=w\d+(?:-h\d+)?[^/?#]*/i, "")
      .replace(/=s\d+[^/?#]*/i, "");
    url.pathname = `${pathname}=w${safeSize}-h${safeSize}-s-no-gm`;
    return url.toString();
  } catch {
    return external;
  }
}

export function buildResponsiveExternalImageSrcSet(
  rawValue: string | null | undefined,
  widths: readonly number[] = PRODUCT_CARD_RESPONSIVE_WIDTHS,
) {
  if (!isGoogleMediaUrl(rawValue)) return null;

  const candidates = [...new Set(widths.map((width) => Math.round(width)))]
    .filter((width) => width >= 160 && width <= 2400)
    .sort((left, right) => left - right)
    .flatMap((width) => {
      const url = buildOptimizedExternalImageUrl(rawValue, width);
      return url ? [`${url} ${width}w`] : [];
    });

  return candidates.length > 0 ? candidates.join(", ") : null;
}

export function buildR2DerivativeSrcSet(input: {
  thumbStorageKey?: string | null;
  cardStorageKey?: string | null;
}) {
  const candidates = [
    input.thumbStorageKey
      ? { url: buildR2PublicImageUrl(input.thumbStorageKey), width: 280 }
      : null,
    input.cardStorageKey ? { url: buildR2PublicImageUrl(input.cardStorageKey), width: 760 } : null,
  ].filter((candidate): candidate is { url: string; width: number } => Boolean(candidate?.url));

  if (candidates.length < 2) return null;
  return candidates.map((candidate) => `${candidate.url} ${candidate.width}w`).join(", ");
}

export function getR2PublicBaseUrl() {
  return normalizedBaseUrl(import.meta.env["VITE_R2_PUBLIC_BASE_URL"]);
}

export function encodeR2ObjectKey(storageKey: string) {
  return storageKey
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export function buildR2PublicImageUrl(
  storageKey: string | null | undefined,
  baseUrl = getR2PublicBaseUrl(),
) {
  const normalizedKey = storageKey?.trim().replace(/^\/+/, "") ?? "";
  if (!baseUrl || !normalizedKey || normalizedKey.includes("..")) return null;
  return `${baseUrl}/${encodeR2ObjectKey(normalizedKey)}`;
}

export function getProductImageSourceUrl(image: ProductImage, size = 1600) {
  const runtime = runtimeImage(image);
  const external = buildOptimizedExternalImageUrl(runtime.external_url, size);
  if (external) return external;
  return buildR2PublicImageUrl(runtime.storage_key);
}

export function sortReadyProductImages(images: ProductImage[]) {
  return images
    .filter((image) => image.status === "ready")
    .slice()
    .sort((left, right) => {
      const leftProductLevel = left.variant_id === null ? 0 : 1;
      const rightProductLevel = right.variant_id === null ? 0 : 1;
      if (leftProductLevel !== rightProductLevel) return leftProductLevel - rightProductLevel;
      if (left.is_primary !== right.is_primary) return left.is_primary ? -1 : 1;
      if (left.sort_order !== right.sort_order) return left.sort_order - right.sort_order;
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
  return (
    (preferredImage ? getProductImageSourceUrl(preferredImage, 1200) : null) ??
    buildOptimizedExternalImageUrl(product.image_url, 1200) ??
    product.image_url ??
    null
  );
}

export function attachProductImages(product: Product, images: ProductImage[]): CatalogProduct {
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
  cardUrl: string;
  cardSrcSet: string | null;
  thumbUrl: string;
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

  const orderedImages =
    selectedVariantImages.length > 0
      ? [...selectedVariantImages, ...productImages]
      : productImages.length > 0
        ? productImages
        : readyImages;

  const seen = new Set<string>();
  const gallery = orderedImages.flatMap((image) => {
    const runtime = runtimeImage(image);
    const originalExternal = normalizedExternalUrl(runtime.external_url);
    const url = originalExternal
      ? buildOptimizedExternalImageUrl(originalExternal, 1600)
      : buildR2PublicImageUrl(runtime.storage_key);
    if (!url || seen.has(url)) return [];

    const cardUrl = originalExternal
      ? buildOptimizedExternalImageUrl(originalExternal, 768)
      : runtime.card_storage_key
        ? buildR2PublicImageUrl(runtime.card_storage_key)
        : null;
    const thumbUrl = originalExternal
      ? buildOptimizedExternalImageUrl(originalExternal, 256)
      : runtime.thumb_storage_key
        ? buildR2PublicImageUrl(runtime.thumb_storage_key)
        : null;
    const cardSrcSet = originalExternal
      ? buildResponsiveExternalImageSrcSet(originalExternal)
      : buildR2DerivativeSrcSet({
          thumbStorageKey: runtime.thumb_storage_key,
          cardStorageKey: runtime.card_storage_key,
        });

    seen.add(url);
    return [
      {
        id: image.id,
        url,
        cardUrl: cardUrl ?? url,
        cardSrcSet,
        thumbUrl: thumbUrl ?? cardUrl ?? url,
        alt: image.alt_text?.trim() || product.name,
        variantId: image.variant_id,
        isPrimary: image.is_primary,
      } satisfies ProductGalleryItem,
    ];
  });

  const legacyImage = buildOptimizedExternalImageUrl(product.image_url, 1600) ?? product.image_url;
  if (legacyImage && selectedVariantImages.length === 0 && !seen.has(legacyImage)) {
    gallery.push({
      id: "legacy-image",
      url: legacyImage,
      cardUrl: buildOptimizedExternalImageUrl(product.image_url, 768) ?? legacyImage,
      cardSrcSet: buildResponsiveExternalImageSrcSet(product.image_url),
      thumbUrl: buildOptimizedExternalImageUrl(product.image_url, 256) ?? legacyImage,
      alt: product.name,
      variantId: null,
      isPrimary: gallery.length === 0,
    });
  }

  return gallery;
}
