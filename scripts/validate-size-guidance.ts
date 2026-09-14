import assert from "node:assert/strict";
import fs from "node:fs";

import { getSizeGuidance, SIZE_GUIDANCE_NOTE } from "../src/lib/size-guidance.ts";

const cases = [
  ["camisa Torcedor", { commercialType: "torcedor" }, "shirt", "axila à outra em uma camisa"],
  ["camisa Jogador", { commercialType: "jogador" }, "shirt", "axila à outra em uma camisa"],
  ["Feminina", { commercialType: "feminino" }, "shirt", "axila à outra em uma camisa"],
  ["Retrô", { commercialType: "retro" }, "shirt", "axila à outra em uma camisa"],
  ["NBA/basquete", { commercialType: "basquete" }, "basketball", "regata ou camiseta"],
  ["Short / Calção", { commercialType: "calcao" }, "shorts", "cintura de um short"],
  [
    "Calça por categoria estruturada",
    { commercialType: "other", categoryName: "Calças" },
    "pants",
    "cintura de uma calça",
  ],
  ["Corta-vento", { commercialType: "corta_vento" }, "outerwear", "axila à outra em um casaco"],
  ["Kit Infantil", { commercialType: "infantil" }, "kids", "altura da criança"],
  ["Camisa + Calção", { commercialType: "camisa_calcao" }, "shirt-shorts", "largura de uma camisa"],
  ["Regata + Calção", { commercialType: "regata_calcao" }, "tank-shorts", "largura de uma regata"],
  [
    "Top/Camisa de treino + Calça",
    { commercialType: "treino_calca" },
    "training-pants",
    "parte de cima na região do peito",
  ],
  ["Casaco + Calça", { commercialType: "casaco_calca" }, "jacket-pants", "largura de um casaco"],
  [
    "categoria desconhecida",
    { commercialType: "other", categoryName: "Acessórios especiais" },
    "fallback",
    "Consulte o guia de tamanhos",
  ],
] as const;

for (const [label, context, expectedKind, expectedText] of cases) {
  const guidance = getSizeGuidance(context);
  assert.equal(guidance.kind, expectedKind, `${label}: tipo de orientação incorreto`);
  assert.ok(guidance.instruction.includes(expectedText), `${label}: texto de orientação incorreto`);
  console.log(`PASS - ${label} -> ${guidance.kind}`);
}

const shorts = getSizeGuidance({ commercialType: "calcao" });
assert.equal(
  /axila/i.test(shorts.instruction),
  false,
  "Short / Calção nunca pode receber orientação de axila",
);
console.log("PASS - Short / Calção nunca usa orientação de axila");

const categoryFallbacks = [
  ["Regatas", "basketball"],
  ["Shorts e Calções", "shorts"],
  ["Calças de treino", "pants"],
  ["Corta-vento", "outerwear"],
  ["Casacos", "outerwear"],
  ["Camisas", "shirt"],
  ["Kit Infantil", "kids"],
] as const;
for (const [categoryName, expectedKind] of categoryFallbacks) {
  assert.equal(
    getSizeGuidance({ commercialType: "other", categoryName }).kind,
    expectedKind,
    `Fallback estruturado de categoria falhou para ${categoryName}`,
  );
}
console.log("PASS - fallbacks por categoria estruturada");

assert.equal(
  SIZE_GUIDANCE_NOTE,
  "As medidas podem variar levemente entre modelos. O tamanho não altera o preço do produto.",
);
console.log("PASS - observação complementar curta preservada");

const route = fs.readFileSync("src/routes/product/$id.tsx", "utf8");
const component = fs.readFileSync("src/components/product/ProductPurchaseOptions.tsx", "utf8");
const helper = fs.readFileSync("src/lib/size-guidance.ts", "utf8");
const detail = fs.readFileSync("src/lib/product-detail.ts", "utf8");
const migration = fs.readFileSync(
  "supabase/migrations/20260914034500_dynamic_size_guidance_variant_type.sql",
  "utf8",
);

assert.ok(
  route.includes("selectedVariant?.commercial_type ?? purchaseConfig.commercialType"),
  "Produto com variantes deve priorizar o tipo comercial da variante selecionada",
);
assert.ok(
  route.includes("onSelect={(variant) => setSelection({ ...variant.optionValueIds })}"),
  "Troca de variante deve continuar usando o estado selection existente",
);
assert.ok(
  component.includes("getSizeGuidance({") && component.includes('aria-live="polite"'),
  "Orientação deve ser recalculada no render e anunciável sem refresh",
);
assert.ok(
  component.includes("data-size-guidance-kind={sizeGuidance.kind}"),
  "Bloco deve expor o tipo resolvido para QA real",
);
assert.equal(
  component.includes("Meça de uma axila à outra em uma peça que já veste bem."),
  false,
  "Frase fixa antiga não pode permanecer no componente",
);
assert.equal(
  /product\.name|includes\(["']short|includes\(["']calc/i.test(helper),
  false,
  "Helper não pode classificar pelo nome do produto nem por includes frágil do título",
);
assert.ok(
  helper.includes("categoryName") && helper.includes("categorySlug"),
  "Fallback deve usar categoria estruturada",
);
assert.ok(
  detail.includes("commercial_type?: string | null"),
  "Detalhe tipado deve preservar commercial_type da variante",
);
assert.ok(
  migration.includes("jsonb_build_object('commercial_type', v.commercial_type)"),
  "RPC público deve expor commercial_type estruturado da variante",
);
assert.equal(
  /UPDATE\s+public\.products|UPDATE\s+public\.product_variants|DELETE\s+FROM/i.test(migration),
  false,
  "Migração de orientação não deve alterar dados comerciais existentes",
);

console.log("PASS - produto com variantes usa classificação estruturada selecionada");
console.log("PASS - troca de variante atualiza orientação sem refresh");
console.log("PASS - helper não usa nome do produto como heurística");
console.log("PASS - migração é somente leitura/contrato do detalhe público");
console.log("SIZE_GUIDANCE_VALIDATION_OK");
