const RESEND_EMAILS_URL = "https://api.resend.com/emails";
const DEFAULT_FROM = "BIGofertas <contato@bigofertas.net>";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CORREIOS_TRACKING_URL = "https://www.correios.com.br/home-page-2024/rastreamento/acompanhe-seu-objeto";
const LOGGI_TRACKING_URL = "https://www.loggi.com/rastreador/";

type NotificationEvent = {
  id: string;
  user_id: string;
  order_id: string | null;
  event_name: string;
  payload: Record<string, unknown>;
  idempotency_key: string;
  occurred_at: string;
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

type ProfileRow = { id: string; email: string | null; full_name: string | null };
type PreparedEmail = { to: string; templateId: string; variables: Record<string, string | number> };

function requiredEnv(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`${name}_MISSING`);
  return value;
}

function serviceHeaders() {
  const key = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  return {
    apikey: key,
    authorization: `Bearer ${key}`,
    accept: "application/json",
    "content-type": "application/json",
  };
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

async function readJson(upstream: Response) {
  const text = await upstream.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
}

async function isAuthorizedProcessorCaller(request: Request) {
  const authorization = request.headers.get("authorization")?.trim();
  if (!authorization?.startsWith("Bearer ")) return false;

  const token = authorization.slice("Bearer ".length).trim();
  if (!token) return false;

  const builtInServiceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  if (builtInServiceRole && token === builtInServiceRole) return true;

  const apiKey = request.headers.get("apikey")?.trim() || token;

  try {
    const endpoint = new URL("/auth/v1/admin/users", requiredEnv("SUPABASE_URL"));
    endpoint.searchParams.set("page", "1");
    endpoint.searchParams.set("per_page", "1");

    const upstream = await fetch(endpoint, {
      headers: {
        apikey: apiKey,
        authorization: `Bearer ${token}`,
        accept: "application/json",
      },
      signal: AbortSignal.timeout(8_000),
    });

    return upstream.ok;
  } catch {
    return false;
  }
}

async function rpc(name: string, body: Record<string, unknown>) {
  const endpoint = `${requiredEnv("SUPABASE_URL").replace(/\/$/, "")}/rest/v1/rpc/${name}`;
  return fetch(endpoint, {
    method: "POST",
    headers: serviceHeaders(),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
}

async function releaseDueAffiliateCommissions() {
  try {
    const upstream = await rpc("release_due_affiliate_commissions", {
      p_affiliate_id: null,
    });
    if (upstream.ok) return;

    const payload = await readJson(upstream) as { code?: unknown } | null;
    const functionNotInstalled =
      upstream.status === 404 || payload?.code === "PGRST202";

    if (!functionNotInstalled) {
      console.warn(
        `[affiliate-release-edge] ${JSON.stringify({ status: upstream.status, code: payload?.code ?? null })}`,
      );
    }
  } catch (error) {
    console.warn(
      `[affiliate-release-edge] ${JSON.stringify({ error: error instanceof Error ? error.message : "unknown" })}`,
    );
  }
}

async function claimEvents(limit = 20): Promise<NotificationEvent[]> {
  const upstream = await rpc("claim_notification_events", { p_limit: Math.min(Math.max(limit, 1), 50) });
  const payload = await readJson(upstream);
  if (!upstream.ok || !Array.isArray(payload)) throw new Error("EMAIL_CLAIM_FAILED");
  return payload.map((row) => ({
    id: String(row.id ?? ""),
    user_id: String(row.user_id ?? ""),
    order_id: typeof row.order_id === "string" ? row.order_id : null,
    event_name: String(row.event_name ?? ""),
    payload: row.payload && typeof row.payload === "object" && !Array.isArray(row.payload) ? row.payload : {},
    idempotency_key: String(row.idempotency_key ?? ""),
    occurred_at: String(row.occurred_at ?? ""),
  }));
}

async function completeEvent(id: string, providerId: string) {
  const upstream = await rpc("complete_notification_event", { p_event_id: id, p_provider_message_id: providerId });
  if (!upstream.ok) throw new Error("EMAIL_COMPLETE_FAILED");
}

async function failEvent(id: string, error: unknown) {
  const message = error instanceof Error ? error.message : "Falha inesperada no envio";
  await rpc("fail_notification_event", { p_event_id: id, p_error: message.slice(0, 1000) }).catch(() => undefined);
}

async function fetchOne(table: string, select: string, filter: string, value: string) {
  const endpoint = new URL(`/rest/v1/${table}`, requiredEnv("SUPABASE_URL"));
  endpoint.searchParams.set("select", select);
  endpoint.searchParams.set(filter, `eq.${value}`);
  endpoint.searchParams.set("limit", "1");
  const upstream = await fetch(endpoint, { headers: serviceHeaders(), signal: AbortSignal.timeout(8_000) });
  const payload = await readJson(upstream);
  return upstream.ok && Array.isArray(payload) && payload.length === 1 ? payload[0] : null;
}

function firstName(name: string | null | undefined) {
  return name?.trim().split(/\s+/)[0] || "cliente";
}

function requiredEmail(value: string | null | undefined) {
  const email = value?.trim().toLowerCase();
  if (!email || !EMAIL_PATTERN.test(email)) throw new Error("EMAIL_RECIPIENT_INVALID");
  return email;
}

function formatBrl(value: number | string) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) throw new Error("EMAIL_AMOUNT_INVALID");
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);
}

function optionalPayloadText(event: NotificationEvent, key: string) {
  const value = event.payload[key];
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string" && value.trim()) return value.trim();
  return null;
}

function payloadText(event: NotificationEvent, key: string) {
  const value = optionalPayloadText(event, key);
  if (value) return value;
  throw new Error(`EMAIL_${key.toUpperCase()}_MISSING`);
}

function moneyText(value: string) {
  if (/^R\$\s*/i.test(value)) return value;
  const numeric = Number(value.replace(",", "."));
  return Number.isFinite(numeric) ? formatBrl(numeric) : value;
}

function rateText(value: string) { return value.includes("%") ? value : `${value}%`; }
function siteUrl() { return (Deno.env.get("PUBLIC_SITE_URL")?.trim() || "https://bigofertas.net").replace(/\/$/, ""); }

function affiliateDashboardUrl() {
  return `${siteUrl()}/conta?secao=afiliados`;
}

function affiliateRegistrationUrl(event: NotificationEvent) {
  const legacyLink = optionalPayloadText(event, "affiliate_link");
  if (legacyLink) return legacyLink;

  const referralCode = payloadText(event, "referral_code");
  const url = new URL("/cadastro", `${siteUrl()}/`);
  url.searchParams.set("ref", referralCode);
  return url.toString();
}

async function prepareEmail(event: NotificationEvent): Promise<PreparedEmail> {
  const order = event.order_id
    ? await fetchOne("orders", "id,public_number,customer_name,customer_email,total_amount,shipping_provider,shipping_service,shipping_tracking_code", "id", event.order_id) as OrderRow | null
    : null;

  if (event.event_name.startsWith("order.") || event.event_name === "refund.requested") {
    if (!order) throw new Error("EMAIL_ORDER_NOT_FOUND");
    const common = {
      FIRST_NAMe: firstName(order.customer_name),
      ORDER_NUMBER: order.public_number,
      ORDER_URL: `${siteUrl()}/conta`,
    };
    const to = requiredEmail(order.customer_email);

    if (event.event_name === "order.paid") {
      return { to, templateId: "order-paid", variables: { ...common, ORDER_TOTAL: formatBrl(order.total_amount) } };
    }
    if (event.event_name === "order.in_production") {
      return { to, templateId: "order-in-production", variables: common };
    }
    if (event.event_name === "order.shipped") {
      const trackingCode = order.shipping_tracking_code?.trim();
      if (!trackingCode) throw new Error("EMAIL_TRACKING_CODE_MISSING");
      const service = order.shipping_service?.toLowerCase() ?? "";
      const provider = order.shipping_provider?.toLowerCase() ?? "";
      const isLoggi = service.includes("loggi") || provider.includes("loggi");
      const isCorreios = service.includes("pac") || service.includes("sedex") || provider.includes("correios");
      if (!isLoggi && !isCorreios) throw new Error("EMAIL_CARRIER_INVALID");
      return {
        to,
        templateId: "order-shipped",
        variables: {
          ...common,
          CARRIER: isLoggi ? "Loggi" : "Correios",
          TRACKING_CODE: trackingCode,
          TRACKING_URL: isLoggi ? LOGGI_TRACKING_URL : CORREIOS_TRACKING_URL,
        },
      };
    }
    if (event.event_name === "order.delivered") {
      return { to, templateId: "order-delivered", variables: common };
    }
    if (event.event_name === "refund.requested") {
      return { to, templateId: "refund-requested", variables: common };
    }
    throw new Error("EMAIL_ORDER_EVENT_UNSUPPORTED");
  }

  const profile = await fetchOne("profiles", "id,email,full_name", "id", event.user_id) as ProfileRow | null;
  if (!profile) throw new Error("EMAIL_PROFILE_NOT_FOUND");
  const to = requiredEmail(profile.email);
  const base = {
    FIRST_NAMe: firstName(profile.full_name),
    AFFILIATE_DASHBOARD_URL: affiliateDashboardUrl(),
  };

  if (event.event_name === "affiliate.created") {
    return {
      to,
      templateId: "affiliate-approved",
      variables: {
        ...base,
        AFFILIATE_LINK: affiliateRegistrationUrl(event),
        COMMISSION_RATE: rateText(payloadText(event, "commission_rate")),
      },
    };
  }
  if (event.event_name === "affiliate.commission.created") {
    return { to, templateId: "affiliate-commission-created", variables: { ...base, ORDER_NUMBER: order?.public_number ?? payloadText(event, "order_number"), SALE_AMOUNT: order ? formatBrl(order.total_amount) : moneyText(payloadText(event, "sale_amount")), COMMISSION_AMOUNT: moneyText(payloadText(event, "commission_amount")), COMMISSION_RATE: rateText(payloadText(event, "commission_rate")) } };
  }
  if (event.event_name === "affiliate.commission.available") {
    return { to, templateId: "affiliate-commission-available", variables: { ...base, AVAILABLE_AMOUNT: moneyText(payloadText(event, "available_amount")) } };
  }
  if (event.event_name === "affiliate.withdrawal.requested") {
    return { to, templateId: "affiliate-withdrawal-requested", variables: { ...base, WITHDRAWAL_AMOUNT: moneyText(payloadText(event, "withdrawal_amount")) } };
  }
  if (event.event_name === "affiliate.withdrawal.paid") {
    const paidDate = typeof event.payload.paid_date === "string" && event.payload.paid_date.trim()
      ? event.payload.paid_date.trim()
      : new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(event.occurred_at));
    return { to, templateId: "affiliate-withdrawal-paid", variables: { ...base, WITHDRAWAL_AMOUNT: moneyText(payloadText(event, "withdrawal_amount")), PAID_DATE: paidDate } };
  }
  if (event.event_name === "affiliate.withdrawal.rejected") {
    return { to, templateId: "affiliate-withdrawal-rejected", variables: { ...base, WITHDRAWAL_AMOUNT: moneyText(payloadText(event, "withdrawal_amount")), REJECTION_REASON: payloadText(event, "rejection_reason") } };
  }
  throw new Error("EMAIL_EVENT_UNSUPPORTED");
}

function safeTag(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 256) || "transactional";
}

async function sendEmail(event: NotificationEvent, prepared: PreparedEmail) {
  const upstream = await fetch(RESEND_EMAILS_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${requiredEnv("RESEND_API_KEY")}`,
      "content-type": "application/json",
      accept: "application/json",
      "user-agent": "BIGofertas/1.0",
      "Idempotency-Key": `notification/${event.idempotency_key}`,
    },
    body: JSON.stringify({
      from: Deno.env.get("RESEND_FROM")?.trim() || DEFAULT_FROM,
      to: [prepared.to],
      template: { id: prepared.templateId, variables: prepared.variables },
      tags: [{ name: "event", value: safeTag(event.event_name) }],
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const payload = await readJson(upstream) as { id?: unknown; message?: unknown } | null;
  if (!upstream.ok || typeof payload?.id !== "string" || !payload.id.trim()) {
    console.error(`[resend-edge] ${JSON.stringify({ event: event.event_name, template: prepared.templateId, status: upstream.status, providerError: typeof payload?.message === "string" ? payload.message.slice(0, 300) : null })}`);
    throw new Error("RESEND_SEND_FAILED");
  }
  return payload.id;
}

async function processOutbox() {
  await releaseDueAffiliateCommissions();

  const events = await claimEvents(20);
  let sent = 0;
  let failed = 0;

  for (const event of events) {
    try {
      const prepared = await prepareEmail(event);
      const providerId = await sendEmail(event, prepared);
      await completeEvent(event.id, providerId);
      sent += 1;
    } catch (error) {
      failed += 1;
      await failEvent(event.id, error);
      console.error(`[notification-email-edge] ${JSON.stringify({ eventId: event.id, eventName: event.event_name, error: error instanceof Error ? error.message : "unknown" })}`);
    }
  }

  return { claimed: events.length, sent, failed };
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return response({ success: false, code: "METHOD_NOT_ALLOWED" }, 405);

  if (!(await isAuthorizedProcessorCaller(request))) {
    return response({ success: false, code: "UNAUTHORIZED" }, 401);
  }

  try {
    requiredEnv("RESEND_API_KEY");
    const result = await processOutbox();
    return response({ success: true, ...result });
  } catch (error) {
    console.error(error);
    return response({ success: false, code: error instanceof Error ? error.message : "EMAIL_PROCESSOR_ERROR" }, 500);
  }
});
