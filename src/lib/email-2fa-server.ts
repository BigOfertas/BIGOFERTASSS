const RESEND_EMAILS_URL = "https://api.resend.com/emails";

export type EmailTwoFactorEnvironment = {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM?: string;
  EMAIL_2FA_SECRET?: string;
};

type NitroCloudflareRequest = Request & {
  runtime?: {
    cloudflare?: {
      env?: unknown;
    };
  };
};

type ResolvedEnvironment = {
  supabaseUrl: string | undefined;
  supabasePublishableKey: string | undefined;
  supabaseServiceRoleKey: string | undefined;
  resendApiKey: string | undefined;
  resendFrom: string | undefined;
  emailTwoFactorSecret: string | undefined;
};

type SupabasePasswordGrant = {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  expires_at?: number;
  token_type?: string;
  user: {
    id: string;
    email?: string | null;
    email_confirmed_at?: string | null;
  };
};

type AuthenticatedUser = {
  id: string;
  email: string;
  emailConfirmedAt: string;
};

type ChallengePurpose = "enroll" | "login";

type ChallengeRow = {
  id: string;
  user_id: string;
  email: string;
  purpose: ChallengePurpose;
  code_digest: string;
  expires_at: string;
  attempt_count: number;
  consumed_at: string | null;
  created_at: string;
};

type SecurityProfile = {
  id: string;
  email: string | null;
  full_name: string | null;
  email_2fa_enabled: boolean;
  email_2fa_enabled_at: string | null;
  email_2fa_prompt_dismissed_at: string | null;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TWO_FACTOR_CODE_PATTERN = /^\d{6}$/;
const TWO_FACTOR_TTL_MS = 10 * 60 * 1000;
const TWO_FACTOR_RESEND_WINDOW_MS = 60 * 1000;
const TWO_FACTOR_MAX_ATTEMPTS = 5;

class EmailTwoFactorError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string, cause?: unknown) {
    super(message, { cause });
    this.name = "EmailTwoFactorError";
    this.status = status;
    this.code = code;
  }
}

function asEnvironment(value: unknown): EmailTwoFactorEnvironment {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as EmailTwoFactorEnvironment;
}

function nonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function resolveEnvironment(
  request: Request,
  explicitEnvironment?: EmailTwoFactorEnvironment,
): ResolvedEnvironment {
  const runtimeEnvironment = asEnvironment(
    (request as NitroCloudflareRequest).runtime?.cloudflare?.env,
  );
  const entryEnvironment = asEnvironment(explicitEnvironment);
  const processEnvironment =
    typeof process !== "undefined" ? asEnvironment(process.env) : {};

  return {
    supabaseUrl:
      nonEmptyString(runtimeEnvironment.VITE_SUPABASE_URL) ??
      nonEmptyString(entryEnvironment.VITE_SUPABASE_URL) ??
      nonEmptyString(import.meta.env["VITE_SUPABASE_URL"]),
    supabasePublishableKey:
      nonEmptyString(runtimeEnvironment.VITE_SUPABASE_PUBLISHABLE_KEY) ??
      nonEmptyString(entryEnvironment.VITE_SUPABASE_PUBLISHABLE_KEY) ??
      nonEmptyString(import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"]),
    supabaseServiceRoleKey:
      nonEmptyString(runtimeEnvironment.SUPABASE_SERVICE_ROLE_KEY) ??
      nonEmptyString(entryEnvironment.SUPABASE_SERVICE_ROLE_KEY) ??
      nonEmptyString(processEnvironment.SUPABASE_SERVICE_ROLE_KEY),
    resendApiKey:
      nonEmptyString(runtimeEnvironment.RESEND_API_KEY) ??
      nonEmptyString(entryEnvironment.RESEND_API_KEY) ??
      nonEmptyString(processEnvironment.RESEND_API_KEY),
    resendFrom:
      nonEmptyString(runtimeEnvironment.RESEND_FROM) ??
      nonEmptyString(entryEnvironment.RESEND_FROM) ??
      nonEmptyString(processEnvironment.RESEND_FROM),
    emailTwoFactorSecret:
      nonEmptyString(runtimeEnvironment.EMAIL_2FA_SECRET) ??
      nonEmptyString(entryEnvironment.EMAIL_2FA_SECRET) ??
      nonEmptyString(processEnvironment.EMAIL_2FA_SECRET),
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
  if (error instanceof EmailTwoFactorError) {
    console.error(
      `[email-2fa] ${JSON.stringify({ code: error.code, status: error.status })}`,
    );
    return jsonResponse({ error: error.message, code: error.code }, error.status);
  }

  console.error(error);
  return jsonResponse(
    { error: "Não foi possível concluir a verificação de segurança agora.", code: "EMAIL_2FA_INTERNAL_ERROR" },
    500,
  );
}

function ensureSameOrigin(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = request.headers.get("origin");
  if (origin && origin !== requestUrl.origin) {
    throw new EmailTwoFactorError(
      "Origem da requisição não permitida.",
      403,
      "EMAIL_2FA_ORIGIN_FORBIDDEN",
    );
  }
}

function requireCoreConfiguration(environment: ResolvedEnvironment) {
  if (
    !environment.supabaseUrl ||
    !environment.supabasePublishableKey ||
    !environment.supabaseServiceRoleKey
  ) {
    throw new EmailTwoFactorError(
      "O acesso à conta está temporariamente indisponível.",
      503,
      "EMAIL_2FA_SUPABASE_CONFIG_MISSING",
    );
  }
}

function requireEmailTwoFactorConfiguration(environment: ResolvedEnvironment) {
  if (
    !environment.resendApiKey ||
    !environment.resendFrom ||
    !environment.emailTwoFactorSecret
  ) {
    throw new EmailTwoFactorError(
      "A verificação por e-mail ainda não está disponível.",
      503,
      "EMAIL_2FA_EMAIL_CONFIG_MISSING",
    );
  }
}

function serviceHeaders(environment: ResolvedEnvironment) {
  if (!environment.supabaseServiceRoleKey) {
    throw new EmailTwoFactorError(
      "O acesso à conta está temporariamente indisponível.",
      503,
      "EMAIL_2FA_SUPABASE_CONFIG_MISSING",
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
    throw new EmailTwoFactorError(
      "Um serviço necessário retornou uma resposta inválida.",
      502,
      code,
      cause,
    );
  }
}

function normalizeEmail(value: unknown) {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return EMAIL_PATTERN.test(email) && email.length <= 320 ? email : null;
}

function normalizePassword(value: unknown) {
  return typeof value === "string" && value.length >= 6 && value.length <= 512
    ? value
    : null;
}

function maskEmail(email: string) {
  const [localPart, domain] = email.split("@");
  if (!localPart || !domain) return email;
  const visible = localPart.slice(0, Math.min(2, localPart.length));
  return `${visible}${"*".repeat(Math.max(2, localPart.length - visible.length))}@${domain}`;
}

async function supabasePasswordGrant(
  email: string,
  password: string,
  environment: ResolvedEnvironment,
): Promise<SupabasePasswordGrant> {
  if (!environment.supabaseUrl || !environment.supabasePublishableKey) {
    throw new EmailTwoFactorError(
      "O acesso à conta está temporariamente indisponível.",
      503,
      "EMAIL_2FA_SUPABASE_CONFIG_MISSING",
    );
  }

  const endpoint = new URL("/auth/v1/token", environment.supabaseUrl);
  endpoint.searchParams.set("grant_type", "password");

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        apikey: environment.supabasePublishableKey,
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (cause) {
    throw new EmailTwoFactorError(
      "Não foi possível entrar agora. Tente novamente.",
      502,
      "EMAIL_2FA_PASSWORD_NETWORK_ERROR",
      cause,
    );
  }

  const payload = (await readJson(response, "EMAIL_2FA_PASSWORD_PARSE_ERROR")) as {
    access_token?: unknown;
    refresh_token?: unknown;
    expires_in?: unknown;
    expires_at?: unknown;
    token_type?: unknown;
    user?: unknown;
    error_code?: unknown;
    msg?: unknown;
    message?: unknown;
    error_description?: unknown;
  };

  if (!response.ok) {
    const source = [payload.error_code, payload.msg, payload.message, payload.error_description]
      .filter((item): item is string => typeof item === "string")
      .join(" ")
      .toLowerCase();

    if (source.includes("email_not_confirmed") || source.includes("email not confirmed")) {
      throw new EmailTwoFactorError(
        "Confirme seu e-mail antes de entrar. Use o link enviado pela BIGofertas.",
        403,
        "EMAIL_NOT_CONFIRMED",
      );
    }

    throw new EmailTwoFactorError(
      "E-mail ou senha incorretos.",
      401,
      "INVALID_LOGIN_CREDENTIALS",
    );
  }

  const user = payload.user;
  if (
    typeof payload.access_token !== "string" ||
    typeof payload.refresh_token !== "string" ||
    !user ||
    typeof user !== "object" ||
    Array.isArray(user) ||
    typeof (user as { id?: unknown }).id !== "string" ||
    !UUID_PATTERN.test((user as { id: string }).id)
  ) {
    throw new EmailTwoFactorError(
      "A autenticação retornou dados inválidos.",
      502,
      "EMAIL_2FA_PASSWORD_INVALID_RESPONSE",
    );
  }

  const emailConfirmedAt = (user as { email_confirmed_at?: unknown }).email_confirmed_at;
  if (typeof emailConfirmedAt !== "string" || !emailConfirmedAt) {
    throw new EmailTwoFactorError(
      "Confirme seu e-mail antes de entrar. Use o link enviado pela BIGofertas.",
      403,
      "EMAIL_NOT_CONFIRMED",
    );
  }

  return payload as SupabasePasswordGrant;
}

async function authenticateBearerUser(
  request: Request,
  environment: ResolvedEnvironment,
): Promise<AuthenticatedUser> {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    throw new EmailTwoFactorError(
      "Entre na sua conta para continuar.",
      401,
      "EMAIL_2FA_AUTH_REQUIRED",
    );
  }

  if (!environment.supabaseUrl || !environment.supabasePublishableKey) {
    throw new EmailTwoFactorError(
      "O acesso à conta está temporariamente indisponível.",
      503,
      "EMAIL_2FA_SUPABASE_CONFIG_MISSING",
    );
  }

  const endpoint = new URL("/auth/v1/user", environment.supabaseUrl);
  const response = await fetch(endpoint, {
    headers: {
      apikey: environment.supabasePublishableKey,
      authorization,
      accept: "application/json",
    },
    signal: AbortSignal.timeout(8_000),
  });

  if (!response.ok) {
    throw new EmailTwoFactorError(
      "Sua sessão expirou. Entre novamente para continuar.",
      401,
      "EMAIL_2FA_AUTH_INVALID",
    );
  }

  const payload = (await readJson(response, "EMAIL_2FA_AUTH_PARSE_ERROR")) as {
    id?: unknown;
    email?: unknown;
    email_confirmed_at?: unknown;
  };

  if (
    typeof payload.id !== "string" ||
    !UUID_PATTERN.test(payload.id) ||
    typeof payload.email !== "string" ||
    !normalizeEmail(payload.email) ||
    typeof payload.email_confirmed_at !== "string" ||
    !payload.email_confirmed_at
  ) {
    throw new EmailTwoFactorError(
      "Sua conta ainda não está pronta para esta verificação.",
      403,
      "EMAIL_2FA_AUTH_INVALID",
    );
  }

  return {
    id: payload.id,
    email: payload.email.toLowerCase(),
    emailConfirmedAt: payload.email_confirmed_at,
  };
}

async function fetchSecurityProfile(
  userId: string,
  environment: ResolvedEnvironment,
): Promise<SecurityProfile> {
  if (!environment.supabaseUrl) {
    throw new EmailTwoFactorError(
      "O acesso à conta está temporariamente indisponível.",
      503,
      "EMAIL_2FA_SUPABASE_CONFIG_MISSING",
    );
  }

  const endpoint = new URL("/rest/v1/profiles", environment.supabaseUrl);
  endpoint.searchParams.set(
    "select",
    "id,email,full_name,email_2fa_enabled,email_2fa_enabled_at,email_2fa_prompt_dismissed_at",
  );
  endpoint.searchParams.set("id", `eq.${userId}`);
  endpoint.searchParams.set("limit", "1");

  const response = await fetch(endpoint, {
    headers: serviceHeaders(environment),
    signal: AbortSignal.timeout(8_000),
  });
  const payload = await readJson(response, "EMAIL_2FA_PROFILE_PARSE_ERROR");

  if (!response.ok || !Array.isArray(payload) || payload.length !== 1) {
    throw new EmailTwoFactorError(
      "Não foi possível carregar as configurações de segurança.",
      502,
      "EMAIL_2FA_PROFILE_NOT_FOUND",
    );
  }

  return payload[0] as SecurityProfile;
}

async function hmacDigest(
  challengeId: string,
  purpose: ChallengePurpose,
  code: string,
  secret: string,
) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${challengeId}:${purpose}:${code}`),
  );
  return [...new Uint8Array(signature)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function constantTimeEqual(left: string, right: string) {
  const maxLength = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < maxLength; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

function generateSixDigitCode() {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return String(values[0]! % 1_000_000).padStart(6, "0");
}

async function ensureChallengeSendRate(
  userId: string,
  purpose: ChallengePurpose,
  environment: ResolvedEnvironment,
) {
  if (!environment.supabaseUrl) return;

  const endpoint = new URL("/rest/v1/email_2fa_challenges", environment.supabaseUrl);
  endpoint.searchParams.set("select", "id,created_at");
  endpoint.searchParams.set("user_id", `eq.${userId}`);
  endpoint.searchParams.set("purpose", `eq.${purpose}`);
  endpoint.searchParams.set("consumed_at", "is.null");
  endpoint.searchParams.set(
    "created_at",
    `gt.${new Date(Date.now() - TWO_FACTOR_RESEND_WINDOW_MS).toISOString()}`,
  );
  endpoint.searchParams.set("order", "created_at.desc");
  endpoint.searchParams.set("limit", "1");

  const response = await fetch(endpoint, {
    headers: serviceHeaders(environment),
    signal: AbortSignal.timeout(8_000),
  });
  const payload = await readJson(response, "EMAIL_2FA_RATE_PARSE_ERROR");

  if (!response.ok) {
    throw new EmailTwoFactorError(
      "Não foi possível preparar o código de segurança.",
      502,
      "EMAIL_2FA_RATE_CHECK_FAILED",
    );
  }

  if (Array.isArray(payload) && payload.length > 0) {
    throw new EmailTwoFactorError(
      "Aguarde um minuto antes de solicitar outro código.",
      429,
      "EMAIL_2FA_RATE_LIMITED",
    );
  }
}

async function insertChallenge(
  userId: string,
  email: string,
  purpose: ChallengePurpose,
  environment: ResolvedEnvironment,
) {
  if (!environment.supabaseUrl || !environment.emailTwoFactorSecret) {
    throw new EmailTwoFactorError(
      "A verificação por e-mail ainda não está disponível.",
      503,
      "EMAIL_2FA_EMAIL_CONFIG_MISSING",
    );
  }

  await ensureChallengeSendRate(userId, purpose, environment);

  const challengeId = crypto.randomUUID();
  const code = generateSixDigitCode();
  const codeDigest = await hmacDigest(
    challengeId,
    purpose,
    code,
    environment.emailTwoFactorSecret,
  );
  const expiresAt = new Date(Date.now() + TWO_FACTOR_TTL_MS).toISOString();

  const endpoint = new URL("/rest/v1/email_2fa_challenges", environment.supabaseUrl);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      ...serviceHeaders(environment),
      prefer: "return=minimal",
    },
    body: JSON.stringify({
      id: challengeId,
      user_id: userId,
      email,
      purpose,
      code_digest: codeDigest,
      expires_at: expiresAt,
    }),
    signal: AbortSignal.timeout(8_000),
  });

  if (!response.ok) {
    throw new EmailTwoFactorError(
      "Não foi possível preparar o código de segurança.",
      502,
      "EMAIL_2FA_CHALLENGE_CREATE_FAILED",
    );
  }

  return { challengeId, code, expiresAt };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function sendTwoFactorEmail(input: {
  to: string;
  name: string | null;
  code: string;
  purpose: ChallengePurpose;
  challengeId: string;
  environment: ResolvedEnvironment;
}) {
  const { environment } = input;
  if (!environment.resendApiKey || !environment.resendFrom) {
    throw new EmailTwoFactorError(
      "A verificação por e-mail ainda não está disponível.",
      503,
      "EMAIL_2FA_EMAIL_CONFIG_MISSING",
    );
  }

  const firstName = input.name?.trim().split(/\s+/)[0] || "Olá";
  const safeFirstName = escapeHtml(firstName);
  const title =
    input.purpose === "enroll"
      ? "Confirme a ativação da verificação em duas etapas"
      : "Confirme seu acesso à BIGofertas";
  const text = `${firstName}, seu código de segurança BIGofertas é ${input.code}. Ele expira em 10 minutos. Se você não solicitou este código, ignore este e-mail.`;
  const html = `<!doctype html><html><body style="margin:0;background:#f6f7f9;font-family:Arial,sans-serif;color:#111827"><div style="max-width:560px;margin:0 auto;padding:32px 16px"><div style="background:#fff;border:1px solid #e5e7eb;border-radius:18px;padding:28px"><div style="font-size:24px;font-weight:900;font-style:italic"><span style="color:#dc2626">BIG</span>ofertas</div><h1 style="font-size:21px;margin:26px 0 8px">${title}</h1><p style="font-size:14px;line-height:1.6;color:#4b5563">${safeFirstName}, use o código abaixo para continuar:</p><div style="margin:24px 0;padding:18px;border-radius:14px;background:#111827;color:#fff;text-align:center;font-size:32px;font-weight:900;letter-spacing:8px">${input.code}</div><p style="font-size:13px;line-height:1.6;color:#6b7280">O código expira em 10 minutos e só pode ser usado uma vez. Se você não solicitou esta verificação, ignore este e-mail.</p></div></div></body></html>`;

  let response: Response;
  try {
    response = await fetch(RESEND_EMAILS_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${environment.resendApiKey}`,
        "content-type": "application/json",
        accept: "application/json",
        "user-agent": "BIGofertas/1.0",
        "Idempotency-Key": `email-2fa/${input.purpose}/${input.challengeId}`,
      },
      body: JSON.stringify({
        from: environment.resendFrom,
        to: [input.to],
        subject: "Seu código de segurança BIGofertas",
        html,
        text,
        tags: [
          { name: "category", value: `two_factor_${input.purpose}` },
        ],
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (cause) {
    throw new EmailTwoFactorError(
      "Não foi possível enviar o código agora.",
      502,
      "EMAIL_2FA_RESEND_NETWORK_ERROR",
      cause,
    );
  }

  if (!response.ok) {
    const payload = await response.clone().text().catch(() => "");
    console.error(
      `[email-2fa] ${JSON.stringify({ event: "resend_failed", status: response.status, body: payload.slice(0, 300) })}`,
    );
    throw new EmailTwoFactorError(
      "Não foi possível enviar o código agora.",
      502,
      "EMAIL_2FA_RESEND_FAILED",
    );
  }
}

async function createAndSendChallenge(input: {
  userId: string;
  email: string;
  name: string | null;
  purpose: ChallengePurpose;
  environment: ResolvedEnvironment;
}) {
  requireEmailTwoFactorConfiguration(input.environment);
  const challenge = await insertChallenge(
    input.userId,
    input.email,
    input.purpose,
    input.environment,
  );

  try {
    await sendTwoFactorEmail({
      to: input.email,
      name: input.name,
      code: challenge.code,
      purpose: input.purpose,
      challengeId: challenge.challengeId,
      environment: input.environment,
    });
  } catch (error) {
    await consumeChallenge(challenge.challengeId, input.environment).catch(() => undefined);
    throw error;
  }

  return challenge;
}

async function fetchChallenge(
  challengeId: string,
  environment: ResolvedEnvironment,
): Promise<ChallengeRow> {
  if (!environment.supabaseUrl) {
    throw new EmailTwoFactorError(
      "A verificação por e-mail está indisponível.",
      503,
      "EMAIL_2FA_SUPABASE_CONFIG_MISSING",
    );
  }

  const endpoint = new URL("/rest/v1/email_2fa_challenges", environment.supabaseUrl);
  endpoint.searchParams.set(
    "select",
    "id,user_id,email,purpose,code_digest,expires_at,attempt_count,consumed_at,created_at",
  );
  endpoint.searchParams.set("id", `eq.${challengeId}`);
  endpoint.searchParams.set("limit", "1");

  const response = await fetch(endpoint, {
    headers: serviceHeaders(environment),
    signal: AbortSignal.timeout(8_000),
  });
  const payload = await readJson(response, "EMAIL_2FA_CHALLENGE_PARSE_ERROR");

  if (!response.ok || !Array.isArray(payload) || payload.length !== 1) {
    throw new EmailTwoFactorError(
      "Esse código não é mais válido. Solicite um novo.",
      400,
      "EMAIL_2FA_CHALLENGE_INVALID",
    );
  }

  return payload[0] as ChallengeRow;
}

async function incrementAttempts(challenge: ChallengeRow, environment: ResolvedEnvironment) {
  if (!environment.supabaseUrl) return;
  const endpoint = new URL("/rest/v1/email_2fa_challenges", environment.supabaseUrl);
  endpoint.searchParams.set("id", `eq.${challenge.id}`);
  endpoint.searchParams.set("consumed_at", "is.null");

  await fetch(endpoint, {
    method: "PATCH",
    headers: serviceHeaders(environment),
    body: JSON.stringify({
      attempt_count: Math.min(TWO_FACTOR_MAX_ATTEMPTS, challenge.attempt_count + 1),
    }),
    signal: AbortSignal.timeout(8_000),
  });
}

async function consumeChallenge(challengeId: string, environment: ResolvedEnvironment) {
  if (!environment.supabaseUrl) return;
  const endpoint = new URL("/rest/v1/email_2fa_challenges", environment.supabaseUrl);
  endpoint.searchParams.set("id", `eq.${challengeId}`);
  endpoint.searchParams.set("consumed_at", "is.null");

  const response = await fetch(endpoint, {
    method: "PATCH",
    headers: {
      ...serviceHeaders(environment),
      prefer: "return=representation",
    },
    body: JSON.stringify({ consumed_at: new Date().toISOString() }),
    signal: AbortSignal.timeout(8_000),
  });
  const payload = await readJson(response, "EMAIL_2FA_CONSUME_PARSE_ERROR");
  if (!response.ok || !Array.isArray(payload) || payload.length !== 1) {
    throw new EmailTwoFactorError(
      "Esse código já foi usado. Solicite um novo.",
      400,
      "EMAIL_2FA_CHALLENGE_ALREADY_USED",
    );
  }
}

async function verifyChallenge(input: {
  challengeId: string;
  code: string;
  purpose: ChallengePurpose;
  expectedUserId?: string;
  expectedEmail?: string;
  environment: ResolvedEnvironment;
}) {
  if (!UUID_PATTERN.test(input.challengeId) || !TWO_FACTOR_CODE_PATTERN.test(input.code)) {
    throw new EmailTwoFactorError(
      "Informe o código de 6 dígitos enviado por e-mail.",
      400,
      "EMAIL_2FA_CODE_INVALID",
    );
  }

  if (!input.environment.emailTwoFactorSecret) {
    throw new EmailTwoFactorError(
      "A verificação por e-mail ainda não está disponível.",
      503,
      "EMAIL_2FA_EMAIL_CONFIG_MISSING",
    );
  }

  const challenge = await fetchChallenge(input.challengeId, input.environment);

  if (
    challenge.purpose !== input.purpose ||
    challenge.consumed_at ||
    (input.expectedUserId && challenge.user_id !== input.expectedUserId) ||
    (input.expectedEmail && challenge.email.toLowerCase() !== input.expectedEmail.toLowerCase())
  ) {
    throw new EmailTwoFactorError(
      "Esse código não é mais válido. Solicite um novo.",
      400,
      "EMAIL_2FA_CHALLENGE_INVALID",
    );
  }

  if (challenge.attempt_count >= TWO_FACTOR_MAX_ATTEMPTS) {
    throw new EmailTwoFactorError(
      "Esse código foi bloqueado após várias tentativas. Solicite um novo.",
      429,
      "EMAIL_2FA_ATTEMPTS_EXCEEDED",
    );
  }

  if (new Date(challenge.expires_at).getTime() <= Date.now()) {
    throw new EmailTwoFactorError(
      "O código expirou. Solicite um novo.",
      400,
      "EMAIL_2FA_CODE_EXPIRED",
    );
  }

  const expectedDigest = await hmacDigest(
    challenge.id,
    challenge.purpose,
    input.code,
    input.environment.emailTwoFactorSecret,
  );

  if (!constantTimeEqual(expectedDigest, challenge.code_digest)) {
    await incrementAttempts(challenge, input.environment);
    throw new EmailTwoFactorError(
      "Código incorreto. Confira o e-mail e tente novamente.",
      400,
      "EMAIL_2FA_CODE_MISMATCH",
    );
  }

  return challenge;
}

function sessionPayload(grant: SupabasePasswordGrant) {
  return {
    accessToken: grant.access_token,
    refreshToken: grant.refresh_token,
    expiresIn: typeof grant.expires_in === "number" ? grant.expires_in : null,
    expiresAt: typeof grant.expires_at === "number" ? grant.expires_at : null,
    tokenType: typeof grant.token_type === "string" ? grant.token_type : "bearer",
  };
}

async function parseRequestBody(request: Request) {
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new Error("invalid");
    }
    return body as Record<string, unknown>;
  } catch (cause) {
    throw new EmailTwoFactorError(
      "Dados inválidos.",
      400,
      "EMAIL_2FA_REQUEST_INVALID",
      cause,
    );
  }
}

export async function handlePasswordLoginRequest(
  request: Request,
  explicitEnvironment?: EmailTwoFactorEnvironment,
) {
  try {
    if (request.method !== "POST") {
      throw new EmailTwoFactorError("Método não permitido.", 405, "EMAIL_2FA_METHOD_NOT_ALLOWED");
    }
    ensureSameOrigin(request);
    const environment = resolveEnvironment(request, explicitEnvironment);
    requireCoreConfiguration(environment);
    const body = await parseRequestBody(request);
    const email = normalizeEmail(body["email"]);
    const password = normalizePassword(body["password"]);

    if (!email || !password) {
      throw new EmailTwoFactorError(
        "Informe e-mail e senha.",
        400,
        "EMAIL_2FA_LOGIN_INPUT_INVALID",
      );
    }

    const grant = await supabasePasswordGrant(email, password, environment);
    const profile = await fetchSecurityProfile(grant.user.id, environment);

    if (!profile.email_2fa_enabled) {
      return jsonResponse({ requiresTwoFactor: false, session: sessionPayload(grant) });
    }

    const challenge = await createAndSendChallenge({
      userId: grant.user.id,
      email: grant.user.email?.toLowerCase() || email,
      name: profile.full_name,
      purpose: "login",
      environment,
    });

    return jsonResponse({
      requiresTwoFactor: true,
      challengeId: challenge.challengeId,
      maskedEmail: maskEmail(grant.user.email?.toLowerCase() || email),
      expiresAt: challenge.expiresAt,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function handleVerifyPasswordLoginTwoFactorRequest(
  request: Request,
  explicitEnvironment?: EmailTwoFactorEnvironment,
) {
  try {
    if (request.method !== "POST") {
      throw new EmailTwoFactorError("Método não permitido.", 405, "EMAIL_2FA_METHOD_NOT_ALLOWED");
    }
    ensureSameOrigin(request);
    const environment = resolveEnvironment(request, explicitEnvironment);
    requireCoreConfiguration(environment);
    requireEmailTwoFactorConfiguration(environment);
    const body = await parseRequestBody(request);
    const email = normalizeEmail(body["email"]);
    const password = normalizePassword(body["password"]);
    const challengeId = typeof body["challengeId"] === "string" ? body["challengeId"] : "";
    const code = typeof body["code"] === "string" ? body["code"].trim() : "";

    if (!email || !password) {
      throw new EmailTwoFactorError(
        "Sua tentativa de acesso expirou. Informe a senha novamente.",
        400,
        "EMAIL_2FA_LOGIN_INPUT_INVALID",
      );
    }

    const challenge = await verifyChallenge({
      challengeId,
      code,
      purpose: "login",
      expectedEmail: email,
      environment,
    });

    const grant = await supabasePasswordGrant(email, password, environment);
    if (grant.user.id !== challenge.user_id) {
      throw new EmailTwoFactorError(
        "A verificação não corresponde a esta conta.",
        403,
        "EMAIL_2FA_LOGIN_USER_MISMATCH",
      );
    }

    const profile = await fetchSecurityProfile(grant.user.id, environment);
    if (!profile.email_2fa_enabled) {
      throw new EmailTwoFactorError(
        "A verificação em duas etapas não está ativa nesta conta.",
        400,
        "EMAIL_2FA_NOT_ENABLED",
      );
    }

    await consumeChallenge(challenge.id, environment);
    return jsonResponse({ requiresTwoFactor: false, session: sessionPayload(grant) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function handleStartEmailTwoFactorEnrollmentRequest(
  request: Request,
  explicitEnvironment?: EmailTwoFactorEnvironment,
) {
  try {
    if (request.method !== "POST") {
      throw new EmailTwoFactorError("Método não permitido.", 405, "EMAIL_2FA_METHOD_NOT_ALLOWED");
    }
    ensureSameOrigin(request);
    const environment = resolveEnvironment(request, explicitEnvironment);
    requireCoreConfiguration(environment);
    requireEmailTwoFactorConfiguration(environment);
    const user = await authenticateBearerUser(request, environment);
    const profile = await fetchSecurityProfile(user.id, environment);

    if (profile.email_2fa_enabled) {
      return jsonResponse({ alreadyEnabled: true });
    }

    const challenge = await createAndSendChallenge({
      userId: user.id,
      email: user.email,
      name: profile.full_name,
      purpose: "enroll",
      environment,
    });

    return jsonResponse({
      alreadyEnabled: false,
      challengeId: challenge.challengeId,
      maskedEmail: maskEmail(user.email),
      expiresAt: challenge.expiresAt,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function handleVerifyEmailTwoFactorEnrollmentRequest(
  request: Request,
  explicitEnvironment?: EmailTwoFactorEnvironment,
) {
  try {
    if (request.method !== "POST") {
      throw new EmailTwoFactorError("Método não permitido.", 405, "EMAIL_2FA_METHOD_NOT_ALLOWED");
    }
    ensureSameOrigin(request);
    const environment = resolveEnvironment(request, explicitEnvironment);
    requireCoreConfiguration(environment);
    requireEmailTwoFactorConfiguration(environment);
    const user = await authenticateBearerUser(request, environment);
    const body = await parseRequestBody(request);
    const challengeId = typeof body["challengeId"] === "string" ? body["challengeId"] : "";
    const code = typeof body["code"] === "string" ? body["code"].trim() : "";

    const challenge = await verifyChallenge({
      challengeId,
      code,
      purpose: "enroll",
      expectedUserId: user.id,
      expectedEmail: user.email,
      environment,
    });

    if (!environment.supabaseUrl) {
      throw new EmailTwoFactorError(
        "A verificação por e-mail está indisponível.",
        503,
        "EMAIL_2FA_SUPABASE_CONFIG_MISSING",
      );
    }

    const profileEndpoint = new URL("/rest/v1/profiles", environment.supabaseUrl);
    profileEndpoint.searchParams.set("id", `eq.${user.id}`);
    const profileResponse = await fetch(profileEndpoint, {
      method: "PATCH",
      headers: serviceHeaders(environment),
      body: JSON.stringify({
        email_2fa_enabled: true,
        email_2fa_enabled_at: new Date().toISOString(),
        email_2fa_prompt_dismissed_at: null,
      }),
      signal: AbortSignal.timeout(8_000),
    });

    if (!profileResponse.ok) {
      throw new EmailTwoFactorError(
        "O código foi confirmado, mas não foi possível ativar a proteção.",
        502,
        "EMAIL_2FA_ENABLE_FAILED",
      );
    }

    await consumeChallenge(challenge.id, environment);
    return jsonResponse({ enabled: true });
  } catch (error) {
    return errorResponse(error);
  }
}
