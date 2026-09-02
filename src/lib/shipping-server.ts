const SUPERFRETE_API_URL = "https://api.superfrete.com/api/v0/calculator";
const SUPERFRETE_USER_AGENT = "BIGofertas/1.0 (contato@bigofertas.net)";

export const SHIPPING_CONFIG = {
  correiosOriginPostalCode: "59655000",
  loggiOriginPostalCode: "59630508",
  packageLengthCm: 40,
  packageWidthCm: 28,
  packageHeightCm: 5,
  packagingWeightGrams: 200,
  defaultShirtWeightGrams: 300,
  maxShirtsPerPackage: 3,
  productionBusinessDays: 5,
  correiosFixedFee: 10,
  loggiFixedFee: 30,
  pacServiceId: 1,
  sedexServiceId: 2,
  loggiServiceId: 31,
} as const;

type ShippingEnvironment = {
  SUPERFRETE_TOKEN?: string;
};

type QuoteRequestItem = {
  productId: string;
  quantity: number;
};

type ProductWeightRow = {
  id: string;
  weight_grams: number | null;
};

type SuperFreteQuoteRow = {
  id?: unknown;
  name?: unknown;
  price?: unknown;
  currency?: unknown;
  delivery_time?: unknown;
  delivery_range?: unknown;
  company?: unknown;
  has_error?: unknown;
};

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

type ShippingQuoteResponse = {
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

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store, max-age=0",
      "x-content-type-options": "nosniff",
    },
  });
}

function normalizePostalCode(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\D/g, "");
  return /^\d{8}$/.test(normalized) ? normalized : null;
}

function normalizeItems(value: unknown): QuoteRequestItem[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 100) {
    return null;
  }

  const merged = new Map<string, number>();

  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;

    const productId = (entry as { productId?: unknown }).productId;
    const quantity = (entry as { quantity?: unknown }).quantity;

    if (
      typeof productId !== "string" ||
      !UUID_PATTERN.test(productId) ||
      typeof quantity !== "number" ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 99
    ) {
      return null;
    }

    merged.set(productId, (merged.get(productId) ?? 0) + quantity);
  }

  const normalized = [...merged.entries()].map(([productId, quantity]) => ({
    productId,
    quantity,
  }));

  const totalUnits = normalized.reduce((sum, item) => sum + item.quantity, 0);
  return totalUnits <= 999 ? normalized : null;
}

function getSupabaseConfiguration() {
  const url = import.meta.env["VITE_SUPABASE_URL"];
  const publishableKey = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"];

  if (!url || !publishableKey) {
    throw new Error("Supabase indisponível para validar o carrinho do frete.");
  }

  return { url, publishableKey };
}

async function fetchTrustedProductWeights(items: QuoteRequestItem[]) {
  const { url, publishableKey } = getSupabaseConfiguration();
  const productIds = items.map((item) => item.productId);
  const endpoint = new URL(`${url}/rest/v1/products`);
  endpoint.searchParams.set("select", "id,weight_grams");
  endpoint.searchParams.set("id", `in.(${productIds.join(",")})`);
  endpoint.searchParams.set("status", "eq.active");

  const response = await fetch(endpoint, {
    headers: {
      apikey: publishableKey,
      accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Não foi possível validar os produtos para calcular o frete.");
  }

  const rows = (await response.json()) as ProductWeightRow[];
  const byId = new Map(rows.map((row) => [row.id, row]));

  if (byId.size !== productIds.length) {
    throw new Error("Há produto indisponível no carrinho. Atualize e tente novamente.");
  }

  return items.map((item) => {
    const row = byId.get(item.productId)!;
    const trustedWeight =
      typeof row.weight_grams === "number" && Number.isFinite(row.weight_grams)
        ? Math.max(row.weight_grams, SHIPPING_CONFIG.defaultShirtWeightGrams)
        : SHIPPING_CONFIG.defaultShirtWeightGrams;

    return { ...item, weightGrams: trustedWeight };
  });
}

function buildConservativePackage(
  items: Array<QuoteRequestItem & { weightGrams: number }>,
) {
  const totalUnits = items.reduce((sum, item) => sum + item.quantity, 0);
  const packageCount = Math.max(
    1,
    Math.ceil(totalUnits / SHIPPING_CONFIG.maxShirtsPerPackage),
  );
  const heaviestUnit = Math.max(
    SHIPPING_CONFIG.defaultShirtWeightGrams,
    ...items.map((item) => item.weightGrams),
  );
  const representativeUnits = Math.min(
    totalUnits,
    SHIPPING_CONFIG.maxShirtsPerPackage,
  );
  const quotedWeightGramsPerPackage =
    representativeUnits * heaviestUnit + SHIPPING_CONFIG.packagingWeightGrams;

  return {
    packageCount,
    quotedWeightGramsPerPackage,
    weightKg: Number((quotedWeightGramsPerPackage / 1000).toFixed(3)),
  };
}

function asFiniteNumber(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function parseTransitRange(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const min = asFiniteNumber(record["min"]);
  const max = asFiniteNumber(record["max"]);
  if (min === null || max === null || min < 0 || max < min) return null;
  return { min: Math.trunc(min), max: Math.trunc(max) };
}

async function requestSuperFreteQuotes(input: {
  token: string;
  originPostalCode: string;
  destinationPostalCode: string;
  services: string;
  weightKg: number;
}) {
  const response = await fetch(SUPERFRETE_API_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${input.token}`,
      "user-agent": SUPERFRETE_USER_AGENT,
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: { postal_code: input.originPostalCode },
      to: { postal_code: input.destinationPostalCode },
      services: input.services,
      options: {
        own_hand: false,
        receipt: false,
        insurance_value: 0,
        use_insurance_value: false,
      },
      package: {
        height: SHIPPING_CONFIG.packageHeightCm,
        width: SHIPPING_CONFIG.packageWidthCm,
        length: SHIPPING_CONFIG.packageLengthCm,
        weight: input.weightKg,
      },
    }),
    signal: AbortSignal.timeout(12_000),
  });

  if (!response.ok) {
    throw new Error(`SuperFrete respondeu HTTP ${response.status}.`);
  }

  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) {
    throw new Error("Resposta inesperada da SuperFrete.");
  }

  return payload as SuperFreteQuoteRow[];
}

function mapQuote(
  row: SuperFreteQuoteRow,
  packageCount: number,
  originPostalCode: string,
): ShippingQuote | null {
  if (row.has_error === true) return null;

  const serviceId = asFiniteNumber(row.id);
  const providerUnitPrice = asFiniteNumber(row.price);
  const transitBusinessDays = asFiniteNumber(row.delivery_time);

  if (
    serviceId === null ||
    providerUnitPrice === null ||
    providerUnitPrice <= 0 ||
    transitBusinessDays === null ||
    transitBusinessDays < 0
  ) {
    return null;
  }

  let carrier: ShippingQuote["carrier"];
  let service: ShippingQuote["service"];
  let additionalFee: number;

  switch (Math.trunc(serviceId)) {
    case SHIPPING_CONFIG.pacServiceId:
      carrier = "Correios";
      service = "PAC";
      additionalFee = SHIPPING_CONFIG.correiosFixedFee;
      break;
    case SHIPPING_CONFIG.sedexServiceId:
      carrier = "Correios";
      service = "SEDEX";
      additionalFee = SHIPPING_CONFIG.correiosFixedFee;
      break;
    case SHIPPING_CONFIG.loggiServiceId:
      carrier = "Loggi";
      service = "Loggi";
      additionalFee = SHIPPING_CONFIG.loggiFixedFee;
      break;
    default:
      return null;
  }

  const basePrice = Number((providerUnitPrice * packageCount).toFixed(2));
  const totalPrice = Number((basePrice + additionalFee).toFixed(2));

  return {
    provider: "superfrete",
    carrier,
    service,
    serviceId: Math.trunc(serviceId),
    originPostalCode,
    providerUnitPrice: Number(providerUnitPrice.toFixed(2)),
    basePrice,
    additionalFee,
    totalPrice,
    transitBusinessDays: Math.trunc(transitBusinessDays),
    transitRange: parseTransitRange(row.delivery_range),
    packageCount,
    currency: "BRL",
  };
}

async function calculateQuotes(
  token: string,
  destinationPostalCode: string,
  items: QuoteRequestItem[],
): Promise<ShippingQuoteResponse> {
  const trustedItems = await fetchTrustedProductWeights(items);
  const packageInfo = buildConservativePackage(trustedItems);

  const [correiosResult, loggiResult] = await Promise.allSettled([
    requestSuperFreteQuotes({
      token,
      originPostalCode: SHIPPING_CONFIG.correiosOriginPostalCode,
      destinationPostalCode,
      services: `${SHIPPING_CONFIG.pacServiceId},${SHIPPING_CONFIG.sedexServiceId}`,
      weightKg: packageInfo.weightKg,
    }),
    requestSuperFreteQuotes({
      token,
      originPostalCode: SHIPPING_CONFIG.loggiOriginPostalCode,
      destinationPostalCode,
      services: String(SHIPPING_CONFIG.loggiServiceId),
      weightKg: packageInfo.weightKg,
    }),
  ]);

  const quotes: ShippingQuote[] = [];

  if (correiosResult.status === "fulfilled") {
    for (const row of correiosResult.value) {
      const quote = mapQuote(
        row,
        packageInfo.packageCount,
        SHIPPING_CONFIG.correiosOriginPostalCode,
      );
      if (quote && quote.carrier === "Correios") quotes.push(quote);
    }
  } else {
    console.error("Falha na cotação Correios/SuperFrete:", correiosResult.reason);
  }

  if (loggiResult.status === "fulfilled") {
    for (const row of loggiResult.value) {
      const quote = mapQuote(
        row,
        packageInfo.packageCount,
        SHIPPING_CONFIG.loggiOriginPostalCode,
      );
      if (quote && quote.carrier === "Loggi") quotes.push(quote);
    }
  } else {
    console.error("Falha na cotação Loggi/SuperFrete:", loggiResult.reason);
  }

  const deduplicated = [...new Map(quotes.map((quote) => [quote.serviceId, quote])).values()]
    .sort((a, b) => a.totalPrice - b.totalPrice);

  if (deduplicated.length === 0) {
    throw new Error("Nenhuma modalidade de entrega está disponível para esse CEP agora.");
  }

  return {
    quotes: deduplicated,
    productionBusinessDays: SHIPPING_CONFIG.productionBusinessDays,
    package: {
      lengthCm: SHIPPING_CONFIG.packageLengthCm,
      widthCm: SHIPPING_CONFIG.packageWidthCm,
      heightCm: SHIPPING_CONFIG.packageHeightCm,
      packagingWeightGrams: SHIPPING_CONFIG.packagingWeightGrams,
      maxShirtsPerPackage: SHIPPING_CONFIG.maxShirtsPerPackage,
      packageCount: packageInfo.packageCount,
      quotedWeightGramsPerPackage: packageInfo.quotedWeightGramsPerPackage,
      pricingMethod: "conservative-multi-package",
    },
    quotedAt: new Date().toISOString(),
  };
}

export async function handleShippingQuoteRequest(
  request: Request,
  env: ShippingEnvironment,
) {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Método não permitido." }, 405);
  }

  const requestUrl = new URL(request.url);
  const origin = request.headers.get("origin");
  if (origin && origin !== requestUrl.origin) {
    return jsonResponse({ error: "Origem da requisição não permitida." }, 403);
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > 24_000) {
    return jsonResponse({ error: "Requisição de frete muito grande." }, 413);
  }

  if (!env.SUPERFRETE_TOKEN) {
    console.error("SUPERFRETE_TOKEN não configurado no ambiente do Worker.");
    return jsonResponse(
      { error: "Cotação de frete temporariamente indisponível." },
      503,
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Dados de frete inválidos." }, 400);
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return jsonResponse({ error: "Dados de frete inválidos." }, 400);
  }

  const record = body as Record<string, unknown>;
  const destinationPostalCode = normalizePostalCode(record["postalCode"]);
  const items = normalizeItems(record["items"]);

  if (!destinationPostalCode) {
    return jsonResponse({ error: "Informe um CEP válido com 8 dígitos." }, 400);
  }

  if (!items) {
    return jsonResponse({ error: "Carrinho inválido para cotação." }, 400);
  }

  try {
    return jsonResponse(
      await calculateQuotes(env.SUPERFRETE_TOKEN, destinationPostalCode, items),
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Não foi possível calcular o frete agora.";
    const expected =
      message.includes("produto indisponível") ||
      message.includes("Nenhuma modalidade") ||
      message.includes("validar os produtos");

    if (!expected) console.error("Erro inesperado na cotação de frete:", error);
    return jsonResponse({ error: message }, expected ? 422 : 502);
  }
}
