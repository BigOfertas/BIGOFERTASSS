import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();

async function read(relativePath) {
  return fs.readFile(path.join(ROOT, relativePath), "utf8");
}

async function write(relativePath, content) {
  await fs.writeFile(path.join(ROOT, relativePath), content);
}

function replaceOnce(content, needle, replacement, label) {
  if (content.includes(replacement)) return content;
  if (!content.includes(needle)) throw new Error(`Stage6 patch failed (${label})`);
  return content.replace(needle, replacement);
}

let root = await read("src/routes/__root.tsx");
root = replaceOnce(
  root,
  'import { QueryClient, QueryClientProvider } from "@tanstack/react-query";',
  'import { QueryClient, QueryClientProvider } from "@tanstack/react-query";\nimport { ThemeProvider } from "next-themes";',
  "ThemeProvider import",
);
root = replaceOnce(
  root,
  'import sportThemeCss from "../sport-theme.css?url";',
  'import sportThemeCss from "../sport-theme.css?url";\nimport stage6ThemeCss from "../stage6-theme.css?url";',
  "Stage6 theme import",
);
root = replaceOnce(
  root,
  'import { getR2PublicBaseUrl } from "@/lib/product-images";',
  'import { getR2PublicBaseUrl } from "@/lib/product-images";\nimport { I18nProvider } from "@/i18n";',
  "i18n import",
);
root = replaceOnce(
  root,
  '      { rel: "stylesheet", href: sportThemeCss },',
  '      { rel: "stylesheet", href: sportThemeCss },\n      { rel: "stylesheet", href: stage6ThemeCss },',
  "Stage6 theme stylesheet",
);
root = root.replace('<html lang="pt-BR">', '<html lang="pt-BR" suppressHydrationWarning>');
root = root.replace('<body style={{ background: "#ffffff" }}>', "<body>");
root = root.replace('background: "#ffffff",', 'background: "var(--background)",');
if (!root.includes('storageKey="dropbox-theme"')) {
  root = replaceOnce(
    root,
    '    <QueryClientProvider client={queryClient}>\n      <AuthProvider>',
    '    <QueryClientProvider client={queryClient}>\n      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} storageKey="dropbox-theme">\n        <I18nProvider>\n          <AuthProvider>',
    "providers open",
  );
  root = replaceOnce(
    root,
    '      </AuthProvider>\n    </QueryClientProvider>',
    '          </AuthProvider>\n        </I18nProvider>\n      </ThemeProvider>\n    </QueryClientProvider>',
    "providers close",
  );
}
await write("src/routes/__root.tsx", root);

let header = await read("src/components/layout/Header.tsx");
header = replaceOnce(
  header,
  'import { BrandWordmark } from "@/components/brand/BrandWordmark";',
  'import { BrandWordmark } from "@/components/brand/BrandWordmark";\nimport { Stage6HeaderControls } from "@/components/layout/Stage6HeaderControls";',
  "header controls import",
);
header = header.replace('className="hidden md:block"', 'className="hidden lg:block"');
header = header.replace('className="md:hidden"', 'className="lg:hidden"');
if (!header.includes("<Stage6HeaderControls />")) {
  header = replaceOnce(
    header,
    '            <div className="flex items-center gap-3">\n              <Link',
    '            <div className="flex items-center gap-3">\n              <Stage6HeaderControls />\n              <Link',
    "desktop header controls",
  );
}
if (!header.includes("<Stage6HeaderControls mobile />")) {
  header = replaceOnce(
    header,
    '        <MobileLiquidMorphMenu\n          open={mobilePanel === "categories"}',
    '        <div className="border-t border-gray-100 px-4 py-3 dark:border-white/10">\n          <Stage6HeaderControls mobile />\n        </div>\n\n        <MobileLiquidMorphMenu\n          open={mobilePanel === "categories"}',
    "mobile header controls",
  );
}
await write("src/components/layout/Header.tsx", header);

let product = await read("src/routes/product/$id.tsx");
product = product.replace("  ShoppingCart,\n", "");
product = replaceOnce(
  product,
  'import { Button } from "@/components/ui/button";',
  'import { Button } from "@/components/ui/button";\nimport MotionButton from "@/components/ui/motion-button";',
  "MotionButton import",
);
if (!product.includes("const [addingToCart")) {
  product = replaceOnce(
    product,
    "  const [quantity, setQuantity] = useState(1);",
    "  const [quantity, setQuantity] = useState(1);\n  const [addingToCart, setAddingToCart] = useState(false);",
    "add-to-cart guard state",
  );
}
if (!product.includes("if (addingToCart) return;")) {
  product = replaceOnce(
    product,
    "  const handleAddToCart = () => {\n    if (!selectedVariant || !selectionComplete) {",
    "  const handleAddToCart = () => {\n    if (addingToCart) return;\n    if (!selectedVariant || !selectionComplete) {",
    "add-to-cart guard",
  );
}
if (!product.includes("setAddingToCart(true);")) {
  product = replaceOnce(
    product,
    "    addToCart(\n      {",
    "    setAddingToCart(true);\n    addToCart(\n      {",
    "add-to-cart lock",
  );
  product = replaceOnce(
    product,
    "      quantity,\n    );\n  };",
    "      quantity,\n    );\n    window.setTimeout(() => setAddingToCart(false), 450);\n  };",
    "add-to-cart unlock",
  );
}

if (!product.includes("<MotionButton")) {
  let replaced = 0;
  product = product.replace(
    /([ ]+)<Button\n\s+onClick=\{handleAddToCart\}[\s\S]*?<\/Button>/g,
    (_match, indent) => {
      replaced += 1;
      const mobile = indent.length <= 10;
      const classes = mobile
        ? 'classes="min-w-0 flex-[1.35] w-auto"'
        : 'classes="w-full"';
      const selectLabel = mobile ? "Escolha as opções" : "Selecione as opções";
      return [
        `${indent}<MotionButton`,
        `${indent}  type="button"`,
        `${indent}  onClick={handleAddToCart}`,
        `${indent}  disabled={!selectedVariant || !selectionComplete || !purchaseConfig}`,
        `${indent}  loading={addingToCart}`,
        `${indent}  label={`,
        `${indent}    !selectionComplete`,
        `${indent}      ? "${selectLabel}"`,
        `${indent}      : availableToOrder`,
        `${indent}        ? "Adicionar ao carrinho"`,
        `${indent}        : "Indisponível"`,
        `${indent}  }`,
        `${indent}  ${classes}`,
        `${indent}/>`
      ].join("\n");
    },
  );
  if (replaced !== 2) throw new Error(`Stage6 expected 2 add-to-cart CTAs, replaced ${replaced}`);
}
await write("src/routes/product/$id.tsx", product);

let seo = await read("src/components/product/ProductSeo.tsx");
seo = replaceOnce(
  seo,
  'import { BRAND } from "@/config/brand";',
  'import { BRAND } from "@/config/brand";\nimport { LOCALE_META, useI18n } from "@/i18n";',
  "ProductSeo i18n import",
);
if (!seo.includes("const { locale, translateText }")) {
  seo = replaceOnce(
    seo,
    "}: ProductSeoProps) {\n  useEffect(() => {",
    "}: ProductSeoProps) {\n  const { locale, translateText } = useI18n();\n\n  useEffect(() => {",
    "ProductSeo i18n hook",
  );
}
seo = seo.replace(
  "      product.description?.trim().slice(0, 160) ||",
  '      translateText(product.description?.trim() ?? "").slice(0, 160) ||',
);
seo = seo.replace(
  "}. Confira fotos, opções e entrega na ${BRAND.officialName}.",
  '${translateText("Confira fotos, opções e entrega na DropBox.")}',
);
if (!seo.includes("LOCALE_META[locale].ogLocale")) {
  seo = replaceOnce(
    seo,
    "    setManagedMeta(\n      'meta[property=\"og:type\"]',",
    "    setManagedMeta(\n      'meta[property=\"og:locale\"]',\n      { property: \"og:locale\", content: LOCALE_META[locale].ogLocale },\n      cleanups,\n    );\n    setManagedMeta(\n      'meta[property=\"og:type\"]',",
    "ProductSeo og locale",
  );
}
seo = seo.replace(
  "  }, [images, inStock, price, product]);",
  "  }, [images, inStock, locale, price, product, translateText]);",
);
await write("src/components/product/ProductSeo.tsx", seo);

let generator = await read("scripts/stage6-generate-translations.mjs");
if (!generator.includes("idioma|tema|claro|escuro")) {
  generator = generator.replace(
    "perguntas|frequentes)\\b)/iu;",
    "perguntas|frequentes|idioma|tema|claro|escuro|compartilhar|link|fale|falar|ajuda|dúvida|duvida|produto|este|encontrei|olha|dispositivo|torcedor|jogador|feminina|retro|retrô|infantil|corta|vento|calção|calcao|short|modelo|versão|versao|versões|versoes|disponíveis|disponiveis|camisa|regata|calça|calca|casaco|itens|caracteres)\\b)/iu;",
  );
}
if (!generator.includes("ts.isTemplateExpression")) {
  generator = generator.replace(
    "    if (ts.isJsxText(node)) add(node.getText(sf));",
    "    if (ts.isJsxText(node)) add(node.getText(sf));\n    if (ts.isTemplateExpression(node)) {\n      add(node.head.text);\n      for (const span of node.templateSpans) add(span.literal.text);\n    }",
  );
}
await write("scripts/stage6-generate-translations.mjs", generator);

let validateMain = await read(".github/workflows/validate-main.yml");
if (!validateMain.includes("validate-stage6-i18n.mjs")) {
  validateMain = replaceOnce(
    validateMain,
    "      - name: Validate affiliate referral backend",
    "      - name: Validate Stage 6 dark mode and i18n\n        run: node scripts/validate-stage6-i18n.mjs\n\n      - name: Validate affiliate referral backend",
    "Stage6 main gate",
  );
}
await write(".github/workflows/validate-main.yml", validateMain);

const pkg = JSON.parse(await read("package.json"));
pkg.scripts = {
  ...pkg.scripts,
  "validate:stage6-i18n": "node scripts/validate-stage6-i18n.mjs",
};
await write("package.json", JSON.stringify(pkg, null, 2) + "\n");

console.log("STAGE6_PATCH_EXISTING_OK");
