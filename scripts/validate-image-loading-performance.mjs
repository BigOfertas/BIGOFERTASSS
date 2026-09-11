import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");
let passed = 0;
let failed = 0;

function check(label, condition) {
  if (condition) {
    passed += 1;
    console.log(`PASS - ${label}`);
  } else {
    failed += 1;
    console.error(`FAIL - ${label}`);
  }
}

const images = read("src/lib/product-images.ts");
const catalog = read("src/lib/catalog.ts");
const card = read("src/components/product/ProductCard.tsx");
const bestSellers = read("src/components/home/BestSellers.tsx");
const grid = read("src/components/product/CatalogProductGrid.tsx");
const home = read("src/routes/index.tsx");
const gallery = read("src/components/product/ProductGallery.tsx");
const root = read("src/routes/__root.tsx");
const r2 = read("supabase/functions/_shared/r2.ts");
const productPresign = read("supabase/functions/r2-image-presign/index.ts");
const sitePresign = read("supabase/functions/site-asset-presign/index.ts");
const generator = read("scripts/generate-home-launches-static.mjs");
const injector = read("scripts/inject-home-image-preload.mjs");
const packageJson = read("package.json");

check(
  "Google Photos possui srcset responsivo 320/480/640/768",
  images.includes("PRODUCT_CARD_RESPONSIVE_WIDTHS = [320, 480, 640, 768]") &&
    images.includes("buildResponsiveExternalImageSrcSet") &&
    images.includes("`${url} ${width}w`"),
);

check(
  "cards recebem srcSet e mantêm sizes responsivo",
  card.includes("imageSrcSet?: string | null") &&
    card.includes("srcSet={imageSrcSet ?? undefined}") &&
    card.includes('sizes="(max-width: 639px) 48vw, (max-width: 1023px) 31vw, 260px"'),
);

check(
  "catálogo entrega srcset coerente com R2 ou imagem externa",
  catalog.includes("displayImageSrcSet: string | null") &&
    catalog.includes("buildR2DerivativeSrcSet") &&
    catalog.includes("buildResponsiveExternalImageSrcSet(externalSource)"),
);

check(
  "prioridade alta da home caiu de cinco para uma imagem",
  bestSellers.includes("const PRIORITY_IMAGE_COUNT = 1") &&
    !bestSellers.includes("const PRIORITY_IMAGE_COUNT = 5"),
);

check(
  "prioridade alta do catálogo caiu de seis para duas imagens",
  grid.includes("const PRIORITY_IMAGE_COUNT = 2") &&
    !grid.includes("const PRIORITY_IMAGE_COUNT = 6"),
);

check(
  "Hostinger gera snapshot antes do build e evita nova espera de dados após hidratação",
  packageJson.includes("node scripts/generate-home-launches-static.mjs") &&
    generator.includes("storefront_launch_products") &&
    generator.includes("src\", \"generated\", \"home-launches.ts") &&
    home.includes('homeLaunchesSnapshot from "@/generated/home-launches"') &&
    home.includes("STATIC_HOME_LAUNCHES") &&
    home.includes("<BestSellers initialData={STATIC_HOME_LAUNCHES} />") &&
    bestSellers.includes("initialDataUpdatedAt: initialData ? 0 : undefined"),
);

check(
  "primeira imagem da home entra no HTML como preload responsivo antes do JavaScript",
  packageJson.includes("node scripts/inject-home-image-preload.mjs") &&
    generator.includes("home-product-image-preload.json") &&
    injector.includes('rel="preload"') &&
    injector.includes('as="image"') &&
    injector.includes('fetchpriority="high"') &&
    injector.includes("imagesrcset") &&
    injector.includes("imagesizes") &&
    injector.includes("data-home-product-image-preload"),
);

check(
  "galeria usa srcset e só pré-carrega a próxima imagem depois da atual carregar",
  gallery.includes("srcSet={activeImage.cardSrcSet ?? undefined}") &&
    gallery.includes("onLoad={() => setLoadedImageId(activeImage.id)}") &&
    gallery.includes("loadedImageId !== activeImage.id") &&
    gallery.includes("const preloader = new Image()") &&
    gallery.includes("nextImage.cardUrl"),
);

check(
  "R2 grava Cache-Control imutável por um ano nos novos objetos",
  r2.includes('R2_IMMUTABLE_IMAGE_CACHE_CONTROL = "public, max-age=31536000, immutable"') &&
    r2.includes('"Cache-Control": R2_IMMUTABLE_IMAGE_CACHE_CONTROL') &&
    r2.includes("requiredHeaders"),
);

check(
  "presigns de produto e artes públicas devolvem os headers assinados de cache",
  productPresign.includes("requiredHeaders: main.requiredHeaders") &&
    productPresign.includes("requiredHeaders: card.requiredHeaders") &&
    productPresign.includes("requiredHeaders: thumb.requiredHeaders") &&
    sitePresign.includes("const { uploadUrl, expiresIn, requiredHeaders }") &&
    sitePresign.includes("requiredHeaders,"),
);

check(
  "documento faz preconnect para Google Photos e CDN R2",
  root.includes('href: "https://lh3.googleusercontent.com"') &&
    root.includes('href: "https://img.bigofertas.net"'),
);

console.log(`\nIMAGE_LOADING_PERFORMANCE passed=${passed} failed=${failed}`);
if (failed > 0) process.exit(1);
