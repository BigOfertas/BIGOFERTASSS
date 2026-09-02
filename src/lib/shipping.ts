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

type ShippingErrorPayload = Partial<ShippingQuoteResult> & {
  error?: unknown;
  code?: unknown;
  stage?: unknown;
  diagnosticId?: unknown;
};

export function onlyPostalCodeDigits(value: string) {
  return value.replace(/\D/g, "").slice(0, 8);
}

export function formatPostalCode(value: string) {
  const digits = onlyPostalCodeDigits(value);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

function businessDaysLabel(days: number) {
  return days === 1 ? "1 dia útil" : `${days} dias úteis`;
}

export function formatTransitLabel(quote: ShippingQuote) {
  if (
    quote.transitRange &&
    quote.transitRange.max >= quote.transitRange.min &&
    quote.transitRange.max > 0
  ) {
    if (quote.transitRange.min === quote.transitRange.max) {
      return businessDaysLabel(quote.transitRange.max);
    }

    return `${quote.transitRange.min}–${quote.transitRange.max} dias úteis`;
  }

  return businessDaysLabel(quote.transitBusinessDays);
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

  const reachedShippingHandler =
    response.headers.get("x-bigofertas-shipping-handler") === "quote-v2";
  const rawBody = await response.text();
  let payload: ShippingErrorPayload | null = null;

  if (rawBody) {
    try {
      payload = JSON.parse(rawBody) as ShippingErrorPayload;
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const diagnosticCode = payload && typeof payload.code === "string" ? payload.code : null;
    const diagnosticId =
      payload && typeof payload.diagnosticId === "string" ? payload.diagnosticId : null;
    const diagnosticSuffix = diagnosticCode
      ? ` (diagnóstico: ${diagnosticCode}${diagnosticId ? ` · ${diagnosticId}` : ""})`
      : "";

    const message =
      payload && typeof payload.error === "string"
        ? `${payload.error}${diagnosticSuffix}`
        : !reachedShippingHandler
          ? `O endpoint de frete não foi alcançado pelo Worker (diagnóstico: SHIPPING_ROUTE_NOT_REACHED · HTTP ${response.status}).`
          : `O adaptador de frete retornou uma resposta inválida (diagnóstico: SHIPPING_ADAPTER_RESPONSE_INVALID · HTTP ${response.status}).`;
    throw new Error(message);
  }

  if (!payload || !Array.isArray(payload.quotes)) {
    throw new Error(
      reachedShippingHandler
        ? "A cotação retornou dados inválidos (diagnóstico: SHIPPING_ADAPTER_RESPONSE_INVALID)."
        : "O endpoint de frete não foi alcançado pelo Worker (diagnóstico: SHIPPING_ROUTE_NOT_REACHED).",
    );
  }

  return payload as ShippingQuoteResult;
}
