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

const root = read("src/routes/__root.tsx");
const gallery = read("src/components/product/ProductGallery.tsx");
const productCard = read("src/components/product/ProductCard.tsx");
const cursor = read("src/components/ui/cursor-follower.tsx");
const productImages = read("src/lib/product-images.ts");
const catalog = read("src/lib/catalog.ts");
const best = read("src/components/home/BestSellers.tsx");
const categories = read("src/components/home/VisualCategories.tsx");
const categoryCard = read("src/components/home/CategoryCard.tsx");

check(
  "entrada da loja não possui atraso artificial nem bloqueio global de imagens",
  !root.includes("INITIAL_REFRESH_MIN_MS") &&
    !root.includes("data-initial-refresh-loader") &&
    !root.includes("preloadRenderedImages") &&
    root.includes("<CursorFollower />"),
);

check(
  "lupa foi removida por completo, inclusive componente e integração legada do cursor",
  !fs.existsSync("src/components/ui/magnifier-lens.tsx") &&
    !gallery.includes("magnifier-lens") &&
    !gallery.includes("<Lens") &&
    !productCard.includes("magnifier-lens") &&
    !productCard.includes("<Lens") &&
    !cursor.includes("storefront:lens-visibility") &&
    !cursor.includes("lensActive") &&
    cursor.includes("data-cursor-follower"),
);

check(
  "troca de fotos do produto é instantânea e sem carrossel animado",
  !gallery.includes("embla-carousel-react") &&
    !gallery.includes("useEmblaCarousel") &&
    !gallery.includes("transition-transform") &&
    gallery.includes("SWIPE_THRESHOLD_PX") &&
    gallery.includes("setActiveImageId"),
);

check(
  "imagem principal do produto tem prioridade máxima",
  gallery.includes('loading="eager"') && gallery.includes('fetchPriority="high"'),
);

check(
  "Google Photos é requisitado em tamanhos adequados em vez de 4096 px",
  productImages.includes("buildOptimizedExternalImageUrl") &&
    productImages.includes("=w${safeSize}-h${safeSize}-s-no-gm") &&
    productImages.includes("originalExternal, 768") &&
    productImages.includes("originalExternal, 256") &&
    catalog.includes("buildOptimizedExternalImageUrl(item.image_external_url, 768)"),
);

check(
  "primeiros produtos visíveis carregam com prioridade",
  productCard.includes('loading={priority ? "eager" : "lazy"}') &&
    productCard.includes('fetchPriority={priority ? "high" : "auto"}') &&
    best.includes("PRIORITY_IMAGE_COUNT") &&
    best.includes("priority={index < PRIORITY_IMAGE_COUNT}"),
);

check(
  "conexão com o host das imagens é antecipada",
  root.includes('rel: "preconnect"') && root.includes('href: "https://lh3.googleusercontent.com"'),
);

check(
  "status e controles da galeria ficam abaixo do cabeçalho sticky",
  gallery.includes("data-gallery-status-overlay") &&
    gallery.includes("z-30") &&
    gallery.includes("z-40"),
);

check(
  "viewer continua centralizado e compacto",
  gallery.includes("data-product-image-viewer-frame") &&
    gallery.includes("h-[75dvh]") &&
    gallery.includes("sm:w-[75vw]"),
);

check(
  "Monte seu pedido mantém cards maiores e somente a arte",
  categories.includes("w-[164px]") &&
    categories.includes("md:w-[328px]") &&
    categoryCard.includes("data-visual-category-card") &&
    !categoryCard.includes("absolute inset-x-3 bottom-3"),
);

console.log(`\nSTAGE1_UX_VALIDATION passed=${passed} failed=${failed}`);
if (failed > 0) process.exit(1);
