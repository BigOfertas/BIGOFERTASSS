import type { CatalogListItem } from "@/lib/catalog";

const STANDARD_COMMERCIAL_TYPES = new Set(["torcedor", "jogador"]);

function normalizeProductName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

export function isStandardHomeJersey(product: Pick<CatalogListItem, "name" | "commercial_type">) {
  if (!product.commercial_type || !STANDARD_COMMERCIAL_TYPES.has(product.commercial_type)) {
    return false;
  }

  return /\bCAMISA(?:\s+(?:TORCEDOR|JOGADOR|PLAYER))?\s+(?:I|II|III)\b/.test(
    normalizeProductName(product.name),
  );
}

export function selectVariedProducts<T extends Pick<CatalogListItem, "id" | "time">>(
  products: readonly T[],
  limit: number,
) {
  const seen = new Set<string>();
  const buckets = new Map<string, T[]>();

  for (const product of products) {
    if (seen.has(product.id)) continue;
    seen.add(product.id);
    const key = product.time?.trim().toLowerCase() || `produto:${product.id}`;
    const bucket = buckets.get(key) ?? [];
    bucket.push(product);
    buckets.set(key, bucket);
  }

  const selected: T[] = [];
  while (selected.length < limit) {
    let pickedInRound = 0;
    for (const bucket of buckets.values()) {
      const next = bucket.shift();
      if (!next) continue;
      selected.push(next);
      pickedInRound += 1;
      if (selected.length >= limit) break;
    }
    if (pickedInRound === 0) break;
  }

  return selected;
}
