import type { Json } from "@/integrations/supabase/types";

export const CART_STORAGE_KEY = "bigofertas_cart";
export const CART_STORAGE_VERSION = 2;
export const MAX_CART_LINE_QUANTITY = 99;

const KNOWN_FICTITIOUS_PRODUCT_NAME = "Camisa Profissional BIGofertas 2024";

function isKnownFictitiousCartItem(name: string, imageUrl: string | null) {
  return (
    name === KNOWN_FICTITIOUS_PRODUCT_NAME &&
    typeof imageUrl === "string" &&
    imageUrl.includes("placehold.co")
  );
}

export type CartItemStatus =
  | "available"
  | "out_of_stock"
  | "unavailable"
  | "needs_review";

export interface CartOptionSnapshot {
  optionId: string;
  optionName: string;
  optionKind: "size" | "style" | "color" | "other";
  valueId: string;
  valueLabel: string;
}

export interface CartItem {
  lineId: string;
  productId: string;
  productSlug: string | null;
  variantId: string | null;
  sku: string | null;
  name: string;
  variantName: string | null;
  unitPrice: number;
  imageUrl: string | null;
  quantity: number;
  availableStock: number | null;
  selectedOptions: CartOptionSnapshot[];
  status: CartItemStatus;
}

export interface AddCartItemInput {
  productId: string;
  productSlug: string | null;
  variantId: string;
  sku: string;
  name: string;
  variantName: string | null;
  unitPrice: number;
  imageUrl: string | null;
  availableStock: number;
  selectedOptions: CartOptionSnapshot[];
}

interface CartStorageEnvelope {
  version: typeof CART_STORAGE_VERSION;
  items: CartItem[];
}

interface LegacyCartItem {
  id?: unknown;
  name?: unknown;
  price?: unknown;
  image_url?: unknown;
  quantity?: unknown;
}

export interface CartValidationRow {
  line_id: string;
  product_id: string | null;
  product_slug: string | null;
  product_name: string | null;
  variant_id: string | null;
  variant_sku: string | null;
  variant_name: string | null;
  unit_price: number | null;
  available_stock: number | null;
  status: CartItemStatus;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function nullableString(value: unknown): string | null {
  return value === null || value === undefined ? null : nonEmptyString(value);
}

function nonNegativeNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

function nonNegativeInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? value
    : null;
}

export function createCartLineId(productId: string, variantId: string | null) {
  return `${productId}::${variantId ?? "legacy"}`;
}

export function getCartQuantityLimit(availableStock: number | null) {
  if (availableStock === null) return MAX_CART_LINE_QUANTITY;
  if (availableStock <= 0) return 1;
  return Math.min(MAX_CART_LINE_QUANTITY, availableStock);
}

export function clampCartQuantity(
  quantity: number,
  availableStock: number | null,
) {
  const normalized = Number.isFinite(quantity) ? Math.trunc(quantity) : 1;
  return Math.min(Math.max(normalized, 1), getCartQuantityLimit(availableStock));
}

function sanitizeOptionSnapshot(value: unknown): CartOptionSnapshot | null {
  if (!isRecord(value)) return null;

  const optionId = nonEmptyString(value.optionId);
  const optionName = nonEmptyString(value.optionName);
  const valueId = nonEmptyString(value.valueId);
  const valueLabel = nonEmptyString(value.valueLabel);
  const optionKind = value.optionKind;

  if (
    !optionId ||
    !optionName ||
    !valueId ||
    !valueLabel ||
    !["size", "style", "color", "other"].includes(String(optionKind))
  ) {
    return null;
  }

  return {
    optionId,
    optionName,
    optionKind: optionKind as CartOptionSnapshot["optionKind"],
    valueId,
    valueLabel,
  };
}

function sanitizeCurrentCartItem(value: unknown): CartItem | null {
  if (!isRecord(value)) return null;

  const productId = nonEmptyString(value.productId);
  const name = nonEmptyString(value.name);
  const unitPrice = nonNegativeNumber(value.unitPrice);
  const rawQuantity = nonNegativeInteger(value.quantity);
  const rawStock =
    value.availableStock === null
      ? null
      : nonNegativeInteger(value.availableStock);

  if (!productId || !name || unitPrice === null || rawQuantity === null) {
    return null;
  }

  const variantId = nullableString(value.variantId);
  const status = [
    "available",
    "out_of_stock",
    "unavailable",
    "needs_review",
  ].includes(String(value.status))
    ? (value.status as CartItemStatus)
    : variantId
      ? "available"
      : "needs_review";

  const selectedOptions = Array.isArray(value.selectedOptions)
    ? value.selectedOptions
        .map(sanitizeOptionSnapshot)
        .filter((item): item is CartOptionSnapshot => item !== null)
    : [];

  const availableStock = rawStock;
  const imageUrl = nullableString(value.imageUrl);

  if (isKnownFictitiousCartItem(name, imageUrl)) {
    return null;
  }

  return {
    lineId: createCartLineId(productId, variantId),
    productId,
    productSlug: nullableString(value.productSlug),
    variantId,
    sku: nullableString(value.sku),
    name,
    variantName: nullableString(value.variantName),
    unitPrice,
    imageUrl,
    quantity: clampCartQuantity(rawQuantity || 1, availableStock),
    availableStock,
    selectedOptions,
    status,
  };
}

function migrateLegacyCartItem(value: LegacyCartItem): CartItem | null {
  const productId = nonEmptyString(value.id);
  const name = nonEmptyString(value.name);
  const unitPrice = nonNegativeNumber(value.price);
  const quantity = nonNegativeInteger(value.quantity);

  if (!productId || !name || unitPrice === null || quantity === null) {
    return null;
  }

  const imageUrl = nullableString(value.image_url);

  if (isKnownFictitiousCartItem(name, imageUrl)) {
    return null;
  }

  return {
    lineId: createCartLineId(productId, null),
    productId,
    productSlug: null,
    variantId: null,
    sku: null,
    name,
    variantName: null,
    unitPrice,
    imageUrl,
    quantity: clampCartQuantity(quantity || 1, null),
    availableStock: null,
    selectedOptions: [],
    status: "needs_review",
  };
}

export function normalizeCartItems(items: CartItem[]) {
  const byLine = new Map<string, CartItem>();

  for (const item of items) {
    const current = byLine.get(item.lineId);
    if (!current) {
      byLine.set(item.lineId, item);
      continue;
    }

    byLine.set(item.lineId, {
      ...item,
      quantity: clampCartQuantity(
        current.quantity + item.quantity,
        item.availableStock,
      ),
    });
  }

  return [...byLine.values()];
}

export function decodeStoredCart(raw: string | null): CartItem[] {
  if (!raw) return [];

  try {
    const parsed: unknown = JSON.parse(raw);

    if (Array.isArray(parsed)) {
      return normalizeCartItems(
        parsed
          .map((item) => migrateLegacyCartItem(item as LegacyCartItem))
          .filter((item): item is CartItem => item !== null),
      );
    }

    if (!isRecord(parsed) || parsed.version !== CART_STORAGE_VERSION) {
      return [];
    }

    if (!Array.isArray(parsed.items)) return [];

    return normalizeCartItems(
      parsed.items
        .map(sanitizeCurrentCartItem)
        .filter((item): item is CartItem => item !== null),
    );
  } catch {
    return [];
  }
}

export function encodeStoredCart(items: CartItem[]) {
  const payload: CartStorageEnvelope = {
    version: CART_STORAGE_VERSION,
    items,
  };

  return JSON.stringify(payload);
}

export function createCartItem(
  input: AddCartItemInput,
  quantity: number,
): CartItem {
  const availableStock = Number.isFinite(input.availableStock)
    ? Math.max(0, Math.trunc(input.availableStock))
    : 0;
  const unitPrice = Number.isFinite(input.unitPrice)
    ? Math.max(0, input.unitPrice)
    : 0;

  return {
    lineId: createCartLineId(input.productId, input.variantId),
    productId: input.productId,
    productSlug: input.productSlug,
    variantId: input.variantId,
    sku: input.sku,
    name: input.name,
    variantName: input.variantName,
    unitPrice,
    imageUrl: input.imageUrl,
    quantity: clampCartQuantity(quantity, availableStock),
    availableStock,
    selectedOptions: input.selectedOptions,
    status: availableStock > 0 ? "available" : "out_of_stock",
  };
}

export function cartItemsToValidationPayload(items: CartItem[]): Json {
  return items.slice(0, 100).map((item) => ({
    line_id: item.lineId,
    product_id: item.productId,
    variant_id: item.variantId,
  }));
}

export function parseCartValidationRows(value: Json): CartValidationRow[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry) => {
    if (!isRecord(entry)) return [];

    const lineId = nonEmptyString(entry.line_id);
    const status = entry.status;
    if (
      !lineId ||
      !["available", "out_of_stock", "unavailable", "needs_review"].includes(
        String(status),
      )
    ) {
      return [];
    }

    return [
      {
        line_id: lineId,
        product_id: nullableString(entry.product_id),
        product_slug: nullableString(entry.product_slug),
        product_name: nullableString(entry.product_name),
        variant_id: nullableString(entry.variant_id),
        variant_sku: nullableString(entry.variant_sku),
        variant_name: nullableString(entry.variant_name),
        unit_price: nonNegativeNumber(entry.unit_price),
        available_stock:
          entry.available_stock === null
            ? null
            : nonNegativeInteger(entry.available_stock),
        status: status as CartItemStatus,
      },
    ];
  });
}
