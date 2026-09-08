import { BRAND } from "@/config/brand";
import type { ProductDetailData } from "@/lib/product-detail";
import { getProductGalleryItems } from "@/lib/product-images";

export function buildProductSeoData(detail: ProductDetailData) {
  const { product } = detail;
  const gallery = getProductGalleryItems(product, product.images, null);
  const primaryImage = gallery[0]?.url ?? product.image_url ?? null;
  const context = [
    product.time,
    product.season,
    product.brand,
    detail.category?.name ?? product.category,
  ]
    .filter(Boolean)
    .join(" · ");
  const description =
    product.description?.trim().slice(0, 160) ||
    `${product.name}${context ? ` — ${context}` : ""}. Confira fotos, opções e entrega na ${BRAND.officialName}.`.slice(
      0,
      160,
    );
  const title = `${product.name} | ${BRAND.officialName}`;
  const canonicalUrl = `${BRAND.siteUrl}/product/${encodeURIComponent(product.slug)}`;
  const effectivePrice = product.promotional_price ?? product.price;

  return {
    title,
    description,
    canonicalUrl,
    primaryImage,
    effectivePrice,
  };
}

export function buildProductHead(detail: ProductDetailData) {
  const seo = buildProductSeoData(detail);
  const meta = [
    { title: seo.title },
    { name: "description", content: seo.description },
    { property: "og:title", content: seo.title },
    { property: "og:description", content: seo.description },
    { property: "og:type", content: "product" },
    { property: "og:url", content: seo.canonicalUrl },
    { property: "product:price:amount", content: seo.effectivePrice.toFixed(2) },
    { property: "product:price:currency", content: "BRL" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: seo.title },
    { name: "twitter:description", content: seo.description },
  ];

  if (seo.primaryImage) {
    meta.push(
      { property: "og:image", content: seo.primaryImage },
      { property: "og:image:alt", content: detail.product.name },
      { name: "twitter:image", content: seo.primaryImage },
    );
  }

  return {
    meta,
    links: [{ rel: "canonical", href: seo.canonicalUrl }],
  };
}
