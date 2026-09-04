import { handleShippingQuoteRequest } from "./shipping-server";
import type { ShippingEnvironment, ShippingQuote } from "./shipping-server";

const INFINITEPAY_LINKS_URL = "https://api.checkout.infinitepay.io/links";
const INFINITEPAY_PAYMENT_CHECK_URL = "https://api.checkout.infinitepay.io/payment_check";

export type InfinitePayEnvironment = ShippingEnvironment & {
  INFINITEPAY_HANDLE?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

type NitroCloudflareRequest = Request & {
  runtime?: {
    cloudflare?: {
      env?: unknown;
    };
  };
};

type ResolvedEnvironment = {
  infinitePayHandle: string | undefined;
  supabaseUrl: string | undefined;
  supabasePublishableKey: string | undefined;
  supabaseServiceRoleKey: string | undefined;
  shippingEnvironment: ShippingEnvironment;
};

type AuthenticatedUser = {
  id: string;
  email: string | null;
};

type CustomerAddress = {
  id: string;
  recipient_name: string;
  postal_code: string;
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
};

type CheckoutItemInput = {
  productId: string;
  variantId: string;
  quantity: number;
  customization: Record<string, unknown>;
};

type StartCheckoutInput = {
  addressId: string;
  shippingServiceId: number;
  idempotencyKey: string;
  items: CheckoutItemInput[];
};

type ShippingQuotePayload = {
  quotes: ShippingQuote[];
  quotedAt: string;
};

type CreatedOrder = {
  id: string;
  public_number: string;
  user_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  total_amount: number | string;
  payment_status: string;
  status: string;
};

type InfinitePayLinkResponse = {
  url?: unknown;
};

type InfinitePayWebhookPayload = {
  invoice_slug?: unknown;
  amount?: unknown;
  paid_amount?: unknown;
  installments?: unknown;
  capture_method?: unknown;
  transaction_nsu?: unknown;
  order_nsu?: unknown;
  receipt_url?: unknown;
};

type InfinitePayPaymentCheckResponse = {
  success?: unknown;
  paid?: unknown;
  amount?: unknown;
  paid_amount?: unknown;
  installments?: unknown;
  capture_method?: unknown;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

class CheckoutError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string, cause?: unknown) {
    super(message, { cause });
    this.name = "CheckoutError";
    this.status = status;
    this.code = code;
  }
}

function asEnvironment(value: unknown): InfinitePayEnvironment {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as InfinitePayEnvironment;
}

function nonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function resolveEnvironment(
  request: Request,
  explicitEnvironment?: InfinitePayEnvironment,
): ResolvedEnvironment {
  const runtimeEnvironment = asEnvironment(
    (request as NitroCloudflareRequest).runtime?.cloudflare?.env,
  );
  const entryEnvironment = asEnvironment(explicitEnvironment);
  const processEnvironment =
    typeof process !== "undefined" ? asEnvironment(process.env) : {};

  const supabaseUrl =
    nonEmptyString(runtimeEnvironment.VITE_SUPABASE_URL) ??
    nonEmptyString(entryEnvironment.VITE_SUPABASE_URL) ??
    nonEmptyString(import.meta.env["VITE_SUPABASE_URL"]);
  const supabasePublishableKey =
    nonEmptyString(runtimeEnvironment.VITE_SUPABASE_PUBLISHABLE_KEY) ??
    nonEmptyString(entryEnvironment.VITE_SUPABASE_PUBLISHABLE_KEY) ??
    nonEmptyString(import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"]);
  const superFreteToken =
    nonEmptyString(runtimeEnvironment.SUPERFRETE_TOKEN) ??
    nonEmptyString(entryEnvironment.SUPERFRETE_TOKEN) ??
    nonEmptyString(processEnvironment.SUPERFRETE_TOKEN);

  return {
    infinitePayHandle:
      nonEmptyString(runtimeEnvironment.INFINITEPAY_HANDLE) ??
      nonEmptyString(entryEnvironment.INFINITEPAY_HANDLE) ??
      nonEmptyString(processEnvironment.INFINITEPAY_HANDLE),
    supabaseUrl,
    supabasePublishableKey,
    supabaseServiceRoleKey:
      nonEmptyString(runtimeEnvironment.SUPABASE_SERVICE_ROLE_KEY) ??
      nonEmptyString(entryEnvironment.SUPABASE_SERVICE_ROLE_KEY) ??
      nonEmptyString(processEnvironment.SUPABASE_SERVICE_ROLE_KEY),
    shippingEnvironment: {
      SUPERFRETE_TOKEN: superFreteToken,
      VITE_SUPABASE_URL: supabaseUrl,
      VITE_SUPABASE_PUBLISHABLE_KEY: supabasePublishableKey,
    },
  };
}

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

function errorResponse(error: unknown) {
  if (error instanceof CheckoutError) {
    console.error(
      `[checkout] ${JSON.stringify({ code: error.code, status: error.status, name: error.name })}`,
    );
    return jsonResponse({ error: error.message, code: error.code }, error.status);
  }

  console.error(error);
  return jsonResponse(
    { error: "Não foi possível iniciar o pagamento agora.", code: "CHECKOUT_INTERNAL_ERROR" },
    500,
  );
}

function requireServerConfiguration(environment: ResolvedEnvironment) {
  if (
    !environment.supabaseUrl ||
    !environment.supabasePublishableKey ||
    !environment.supabaseServiceRoleKey
  ) {
    throw new CheckoutError(
      "O checkout ainda não está disponível.",
      503,
      "CHECKOUT_SUPABASE_CONFIG_MISSING",
    );
  }

  if (!environment.infinitePayHandle) {
    throw new CheckoutError(
      "O pagamento ainda não está disponível.",
      503,
      "CHECKOUT_INFINITEPAY_HANDLE_MISSING",
    );
  }
}

function serviceHeaders(environment: ResolvedEnvironment) {
  if (!environment.supabaseServiceRoleKey) {
    throw new CheckoutError(
      "O checkout ainda não está disponível.",
      503,
      "CHECKOUT_SUPABASE_CONFIG_MISSING",
    );
  }

  return {
    apikey: environment.supabaseServiceRoleKey,
    authorization: `Bearer ${environment.supabaseServiceRoleKey}`,
    accept: "application/json",
    "content-type": "application/json",
  };
}

async function readJson(response: Response, code: string) {
  try {
    return await response.json();
  } catch (cause) {
    throw new CheckoutError(
      "Um serviço necessário retornou uma resposta inválida.",
      502,
      code,
      cause,
    );
  }
}

async function authenticateCustomer(
  request: Request,
  environment: ResolvedEnvironment,
): Promise<AuthenticatedUser> {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    throw new CheckoutError(
      "Entre na sua conta para finalizar a compra.",
      401,
      "CHECKOUT_AUTH_REQUIRED",
    );
  }

  if (!environment.supabaseUrl || !environment.supabasePublishableKey) {
    throw new CheckoutError(
      "O checkout ainda não está disponível.",
      503,
      "CHECKOUT_SUPABASE_CONFIG_MISSING",
    );
  }

  const endpoint = new URL("/auth/v1/user", environment.supabaseUrl);
  let response: Response;
  try {
    response = await fetch(endpoint, {
      headers: {
        apikey: environment.supabasePublishableKey,
        authorization,
        accept: "application/json",
      },
      signal: AbortSignal.timeout(8_000),
    });
  } catch (cause) {
    throw new CheckoutError(
      "Não foi possível confirmar sua sessão agora.",
      502,
      "CHECKOUT_AUTH_NETWORK_ERROR",
      cause,
    );
  }

  if (!response.ok) {
    throw new CheckoutError(
      "Sua sessão expirou. Entre novamente para continuar.",
      401,
      "CHECKOUT_AUTH_INVALID",
    );
  }

  const payload = (await readJson(response, "CHECKOUT_AUTH_PARSE_ERROR")) as {
    id?: unknown;
    email?: unknown;
  };

  if (typeof payload.id !== "string" || !UUID_PATTERN.test(payload.id)) {
    throw new CheckoutError(
      "Sua sessão não pôde ser confirmada.",
      401,
      "CHECKOUT_AUTH_INVALID",
    );
  }

  return {
    id: payload.id,
    email: typeof payload.email === "string" ? payload.email : null,
  };
}

function normalizeStartCheckoutInput(value: unknown): StartCheckoutInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new CheckoutError("Dados da compra inválidos.", 400, "CHECKOUT_REQUEST_INVALID");
  }

  const record = value as Record<string, unknown>;
  const addressId = record["addressId"];
  const shippingServiceId = record["shippingServiceId"];
  const idempotencyKey = record["idempotencyKey"];
  const items = record["items"];

  if (
    typeof addressId !== "string" ||
    !UUID_PATTERN.test(addressId) ||
    typeof shippingServiceId !== "number" ||
    !Number.isInteger(shippingServiceId) ||
    ![1, 2, 31].includes(shippingServiceId) ||
    typeof idempotencyKey !== "string" ||
    !UUID_PATTERN.test(idempotencyKey) ||
    !Array.isArray(items) ||
    items.length < 1 ||
    items.length > 100
  ) {
    throw new CheckoutError("Dados da compra inválidos.", 400, "CHECKOUT_REQUEST_INVALID");
  }

  const normalizedItems: CheckoutItemInput[] = items.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new CheckoutError("Carrinho inválido.", 400, "CHECKOUT_CART_INVALID");
    }

    const itemRecord = item as Record<string, unknown>;
    const productId = itemRecord["productId"];
    const variantId = itemRecord["variantId"];
    const quantity = itemRecord["quantity"];
    const customizationRaw = itemRecord["customization"];
    const customization = customizationRaw && typeof customizationRaw === "object" && !Array.isArray(customizationRaw)
      ? (customizationRaw as Record<string, unknown>)
      : {};
    if (JSON.stringify(customization).length > 3000) {
      throw new CheckoutError("Personalização inválida.", 400, "CHECKOUT_CART_INVALID");
    }

    if (
      typeof productId !== "string" ||
      !UUID_PATTERN.test(productId) ||
      typeof variantId !== "string" ||
      !UUID_PATTERN.test(variantId) ||
      typeof quantity !== "number" ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 99
    ) {
      throw new CheckoutError("Carrinho inválido.", 400, "CHECKOUT_CART_INVALID");
    }

    return { productId, variantId, quantity, customization };
  });

  const totalUnits = normalizedItems.reduce((total, item) => total + item.quantity, 0);
  if (totalUnits < 1 || totalUnits > 999) {
    throw new CheckoutError("Carrinho inválido.", 400, "CHECKOUT_CART_INVALID");
  }

  return {
    addressId,
    shippingServiceId,
    idempotencyKey,
    items: normalizedItems,
  };
}

async function fetchCustomerAddress(
  userId: string,
  addressId: string,
  environment: ResolvedEnvironment,
): Promise<CustomerAddress> {
  if (!environment.supabaseUrl) {
    throw new CheckoutError(
      "O checkout ainda não está disponível.",
      503,
      "CHECKOUT_SUPABASE_CONFIG_MISSING",
    );
  }

  const endpoint = new URL("/rest/v1/customer_addresses", environment.supabaseUrl);
  endpoint.searchParams.set(
    "select",
    "id,recipient_name,postal_code,street,number,complement,neighborhood,city,state",
  );
  endpoint.searchParams.set("id", `eq.${addressId}`);
  endpoint.searchParams.set("user_id", `eq.${userId}`);
  endpoint.searchParams.set("limit", "1");

  const response = await fetch(endpoint, {
    headers: serviceHeaders(environment),
    signal: AbortSignal.timeout(8_000),
  });

  if (!response.ok) {
    throw new CheckoutError(
      "Não foi possível carregar o endereço de entrega.",
      502,
      "CHECKOUT_ADDRESS_HTTP_ERROR",
    );
  }

  const payload = await readJson(response, "CHECKOUT_ADDRESS_PARSE_ERROR");
  if (!Array.isArray(payload) || payload.length !== 1) {
    throw new CheckoutError(
      "Selecione um endereço de entrega válido.",
      422,
      "CHECKOUT_ADDRESS_INVALID",
    );
  }

  return payload[0] as CustomerAddress;
}

async function calculateAuthoritativeShipping(
  request: Request,
  input: StartCheckoutInput,
  address: CustomerAddress,
  environment: ResolvedEnvironment,
) {
  const shippingRequest = new Request(new URL("/api/shipping/quote", request.url), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      postalCode: address.postal_code,
      items: input.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        customization: item.customization,
      })),
    }),
  });

  const response = await handleShippingQuoteRequest(
    shippingRequest,
    environment.shippingEnvironment,
    { source: "cloudflare-entry" },
  );
  const payload = (await readJson(response, "CHECKOUT_SHIPPING_PARSE_ERROR")) as
    | ShippingQuotePayload
    | { error?: unknown };

  if (!response.ok || !("quotes" in payload) || !Array.isArray(payload.quotes)) {
    const message =
      "error" in payload && typeof payload.error === "string"
        ? payload.error
        : "Não foi possível calcular a entrega agora.";
    throw new CheckoutError(message, 422, "CHECKOUT_SHIPPING_UNAVAILABLE");
  }

  const quote = payload.quotes.find(
    (candidate) => candidate.serviceId === input.shippingServiceId,
  );

  if (!quote) {
    throw new CheckoutError(
      "A modalidade de entrega escolhida não está disponível para este endereço.",
      422,
      "CHECKOUT_SHIPPING_SERVICE_UNAVAILABLE",
    );
  }

  return { quote, quotedAt: payload.quotedAt };
}

async function createOrder(
  user: AuthenticatedUser,
  input: StartCheckoutInput,
  shipping: { quote: ShippingQuote; quotedAt: string },
  environment: ResolvedEnvironment,
): Promise<CreatedOrder> {
  if (!environment.supabaseUrl) {
    throw new CheckoutError(
      "O checkout ainda não está disponível.",
      503,
      "CHECKOUT_SUPABASE_CONFIG_MISSING",
    );
  }

  const endpoint = new URL("/rest/v1/rpc/create_order_core", environment.supabaseUrl);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: serviceHeaders(environment),
    body: JSON.stringify({
      p_user_id: user.id,
      p_address_id: input.addressId,
      p_items: input.items.map((item) => ({
        product_id: item.productId,
        variant_id: item.variantId,
        quantity: item.quantity,
      })),
      p_shipping: {
        provider: "superfrete",
        service: shipping.quote.service,
        quote_reference: `superfrete:${shipping.quote.serviceId}:${shipping.quotedAt}`,
        base_amount: shipping.quote.basePrice,
        additional_amount: shipping.quote.additionalFee,
        amount: shipping.quote.totalPrice,
        transit_business_days: shipping.quote.transitBusinessDays,
        quoted_at: shipping.quotedAt,
      },
      p_payment: { provider: "infinitepay" },
      p_discount_amount: 0,
      p_idempotency_key: input.idempotencyKey,
    }),
    signal: AbortSignal.timeout(10_000),
  });

  const payload = await readJson(response, "CHECKOUT_ORDER_PARSE_ERROR");
  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && !Array.isArray(payload)
        ? (payload as { message?: unknown }).message
        : null;
    throw new CheckoutError(
      typeof message === "string" && message.trim()
        ? message
        : "Não foi possível criar o pedido.",
      422,
      "CHECKOUT_ORDER_CREATE_FAILED",
    );
  }

  if (
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload) ||
    typeof (payload as { id?: unknown }).id !== "string" ||
    typeof (payload as { public_number?: unknown }).public_number !== "string"
  ) {
    throw new CheckoutError(
      "O pedido foi criado, mas a confirmação retornou dados inválidos.",
      502,
      "CHECKOUT_ORDER_INVALID_RESPONSE",
    );
  }

  return payload as CreatedOrder;
}

function toCents(value: number | string) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new CheckoutError(
      "O total do pedido é inválido para pagamento.",
      422,
      "CHECKOUT_TOTAL_INVALID",
    );
  }
  return Math.round((numeric + Number.EPSILON) * 100);
}

function normalizePhoneForInfinitePay(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.startsWith("55") ? `+${digits}` : `+55${digits}`;
}

async function createInfinitePayLink(
  request: Request,
  order: CreatedOrder,
  address: CustomerAddress,
  environment: ResolvedEnvironment,
) {
  if (!environment.infinitePayHandle) {
    throw new CheckoutError(
      "O pagamento ainda não está disponível.",
      503,
      "CHECKOUT_INFINITEPAY_HANDLE_MISSING",
    );
  }

  const requestUrl = new URL(request.url);
  const amountInCents = toCents(order.total_amount);

  let response: Response;
  try {
    response = await fetch(INFINITEPAY_LINKS_URL, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        handle: environment.infinitePayHandle,
        redirect_url: new URL("/conta", requestUrl.origin).toString(),
        webhook_url: new URL(
          "/api/payments/infinitepay/webhook",
          requestUrl.origin,
        ).toString(),
        order_nsu: order.public_number,
        items: [
          {
            quantity: 1,
            price: amountInCents,
            description: `Pedido ${order.public_number}`,
          },
        ],
        customer: {
          name: order.customer_name,
          email: order.customer_email,
          phone_number: normalizePhoneForInfinitePay(order.customer_phone),
        },
        address: {
          cep: address.postal_code,
          street: address.street,
          neighborhood: address.neighborhood,
          number: address.number,
          complement: address.complement ?? "",
        },
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (cause) {
    throw new CheckoutError(
      "Não foi possível abrir o pagamento agora.",
      502,
      "CHECKOUT_INFINITEPAY_NETWORK_ERROR",
      cause,
    );
  }

  const payload = (await readJson(
    response,
    "CHECKOUT_INFINITEPAY_PARSE_ERROR",
  )) as InfinitePayLinkResponse & { message?: unknown; error?: unknown };

  if (!response.ok || typeof payload.url !== "string") {
    throw new CheckoutError(
      "A InfinitePay não conseguiu gerar o pagamento agora.",
      502,
      "CHECKOUT_INFINITEPAY_LINK_FAILED",
    );
  }

  let checkoutUrl: URL;
  try {
    checkoutUrl = new URL(payload.url);
  } catch (cause) {
    throw new CheckoutError(
      "A InfinitePay retornou um link de pagamento inválido.",
      502,
      "CHECKOUT_INFINITEPAY_URL_INVALID",
      cause,
    );
  }

  if (
    checkoutUrl.protocol !== "https:" ||
    !(
      checkoutUrl.hostname === "checkout.infinitepay.com.br" ||
      checkoutUrl.hostname.endsWith(".infinitepay.com.br") ||
      checkoutUrl.hostname.endsWith(".infinitepay.io")
    )
  ) {
    throw new CheckoutError(
      "A InfinitePay retornou um link de pagamento inválido.",
      502,
      "CHECKOUT_INFINITEPAY_URL_INVALID",
    );
  }

  return checkoutUrl.toString();
}

export async function handleStartCheckoutRequest(
  request: Request,
  explicitEnvironment?: InfinitePayEnvironment,
) {
  try {
    if (request.method !== "POST") {
      throw new CheckoutError("Método não permitido.", 405, "CHECKOUT_METHOD_NOT_ALLOWED");
    }

    const requestUrl = new URL(request.url);
    const origin = request.headers.get("origin");
    if (origin && origin !== requestUrl.origin) {
      throw new CheckoutError(
        "Origem da requisição não permitida.",
        403,
        "CHECKOUT_ORIGIN_FORBIDDEN",
      );
    }

    const environment = resolveEnvironment(request, explicitEnvironment);
    requireServerConfiguration(environment);
    const user = await authenticateCustomer(request, environment);

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch (cause) {
      throw new CheckoutError(
        "Dados da compra inválidos.",
        400,
        "CHECKOUT_REQUEST_PARSE_ERROR",
        cause,
      );
    }

    const input = normalizeStartCheckoutInput(rawBody);
    const address = await fetchCustomerAddress(
      user.id,
      input.addressId,
      environment,
    );
    const shipping = await calculateAuthoritativeShipping(
      request,
      input,
      address,
      environment,
    );
    const order = await createOrder(user, input, shipping, environment);
    const checkoutUrl = await createInfinitePayLink(
      request,
      order,
      address,
      environment,
    );

    return jsonResponse({
      checkoutUrl,
      orderId: order.id,
      orderNumber: order.public_number,
      totalAmount: Number(order.total_amount),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

async function fetchOrderByPublicNumber(
  publicNumber: string,
  environment: ResolvedEnvironment,
) {
  if (!environment.supabaseUrl) {
    throw new CheckoutError(
      "Integração de pagamento indisponível.",
      503,
      "PAYMENT_SUPABASE_CONFIG_MISSING",
    );
  }

  const endpoint = new URL("/rest/v1/orders", environment.supabaseUrl);
  endpoint.searchParams.set(
    "select",
    "id,public_number,total_amount,status,payment_status,payment_provider,payment_reference,paid_amount",
  );
  endpoint.searchParams.set("public_number", `eq.${publicNumber}`);
  endpoint.searchParams.set("limit", "1");

  const response = await fetch(endpoint, {
    headers: serviceHeaders(environment),
    signal: AbortSignal.timeout(8_000),
  });
  const payload = await readJson(response, "PAYMENT_ORDER_PARSE_ERROR");

  if (!response.ok || !Array.isArray(payload) || payload.length !== 1) {
    throw new CheckoutError(
      "Pedido não encontrado.",
      400,
      "PAYMENT_ORDER_NOT_FOUND",
    );
  }

  return payload[0] as {
    id: string;
    public_number: string;
    total_amount: number | string;
    status: string;
    payment_status: string;
    payment_provider: string | null;
    payment_reference: string | null;
    paid_amount: number | string | null;
  };
}

function requiredWebhookString(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new CheckoutError(
      "Notificação de pagamento inválida.",
      400,
      `PAYMENT_WEBHOOK_${field.toUpperCase()}_INVALID`,
    );
  }
  return value.trim();
}

async function verifyPaymentWithInfinitePay(
  orderNumber: string,
  transactionNsu: string,
  invoiceSlug: string,
  environment: ResolvedEnvironment,
) {
  if (!environment.infinitePayHandle) {
    throw new CheckoutError(
      "Integração de pagamento indisponível.",
      503,
      "PAYMENT_INFINITEPAY_HANDLE_MISSING",
    );
  }

  let response: Response;
  try {
    response = await fetch(INFINITEPAY_PAYMENT_CHECK_URL, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        handle: environment.infinitePayHandle,
        order_nsu: orderNumber,
        transaction_nsu: transactionNsu,
        slug: invoiceSlug,
      }),
      signal: AbortSignal.timeout(8_000),
    });
  } catch (cause) {
    throw new CheckoutError(
      "Não foi possível verificar o pagamento agora.",
      502,
      "PAYMENT_CHECK_NETWORK_ERROR",
      cause,
    );
  }

  const payload = (await readJson(
    response,
    "PAYMENT_CHECK_PARSE_ERROR",
  )) as InfinitePayPaymentCheckResponse;

  if (!response.ok || payload.success !== true || payload.paid !== true) {
    throw new CheckoutError(
      "Pagamento ainda não confirmado.",
      400,
      "PAYMENT_NOT_CONFIRMED",
    );
  }

  const amount = Number(payload.amount);
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new CheckoutError(
      "A confirmação do pagamento retornou valor inválido.",
      400,
      "PAYMENT_AMOUNT_INVALID",
    );
  }

  return {
    amountInCents: amount,
    method:
      typeof payload.capture_method === "string"
        ? payload.capture_method
        : "infinitepay",
  };
}

async function recordPayment(
  orderId: string,
  transactionNsu: string,
  method: string,
  paidAmount: number,
  environment: ResolvedEnvironment,
) {
  if (!environment.supabaseUrl) {
    throw new CheckoutError(
      "Integração de pagamento indisponível.",
      503,
      "PAYMENT_SUPABASE_CONFIG_MISSING",
    );
  }

  const endpoint = new URL("/rest/v1/rpc/record_order_payment", environment.supabaseUrl);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: serviceHeaders(environment),
    body: JSON.stringify({
      p_order_id: orderId,
      p_provider: "infinitepay",
      p_reference: transactionNsu,
      p_method: method,
      p_paid_amount: paidAmount,
      p_idempotency_key: transactionNsu,
    }),
    signal: AbortSignal.timeout(8_000),
  });

  if (!response.ok) {
    const payload = await readJson(response, "PAYMENT_RECORD_PARSE_ERROR");
    const message =
      payload && typeof payload === "object" && !Array.isArray(payload)
        ? (payload as { message?: unknown }).message
        : null;
    throw new CheckoutError(
      typeof message === "string" && message.trim()
        ? message
        : "Não foi possível registrar o pagamento.",
      400,
      "PAYMENT_RECORD_FAILED",
    );
  }
}

export async function handleInfinitePayWebhookRequest(
  request: Request,
  explicitEnvironment?: InfinitePayEnvironment,
) {
  try {
    if (request.method !== "POST") {
      throw new CheckoutError("Método não permitido.", 405, "PAYMENT_METHOD_NOT_ALLOWED");
    }

    const environment = resolveEnvironment(request, explicitEnvironment);
    requireServerConfiguration(environment);

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch (cause) {
      throw new CheckoutError(
        "Notificação de pagamento inválida.",
        400,
        "PAYMENT_WEBHOOK_PARSE_ERROR",
        cause,
      );
    }

    if (!rawBody || typeof rawBody !== "object" || Array.isArray(rawBody)) {
      throw new CheckoutError(
        "Notificação de pagamento inválida.",
        400,
        "PAYMENT_WEBHOOK_INVALID",
      );
    }

    const payload = rawBody as InfinitePayWebhookPayload;
    const orderNumber = requiredWebhookString(payload.order_nsu, "order_nsu");
    const transactionNsu = requiredWebhookString(
      payload.transaction_nsu,
      "transaction_nsu",
    );
    const invoiceSlug = requiredWebhookString(payload.invoice_slug, "invoice_slug");
    const order = await fetchOrderByPublicNumber(orderNumber, environment);

    if (
      order.payment_status === "paid" &&
      order.payment_provider?.toLowerCase() === "infinitepay" &&
      order.payment_reference === transactionNsu
    ) {
      return jsonResponse({ success: true, message: null });
    }

    const verification = await verifyPaymentWithInfinitePay(
      orderNumber,
      transactionNsu,
      invoiceSlug,
      environment,
    );
    const expectedAmountInCents = toCents(order.total_amount);

    if (verification.amountInCents !== expectedAmountInCents) {
      throw new CheckoutError(
        "Valor do pagamento não corresponde ao pedido.",
        400,
        "PAYMENT_AMOUNT_MISMATCH",
      );
    }

    await recordPayment(
      order.id,
      transactionNsu,
      verification.method,
      verification.amountInCents / 100,
      environment,
    );

    console.info(
      `[infinitepay-webhook] ${JSON.stringify({ orderNumber, transactionNsu, status: "paid" })}`,
    );
    return jsonResponse({ success: true, message: null });
  } catch (error) {
    if (error instanceof CheckoutError) {
      console.error(
        `[infinitepay-webhook] ${JSON.stringify({ code: error.code, status: error.status })}`,
      );
      return jsonResponse({ success: false, message: error.message }, error.status);
    }

    console.error(error);
    return jsonResponse(
      { success: false, message: "Não foi possível processar a notificação." },
      500,
    );
  }
}
