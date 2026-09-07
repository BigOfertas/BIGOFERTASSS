import {
  ResendTemplateError,
  sendResendTemplate,
  type ResendTemplateVariable,
} from "./resend-server";

export type NotificationEmailEnvironment = {
  VITE_SUPABASE_URL?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM?: string;
  EMAIL_PROCESSOR_SECRET?: string;
};

type ResolvedEnvironment = {
  supabaseUrl: string | undefined;
  supabaseServiceRoleKey: string | undefined;
  resendApiKey: string | undefined;
  resendFrom: string | undefined;
  processorSecret: string | undefined;
};

type NotificationEvent = {
  id: string;
  user_id: string;
  order_id: string | null;
  event_name: string;
  payload: Record<string, unknown>;
  idempotency_key: string;
  occurred_at: string;
  attempt_count: number;
};

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
};

type OrderRow = {
  id: string;
  public_number: string;
  customer_name: string;
  customer_email: string;
  total_amount: number | string;
  shipping_provider: string | null;
  shipping_service: string | null;
  shipping_tracking_code: string | null;
};

type PreparedEmail = {
  to: string;
  templateId: string;
  variables: Record<string, ResendTemplateVariable>;
};

const DEFAULT_RESEND_FROM = "BIGofertas <contato@bigofertas.net>";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CORREIOS_TRACKING_URL =
  "https://www.correios.com.br/home-page-2024/rastreamento/acompanhe-seu-objeto";
const LOGGI_TRACKING_URL = "https://www.loggi.com/rastreador/";

class NotificationEmailError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string, cause?: unknown) {
    super(message, { cause });
    this.name = "NotificationEmailError";
    this.status = status;
    this.code = code;
  }
}

function asEnvironment(value: unknown): NotificationEmailEnvironment {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as NotificationEmailEnvironment;
}

function nonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function resolveEnvironment(
  explicitEnvironment?: NotificationEmailEnvironment,
): ResolvedEnvironment {
  const explicit = asEnvironment(explicitEnvironment);
  const processEnvironment = typeof process !== "undefined" ? asEnvironment(process.env) : {};

  return {
    supabaseUrl:
      nonEmptyString(explicit.VITE_SUPABASE_URL) ??
      nonEmptyString(explicit.SUPABASE_URL) ??
      nonEmptyString(processEnvironment.VITE_SUPABASE_URL) ??
      nonEmptyString(processEnvironment.SUPABASE_URL) ??
      nonEmptyString(import.meta.env["VITE_SUPABASE_URL"]),
    supabaseServiceRoleKey:
      nonEmptyString(explicit.SUPABASE_SERVICE_ROLE_KEY) ??
      nonEmptyString(processEnvironment.SUPABASE_SERVICE_ROLE_KEY),
    resendApiKey:
      nonEmptyString(explicit.RESEND_API_KEY) ?? nonEmptyString(processEnvironment.RESEND_API_KEY),
    resendFrom:
      nonEmptyString(explicit.RESEND_FROM) ??
      nonEmptyString(processEnvironment.RESEND_FROM) ??
      DEFAULT_RESEND_FROM,
    processorSecret:
      nonEmptyString(explicit.EMAIL_PROCESSOR_SECRET) ??
      nonEmptyString(processEnvironment.EMAIL_PROCESSOR_SECRET),
  };
}

function requireConfiguration(environment: ResolvedEnvironment) {
  if (!environment.supabaseUrl || !environment.supabaseServiceRoleKey) {
    throw new NotificationEmailError(
      "Processador de notificações sem acesso ao banco.",
      503,
      "EMAIL_PROCESSOR_SUPABASE_CONFIG_MISSING",
    );
  }
  if (!environment.resendApiKey || !environment.resendFrom) {
    throw new NotificationEmailError(
      "Processador de notificações sem configuração de e-mail.",
      503,
      "EMAIL_PROCESSOR_RESEND_CONFIG_MISSING",
    );
  }
}

function serviceHeaders(environment: ResolvedEnvironment) {
  if (!environment.supabaseServiceRoleKey) {
    throw new NotificationEmailError(
      "Processador de notificações sem acesso ao banco.",
      503,
      "EMAIL_PROCESSOR_SUPABASE_CONFIG_MISSING",
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
    throw new NotificationEmailError(
      "Um serviço necessário retornou uma resposta inválida.",
      502,
      code,
      cause,
    );
  }
}

function normalizePayload(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function claimEvents(environment: ResolvedEnvironment, limit: number) {
  if (!environment.supabaseUrl) return [];
  const endpoint = new URL("/rest/v1/rpc/claim_notification_events", environment.supabaseUrl);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: serviceHeaders(environment),
    body: JSON.stringify({ p_limit: Math.min(Math.max(limit, 1), 50) }),
    signal: AbortSignal.timeout(8_000),
  });
  const payload = await readJson(response, "EMAIL_PROCESSOR_CLAIM_PARSE_ERROR");

  if (!response.ok || !Array.isArray(payload)) {
    throw new NotificationEmailError(
      "Não foi possível reservar notificações pendentes.",
      502,
      "EMAIL_PROCESSOR_CLAIM_FAILED",
    );
  }

  return payload.map((row) => {
    const record = row as Record<string, unknown>;
    return {
      id: String(record.id ?? ""),
      user_id: String(record.user_id ?? ""),
      order_id: typeof record.order_id === "string" ? record.order_id : null,
      event_name: String(record.event_name ?? ""),
      payload: normalizePayload(record.payload),
      idempotency_key: String(record.idempotency_key ?? ""),
      occurred_at: String(record.occurred_at ?? ""),
      attempt_count: Number(record.attempt_count ?? 0),
    } satisfies NotificationEvent;
  });
}

async function completeEvent(
  eventId: string,
  providerMessageId: string,
  environment: ResolvedEnvironment,
) {
  if (!environment.supabaseUrl) return;
  const endpoint = new URL("/rest/v1/rpc/complete_notification_event", environment.supabaseUrl);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: serviceHeaders(environment),
    body: JSON.stringify({
      p_event_id: eventId,
      p_provider_message_id: providerMessageId,
    }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) {
    throw new NotificationEmailError(
      "O e-mail foi enviado, mas o evento não pôde ser concluído.",
      502,
      "EMAIL_PROCESSOR_COMPLETE_FAILED",
    );
  }
}

async function failEvent(eventId: string, error: unknown, environment: ResolvedEnvironment) {
  if (!environment.supabaseUrl) return;
  const message =
    error instanceof Error && error.message ? error.message : "Falha inesperada no envio do e-mail";
  const endpoint = new URL("/rest/v1/rpc/fail_notification_event", environment.supabaseUrl);
  await fetch(endpoint, {
    method: "POST",
    headers: serviceHeaders(environment),
    body: JSON.stringify({
      p_event_id: eventId,
      p_error: message.slice(0, 1000),
    }),
    signal: AbortSignal.timeout(8_000),
  }).catch(() => undefined);
}

async function fetchProfile(userId: string, environment: ResolvedEnvironment) {
  if (!environment.supabaseUrl) return null;
  const endpoint = new URL("/rest/v1/profiles", environment.supabaseUrl);
  endpoint.searchParams.set("select", "id,email,full_name");
  endpoint.searchParams.set("id", `eq.${userId}`);
  endpoint.searchParams.set("limit", "1");
  const response = await fetch(endpoint, {
    headers: serviceHeaders(environment),
    signal: AbortSignal.timeout(8_000),
  });
  const payload = await readJson(response, "EMAIL_PROCESSOR_PROFILE_PARSE_ERROR");
  if (!response.ok || !Array.isArray(payload) || payload.length !== 1) return null;
  return payload[0] as ProfileRow;
}

async function fetchOrder(orderId: string | null, environment: ResolvedEnvironment) {
  if (!orderId || !environment.supabaseUrl) return null;
  const endpoint = new URL("/rest/v1/orders", environment.supabaseUrl);
  endpoint.searchParams.set(
    "select",
    "id,public_number,customer_name,customer_email,total_amount,shipping_provider,shipping_service,shipping_tracking_code",
  );
  endpoint.searchParams.set("id", `eq.${orderId}`);
  endpoint.searchParams.set("limit", "1");
  const response = await fetch(endpoint, {
    headers: serviceHeaders(environment),
    signal: AbortSignal.timeout(8_000),
  });
  const payload = await readJson(response, "EMAIL_PROCESSOR_ORDER_PARSE_ERROR");
  if (!response.ok || !Array.isArray(payload) || payload.length !== 1) return null;
  return payload[0] as OrderRow;
}

function firstName(name: string | null | undefined) {
  return name?.trim().split(/\s+/)[0] || "cliente";
}

function requiredEmail(value: string | null | undefined) {
  const email = value?.trim().toLowerCase();
  if (!email || !EMAIL_PATTERN.test(email)) {
    throw new NotificationEmailError(
      "Destinatário inválido para o e-mail transacional.",
      422,
      "EMAIL_PROCESSOR_RECIPIENT_INVALID",
    );
  }
  return email;
}

function requiredPayloadText(payload: Record<string, unknown>, key: string, code: string) {
  const value = payload[key];
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string" && value.trim()) return value.trim();
  throw new NotificationEmailError("Evento de notificação incompleto.", 422, code);
}

function formatBrl(value: number | string) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    throw new NotificationEmailError(
      "Valor financeiro inválido no evento.",
      422,
      "EMAIL_PROCESSOR_AMOUNT_INVALID",
    );
  }
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(amount);
}

function normalizeMoneyText(value: string) {
  if (/^R\$\s*/i.test(value)) return value;
  const numeric = Number(value.replace(",", "."));
  return Number.isFinite(numeric) ? formatBrl(numeric) : value;
}

function fixedCommissionText(payload: Record<string, unknown>) {
  const unitAmount = payload["commission_unit_amount"];
  const units = Number(payload["commission_units"] ?? 0);
  if (
    (typeof unitAmount === "number" && Number.isFinite(unitAmount)) ||
    (typeof unitAmount === "string" && unitAmount.trim())
  ) {
    const amount = normalizeMoneyText(String(unitAmount));
    return units > 0 ? `${amount} por peça • ${units} peças` : `${amount} por peça`;
  }
  return "valor fixo por peça conforme a quantidade do pedido";
}

function orderUrl(origin: string) {
  return new URL("/conta", origin).toString();
}

function affiliateDashboardUrl(origin: string) {
  return new URL("/conta", origin).toString();
}

function carrierDetails(order: OrderRow) {
  const service = order.shipping_service?.trim().toLowerCase() ?? "";
  const provider = order.shipping_provider?.trim().toLowerCase() ?? "";

  if (service.includes("loggi") || provider.includes("loggi")) {
    return { carrier: "Loggi", trackingUrl: LOGGI_TRACKING_URL };
  }

  if (service.includes("pac") || service.includes("sedex") || provider.includes("correios")) {
    return { carrier: "Correios", trackingUrl: CORREIOS_TRACKING_URL };
  }

  throw new NotificationEmailError(
    "Transportadora não reconhecida para o rastreio.",
    422,
    "EMAIL_PROCESSOR_CARRIER_INVALID",
  );
}

async function prepareEmail(
  event: NotificationEvent,
  origin: string,
  environment: ResolvedEnvironment,
): Promise<PreparedEmail> {
  const profilePromise = fetchProfile(event.user_id, environment);
  const orderPromise = fetchOrder(event.order_id, environment);
  const [profile, order] = await Promise.all([profilePromise, orderPromise]);

  if (event.event_name.startsWith("order.") || event.event_name === "refund.requested") {
    if (!order) {
      throw new NotificationEmailError(
        "Pedido do evento não encontrado.",
        422,
        "EMAIL_PROCESSOR_ORDER_NOT_FOUND",
      );
    }

    const to = requiredEmail(order.customer_email);
    const common = {
      FIRST_NAMe: firstName(order.customer_name),
      ORDER_NUMBER: order.public_number,
      ORDER_URL: orderUrl(origin),
    } satisfies Record<string, ResendTemplateVariable>;

    if (event.event_name === "order.paid") {
      return {
        to,
        templateId: "order-paid",
        variables: {
          ...common,
          ORDER_TOTAL: formatBrl(order.total_amount),
        },
      };
    }

    if (event.event_name === "order.in_production") {
      return { to, templateId: "order-in-production", variables: common };
    }

    if (event.event_name === "order.shipped") {
      const trackingCode = order.shipping_tracking_code?.trim();
      if (!trackingCode) {
        throw new NotificationEmailError(
          "Pedido enviado sem código de rastreio.",
          422,
          "EMAIL_PROCESSOR_TRACKING_CODE_MISSING",
        );
      }
      const carrier = carrierDetails(order);
      return {
        to,
        templateId: "order-shipped",
        variables: {
          ...common,
          CARRIER: carrier.carrier,
          TRACKING_CODE: trackingCode,
          TRACKING_URL: carrier.trackingUrl,
        },
      };
    }

    if (event.event_name === "order.delivered") {
      return { to, templateId: "order-delivered", variables: common };
    }

    if (event.event_name === "refund.requested") {
      return { to, templateId: "refund-requested", variables: common };
    }
  }

  if (!profile) {
    throw new NotificationEmailError(
      "Perfil do afiliado não encontrado.",
      422,
      "EMAIL_PROCESSOR_AFFILIATE_PROFILE_NOT_FOUND",
    );
  }

  const to = requiredEmail(profile.email);
  const baseVariables = {
    FIRST_NAMe: firstName(profile.full_name),
    AFFILIATE_DASHBOARD_URL: affiliateDashboardUrl(origin),
  } satisfies Record<string, ResendTemplateVariable>;

  if (event.event_name === "affiliate.created") {
    return {
      to,
      templateId: "affiliate-approved",
      variables: {
        ...baseVariables,
        AFFILIATE_LINK: requiredPayloadText(
          event.payload,
          "affiliate_link",
          "EMAIL_PROCESSOR_AFFILIATE_LINK_MISSING",
        ),
        COMMISSION_RATE: fixedCommissionText(event.payload),
      },
    };
  }

  if (event.event_name === "affiliate.commission.created") {
    const affiliateOrder = order;
    const orderNumber =
      affiliateOrder?.public_number ??
      requiredPayloadText(
        event.payload,
        "order_number",
        "EMAIL_PROCESSOR_AFFILIATE_ORDER_NUMBER_MISSING",
      );
    const saleAmount = affiliateOrder
      ? formatBrl(affiliateOrder.total_amount)
      : normalizeMoneyText(
          requiredPayloadText(
            event.payload,
            "sale_amount",
            "EMAIL_PROCESSOR_AFFILIATE_SALE_AMOUNT_MISSING",
          ),
        );
    return {
      to,
      templateId: "affiliate-commission-created",
      variables: {
        ...baseVariables,
        ORDER_NUMBER: orderNumber,
        SALE_AMOUNT: saleAmount,
        COMMISSION_AMOUNT: normalizeMoneyText(
          requiredPayloadText(
            event.payload,
            "commission_amount",
            "EMAIL_PROCESSOR_AFFILIATE_COMMISSION_AMOUNT_MISSING",
          ),
        ),
        COMMISSION_RATE: fixedCommissionText(event.payload),
      },
    };
  }

  if (event.event_name === "affiliate.commission.available") {
    return {
      to,
      templateId: "affiliate-commission-available",
      variables: {
        ...baseVariables,
        AVAILABLE_AMOUNT: normalizeMoneyText(
          requiredPayloadText(
            event.payload,
            "available_amount",
            "EMAIL_PROCESSOR_AVAILABLE_AMOUNT_MISSING",
          ),
        ),
      },
    };
  }

  if (event.event_name === "affiliate.withdrawal.requested") {
    return {
      to,
      templateId: "affiliate-withdrawal-requested",
      variables: {
        ...baseVariables,
        WITHDRAWAL_AMOUNT: normalizeMoneyText(
          requiredPayloadText(
            event.payload,
            "withdrawal_amount",
            "EMAIL_PROCESSOR_WITHDRAWAL_AMOUNT_MISSING",
          ),
        ),
      },
    };
  }

  if (event.event_name === "affiliate.withdrawal.paid") {
    const paidDate =
      nonEmptyString(event.payload["paid_date"]) ??
      new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(event.occurred_at));
    return {
      to,
      templateId: "affiliate-withdrawal-paid",
      variables: {
        ...baseVariables,
        WITHDRAWAL_AMOUNT: normalizeMoneyText(
          requiredPayloadText(
            event.payload,
            "withdrawal_amount",
            "EMAIL_PROCESSOR_WITHDRAWAL_AMOUNT_MISSING",
          ),
        ),
        PAID_DATE: paidDate,
      },
    };
  }

  if (event.event_name === "affiliate.withdrawal.rejected") {
    return {
      to,
      templateId: "affiliate-withdrawal-rejected",
      variables: {
        ...baseVariables,
        WITHDRAWAL_AMOUNT: normalizeMoneyText(
          requiredPayloadText(
            event.payload,
            "withdrawal_amount",
            "EMAIL_PROCESSOR_WITHDRAWAL_AMOUNT_MISSING",
          ),
        ),
        REJECTION_REASON: requiredPayloadText(
          event.payload,
          "rejection_reason",
          "EMAIL_PROCESSOR_REJECTION_REASON_MISSING",
        ),
      },
    };
  }

  throw new NotificationEmailError(
    "Evento de e-mail sem template configurado.",
    422,
    "EMAIL_PROCESSOR_EVENT_UNSUPPORTED",
  );
}

export async function processNotificationEmailOutbox(input: {
  origin: string;
  environment?: NotificationEmailEnvironment;
  limit?: number;
}) {
  const environment = resolveEnvironment(input.environment);
  requireConfiguration(environment);
  const events = await claimEvents(environment, input.limit ?? 20);
  let sent = 0;
  let failed = 0;

  for (const event of events) {
    try {
      const prepared = await prepareEmail(event, input.origin, environment);
      const result = await sendResendTemplate({
        apiKey: environment.resendApiKey,
        from: environment.resendFrom,
        to: prepared.to,
        templateId: prepared.templateId,
        variables: prepared.variables,
        idempotencyKey: `notification/${event.idempotency_key}`,
        eventName: event.event_name,
      });
      await completeEvent(event.id, result.id, environment);
      sent += 1;
    } catch (error) {
      failed += 1;
      await failEvent(event.id, error, environment);
      const code =
        error instanceof NotificationEmailError || error instanceof ResendTemplateError
          ? error.code
          : "EMAIL_PROCESSOR_UNKNOWN_ERROR";
      console.error(
        `[notification-email] ${JSON.stringify({ eventId: event.id, eventName: event.event_name, code })}`,
      );
    }
  }

  return { claimed: events.length, sent, failed };
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

export async function handleProcessNotificationEmailsRequest(
  request: Request,
  explicitEnvironment?: NotificationEmailEnvironment,
) {
  try {
    if (request.method !== "POST") {
      throw new NotificationEmailError(
        "Método não permitido.",
        405,
        "EMAIL_PROCESSOR_METHOD_NOT_ALLOWED",
      );
    }

    const environment = resolveEnvironment(explicitEnvironment);
    const secret = environment.processorSecret;
    if (!secret) {
      throw new NotificationEmailError(
        "Processador de notificações ainda não configurado.",
        503,
        "EMAIL_PROCESSOR_SECRET_MISSING",
      );
    }

    const authorization = request.headers.get("authorization");
    if (authorization !== `Bearer ${secret}`) {
      throw new NotificationEmailError(
        "Acesso não autorizado.",
        401,
        "EMAIL_PROCESSOR_UNAUTHORIZED",
      );
    }

    const result = await processNotificationEmailOutbox({
      origin: new URL(request.url).origin,
      environment: explicitEnvironment,
      limit: 20,
    });
    return jsonResponse({ success: true, ...result });
  } catch (error) {
    if (error instanceof NotificationEmailError) {
      console.error(
        `[notification-email] ${JSON.stringify({ code: error.code, status: error.status })}`,
      );
      return jsonResponse({ success: false, code: error.code }, error.status);
    }

    console.error(error);
    return jsonResponse({ success: false, code: "EMAIL_PROCESSOR_INTERNAL_ERROR" }, 500);
  }
}
