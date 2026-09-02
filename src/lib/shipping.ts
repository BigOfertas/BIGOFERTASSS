import type { CartItem } from "@/lib/cart";

export type ShippingQuote = {
  provider: "superfrete";
  carrier: "Correios" | "Loggi";
  service: "PAC" | "SEDEX" | "Loggi";
  serviceId: number;
  originPostalCode: string;
  providerUnitPrice: number;
  basePrice: number;
  additionalFee: number;
  totalPrice: number;
  transitBusinessDays: number;
  transitRange: { min: number; max: number } | null;
  packageCount: number;
  currency: "BRL";
};

export type ShippingQuoteResult = {
  quotes: ShippingQuote[];
  productionBusinessDays: number;
  package: {
    lengthCm: number;
    widthCm: number;
    heightCm: number;
    packagingWeightGrams: number;
    maxShirtsPerPackage: number;
    packageCount: number;
    quotedWeightGramsPerPackage: number;
    pricingMethod: "conservative-multi-package";
  };
  quotedAt: string;
};

export function onlyPostalCodeDigits(value: string) {
  return value.replace(/\D/g, "").slice(0, 8);
}

export function formatPostalCode(value: string) {
  const digits = onlyPostalCodeDigits(value);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

export function formatTransitLabel(quote: ShippingQuote) {
  if (
    quote.transitRange &&
    quote.transitRange.max >= quote.transitRange.min &&
    quote.transitRange.max > 0
  ) {
    if (quote.transitRange.min === quote.transitRange.max) {
      return `${quote.transitRange.max} dia${quote.transitRange.max === 1 ? "" : "s"} útil${quote.transitRange.max === 1 ? "" : "eis"}`;
    }

    return `${quote.transitRange.min}–${quote.transitRange.max} dias úteis`;
  }

  return `${quote.transitBusinessDays} dia${quote.transitBusinessDays === 1 ? "" : "s"} útil${quote.transitBusinessDays === 1 ? "" : "eis"}`;
}

export async function requestShippingQuotes(
  postalCode: string,
  cart: CartItem[],
): Promise<ShippingQuoteResult> {
  const normalizedPostalCode = onlyPostalCodeDigits(postalCode);

  if (normalizedPostalCode.length !== 8) {
    throw new Error("Informe um CEP válido com 8 dígitos.");
  }

  if (cart.length === 0) {
    throw new Error("Adicione um produto ao carrinho para calcular o frete.");
  }

  const response = await fetch("/api/shipping/quote", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      postalCode: normalizedPostalCode,
      items: cart.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
      })),
    }),
  });

  const payload = (await response.json().catch(() => null)) as
    | (Partial<ShippingQuoteResult> & { error?: unknown })
    | null;

  if (!response.ok) {
    const message =
      payload && typeof payload.error === "string"
        ? payload.error
        : "Não foi possível calcular o frete agora.";
    throw new Error(message);
  }

  if (!payload || !Array.isArray(payload.quotes)) {
    throw new Error("A cotação retornou dados inválidos. Tente novamente.");
  }

  return payload as ShippingQuoteResult;
}
