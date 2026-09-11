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
const lens = read("src/components/ui/magnifier-lens.tsx");
const cursor = read("src/components/ui/cursor-follower.tsx");
const categories = read("src/components/home/VisualCategories.tsx");
const categoryCard = read("src/components/home/CategoryCard.tsx");
const leagues = read("src/components/home/ShopByLeague.tsx");

check(
  "loading inicial tem mínimo de 2,3 s e espera dados, placeholders e imagens",
  root.includes("const INITIAL_REFRESH_MIN_MS = 2300") &&
    root.includes("waitForInitialQueries") &&
    root.includes("waitForStorefrontPlaceholders") &&
    root.includes("preloadRenderedImages"),
);

check(
  "cursor fica oculto no loading e só monta após a liberação da tela",
  root.includes("data-initial-refresh-loader") &&
    root.includes("cursor-none") &&
    root.includes("!initialRefreshLoading ? <CursorFollower /> : null"),
);

check(
  "troca de liga preserva cards existentes e pré-carrega novas imagens",
  leagues.includes("preloadProductImages") &&
    leagues.includes("displayProducts") &&
    leagues.includes("isPlaceholderData") &&
    leagues.includes("data-league-products") &&
    leagues.includes("setDisplayLeagueId(activeLeague.id)"),
);

check(
  "galeria usa arraste contínuo via Embla e não troca apenas no touchend",
  gallery.includes('from "embla-carousel-react"') &&
    gallery.includes("data-product-gallery-track") &&
    gallery.includes("useEmblaCarousel") &&
    !gallery.includes("onTouchEnd") &&
    !gallery.includes("SWIPE_THRESHOLD"),
);

check(
  "status e controles da galeria ficam abaixo do cabeçalho sticky",
  gallery.includes("data-gallery-status-overlay") &&
    gallery.includes("z-30") &&
    gallery.includes("z-40") &&
    !gallery.includes("z-[70]") &&
    !gallery.includes("z-[80]"),
);

check(
  "viewer abre centralizado e cerca de 25% menor que a viewport",
  gallery.includes("data-product-image-viewer-frame") &&
    gallery.includes("h-[75dvh]") &&
    gallery.includes("sm:w-[75vw]") &&
    gallery.includes("items-center justify-center"),
);

check(
  "lupa avisa o cursor e ambos fazem transição suave",
  lens.includes('const LENS_VISIBILITY_EVENT = "storefront:lens-visibility"') &&
    lens.includes("transition: \"opacity 180ms ease\"") &&
    cursor.includes('const LENS_VISIBILITY_EVENT = "storefront:lens-visibility"') &&
    cursor.includes("lensActiveRef") &&
    cursor.includes("transition-opacity duration-200"),
);

check(
  "Monte seu pedido dobra os cards no desktop",
  categories.includes('w-[164px]') && categories.includes('md:w-[328px]'),
);

check(
  "cards visuais exibem somente a arte, sem texto sobreposto",
  categoryCard.includes("data-visual-category-card") &&
    !categoryCard.includes("absolute inset-x-3 bottom-3") &&
    !categoryCard.includes("{name}\n        </span>"),
);

console.log(`\nSTAGE1_UX_VALIDATION passed=${passed} failed=${failed}`);
if (failed > 0) process.exit(1);
