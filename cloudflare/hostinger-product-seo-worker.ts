export interface Env {
  STOREFRONT_ORIGIN_BASE_URL: string;
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  R2_PUBLIC_BASE_URL: string;
  BRAND_NAME?: string;
  BRAND_SITE_URL?: string;
}

type ProductDetailPayload = {
  product?: {
    slug?: string;
    name?: string;
    description?: string | null;
    price?: number;
    promotional_price?: number | null;
    time?: string | null;
    season?: string | null;
    brand?: string | null;
    category?: string | null;
  } | null;
  category?: { name?: string | null } | null;
  images?: Array<{
    storage_key?: string | null;
    card_storage_key?: string | null;
    external_url?: string | null;
    is_primary?: boolean;
  }>;
};

function cleanBase(value: string) {
  return value.trim().replace(/\/+$/, "");
}

function encodeObjectKey(storageKey: string) {
  return storageKey
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");
}

function escapeAttribute(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

async function fetchProduct(slug: string, env: Env) {
  const response = await fetch(
    `${cleanBase(env.SUPABASE_URL)}/rest/v1/rpc/storefront_product_detail_v2`,
    {
      method: "POST",
      headers: {
        apikey: env.SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_PUBLISHABLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_identifier: slug }),
    },
  );

  if (!response.ok) return null;
  return (await response.json()) as ProductDetailPayload | null;
}

function productMeta(detail: ProductDetailPayload, env: Env) {
  const product = detail.product;
  if (!product?.name || !product.slug) return null;

  const brandName = env.BRAND_NAME?.trim() || "BIGofertas";
  const siteUrl = cleanBase(env.BRAND_SITE_URL?.trim() || "https://bigofertas.net");
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
    `${product.name}${context ? ` — ${context}` : ""}. Confira fotos, opções e entrega na ${brandName}.`.slice(
      0,
      160,
    );
  const title = `${product.name} | ${brandName}`;
  const canonical = `${siteUrl}/product/${encodeURIComponent(product.slug)}`;
  const primary = detail.images?.find((image) => image.is_primary) ?? detail.images?.[0] ?? null;
  const imageKey = primary?.storage_key ?? primary?.card_storage_key ?? null;
  const externalImage = primary?.external_url?.trim() || null;
  const image =
    externalImage ??
    (imageKey ? `${cleanBase(env.R2_PUBLIC_BASE_URL)}/${encodeObjectKey(imageKey)}` : null);
  const price = Number(product.promotional_price ?? product.price ?? 0).toFixed(2);

  return { title, description, canonical, image, price, productName: product.name };
}

function originRequest(request: Request, env: Env) {
  const incoming = new URL(request.url);
  const origin = new URL(cleanBase(env.STOREFRONT_ORIGIN_BASE_URL));
  origin.pathname = incoming.pathname;
  origin.search = incoming.search;
  return new Request(origin.toString(), request);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const originResponse = await fetch(originRequest(request, env));

    if (request.method !== "GET" || !url.pathname.startsWith("/product/") || !originResponse.ok) {
      return originResponse;
    }

    const slug = decodeURIComponent(url.pathname.slice("/product/".length)).split("/")[0]?.trim();
    if (!slug) return originResponse;

    const detail = await fetchProduct(slug, env).catch(() => null);
    if (!detail) return originResponse;
    const meta = productMeta(detail, env);
    if (!meta) return originResponse;

    const additions = [
      `<meta property="og:url" content="${escapeAttribute(meta.canonical)}">`,
      `<meta property="product:price:amount" content="${escapeAttribute(meta.price)}">`,
      '<meta property="product:price:currency" content="BRL">',
      `<meta name="twitter:title" content="${escapeAttribute(meta.title)}">`,
      `<meta name="twitter:description" content="${escapeAttribute(meta.description)}">`,
      `<link rel="canonical" href="${escapeAttribute(meta.canonical)}">`,
      meta.image
        ? `<meta property="og:image" content="${escapeAttribute(meta.image)}"><meta property="og:image:alt" content="${escapeAttribute(meta.productName)}"><meta name="twitter:image" content="${escapeAttribute(meta.image)}">`
        : "",
    ].join("");

    return new HTMLRewriter()
      .on("title", {
        element(element) {
          element.setInnerContent(meta.title);
        },
      })
      .on('meta[name="description"]', {
        element(element) {
          element.setAttribute("content", meta.description);
        },
      })
      .on('meta[property="og:title"]', {
        element(element) {
          element.setAttribute("content", meta.title);
        },
      })
      .on('meta[property="og:description"]', {
        element(element) {
          element.setAttribute("content", meta.description);
        },
      })
      .on('meta[property="og:type"]', {
        element(element) {
          element.setAttribute("content", "product");
        },
      })
      .on('meta[name="twitter:card"]', {
        element(element) {
          element.setAttribute("content", "summary_large_image");
        },
      })
      .on("head", {
        element(element) {
          element.append(additions, { html: true });
        },
      })
      .transform(originResponse);
  },
};
