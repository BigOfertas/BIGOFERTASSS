import { corsHeaders } from "../_shared/http.ts";

const INFINITEPAY_LINKS_URL = "https://api.checkout.infinitepay.io/links";
const INFINITEPAY_LEGACY_LINKS_URL = "https://api.infinitepay.io/invoices/public/checkout/links";
const INFINITEPAY_TIMEOUT_MS = 15_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

class CheckoutError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly causeForLog?: unknown,
  ) {
    super(message);
    this.name = "CheckoutError";
  }
}

function environment(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) {
    throw new CheckoutError(
      "O checkout ainda não está disponível.",
      503,
      `CHECKOUT_${name}_MISSING`,
    );
  }
  return value;
}

function allowedOrigins() {
  return (Deno.env.get("APP_ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function requestOrigin(request: Request) {
  const origin = request.headers.get("origin")?.trim();
  const allowed = allowedOrigins();

  if (origin) {
    if (allowed.length > 0 && !allowed.includes(origin)) {
      throw new CheckoutError(
        "Origem da requisição não permitida.",
        403,
        "CHECKOUT_ORIGIN_FORBIDDEN",
      );
    }
    return origin;
  }

  return allowed[0] ?? "https://bigofertas.net";
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

function errorResponse(request: Request, error: unknown) {
  if (error instanceof CheckoutError) {
    const causeName = error.causeForLog instanceof Error ? error.causeForLog.name : null;
    console.error(
      `[checkout-edge] ${JSON.stringify({
        code: error.code,
        status: error.status,
        causeName,
      })}`,
    );
    return response(request, { error: error.message, code: error.code }, error.status);
  }

  console.error(error);
  return response(
    request,
    { error: "Não foi possível iniciar o pagamento agora.", code: "CHECKOUT_INTERNAL_ERROR" },
    500,
  );
}

function serviceHeaders() {
  const serviceRoleKey = environment("SUPABASE_SERVICE_ROLE_KEY");
  return {
    apikey: serviceRoleKey,
    authorization: `Bearer ${serviceRoleKey}`,
    accept: "application/json",
    "content-type": "application/json",
  };
}

async function readJson(upstream: Response, code: string) {
  try {
    return await upstream.json();
  } catch (cause) {
    throw new CheckoutError(
      "Um serviço necessário retornou uma resposta inválida.",
      502,
      code,
      cause,
    );
  }
}

async function authenticateCustomer(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    throw new CheckoutError(
      "Entre na sua conta para finalizar a compra.",
      401,
      "CHECKOUT_AUTH_REQUIRED",
    );
  }

  const supabaseUrl = environment("SUPABASE_URL");
  const endpoint = new URL("/auth/v1/user", supabaseUrl);
  let upstream: Response;

  try {
    upstream = await fetch(endpoint, {
      headers: {
        apikey: environment("SUPABASE_SERVICE_ROLE_KEY"),
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

  if (!upstream.ok) {
    throw new CheckoutError(
      "Sua sessão expirou. Entre novamente para continuar.",
      401,
      "CHECKOUT_AUTH_INVALID",
    );
  }

  const payload = (await readJson(upstream, "CHECKOUT_AUTH_PARSE_ERROR")) as {
    id?: unknown;
    email?: unknown;
  };

  if (typeof payload.id !== "string" || !UUID_PATTERN.test(payload.id)) {
    throw new CheckoutError("Sua sessão não pôde ser confirmada.", 401, "CHECKOUT_AUTH_INVALID");
  }

  return {
    id: payload.id,
    email: typeof payload.email === "string" ? payload.email : null,
  };
}

function normalizeInput(value: unknown): StartCheckoutInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new CheckoutError("Dados da compra inválidos.", 400, "CHECKOUT_REQUEST_INVALID");
  }

  const record = value as Record<string, unknown>;
  const addressId = record.addressId;
  const shippingServiceId = record.shippingServiceId;
  const idempotencyKey = record.idempotencyKey;
  const items = record.items;

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

  const normalizedItems = items.map((item): CheckoutItemInput => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new CheckoutError("Carrinho inválido.", 400, "CHECKOUT_CART_INVALID");
    }

    const productId = (item as Record<string, unknown>).productId;
    const variantId = (item as Record<string, unknown>).variantId;
    const quantity = (item as Record<string, unknown>).quantity;
    const customizationRaw = (item as Record<string, unknown>).customization;
    const customization =
      customizationRaw && typeof customizationRaw === "object" && !Array.isArray(customizationRaw)
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

  const totalUnits = normalizedItems.reduce((sum, item) => sum + item.quantity, 0);
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

async function fetchAddress(userId: string, addressId: string): Promise<CustomerAddress> {
  const endpoint = new URL("/rest/v1/customer_addresses", environment("SUPABASE_URL"));
  endpoint.searchParams.set(
    "select",
    "id,recipient_name,postal_code,street,number,complement,neighborhood,city,state",
  );
  endpoint.searchParams.set("id", `eq.${addressId}`);
  endpoint.searchParams.set("user_id", `eq.${userId}`);
  endpoint.searchParams.set("limit", "1");

  const upstream = await fetch(endpoint, {
    headers: serviceHeaders(),
    signal: AbortSignal.timeout(8_000),
  });
  const payload = await readJson(upstream, "CHECKOUT_ADDRESS_PARSE_ERROR");

  if (!upstream.ok || !Array.isArray(payload) || payload.length !== 1) {
    throw new CheckoutError(
      "Selecione um endereço de entrega válido.",
      422,
      "CHECKOUT_ADDRESS_INVALID",
    );
  }

  return payload[0] as CustomerAddress;
}

async function authoritativeShipping(input: StartCheckoutInput, address: CustomerAddress) {
  const endpoint = `${environment("SUPABASE_URL").replace(/\/$/, "")}/functions/v1/shipping-quote`;
  const upstream = await fetch(endpoint, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      postalCode: address.postal_code,
      items: input.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        customization: item.customization,
      })),
    }),
    signal: AbortSignal.timeout(15_000),
  });

  const payload = (await readJson(upstream, "CHECKOUT_SHIPPING_PARSE_ERROR")) as {
    quotes?: unknown;
    quotedAt?: unknown;
    error?: unknown;
  } | null;

  if (!upstream.ok || !payload || !Array.isArray(payload.quotes)) {
    throw new CheckoutError(
      payload && typeof payload.error === "string"
        ? payload.error
        : "Não foi possível calcular a entrega agora.",
      422,
      "CHECKOUT_SHIPPING_UNAVAILABLE",
    );
  }

  const quotes = payload.quotes as ShippingQuote[];
  const quote = quotes.find((candidate) => candidate.serviceId === input.shippingServiceId);

  if (!quote || typeof payload.quotedAt !== "string") {
    throw new CheckoutError(
      "A modalidade de entrega escolhida não está disponível para este endereço.",
      422,
      "CHECKOUT_SHIPPING_SERVICE_UNAVAILABLE",
    );
  }

  return { quote, quotedAt: payload.quotedAt };
}

async function createOrder(
  userId: string,
  input: StartCheckoutInput,
  shipping: { quote: ShippingQuote; quotedAt: string },
): Promise<CreatedOrder> {
  const endpoint = new URL("/rest/v1/rpc/create_order_core", environment("SUPABASE_URL"));
  const upstream = await fetch(endpoint, {
    method: "POST",
    headers: serviceHeaders(),
    body: JSON.stringify({
      p_user_id: userId,
      p_address_id: input.addressId,
      p_items: input.items.map((item) => ({
        product_id: item.productId,
        variant_id: item.variantId,
        quantity: item.quantity,
        customization: item.customization,
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

  const payload = await readJson(upstream, "CHECKOUT_ORDER_PARSE_ERROR");
  if (!upstream.ok) {
    const message =
      payload && typeof payload === "object" && !Array.isArray(payload)
        ? (payload as { message?: unknown }).message
        : null;
    throw new CheckoutError(
      typeof message === "string" && message.trim() ? message : "Não foi possível criar o pedido.",
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

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 13) {
    throw new CheckoutError(
      "O telefone do comprador precisa ser revisado antes do pagamento.",
      422,
      "CHECKOUT_CUSTOMER_PHONE_INVALID",
    );
  }
  return digits.startsWith("55") ? `+${digits}` : `+55${digits}`;
}

function retryableInfinitePayStatus(status: number) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

async function postInfinitePayLink(payload: unknown) {
  const endpoints = [
    { url: INFINITEPAY_LINKS_URL, label: "primary" },
    { url: INFINITEPAY_LEGACY_LINKS_URL, label: "legacy" },
  ] as const;
  let lastCause: unknown = null;

  for (const endpoint of endpoints) {
    try {
      const upstream = await fetch(endpoint.url, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(INFINITEPAY_TIMEOUT_MS),
      });

      if (endpoint.label === "primary" && retryableInfinitePayStatus(upstream.status)) {
        console.error(
          `[checkout-edge] ${JSON.stringify({
            code: "CHECKOUT_INFINITEPAY_PRIMARY_RETRY",
            upstreamStatus: upstream.status,
          })}`,
        );
        continue;
      }

      return upstream;
    } catch (cause) {
      lastCause = cause;
      console.error(
        `[checkout-edge] ${JSON.stringify({
          code: "CHECKOUT_INFINITEPAY_ENDPOINT_NETWORK_ERROR",
          endpoint: endpoint.label,
          causeName: cause instanceof Error ? cause.name : typeof cause,
        })}`,
      );
    }
  }

  throw new CheckoutError(
    "Não foi possível conectar à InfinitePay agora. Tente novamente.",
    502,
    "CHECKOUT_INFINITEPAY_NETWORK_ERROR",
    lastCause,
  );
}

async function createInfinitePayLink(
  request: Request,
  origin: string,
  order: CreatedOrder,
  address: CustomerAddress,
) {
  const supabaseUrl = environment("SUPABASE_URL").replace(/\/$/, "");
  const amountInCents = toCents(order.total_amount);
  const infinitePayPayload = {
    handle: environment("INFINITEPAY_HANDLE"),
    redirect_url: `${origin.replace(/\/$/, "")}/conta`,
    webhook_url: `${supabaseUrl}/functions/v1/infinitepay-webhook`,
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
      phone_number: normalizePhone(order.customer_phone),
    },
    address: {
      cep: address.postal_code,
      street: address.street,
      neighborhood: address.neighborhood,
      number: address.number,
      complement: address.complement ?? "",
    },
  };

  const upstream = await postInfinitePayLink(infinitePayPayload);
  const payload = (await readJson(upstream, "CHECKOUT_INFINITEPAY_PARSE_ERROR")) as {
    url?: unknown;
    message?: unknown;
    error?: unknown;
  };

  if (!upstream.ok || typeof payload.url !== "string") {
    const upstreamMessage =
      typeof payload.message === "string"
        ? payload.message.slice(0, 300)
        : typeof payload.error === "string"
          ? payload.error.slice(0, 300)
          : null;
    console.error(
      `[checkout-edge] ${JSON.stringify({
        code: "CHECKOUT_INFINITEPAY_LINK_FAILED",
        upstreamStatus: upstream.status,
        upstreamMessage,
      })}`,
    );

    if (
      upstream.status === 400 ||
      upstream.status === 401 ||
      upstream.status === 403 ||
      (upstreamMessage && /handle|checkout|integrado|enabled|habilit/i.test(upstreamMessage))
    ) {
      throw new CheckoutError(
        "A InfinitePay recusou a criação do checkout. Confira se o Checkout Integrado está habilitado e se a InfiniteTag configurada está correta.",
        502,
        "CHECKOUT_INFINITEPAY_CONFIGURATION_REJECTED",
      );
    }

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

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }

  try {
    if (request.method !== "POST") {
      throw new CheckoutError("Método não permitido.", 405, "CHECKOUT_METHOD_NOT_ALLOWED");
    }

    const origin = requestOrigin(request);
    environment("INFINITEPAY_HANDLE");
    const user = await authenticateCustomer(request);

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

    const input = normalizeInput(rawBody);
    const address = await fetchAddress(user.id, input.addressId);
    const shipping = await authoritativeShipping(input, address);
    const order = await createOrder(user.id, input, shipping);
    const checkoutUrl = await createInfinitePayLink(request, origin, order, address);

    return response(request, {
      checkoutUrl,
      orderId: order.id,
      orderNumber: order.public_number,
      totalAmount: Number(order.total_amount),
    });
  } catch (error) {
    return errorResponse(request, error);
  }
});
