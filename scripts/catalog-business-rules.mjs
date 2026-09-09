const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();

export function normalizeCatalogText(value) {
  return clean(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

export const CATALOG_SIZES = Object.freeze(["P", "M", "G", "GG", "2GG", "3GG", "4XL"]);

export const COMMERCIAL_TYPE_PRICES = Object.freeze({
  torcedor: 184.9,
  feminino: 184.9,
  jogador: 219.9,
  retro: 219.9,
  infantil: 169.9,
  calcao: 159.9,
  basquete: 229.9,
});

export const PERSONALIZATION_RULES = Object.freeze({
  normalPrice: 25,
  normalNameMax: 12,
  phrasePrice: 45,
  phraseMax: 50,
  patchPrice: 15,
});

export const BRAZIL_CLUB_PATCHES = Object.freeze([
  Object.freeze({ code: "brasileirao", label: "Brasileirão", enabled: true }),
  Object.freeze({ code: "libertadores", label: "Libertadores", enabled: true }),
  Object.freeze({ code: "sul-americana", label: "Sul Americana", enabled: true }),
  Object.freeze({ code: "copa-do-brasil", label: "Copa do Brasil", enabled: true }),
  Object.freeze({ code: "mundial-de-clubes", label: "Mundial de Clubes", enabled: true }),
]);

function sourceText(product) {
  return normalizeCatalogText(
    [
      product?.name,
      product?.nome,
      product?.tipo_produto,
      product?.type,
      product?.audience,
      product?.publico,
      product?.competition,
      product?.campeonato,
      product?.league,
      product?.liga,
      product?.team,
      product?.time,
      product?.selecao,
    ]
      .filter(Boolean)
      .join(" "),
  );
}

export function inferCommercialType(product) {
  const source = sourceText(product);

  // Tipos de peça prevalecem sobre versão/modelo.
  if (/\b(BASQUETE|BASKET|NBA)\b/.test(source)) return "basquete";
  if (/\b(SHORT|SHORTS|CALCAO)\b/.test(source)) return "calcao";
  if (/\b(INFANTIL|KIDS?|CRIANCA)\b/.test(source)) return "infantil";
  if (/\bRETRO\b/.test(source)) return "retro";
  if (/\b(PLAYER|JOGADOR)\b/.test(source)) return "jogador";
  if (/\bFEMININ[AO]\b/.test(source)) return "feminino";
  if (/\b(TORCEDOR|FAN|CAMISA|REGATA)\b/.test(source)) return "torcedor";
  return "other";
}

export function resolveCommercialPrice(commercialType, explicitPrice = null, fallbackPrice = null) {
  // Para tipos reconhecidos, a tabela BIGofertas é a fonte de verdade.
  const fixed = COMMERCIAL_TYPE_PRICES[commercialType];
  if (Number.isFinite(fixed)) return fixed;
  if (Number.isFinite(explicitPrice)) return Number(explicitPrice);
  return Number.isFinite(fallbackPrice) ? Number(fallbackPrice) : null;
}

const UNIFORM_LABELS = Object.freeze({
  I: "Primeiro uniforme",
  II: "Segundo uniforme",
  III: "Terceiro uniforme",
});

export function inferUniform(productOrTitle) {
  const source = normalizeCatalogText(
    typeof productOrTitle === "string" ? productOrTitle : sourceText(productOrTitle),
  );
  const match = source.match(/\b(?:CAMISA|REGATA)\s+(III|II|I)\b/);
  if (!match) return { model: null, label: null };
  return { model: match[1], label: UNIFORM_LABELS[match[1]] ?? null };
}

export function appendUniformSpecification(existingSpecifications, productOrTitle) {
  const existing = clean(existingSpecifications);
  if (/\bUniforme\s*:/i.test(existing)) return existing;
  const uniform = inferUniform(productOrTitle);
  if (!uniform.label) return existing;
  return [existing, `Uniforme: ${uniform.label}`].filter(Boolean).join(" | ");
}

export function inferPurchasePatches(product) {
  const source = sourceText(product);
  const isBrazilClubContext = /\b(BRASILEIRAO|CAMPEONATO BRASILEIRO|COPA DO BRASIL|LIBERTADORES|SUL AMERICANA)\b/.test(source);
  if (!isBrazilClubContext) return [];
  return BRAZIL_CLUB_PATCHES.map(({ code, enabled }) => ({ code, enabled }));
}

export function buildCatalogBusinessProfile(product, options = {}) {
  const commercialType = inferCommercialType(product);
  const uniform = inferUniform(product);
  const price = resolveCommercialPrice(
    commercialType,
    options.explicitPrice ?? null,
    options.fallbackPrice ?? null,
  );
  return {
    commercialType,
    price,
    uniform,
    specifications: appendUniformSpecification(options.specifications ?? "", product),
    patches: inferPurchasePatches(product),
    sizes: [...CATALOG_SIZES],
  };
}
