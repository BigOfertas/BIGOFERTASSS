const INFINITEPAY_PAYMENT_CHECK_URL = "https://api.checkout.infinitepay.io/payment_check";

declare const EdgeRuntime: {
  waitUntil(promise: Promise<unknown>): void;
};

class PaymentError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly causeForLog?: unknown,
  ) {
    super(message);
    this.name = "PaymentError";
  }
}

function environment(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) {
    throw new PaymentError("Integração de pagamento indisponível.", 503, `PAYMENT_${name}_MISSING`);
  }
  return value;
}

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store, max-age=0",
      "x-content-type-options": "nosniff",
    },
  });
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
    throw new PaymentError(
      "Um serviço necessário retornou uma resposta inválida.",
      502,
      code,
      cause,
    );
  }
}

function requiredString(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new PaymentError(
      "Notificação de pagamento inválida.",
      400,
      `PAYMENT_WEBHOOK_${field.toUpperCase()}_INVALID`,
    );
  }
  return value.trim();
}

function toCents(value: number | string) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new PaymentError(
      "O total do pedido é inválido para pagamento.",
      400,
      "PAYMENT_ORDER_TOTAL_INVALID",
    );
  }
  return Math.round((numeric + Number.EPSILON) * 100);
}

async function fetchOrder(publicNumber: string) {
  const endpoint = new URL("/rest/v1/orders", environment("SUPABASE_URL"));
  endpoint.searchParams.set(
    "select",
    "id,public_number,total_amount,status,payment_status,payment_provider,payment_reference,paid_amount",
  );
  endpoint.searchParams.set("public_number", `eq.${publicNumber}`);
  endpoint.searchParams.set("limit", "1");

  const upstream = await fetch(endpoint, {
    headers: serviceHeaders(),
    signal: AbortSignal.timeout(8_000),
  });
  const payload = await readJson(upstream, "PAYMENT_ORDER_PARSE_ERROR");

  if (!upstream.ok || !Array.isArray(payload) || payload.length !== 1) {
    throw new PaymentError("Pedido não encontrado.", 400, "PAYMENT_ORDER_NOT_FOUND");
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

async function verifyPayment(orderNumber: string, transactionNsu: string, invoiceSlug: string) {
  let upstream: Response;

  try {
    upstream = await fetch(INFINITEPAY_PAYMENT_CHECK_URL, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        handle: environment("INFINITEPAY_HANDLE"),
        order_nsu: orderNumber,
        transaction_nsu: transactionNsu,
        slug: invoiceSlug,
      }),
      signal: AbortSignal.timeout(8_000),
    });
  } catch (cause) {
    throw new PaymentError(
      "Não foi possível verificar o pagamento agora.",
      502,
      "PAYMENT_CHECK_NETWORK_ERROR",
      cause,
    );
  }

  const payload = (await readJson(upstream, "PAYMENT_CHECK_PARSE_ERROR")) as {
    success?: unknown;
    paid?: unknown;
    amount?: unknown;
    paid_amount?: unknown;
    installments?: unknown;
    capture_method?: unknown;
  };

  if (!upstream.ok || payload.success !== true || payload.paid !== true) {
    throw new PaymentError("Pagamento ainda não confirmado.", 400, "PAYMENT_NOT_CONFIRMED");
  }

  const amount = Number(payload.amount);
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new PaymentError(
      "A confirmação do pagamento retornou valor inválido.",
      400,
      "PAYMENT_AMOUNT_INVALID",
    );
  }

  return {
    amountInCents: amount,
    method:
      typeof payload.capture_method === "string" && payload.capture_method.trim()
        ? payload.capture_method.trim()
        : "infinitepay",
  };
}

async function recordPayment(
  orderId: string,
  transactionNsu: string,
  method: string,
  paidAmount: number,
) {
  const endpoint = new URL("/rest/v1/rpc/record_order_payment", environment("SUPABASE_URL"));
  const upstream = await fetch(endpoint, {
    method: "POST",
    headers: serviceHeaders(),
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

  if (!upstream.ok) {
    const payload = await readJson(upstream, "PAYMENT_RECORD_PARSE_ERROR");
    const message =
      payload && typeof payload === "object" && !Array.isArray(payload)
        ? (payload as { message?: unknown }).message
        : null;

    throw new PaymentError(
      typeof message === "string" && message.trim()
        ? message
        : "Não foi possível registrar o pagamento.",
      400,
      "PAYMENT_RECORD_FAILED",
    );
  }
}

async function triggerEmailProcessor() {
  const supabaseUrl = environment("SUPABASE_URL").replace(/\/$/, "");
  const serviceRoleKey = environment("SUPABASE_SERVICE_ROLE_KEY");
  const upstream = await fetch(`${supabaseUrl}/functions/v1/notifications-process`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      accept: "application/json",
    },
    signal: AbortSignal.timeout(30_000),
  });

  const body = await upstream.text().catch(() => "");
  if (!upstream.ok) {
    console.error(
      `[notification-email-trigger] ${JSON.stringify({ status: upstream.status, body: body.slice(0, 300) })}`,
    );
  }
}

Deno.serve(async (request) => {
  try {
    if (request.method !== "POST") {
      throw new PaymentError("Método não permitido.", 405, "PAYMENT_METHOD_NOT_ALLOWED");
    }

    environment("INFINITEPAY_HANDLE");

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch (cause) {
      throw new PaymentError(
        "Notificação de pagamento inválida.",
        400,
        "PAYMENT_WEBHOOK_PARSE_ERROR",
        cause,
      );
    }

    if (!rawBody || typeof rawBody !== "object" || Array.isArray(rawBody)) {
      throw new PaymentError("Notificação de pagamento inválida.", 400, "PAYMENT_WEBHOOK_INVALID");
    }

    const payload = rawBody as Record<string, unknown>;
    const orderNumber = requiredString(payload.order_nsu, "order_nsu");
    const transactionNsu = requiredString(payload.transaction_nsu, "transaction_nsu");
    const invoiceSlug = requiredString(payload.invoice_slug, "invoice_slug");
    const order = await fetchOrder(orderNumber);

    if (
      order.payment_status === "paid" &&
      order.payment_provider?.toLowerCase() === "infinitepay" &&
      order.payment_reference === transactionNsu
    ) {
      EdgeRuntime.waitUntil(
        triggerEmailProcessor().catch((error) => {
          console.error("[notification-email-trigger]", error);
        }),
      );
      return response({ success: true, message: null });
    }

    const verification = await verifyPayment(orderNumber, transactionNsu, invoiceSlug);
    const expectedAmountInCents = toCents(order.total_amount);

    if (verification.amountInCents !== expectedAmountInCents) {
      throw new PaymentError(
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
    );

    EdgeRuntime.waitUntil(
      triggerEmailProcessor().catch((error) => {
        console.error("[notification-email-trigger]", error);
      }),
    );

    console.info(
      `[infinitepay-webhook-edge] ${JSON.stringify({
        orderNumber,
        transactionNsu,
        status: "paid",
      })}`,
    );

    return response({ success: true, message: null });
  } catch (error) {
    if (error instanceof PaymentError) {
      console.error(
        `[infinitepay-webhook-edge] ${JSON.stringify({
          code: error.code,
          status: error.status,
        })}`,
      );
      return response({ success: false, message: error.message }, error.status);
    }

    console.error(error);
    return response({ success: false, message: "Não foi possível processar a notificação." }, 500);
  }
});
