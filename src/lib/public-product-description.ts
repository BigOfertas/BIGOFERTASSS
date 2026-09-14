type PublicDescriptionOptionValue = {
  id: string;
  value: string;
};

type PublicDescriptionOption = {
  id: string;
  name: string;
  kind?: string | null;
  values?: PublicDescriptionOptionValue[] | null;
};

type PublicDescriptionVariant = {
  name?: string | null;
  commercial_type?: string | null;
  optionValueIds?: Record<string, string> | null;
};

const COMMERCIAL_TYPE_LABELS: Record<string, string> = {
  torcedor: "Torcedor",
  jogador: "Jogador",
  feminina: "Feminina",
  retro: "Retrô",
  nba: "NBA",
  short: "Short",
  "corta-vento": "Corta-vento",
  infantil: "Infantil",
  "training-kit": "Kit de treino",
};

function normalizeComparable(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isSizeOption(option: PublicDescriptionOption) {
  const normalizedName = normalizeComparable(option.name);
  return option.kind === "size" || normalizedName === "tamanho" || normalizedName === "size";
}

function looksLikeSizeLabel(value: string) {
  const compact = value.trim().toLocaleUpperCase("pt-BR").replace(/\s+/g, "");
  return /^(?:PP|P|M|G|GG|XG|XGG|EG|EGG|XS|S|L|XL|XXL|XXXL|[2-6]XL|\d{1,3})$/.test(compact);
}

function looksLikeGenericVersionLabel(value: string) {
  const normalized = normalizeComparable(value);
  return /^(?:versao|modelo)?\s*0*\d+$/.test(normalized) || /^versao\s+[a-z]$/.test(normalized);
}

function labelFromCommercialType(value: string | null | undefined) {
  if (!value || value === "other") return null;
  return (
    COMMERCIAL_TYPE_LABELS[value] ??
    value
      .replace(/[-_]+/g, " ")
      .replace(/^./, (char) => char.toUpperCase())
  );
}

function variantLabel(variant: PublicDescriptionVariant, options: PublicDescriptionOption[]) {
  const selectedValues = options
    .filter((option) => !isSizeOption(option))
    .map((option) => {
      const selectedValueId = variant.optionValueIds?.[option.id];
      if (!selectedValueId) return null;
      return option.values?.find((value) => value.id === selectedValueId)?.value?.trim() || null;
    })
    .filter((value): value is string => Boolean(value));

  const commercialTypeLabel = labelFromCommercialType(variant.commercial_type);
  if (
    selectedValues.length > 0 &&
    !selectedValues.every((value) => looksLikeGenericVersionLabel(value))
  ) {
    return selectedValues.join(" · ");
  }

  if (commercialTypeLabel) return commercialTypeLabel;

  if (selectedValues.length > 0) {
    return selectedValues.join(" · ");
  }

  const variantName = variant.name?.trim();
  return variantName && !looksLikeSizeLabel(variantName) ? variantName : null;
}

export function getProductVersionLabels(
  options: PublicDescriptionOption[],
  variants: PublicDescriptionVariant[],
) {
  const labels: string[] = [];
  const seen = new Set<string>();

  for (const variant of variants) {
    const label = variantLabel(variant, options);
    if (!label) continue;

    const comparable = normalizeComparable(label);
    if (!comparable || seen.has(comparable)) continue;

    seen.add(comparable);
    labels.push(label);
  }

  return labels;
}

export function formatProductVersionSentence(labels: string[]) {
  if (labels.length === 0) return "";
  if (labels.length === 1) return `Versão: ${labels[0]}.`;
  if (labels.length === 2) return `Versões disponíveis: ${labels[0]} e ${labels[1]}.`;

  return `Versões disponíveis: ${labels.slice(0, -1).join(", ")} e ${labels.at(-1)}.`;
}

export function sanitizeStoredPublicProductDescription(description: string | null | undefined) {
  if (!description?.trim()) return "";

  let cleaned = description.replace(/\bbigofertas\b(?!\.net)/giu, "DropBox");

  const metadataPatterns = [
    /(^|[.!?]\s+|\n+\s*)Vers(?:ões|oes)\s+dispon[ií]veis\s*:\s*[^.!?\n]{1,180}[.!?]?/giu,
    /(^|[.!?]\s+|\n+\s*)Vers(?:ão|ao)\s*:\s*[^.!?\n]{1,120}[.!?]?/giu,
    /(^|[.!?]\s+|\n+\s*)Vers(?:ão|ao)\s+[^.!?\n]{1,80}[.!?]?/giu,
  ];

  for (const pattern of metadataPatterns) {
    cleaned = cleaned.replace(pattern, (_match, prefix: string) => {
      if (!prefix) return "";
      return /[.!?]/.test(prefix) ? prefix.trimEnd() + " " : " ";
    });
  }

  return cleaned
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

function descriptionAlreadyRepresentsAllVersions(description: string, labels: string[]) {
  if (!description || labels.length === 0 || !/\bvers(?:ão|oes|ões)\b/iu.test(description)) {
    return false;
  }

  const normalizedDescription = normalizeComparable(description);
  return labels.every((label) => normalizedDescription.includes(normalizeComparable(label)));
}

export function buildPublicProductDescription(
  description: string | null | undefined,
  options: PublicDescriptionOption[],
  variants: PublicDescriptionVariant[],
) {
  const storedDescription = sanitizeStoredPublicProductDescription(description);
  const labels = getProductVersionLabels(options, variants);

  if (labels.length === 0 || descriptionAlreadyRepresentsAllVersions(storedDescription, labels)) {
    return storedDescription || null;
  }

  const versionSentence = formatProductVersionSentence(labels);
  return [storedDescription, versionSentence].filter(Boolean).join(" ") || null;
}
