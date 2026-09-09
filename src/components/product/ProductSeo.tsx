import { useEffect } from "react";

import { BRAND } from "@/config/brand";
import type { ProductGalleryItem } from "@/lib/product-images";
import type { Product, ProductVariant } from "@/lib/products";

interface ProductSeoProps {
  product: Product;
  selectedVariant: ProductVariant | null;
  price: number;
  inStock: boolean;
  images: ProductGalleryItem[];
}

function setManagedMeta(
  selector: string,
  attributes: Record<string, string>,
  cleanups: Array<() => void>,
) {
  const existing = document.head.querySelector<HTMLMetaElement>(selector);

  if (existing) {
    const previous = new Map<string, string | null>();
    for (const name of Object.keys(attributes)) previous.set(name, existing.getAttribute(name));
    for (const [name, value] of Object.entries(attributes)) existing.setAttribute(name, value);
    cleanups.push(() => {
      for (const [name, value] of previous) {
        if (value === null) existing.removeAttribute(name);
        else existing.setAttribute(name, value);
      }
    });
    return;
  }

  const element = document.createElement("meta");
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  document.head.appendChild(element);
  cleanups.push(() => element.remove());
}

export default function ProductSeo({
  product,
  selectedVariant: _selectedVariant,
  price,
  inStock,
  images,
}: ProductSeoProps) {
  useEffect(() => {
    const cleanups: Array<() => void> = [];
    const previousTitle = document.title;
    const context = [product.time, product.category, product.campeonato]
      .filter(Boolean)
      .join(" · ");
    const description =
      product.description?.trim().slice(0, 160) ||
      `${product.name}${context ? ` — ${context}` : ""}. Confira fotos, opções e entrega na ${BRAND.officialName}.`.slice(
        0,
        160,
      );
    const canonicalUrl = `${BRAND.siteUrl}/product/${encodeURIComponent(product.slug)}`;
    const primaryImage = images[0]?.url ?? product.image_url ?? undefined;
    const productTitle = `${product.name} | ${BRAND.officialName}`;

    document.title = productTitle;
    cleanups.push(() => {
      document.title = previousTitle;
    });

    setManagedMeta('meta[name="description"]', { name: "description", content: description }, cleanups);
    setManagedMeta('meta[property="og:title"]', { property: "og:title", content: productTitle }, cleanups);
    setManagedMeta('meta[property="og:description"]', { property: "og:description", content: description }, cleanups);
    setManagedMeta('meta[property="og:type"]', { property: "og:type", content: "product" }, cleanups);
    setManagedMeta('meta[property="og:url"]', { property: "og:url", content: canonicalUrl }, cleanups);
    setManagedMeta('meta[property="product:price:amount"]', { property: "product:price:amount", content: price.toFixed(2) }, cleanups);
    setManagedMeta('meta[property="product:price:currency"]', { property: "product:price:currency", content: "BRL" }, cleanups);
    setManagedMeta('meta[name="twitter:card"]', { name: "twitter:card", content: "summary_large_image" }, cleanups);
    setManagedMeta('meta[name="twitter:title"]', { name: "twitter:title", content: productTitle }, cleanups);
    setManagedMeta('meta[name="twitter:description"]', { name: "twitter:description", content: description }, cleanups);

    if (primaryImage) {
      setManagedMeta('meta[property="og:image"]', { property: "og:image", content: primaryImage }, cleanups);
      setManagedMeta('meta[property="og:image:alt"]', { property: "og:image:alt", content: product.name }, cleanups);
      setManagedMeta('meta[name="twitter:image"]', { name: "twitter:image", content: primaryImage }, cleanups);
    }

    const existingCanonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (existingCanonical) {
      const previousHref = existingCanonical.getAttribute("href");
      existingCanonical.href = canonicalUrl;
      cleanups.push(() => {
        if (previousHref === null) existingCanonical.removeAttribute("href");
        else existingCanonical.setAttribute("href", previousHref);
      });
    } else {
      const canonical = document.createElement("link");
      canonical.rel = "canonical";
      canonical.href = canonicalUrl;
      document.head.appendChild(canonical);
      cleanups.push(() => canonical.remove());
    }

    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.name,
      description,
      ...(primaryImage
        ? { image: images.length > 0 ? images.map((image) => image.url) : [primaryImage] }
        : {}),
      offers: {
        "@type": "Offer",
        priceCurrency: "BRL",
        price: price.toFixed(2),
        availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
        url: canonicalUrl,
      },
    };

    const previousJsonLd = document.head.querySelector<HTMLScriptElement>("#storefront-product-jsonld");
    const script = previousJsonLd ?? document.createElement("script");
    const previousScriptText = previousJsonLd?.textContent ?? null;
    script.id = "storefront-product-jsonld";
    script.type = "application/ld+json";
    script.textContent = JSON.stringify(jsonLd);
    if (!previousJsonLd) document.head.appendChild(script);
    cleanups.push(() => {
      if (previousJsonLd) previousJsonLd.textContent = previousScriptText;
      else script.remove();
    });

    return () => cleanups.reverse().forEach((cleanup) => cleanup());
  }, [images, inStock, price, product]);

  return (
    <style>{`
      @media (min-width: 1024px) {
        section[aria-labelledby="product-title"] {
          position: sticky;
          top: 9.25rem;
          align-self: start;
          max-height: calc(100vh - 10rem);
          overflow-y: auto;
          scrollbar-width: thin;
          padding-right: 0.4rem;
        }
      }
      section[aria-labelledby="product-title"] fieldset {
        padding: 0.15rem 0 0.35rem;
      }
      section[aria-labelledby="product-title"] fieldset + fieldset {
        margin-top: 1.35rem;
        padding-top: 1.35rem;
        border-top: 1px solid rgb(243 244 246);
      }
      section[aria-labelledby="product-title"] fieldset legend {
        margin-bottom: 0.85rem;
        font-size: 0.72rem;
        letter-spacing: 0.09em;
      }
      section[aria-labelledby="product-title"] fieldset button {
        min-height: 3rem;
        min-width: 3.25rem;
        border-radius: 0.55rem;
        padding-inline: 1rem;
      }
      @media (max-width: 639px) {
        section[aria-labelledby="product-title"] fieldset button {
          min-height: 3.1rem;
          min-width: 3.35rem;
          font-size: 0.875rem;
        }
      }
    `}</style>
  );
}
