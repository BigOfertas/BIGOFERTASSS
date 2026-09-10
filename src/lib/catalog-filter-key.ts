const FILTER_KEY_MAX_LENGTH = 100;

export function toCatalogFilterKey(value: string) {
  const normalized = value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized.slice(0, FILTER_KEY_MAX_LENGTH).replace(/-+$/g, "");
}
