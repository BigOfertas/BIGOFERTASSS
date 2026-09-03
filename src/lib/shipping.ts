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

function edgeShippingUrl() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
  return supabaseUrl ? `${supabaseUrl.replace(/\/$/, "")}/functions/v1/shipping-quote` : null;
}

async function postShippingQuote(url: string, body: string) {
  return fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
    },
    body,
  });
}

async function shippingResponse(body: string) {
  const edgeUrl = edgeShippingUrl();

  if (edgeUrl) {
    try {
      const edgeResponse = await postShippingQuote(edgeUrl, body);
      if (edgeResponse.status < 500) return edgeResponse;
    } catch {
      // Durante a migração, o Worker antigo continua disponível como fallback.
    }
  }

  return postShippingQuote("/api/shipping/quote", body);
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

  const requestBody = JSON.stringify({
    postalCode: normalizedPostalCode,
    items: cart.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
    })),
  });

  const response = await shippingResponse(requestBody);
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
    const canShowServerMessage = response.status === 400 || response.status === 422;
    const message =
      canShowServerMessage && payload && typeof payload.error === "string"
        ? payload.error
        : "Não foi possível calcular o frete agora. Tente novamente em instantes.";
    throw new Error(message);
  }

  if (!payload || !Array.isArray(payload.quotes)) {
    throw new Error(
      "Não foi possível carregar as opções de entrega agora. Tente novamente.",
    );
  }

  return payload as ShippingQuoteResult;
}
