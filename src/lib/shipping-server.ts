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

export type ShippingEnvironment = {
  SUPERFRETE_TOKEN?: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
};

export type ShippingHandlerSource = "cloudflare-entry" | "tanstack-route";

type ShippingDiagnosticStage =
  | "request"
  | "request_parse"
  | "environment"
  | "supabase_config"
  | "supabase"
  | "superfrete"
  | "superfrete_parse"
  | "quote_mapping"
  | "adapter"
  | "complete";

type ShippingDiagnostic = {
  code: string;
  stage: ShippingDiagnosticStage;
  diagnosticId: string;
  source: ShippingHandlerSource;
};

type SafeDiagnosticDetails = Record<
  string,
  string | number | boolean | null | Array<Record<string, string | number | null>>
>;

type ShippingHandlerOptions = {
  source?: ShippingHandlerSource;
};

type NitroCloudflareRequest = Request & {
  runtime?: {
    cloudflare?: {
      env?: unknown;
    };
  };
};

type ShippingRuntimeConfiguration = {
  token: string | undefined;
  tokenSource: "nitro-request" | "entry-argument" | "process" | "missing";
  supabaseUrl: string | undefined;
  supabasePublishableKey: string | undefined;
};

class ShippingOperationalError extends Error {
  readonly code: string;
  readonly stage: ShippingDiagnosticStage;
  readonly httpStatus: number;
  readonly details: SafeDiagnosticDetails | undefined;

  constructor(input: {
    message: string;
    code: string;
    stage: ShippingDiagnosticStage;
    httpStatus: number;
    details?: SafeDiagnosticDetails;
    cause?: unknown;
  }) {
    super(input.message, { cause: input.cause });
    this.name = "ShippingOperationalError";
    this.code = input.code;
    this.stage = input.stage;
    this.httpStatus = input.httpStatus;
    this.details = input.details;
  }
}

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

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function createDiagnostic(
  source: ShippingHandlerSource,
  code: string,
  stage: ShippingDiagnosticStage,
  diagnosticId = crypto.randomUUID(),
): ShippingDiagnostic {
  return { source, code, stage, diagnosticId };
}

function jsonResponse(payload: unknown, status: number, diagnostic: ShippingDiagnostic) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store, max-age=0",
      "x-content-type-options": "nosniff",
      "x-bigofertas-shipping-handler": "quote-v2",
      "x-bigofertas-shipping-source": diagnostic.source,
      "x-bigofertas-shipping-code": diagnostic.code,
      "x-bigofertas-shipping-id": diagnostic.diagnosticId,
    },
  });
}

function errorResponse(
  message: string,
  status: number,
  diagnostic: ShippingDiagnostic,
  details?: SafeDiagnosticDetails,
) {
  return jsonResponse(
    {
      error: message,
      code: diagnostic.code,
      stage: diagnostic.stage,
      diagnosticId: diagnostic.diagnosticId,
      ...(details ? { details } : {}),
    },
    status,
    diagnostic,
  );
}

function logShippingDiagnostic(
  level: "info" | "error",
  event: string,
  diagnostic: ShippingDiagnostic,
  details?: SafeDiagnosticDetails,
) {
  const payload = {
    component: "shipping-quote",
    event,
    ...diagnostic,
    ...(details ? { details } : {}),
  };

  console[level](`[shipping-quote] ${JSON.stringify(payload)}`);
}

function asEnvironment(value: unknown): ShippingEnvironment {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as ShippingEnvironment;
}

function nonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function resolveRuntimeConfiguration(
  request: Request,
  explicitEnvironment?: ShippingEnvironment,
): ShippingRuntimeConfiguration {
  const runtimeEnvironment = asEnvironment(
    (request as NitroCloudflareRequest).runtime?.cloudflare?.env,
  );
  const entryEnvironment = asEnvironment(explicitEnvironment);
  const processEnvironment = typeof process !== "undefined" ? asEnvironment(process.env) : {};

  const runtimeToken = nonEmptyString(runtimeEnvironment.SUPERFRETE_TOKEN);
  const entryToken = nonEmptyString(entryEnvironment.SUPERFRETE_TOKEN);
  const processToken = nonEmptyString(processEnvironment.SUPERFRETE_TOKEN);

  return {
    token: runtimeToken ?? entryToken ?? processToken,
    tokenSource: runtimeToken
      ? "nitro-request"
      : entryToken
        ? "entry-argument"
        : processToken
          ? "process"
          : "missing",
    supabaseUrl:
      nonEmptyString(runtimeEnvironment.VITE_SUPABASE_URL) ??
      nonEmptyString(entryEnvironment.VITE_SUPABASE_URL) ??
      nonEmptyString(import.meta.env["VITE_SUPABASE_URL"]),
    supabasePublishableKey:
      nonEmptyString(runtimeEnvironment.VITE_SUPABASE_PUBLISHABLE_KEY) ??
      nonEmptyString(entryEnvironment.VITE_SUPABASE_PUBLISHABLE_KEY) ??
      nonEmptyString(import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"]),
  };
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

function getSupabaseConfiguration(configuration: ShippingRuntimeConfiguration) {
  const url = configuration.supabaseUrl;
  const publishableKey = configuration.supabasePublishableKey;

  if (!url || !publishableKey) {
    throw new ShippingOperationalError({
      message: "A validação do carrinho está temporariamente indisponível.",
      code: "SHIPPING_SUPABASE_CONFIG_MISSING",
      stage: "supabase_config",
      httpStatus: 503,
      details: {
        urlConfigured: Boolean(url),
        publishableKeyConfigured: Boolean(publishableKey),
      },
    });
  }

  let endpoint: URL;
  try {
    endpoint = new URL("/rest/v1/products", url);
  } catch (cause) {
    throw new ShippingOperationalError({
      message: "A validação do carrinho está temporariamente indisponível.",
      code: "SHIPPING_SUPABASE_CONFIG_INVALID",
      stage: "supabase_config",
      httpStatus: 503,
      cause,
    });
  }

  if (endpoint.protocol !== "https:") {
    throw new ShippingOperationalError({
      message: "A validação do carrinho está temporariamente indisponível.",
      code: "SHIPPING_SUPABASE_CONFIG_INVALID",
      stage: "supabase_config",
      httpStatus: 503,
    });
  }

  return { endpoint, publishableKey };
}

async function fetchTrustedProductWeights(
  items: QuoteRequestItem[],
  configuration: ShippingRuntimeConfiguration,
) {
  const { endpoint, publishableKey } = getSupabaseConfiguration(configuration);
  const productIds = items.map((item) => item.productId);
  endpoint.searchParams.set("select", "id,weight_grams");
  endpoint.searchParams.set("id", `in.(${productIds.join(",")})`);
  endpoint.searchParams.set("status", "eq.active");

  let response: Response;
  try {
    response = await fetch(endpoint, {
      headers: {
        apikey: publishableKey,
        accept: "application/json",
      },
      signal: AbortSignal.timeout(8_000),
    });
  } catch (cause) {
    throw new ShippingOperationalError({
      message: "Não foi possível validar os produtos para calcular o frete.",
      code: "SHIPPING_SUPABASE_NETWORK_ERROR",
      stage: "supabase",
      httpStatus: 502,
      cause,
    });
  }

  if (!response.ok) {
    throw new ShippingOperationalError({
      message: "Não foi possível validar os produtos para calcular o frete.",
      code: "SHIPPING_SUPABASE_HTTP_ERROR",
      stage: "supabase",
      httpStatus: 502,
      details: { upstreamStatus: response.status },
    });
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (cause) {
    throw new ShippingOperationalError({
      message: "A validação dos produtos retornou dados inválidos.",
      code: "SHIPPING_SUPABASE_PARSE_ERROR",
      stage: "supabase",
      httpStatus: 502,
      cause,
    });
  }

  if (!Array.isArray(payload)) {
    throw new ShippingOperationalError({
      message: "A validação dos produtos retornou dados inválidos.",
      code: "SHIPPING_SUPABASE_PARSE_ERROR",
      stage: "supabase",
      httpStatus: 502,
    });
  }

  const rows = payload.filter(
    (row): row is ProductWeightRow =>
      Boolean(row) &&
      typeof row === "object" &&
      !Array.isArray(row) &&
      typeof (row as { id?: unknown }).id === "string",
  );

  if (rows.length !== payload.length) {
    throw new ShippingOperationalError({
      message: "A validação dos produtos retornou dados inválidos.",
      code: "SHIPPING_SUPABASE_PARSE_ERROR",
      stage: "supabase",
      httpStatus: 502,
    });
  }

  const byId = new Map(rows.map((row) => [row.id, row]));

  if (byId.size !== productIds.length) {
    throw new ShippingOperationalError({
      message: "Há produto indisponível no carrinho. Atualize e tente novamente.",
      code: "SHIPPING_PRODUCT_UNAVAILABLE",
      stage: "supabase",
      httpStatus: 422,
    });
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

function buildConservativePackage(items: Array<QuoteRequestItem & { weightGrams: number }>) {
  const totalUnits = items.reduce((sum, item) => sum + item.quantity, 0);
  const packageCount = Math.max(1, Math.ceil(totalUnits / SHIPPING_CONFIG.maxShirtsPerPackage));
  const heaviestUnit = Math.max(
    SHIPPING_CONFIG.defaultShirtWeightGrams,
    ...items.map((item) => item.weightGrams),
  );
  const representativeUnits = Math.min(totalUnits, SHIPPING_CONFIG.maxShirtsPerPackage);
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
  let response: Response;
  try {
    response = await fetch(SUPERFRETE_API_URL, {
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
  } catch (cause) {
    throw new ShippingOperationalError({
      message: "Não foi possível conectar à SuperFrete agora.",
      code: "SHIPPING_SUPERFRETE_NETWORK_ERROR",
      stage: "superfrete",
      httpStatus: 502,
      cause,
    });
  }

  if (!response.ok) {
    throw new ShippingOperationalError({
      message: "A SuperFrete não conseguiu concluir a cotação agora.",
      code: "SHIPPING_SUPERFRETE_HTTP_ERROR",
      stage: "superfrete",
      httpStatus: 502,
      details: { upstreamStatus: response.status },
    });
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (cause) {
    throw new ShippingOperationalError({
      message: "A SuperFrete retornou uma resposta inválida.",
      code: "SHIPPING_SUPERFRETE_PARSE_ERROR",
      stage: "superfrete_parse",
      httpStatus: 502,
      cause,
    });
  }

  if (!Array.isArray(payload)) {
    throw new ShippingOperationalError({
      message: "A SuperFrete retornou uma resposta inválida.",
      code: "SHIPPING_SUPERFRETE_PARSE_ERROR",
      stage: "superfrete_parse",
      httpStatus: 502,
    });
  }

  const rows = payload.filter(
    (row): row is SuperFreteQuoteRow =>
      Boolean(row) && typeof row === "object" && !Array.isArray(row),
  );

  if (rows.length !== payload.length) {
    throw new ShippingOperationalError({
      message: "A SuperFrete retornou uma resposta inválida.",
      code: "SHIPPING_SUPERFRETE_PARSE_ERROR",
      stage: "superfrete_parse",
      httpStatus: 502,
    });
  }

  return rows;
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
  configuration: ShippingRuntimeConfiguration,
): Promise<ShippingQuoteResponse> {
  const trustedItems = await fetchTrustedProductWeights(items, configuration);
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
  }

  if (loggiResult.status === "fulfilled") {
    for (const row of loggiResult.value) {
      const quote = mapQuote(row, packageInfo.packageCount, SHIPPING_CONFIG.loggiOriginPostalCode);
      if (quote && quote.carrier === "Loggi") quotes.push(quote);
    }
  }

  const deduplicated = [...new Map(quotes.map((quote) => [quote.serviceId, quote])).values()].sort(
    (a, b) => a.totalPrice - b.totalPrice,
  );

  if (deduplicated.length === 0) {
    const failures = [
      correiosResult.status === "rejected"
        ? toProviderFailure("Correios", correiosResult.reason)
        : null,
      loggiResult.status === "rejected" ? toProviderFailure("Loggi", loggiResult.reason) : null,
    ].filter((failure): failure is NonNullable<typeof failure> => Boolean(failure));

    if (failures.length > 0) {
      const parseFailure = failures.find((failure) => failure.stage === "superfrete_parse");
      const representativeFailure = parseFailure ?? failures[0]!;

      throw new ShippingOperationalError({
        message:
          representativeFailure.stage === "superfrete_parse"
            ? "A SuperFrete retornou uma resposta inválida."
            : "A SuperFrete não conseguiu concluir a cotação agora.",
        code: representativeFailure.code,
        stage: representativeFailure.stage,
        httpStatus: 502,
        details: { failures },
      });
    }

    throw new ShippingOperationalError({
      message: "Nenhuma modalidade de entrega está disponível para esse CEP agora.",
      code: "SHIPPING_NO_SERVICES",
      stage: "quote_mapping",
      httpStatus: 422,
    });
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

function toProviderFailure(carrier: "Correios" | "Loggi", reason: unknown) {
  if (reason instanceof ShippingOperationalError) {
    const upstreamStatus = reason.details?.["upstreamStatus"];
    return {
      carrier,
      code: reason.code,
      stage: reason.stage,
      upstreamStatus: typeof upstreamStatus === "number" ? upstreamStatus : null,
    };
  }

  return {
    carrier,
    code: "SHIPPING_SUPERFRETE_UNKNOWN_ERROR",
    stage: "superfrete" as const,
    upstreamStatus: null,
  };
}

export async function handleShippingQuoteRequest(
  request: Request,
  environment?: ShippingEnvironment,
  options: ShippingHandlerOptions = {},
) {
  const source = options.source ?? "tanstack-route";

  try {
    return await executeShippingQuoteRequest(request, environment, source);
  } catch (error) {
    return createShippingAdapterErrorResponse(error, source);
  }
}

async function executeShippingQuoteRequest(
  request: Request,
  environment: ShippingEnvironment | undefined,
  source: ShippingHandlerSource,
) {
  const diagnosticId = crypto.randomUUID();
  const runtimeConfiguration = resolveRuntimeConfiguration(request, environment);

  logShippingDiagnostic(
    "info",
    "route_reached",
    createDiagnostic(source, "SHIPPING_ROUTE_REACHED", "request", diagnosticId),
    {
      method: request.method,
      tokenSource: runtimeConfiguration.tokenSource,
      supabaseUrlConfigured: Boolean(runtimeConfiguration.supabaseUrl),
      supabaseKeyConfigured: Boolean(runtimeConfiguration.supabasePublishableKey),
    },
  );

  if (request.method !== "POST") {
    const diagnostic = createDiagnostic(
      source,
      "SHIPPING_METHOD_NOT_ALLOWED",
      "request",
      diagnosticId,
    );
    return errorResponse("Método não permitido.", 405, diagnostic);
  }

  const requestUrl = new URL(request.url);
  const origin = request.headers.get("origin");
  if (origin && origin !== requestUrl.origin) {
    const diagnostic = createDiagnostic(
      source,
      "SHIPPING_ORIGIN_FORBIDDEN",
      "request",
      diagnosticId,
    );
    return errorResponse("Origem da requisição não permitida.", 403, diagnostic);
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > 24_000) {
    const diagnostic = createDiagnostic(
      source,
      "SHIPPING_REQUEST_TOO_LARGE",
      "request",
      diagnosticId,
    );
    return errorResponse("Requisição de frete muito grande.", 413, diagnostic);
  }

  if (!runtimeConfiguration.token) {
    const diagnostic = createDiagnostic(
      source,
      "SHIPPING_ENV_MISSING",
      "environment",
      diagnosticId,
    );
    logShippingDiagnostic("error", "request_failed", diagnostic, {
      tokenConfigured: false,
    });
    return errorResponse("Cotação de frete temporariamente indisponível.", 503, diagnostic);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    const diagnostic = createDiagnostic(
      source,
      "SHIPPING_REQUEST_PARSE_ERROR",
      "request_parse",
      diagnosticId,
    );
    return errorResponse("Dados de frete inválidos.", 400, diagnostic);
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    const diagnostic = createDiagnostic(
      source,
      "SHIPPING_REQUEST_PARSE_ERROR",
      "request_parse",
      diagnosticId,
    );
    return errorResponse("Dados de frete inválidos.", 400, diagnostic);
  }

  const record = body as Record<string, unknown>;
  const destinationPostalCode = normalizePostalCode(record["postalCode"]);
  const items = normalizeItems(record["items"]);

  if (!destinationPostalCode) {
    const diagnostic = createDiagnostic(
      source,
      "SHIPPING_POSTAL_CODE_INVALID",
      "request",
      diagnosticId,
    );
    return errorResponse("Informe um CEP válido com 8 dígitos.", 400, diagnostic);
  }

  if (!items) {
    const diagnostic = createDiagnostic(source, "SHIPPING_CART_INVALID", "request", diagnosticId);
    return errorResponse("Carrinho inválido para cotação.", 400, diagnostic);
  }

  try {
    const diagnostic = createDiagnostic(source, "SHIPPING_OK", "complete", diagnosticId);
    return jsonResponse(
      await calculateQuotes(
        runtimeConfiguration.token,
        destinationPostalCode,
        items,
        runtimeConfiguration,
      ),
      200,
      diagnostic,
    );
  } catch (error) {
    if (error instanceof ShippingOperationalError) {
      const diagnostic = createDiagnostic(source, error.code, error.stage, diagnosticId);
      logShippingDiagnostic("error", "request_failed", diagnostic, error.details);
      return errorResponse(error.message, error.httpStatus, diagnostic, error.details);
    }

    const diagnostic = createDiagnostic(source, "SHIPPING_INTERNAL_ERROR", "adapter", diagnosticId);
    logShippingDiagnostic("error", "request_failed", diagnostic, {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return errorResponse("Não foi possível calcular o frete agora.", 500, diagnostic);
  }
}

export function createShippingAdapterErrorResponse(
  error: unknown,
  source: ShippingHandlerSource = "cloudflare-entry",
) {
  const diagnostic = createDiagnostic(source, "SHIPPING_ADAPTER_ERROR", "adapter");
  logShippingDiagnostic("error", "adapter_failed", diagnostic, {
    errorName: error instanceof Error ? error.name : "UnknownError",
  });
  return errorResponse(
    "O adaptador do serviço de frete falhou antes de concluir a requisição.",
    500,
    diagnostic,
  );
}
