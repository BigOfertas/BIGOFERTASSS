import fs from "node:fs";

import {
  buildPublicProductDescription,
  formatProductVersionSentence,
  getProductVersionLabels,
  sanitizeStoredPublicProductDescription,
} from "../src/lib/public-product-description";

let passed = 0;
let failed = 0;

function check(label: string, condition: boolean) {
  if (condition) {
    passed += 1;
    console.log(`PASS - ${label}`);
  } else {
    failed += 1;
    console.error(`FAIL - ${label}`);
  }
}

const visualCategories = fs.readFileSync("src/components/home/VisualCategories.tsx", "utf8");
const categoryCard = fs.readFileSync("src/components/home/CategoryCard.tsx", "utf8");
const productDetail = fs.readFileSync("src/lib/product-detail.ts", "utf8");
const helper = fs.readFileSync("src/lib/public-product-description.ts", "utf8");
const migration = fs.readFileSync(
  "supabase/migrations/20260914162500_stage5_public_product_descriptions.sql",
  "utf8",
);
const deployment = fs.readFileSync("scripts/deploy-stage5-product-descriptions.mjs", "utf8");

check(
  "Monte seu pedido usa loop triplo contínuo sem paginação por timer",
  visualCategories.includes("const LOOP_COPIES = 3") &&
    visualCategories.includes("CONTINUOUS_SPEED_PX_PER_SECOND = 20") &&
    visualCategories.includes("requestAnimationFrame") &&
    !visualCategories.includes("setInterval"),
);
check(
  "loop normaliza para a cópia central sem salto de conteúdo",
  visualCategories.includes("normalizeLoopPosition") &&
    visualCategories.includes("scroller.scrollLeft -= sequenceWidth") &&
    visualCategories.includes("scroller.scrollLeft += sequenceWidth"),
);
check(
  "hover pausa imediatamente e saída espera cinco segundos",
  visualCategories.includes('addEventListener("mouseenter"') &&
    visualCategories.includes('addEventListener("mouseleave"') &&
    visualCategories.includes("const HOVER_RESUME_DELAY_MS = 5000"),
);
check(
  "setas existentes continuam navegando um card",
  visualCategories.includes("moveOneCard(-1)") && visualCategories.includes("moveOneCard(1)"),
);
check(
  "mobile preserva overflow técnico e esconde scrollbar visual",
  visualCategories.includes("overflow-x-auto") &&
    visualCategories.includes("[scrollbar-width:none]") &&
    visualCategories.includes("[&::-webkit-scrollbar]:hidden") &&
    !visualCategories.includes("custom-scrollbar"),
);
check(
  "reduced motion desativa a esteira automática e mantém navegação manual",
  visualCategories.includes('matchMedia("(prefers-reduced-motion: reduce)")') &&
    visualCategories.includes('behavior: prefersReducedMotionRef.current ? "auto" : "smooth"'),
);
check(
  "clones do loop saem da navegação por teclado",
  categoryCard.includes("clone = false") &&
    categoryCard.includes("aria-hidden={clone || undefined}") &&
    categoryCard.includes("tabIndex={clone ? -1 : undefined}") &&
    visualCategories.includes("clone={copyIndex !== 1}"),
);

const baseOptions = [
  {
    id: "size",
    name: "Tamanho",
    kind: "size",
    values: [
      { id: "p", value: "P" },
      { id: "m", value: "M" },
    ],
  },
];

check(
  "uma variante gera redação singular",
  formatProductVersionSentence(
    getProductVersionLabels(baseOptions, [
      { name: "P", commercial_type: "torcedor", optionValueIds: { size: "p" } },
    ]),
  ) === "Versão: Torcedor.",
);
check(
  "Torcedor e Jogador usam as duas variantes reais",
  formatProductVersionSentence(
    getProductVersionLabels(baseOptions, [
      { name: "P", commercial_type: "torcedor", optionValueIds: { size: "p" } },
      { name: "M", commercial_type: "jogador", optionValueIds: { size: "m" } },
    ]),
  ) === "Versões disponíveis: Torcedor e Jogador.",
);
check(
  "três variantes recebem vírgulas e conjunção final",
  formatProductVersionSentence(
    getProductVersionLabels(baseOptions, [
      { name: "A", commercial_type: "torcedor", optionValueIds: {} },
      { name: "B", commercial_type: "jogador", optionValueIds: {} },
      { name: "C", commercial_type: "feminina", optionValueIds: {} },
    ]),
  ) === "Versões disponíveis: Torcedor, Jogador e Feminina.",
);

const modelOptions = [
  {
    id: "model",
    name: "Modelo",
    kind: "style",
    values: [
      { id: "model-1", value: "Modelo 1" },
      { id: "model-2", value: "Modelo 2" },
    ],
  },
  ...baseOptions,
];
check(
  "Modelo 1 e Modelo 2 vêm da opção estruturada e não do título",
  formatProductVersionSentence(
    getProductVersionLabels(modelOptions, [
      { name: "qualquer nome", optionValueIds: { model: "model-1", size: "p" } },
      { name: "outro nome", optionValueIds: { model: "model-2", size: "m" } },
    ]),
  ) === "Versões disponíveis: Modelo 1 e Modelo 2.",
);
check(
  "tamanhos não são tratados como versões e valores iguais são deduplicados",
  getProductVersionLabels(baseOptions, [
    { name: "P", commercial_type: "torcedor", optionValueIds: { size: "p" } },
    { name: "M", commercial_type: "torcedor", optionValueIds: { size: "m" } },
  ]).join("|") === "Torcedor",
);
check(
  "remover Jogador remove imediatamente a versão da descrição derivada",
  buildPublicProductDescription("Versões disponíveis: Torcedor e Jogador.", baseOptions, [
    { name: "P", commercial_type: "torcedor", optionValueIds: { size: "p" } },
  ]) === "Versão: Torcedor.",
);
check(
  "descrição antiga perde marca legada e metadado duplicado",
  buildPublicProductDescription(
    "Produto sob demanda da BIGofertas. Versão Torcedor.",
    baseOptions,
    [
      { name: "P", commercial_type: "torcedor", optionValueIds: { size: "p" } },
      { name: "M", commercial_type: "jogador", optionValueIds: { size: "m" } },
    ],
  ) === "Produto sob demanda da DropBox. Versões disponíveis: Torcedor e Jogador.",
);
check(
  "domínio técnico bigofertas.net é preservado no saneamento",
  sanitizeStoredPublicProductDescription("Veja https://bigofertas.net. BIGofertas") ===
    "Veja https://bigofertas.net. DropBox",
);
check(
  "detalhe público aplica o helper após carregar opções e variantes reais",
  productDetail.includes("buildPublicProductDescription(product.description, options, variants)"),
);
check(
  "helper não usa nome do produto como fonte de versões",
  !helper.includes("product.name") && !helper.includes("productName"),
);
check(
  "banco limpa dados atuais e protege novas importações via trigger",
  migration.includes("UPDATE public.products") &&
    migration.includes("BEFORE INSERT OR UPDATE OF description") &&
    migration.includes("clean_product_description_before_write"),
);
check(
  "deploy de descrições mede pré e pós auditoria incluindo divergência singular/múltipla",
  deployment.includes("STAGE5_PRODUCT_DESCRIPTION_PRE_AUDIT") &&
    deployment.includes("STAGE5_PRODUCT_DESCRIPTION_POST_AUDIT") &&
    deployment.includes("multi_variant_products_with_singular_version"),
);

console.log(`\nSTAGE5_VALIDATION passed=${passed} failed=${failed}`);
if (failed > 0) process.exit(1);
