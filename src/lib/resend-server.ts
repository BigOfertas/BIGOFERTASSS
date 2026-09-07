const RESEND_EMAILS_URL = "https://api.resend.com/emails";

export type ResendTemplateVariable = string | number;

export class ResendTemplateError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string, cause?: unknown) {
    super(message, { cause });
    this.name = "ResendTemplateError";
    this.status = status;
    this.code = code;
  }
}

function required(value: string | undefined, code: string) {
  const normalized = value?.trim();
  if (!normalized) {
    throw new ResendTemplateError("Configuração de e-mail indisponível.", 503, code);
  }
  return normalized;
}

function safeTagValue(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 256) || "transactional"
  );
}

export async function sendResendTemplate(input: {
  apiKey: string | undefined;
  from: string | undefined;
  to: string;
  templateId: string;
  variables: Record<string, ResendTemplateVariable>;
  idempotencyKey: string;
  eventName: string;
}) {
  const apiKey = required(input.apiKey, "RESEND_API_KEY_MISSING");
  const from = required(input.from, "RESEND_FROM_MISSING");
  const to = required(input.to, "RESEND_RECIPIENT_MISSING");
  const templateId = required(input.templateId, "RESEND_TEMPLATE_MISSING");
  const idempotencyKey = required(input.idempotencyKey, "RESEND_IDEMPOTENCY_KEY_MISSING");

  let response: Response;
  try {
    response = await fetch(RESEND_EMAILS_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        accept: "application/json",
        "user-agent": "BIGofertas/1.0",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        from,
        to: [to],
        template: {
          id: templateId,
          variables: input.variables,
        },
        tags: [
          {
            name: "event",
            value: safeTagValue(input.eventName),
          },
        ],
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (cause) {
    throw new ResendTemplateError(
      "Não foi possível enviar o e-mail agora.",
      502,
      "RESEND_NETWORK_ERROR",
      cause,
    );
  }

  const rawBody = await response.text().catch(() => "");
  let payload: { id?: unknown; message?: unknown; name?: unknown } | null = null;
  if (rawBody) {
    try {
      const parsed = JSON.parse(rawBody);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        payload = parsed as { id?: unknown; message?: unknown; name?: unknown };
      }
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    console.error(
      `[resend] ${JSON.stringify({ event: input.eventName, templateId, status: response.status, providerError: typeof payload?.message === "string" ? payload.message.slice(0, 300) : undefined })}`,
    );
    throw new ResendTemplateError(
      "O provedor de e-mail recusou o envio.",
      502,
      "RESEND_SEND_FAILED",
    );
  }

  if (typeof payload?.id !== "string" || !payload.id.trim()) {
    throw new ResendTemplateError(
      "O provedor de e-mail retornou uma resposta inválida.",
      502,
      "RESEND_INVALID_RESPONSE",
    );
  }

  return { id: payload.id };
}
