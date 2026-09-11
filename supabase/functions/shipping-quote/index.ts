import { corsHeaders } from "../_shared/http.ts";

const SUPERFRETE_API_URL = "https://api.superfrete.com/api/v0/calculator";
const SUPERFRETE_USER_AGENT = "DropBox/1.0 (contato@bigofertas.net)";

const CONFIG = {
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

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type QuoteRequestItem = {
  productId: string;
  quantity: number;
};

type ProductWeightRow = {
  id: string;
  weight_grams: number | null;
};

type ProviderRow = {
  id?: unknown;
  price?: unknown;
  delivery_time?: unknown;
  delivery_range?: unknown;
  has_error?: unknown;
};

type ShippingQuote = {
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

class ShippingError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly causeForLog?: unknown,
  ) {
    super(message);
    this.name = "ShippingError";
  }
}

function response(request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(request),
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

  return normalized.reduce((sum, item) => sum + item.quantity, 0) <= 999 ? normalized : null;
}

function requiredEnvironment(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) {
    throw new ShippingError(
      "Cotação de frete temporariamente indisponível.",
      503,
      "SHIPPING_CONFIG_MISSING",
    );
  }
  return value;
}

async function fetchTrustedProductWeights(items: QuoteRequestItem[]) {
  const supabaseUrl = requiredEnvironment("SUPABASE_URL");
  const serviceRoleKey = requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY");
  const endpoint = new URL("/rest/v1/products", supabaseUrl);
  const productIds = items.map((item) => item.productId);

  endpoint.searchParams.set("select", "id,weight_grams");
  endpoint.searchParams.set("id", `in.(${productIds.join(",")})`);
  endpoint.searchParams.set("status", "eq.active");

  let upstream: Response;
  try {
    upstream = await fetch(endpoint, {
      headers: {
        apikey: serviceRoleKey,
        authorization: `Bearer ${serviceRoleKey}`,
        accept: "application/json",
      },
      signal: AbortSignal.timeout(8_000),
    });
  } catch (cause) {
    throw new ShippingError(
      "Não foi possível validar os produtos para calcular o frete.",
      502,
      "SHIPPING_PRODUCTS_UNAVAILABLE",
      cause,
    );
  }

  if (!upstream.ok) {
    throw new ShippingError(
      "Não foi possível validar os produtos para calcular o frete.",
      502,
      "SHIPPING_PRODUCTS_UNAVAILABLE",
      new Error(`Supabase products HTTP ${upstream.status}`),
    );
  }

  let payload: unknown;
  try {
    payload = await upstream.json();
  } catch (cause) {
    throw new ShippingError(
      "Não foi possível validar os produtos para calcular o frete.",
      502,
      "SHIPPING_PRODUCTS_UNAVAILABLE",
      cause,
    );
  }

  if (!Array.isArray(payload)) {
    throw new ShippingError(
      "Não foi possível validar os produtos para calcular o frete.",
      502,
      "SHIPPING_PRODUCTS_UNAVAILABLE",
    );
  }

  const rows = payload.filter(
    (row): row is ProductWeightRow =>
      Boolean(row) &&
      typeof row === "object" &&
      !Array.isArray(row) &&
      typeof (row as { id?: unknown }).id === "string",
  );

  const byId = new Map(rows.map((row) => [row.id, row]));
  if (rows.length !== payload.length || byId.size !== productIds.length) {
    throw new ShippingError(
      "Há produto indisponível no carrinho. Atualize e tente novamente.",
      422,
      "SHIPPING_PRODUCT_UNAVAILABLE",
    );
  }

  return items.map((item) => {
    const row = byId.get(item.productId)!;
    const weightGrams =
      typeof row.weight_grams === "number" && Number.isFinite(row.weight_grams)
        ? Math.max(row.weight_grams, CONFIG.defaultShirtWeightGrams)
        : CONFIG.defaultShirtWeightGrams;

    return { ...item, weightGrams };
  });
}

function buildPackage(items: Array<QuoteRequestItem & { weightGrams: number }>) {
  const totalUnits = items.reduce((sum, item) => sum + item.quantity, 0);
  const packageCount = Math.max(1, Math.ceil(totalUnits / CONFIG.maxShirtsPerPackage));
  const heaviestUnit = Math.max(
    CONFIG.defaultShirtWeightGrams,
    ...items.map((item) => item.weightGrams),
  );
  const unitsPerPackage = Math.min(totalUnits, CONFIG.maxShirtsPerPackage);
  const quotedWeightGramsPerPackage = unitsPerPackage * heaviestUnit + CONFIG.packagingWeightGrams;

  return {
    packageCount,
    quotedWeightGramsPerPackage,
    weightKg: Number((quotedWeightGramsPerPackage / 1000).toFixed(3)),
  };
}

async function requestProvider(input: {
  token: string;
  originPostalCode: string;
  destinationPostalCode: string;
  services: string;
  weightKg: number;
}) {
  let upstream: Response;
  try {
    upstream = await fetch(SUPERFRETE_API_URL, {
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
          height: CONFIG.packageHeightCm,
          width: CONFIG.packageWidthCm,
          length: CONFIG.packageLengthCm,
          weight: input.weightKg,
        },
      }),
      signal: AbortSignal.timeout(12_000),
    });
  } catch (cause) {
    throw new ShippingError(
      "A SuperFrete não conseguiu concluir a cotação agora.",
      502,
      "SHIPPING_PROVIDER_UNAVAILABLE",
      cause,
    );
  }

  if (!upstream.ok) {
    throw new ShippingError(
      "A SuperFrete não conseguiu concluir a cotação agora.",
      502,
      "SHIPPING_PROVIDER_UNAVAILABLE",
      new Error(`SuperFrete HTTP ${upstream.status}`),
    );
  }

  let payload: unknown;
  try {
    payload = await upstream.json();
  } catch (cause) {
    throw new ShippingError(
      "A SuperFrete não conseguiu concluir a cotação agora.",
      502,
      "SHIPPING_PROVIDER_UNAVAILABLE",
      cause,
    );
  }

  if (!Array.isArray(payload)) {
    throw new ShippingError(
      "A SuperFrete não conseguiu concluir a cotação agora.",
      502,
      "SHIPPING_PROVIDER_UNAVAILABLE",
    );
  }

  return payload.filter(
    (row): row is ProviderRow => Boolean(row) && typeof row === "object" && !Array.isArray(row),
  );
}

function finiteNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function transitRange(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const min = finiteNumber(record.min);
  const max = finiteNumber(record.max);
  if (min === null || max === null || min < 0 || max < min) return null;
  return { min: Math.trunc(min), max: Math.trunc(max) };
}

function mapQuote(
  row: ProviderRow,
  packageCount: number,
  originPostalCode: string,
): ShippingQuote | null {
  if (row.has_error === true) return null;

  const serviceId = finiteNumber(row.id);
  const providerUnitPrice = finiteNumber(row.price);
  const transitBusinessDays = finiteNumber(row.delivery_time);

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
    case CONFIG.pacServiceId:
      carrier = "Correios";
      service = "PAC";
      additionalFee = CONFIG.correiosFixedFee;
      break;
    case CONFIG.sedexServiceId:
      carrier = "Correios";
      service = "SEDEX";
      additionalFee = CONFIG.correiosFixedFee;
      break;
    case CONFIG.loggiServiceId:
      carrier = "Loggi";
      service = "Loggi";
      additionalFee = CONFIG.loggiFixedFee;
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
    transitRange: transitRange(row.delivery_range),
    packageCount,
    currency: "BRL",
  };
}

async function calculateQuotes(postalCode: string, items: QuoteRequestItem[]) {
  const token = requiredEnvironment("SUPERFRETE_TOKEN");
  const trustedItems = await fetchTrustedProductWeights(items);
  const packageInfo = buildPackage(trustedItems);

  const [correiosResult, loggiResult] = await Promise.allSettled([
    requestProvider({
      token,
      originPostalCode: CONFIG.correiosOriginPostalCode,
      destinationPostalCode: postalCode,
      services: `${CONFIG.pacServiceId},${CONFIG.sedexServiceId}`,
      weightKg: packageInfo.weightKg,
    }),
    requestProvider({
      token,
      originPostalCode: CONFIG.loggiOriginPostalCode,
      destinationPostalCode: postalCode,
      services: String(CONFIG.loggiServiceId),
      weightKg: packageInfo.weightKg,
    }),
  ]);

  const quotes: ShippingQuote[] = [];

  if (correiosResult.status === "fulfilled") {
    for (const row of correiosResult.value) {
      const quote = mapQuote(row, packageInfo.packageCount, CONFIG.correiosOriginPostalCode);
      if (quote?.carrier === "Correios") quotes.push(quote);
    }
  }

  if (loggiResult.status === "fulfilled") {
    for (const row of loggiResult.value) {
      const quote = mapQuote(row, packageInfo.packageCount, CONFIG.loggiOriginPostalCode);
      if (quote?.carrier === "Loggi") quotes.push(quote);
    }
  }

  const available = [...new Map(quotes.map((quote) => [quote.serviceId, quote])).values()].sort(
    (left, right) => left.totalPrice - right.totalPrice,
  );

  if (available.length === 0) {
    const rejected = [correiosResult, loggiResult].find((result) => result.status === "rejected");
    if (rejected?.status === "rejected") throw rejected.reason;

    throw new ShippingError(
      "Nenhuma modalidade de entrega está disponível para esse CEP agora.",
      422,
      "SHIPPING_NO_SERVICES",
    );
  }

  return {
    quotes: available,
    productionBusinessDays: CONFIG.productionBusinessDays,
    package: {
      lengthCm: CONFIG.packageLengthCm,
      widthCm: CONFIG.packageWidthCm,
      heightCm: CONFIG.packageHeightCm,
      packagingWeightGrams: CONFIG.packagingWeightGrams,
      maxShirtsPerPackage: CONFIG.maxShirtsPerPackage,
      packageCount: packageInfo.packageCount,
      quotedWeightGramsPerPackage: packageInfo.quotedWeightGramsPerPackage,
      pricingMethod: "conservative-multi-package" as const,
    },
    quotedAt: new Date().toISOString(),
  };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }

  if (request.method !== "POST") {
    return response(request, { error: "Método não permitido." }, 405);
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > 24_000) {
    return response(request, { error: "Requisição de frete muito grande." }, 413);
  }

  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new ShippingError("Dados de frete inválidos.", 400, "SHIPPING_REQUEST_INVALID");
    }

    const record = body as Record<string, unknown>;
    const postalCode = normalizePostalCode(record.postalCode);
    const items = normalizeItems(record.items);

    if (!postalCode) {
      throw new ShippingError(
        "Informe um CEP válido com 8 dígitos.",
        400,
        "SHIPPING_POSTAL_CODE_INVALID",
      );
    }

    if (!items) {
      throw new ShippingError("Carrinho inválido para cotação.", 400, "SHIPPING_CART_INVALID");
    }

    return response(request, await calculateQuotes(postalCode, items));
  } catch (error) {
    if (error instanceof ShippingError) {
      console.error("[shipping-quote]", error.code, error.causeForLog ?? error.message);
      return response(request, { error: error.message, code: error.code }, error.status);
    }

    console.error("[shipping-quote] unexpected", error);
    return response(request, { error: "Não foi possível calcular o frete agora." }, 500);
  }
});
