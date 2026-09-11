import { corsHeaders } from "../_shared/http.ts";

const RESEND_EMAILS_URL = "https://api.resend.com/emails";
const DEFAULT_FROM = "DropBox <contato@bigofertas.net>";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_PATTERN = /^\d{6}$/;
const TWO_FACTOR_TTL_MS = 10 * 60 * 1000;
const TWO_FACTOR_RESEND_WINDOW_MS = 60 * 1000;
const TWO_FACTOR_MAX_ATTEMPTS = 5;

type Action = "password-login" | "password-login-verify-2fa" | "enroll-start" | "enroll-verify";

type ChallengePurpose = "enroll" | "login";

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

type SecurityProfile = {
  id: string;
  email: string | null;
  full_name: string | null;
  email_2fa_enabled: boolean;
  email_2fa_enabled_at: string | null;
  email_2fa_prompt_dismissed_at: string | null;
};

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

class EmailTwoFactorError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly causeForLog?: unknown,
  ) {
    super(message);
    this.name = "EmailTwoFactorError";
  }
}

function env(name: string, fallback?: string) {
  const value = Deno.env.get(name)?.trim() || fallback?.trim();
  if (!value) {
    throw new EmailTwoFactorError(
      "O acesso à conta está temporariamente indisponível.",
      503,
      `EMAIL_2FA_${name}_MISSING`,
    );
  }
  return value;
}

function publishableKey() {
  return (
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY")?.trim() ||
    Deno.env.get("SUPABASE_ANON_KEY")?.trim() ||
    env("SUPABASE_PUBLISHABLE_KEY")
  );
}

function serviceHeaders() {
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  return {
    apikey: key,
    authorization: `Bearer ${key}`,
    accept: "application/json",
    "content-type": "application/json",
  };
}

function configuredOrigins() {
  return (Deno.env.get("APP_ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function ensureAllowedOrigin(request: Request) {
  const origin = request.headers.get("origin")?.trim();
  const allowed = configuredOrigins();
  if (origin && allowed.length > 0 && !allowed.includes(origin)) {
    throw new EmailTwoFactorError(
      "Origem da requisição não permitida.",
      403,
      "EMAIL_2FA_ORIGIN_FORBIDDEN",
    );
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

function errorResponse(request: Request, error: unknown) {
  if (error instanceof EmailTwoFactorError) {
    console.error(`[email-2fa-edge] ${JSON.stringify({ code: error.code, status: error.status })}`);
    return response(request, { error: error.message, code: error.code }, error.status);
  }

  console.error(error);
  return response(
    request,
    {
      error: "Não foi possível concluir a verificação de segurança agora.",
      code: "EMAIL_2FA_INTERNAL_ERROR",
    },
    500,
  );
}

async function readJson(upstream: Response, code: string) {
  try {
    return await upstream.json();
  } catch (cause) {
    throw new EmailTwoFactorError(
      "Um serviço necessário retornou uma resposta inválida.",
      502,
      code,
      cause,
    );
  }
}

async function parseBody(request: Request) {
  try {
    const value = await request.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid");
    return value as Record<string, unknown>;
  } catch (cause) {
    throw new EmailTwoFactorError("Dados inválidos.", 400, "EMAIL_2FA_REQUEST_INVALID", cause);
  }
}

function normalizeEmail(value: unknown) {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return EMAIL_PATTERN.test(email) && email.length <= 320 ? email : null;
}

function normalizePassword(value: unknown) {
  return typeof value === "string" && value.length >= 6 && value.length <= 512 ? value : null;
}

function maskEmail(email: string) {
  const [localPart, domain] = email.split("@");
  if (!localPart || !domain) return email;
  const visible = localPart.slice(0, Math.min(2, localPart.length));
  return `${visible}${"*".repeat(Math.max(2, localPart.length - visible.length))}@${domain}`;
}

async function passwordGrant(email: string, password: string): Promise<SupabasePasswordGrant> {
  const endpoint = new URL("/auth/v1/token", env("SUPABASE_URL"));
  endpoint.searchParams.set("grant_type", "password");

  let upstream: Response;
  try {
    upstream = await fetch(endpoint, {
      method: "POST",
      headers: {
        apikey: publishableKey(),
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

  const payload = (await readJson(upstream, "EMAIL_2FA_PASSWORD_PARSE_ERROR")) as Record<
    string,
    unknown
  >;

  if (!upstream.ok) {
    const source = [payload.error_code, payload.msg, payload.message, payload.error_description]
      .filter((item): item is string => typeof item === "string")
      .join(" ")
      .toLowerCase();

    if (source.includes("email_not_confirmed") || source.includes("email not confirmed")) {
      throw new EmailTwoFactorError(
        "Confirme seu e-mail antes de entrar. Use o link enviado pela DropBox.",
        403,
        "EMAIL_NOT_CONFIRMED",
      );
    }

    throw new EmailTwoFactorError("E-mail ou senha incorretos.", 401, "INVALID_LOGIN_CREDENTIALS");
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

  const confirmedAt = (user as { email_confirmed_at?: unknown }).email_confirmed_at;
  if (typeof confirmedAt !== "string" || !confirmedAt) {
    throw new EmailTwoFactorError(
      "Confirme seu e-mail antes de entrar. Use o link enviado pela DropBox.",
      403,
      "EMAIL_NOT_CONFIRMED",
    );
  }

  return payload as unknown as SupabasePasswordGrant;
}

async function authenticatedUser(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    throw new EmailTwoFactorError(
      "Entre na sua conta para continuar.",
      401,
      "EMAIL_2FA_AUTH_REQUIRED",
    );
  }

  const upstream = await fetch(new URL("/auth/v1/user", env("SUPABASE_URL")), {
    headers: {
      apikey: publishableKey(),
      authorization,
      accept: "application/json",
    },
    signal: AbortSignal.timeout(8_000),
  });

  if (!upstream.ok) {
    throw new EmailTwoFactorError(
      "Sua sessão expirou. Entre novamente para continuar.",
      401,
      "EMAIL_2FA_AUTH_INVALID",
    );
  }

  const payload = (await readJson(upstream, "EMAIL_2FA_AUTH_PARSE_ERROR")) as Record<
    string,
    unknown
  >;
  const email = normalizeEmail(payload.email);
  if (
    typeof payload.id !== "string" ||
    !UUID_PATTERN.test(payload.id) ||
    !email ||
    typeof payload.email_confirmed_at !== "string" ||
    !payload.email_confirmed_at
  ) {
    throw new EmailTwoFactorError(
      "Sua conta ainda não está pronta para esta verificação.",
      403,
      "EMAIL_2FA_AUTH_INVALID",
    );
  }

  return { id: payload.id, email };
}

async function securityProfile(userId: string): Promise<SecurityProfile> {
  const endpoint = new URL("/rest/v1/profiles", env("SUPABASE_URL"));
  endpoint.searchParams.set(
    "select",
    "id,email,full_name,email_2fa_enabled,email_2fa_enabled_at,email_2fa_prompt_dismissed_at",
  );
  endpoint.searchParams.set("id", `eq.${userId}`);
  endpoint.searchParams.set("limit", "1");

  const upstream = await fetch(endpoint, {
    headers: serviceHeaders(),
    signal: AbortSignal.timeout(8_000),
  });
  const payload = await readJson(upstream, "EMAIL_2FA_PROFILE_PARSE_ERROR");

  if (!upstream.ok || !Array.isArray(payload) || payload.length !== 1) {
    throw new EmailTwoFactorError(
      "Não foi possível carregar as configurações de segurança.",
      502,
      "EMAIL_2FA_PROFILE_NOT_FOUND",
    );
  }
  return payload[0] as SecurityProfile;
}

async function hmacDigest(challengeId: string, purpose: ChallengePurpose, code: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(env("EMAIL_2FA_SECRET")),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${challengeId}:${purpose}:${code}`),
  );
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(left: string, right: string) {
  const maxLength = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < maxLength; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

function generateCode() {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return String(values[0]! % 1_000_000).padStart(6, "0");
}

async function ensureSendRate(userId: string, purpose: ChallengePurpose) {
  const endpoint = new URL("/rest/v1/email_2fa_challenges", env("SUPABASE_URL"));
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

  const upstream = await fetch(endpoint, {
    headers: serviceHeaders(),
    signal: AbortSignal.timeout(8_000),
  });
  const payload = await readJson(upstream, "EMAIL_2FA_RATE_PARSE_ERROR");
  if (!upstream.ok) {
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

async function insertChallenge(userId: string, email: string, purpose: ChallengePurpose) {
  env("EMAIL_2FA_SECRET");
  await ensureSendRate(userId, purpose);

  const challengeId = crypto.randomUUID();
  const code = generateCode();
  const codeDigest = await hmacDigest(challengeId, purpose, code);
  const expiresAt = new Date(Date.now() + TWO_FACTOR_TTL_MS).toISOString();

  const upstream = await fetch(new URL("/rest/v1/email_2fa_challenges", env("SUPABASE_URL")), {
    method: "POST",
    headers: { ...serviceHeaders(), prefer: "return=minimal" },
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

  if (!upstream.ok) {
    throw new EmailTwoFactorError(
      "Não foi possível preparar o código de segurança.",
      502,
      "EMAIL_2FA_CHALLENGE_CREATE_FAILED",
    );
  }
  return { challengeId, code, expiresAt };
}

async function consumeChallenge(challengeId: string) {
  const endpoint = new URL("/rest/v1/email_2fa_challenges", env("SUPABASE_URL"));
  endpoint.searchParams.set("id", `eq.${challengeId}`);
  endpoint.searchParams.set("consumed_at", "is.null");
  const upstream = await fetch(endpoint, {
    method: "PATCH",
    headers: { ...serviceHeaders(), prefer: "return=representation" },
    body: JSON.stringify({ consumed_at: new Date().toISOString() }),
    signal: AbortSignal.timeout(8_000),
  });
  const payload = await readJson(upstream, "EMAIL_2FA_CONSUME_PARSE_ERROR");
  if (!upstream.ok || !Array.isArray(payload) || payload.length !== 1) {
    throw new EmailTwoFactorError(
      "Esse código já foi usado. Solicite um novo.",
      400,
      "EMAIL_2FA_CHALLENGE_ALREADY_USED",
    );
  }
}

async function sendCode(input: {
  challengeId: string;
  email: string;
  code: string;
  purpose: ChallengePurpose;
  name: string | null;
}) {
  const apiKey = env("RESEND_API_KEY");
  const name = input.name?.trim().split(/\s+/)[0] || "cliente";
  const title =
    input.purpose === "enroll"
      ? "Confirme a ativação da verificação em duas etapas"
      : "Confirme seu acesso à DropBox";

  let upstream: Response;
  try {
    upstream = await fetch(RESEND_EMAILS_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        accept: "application/json",
        "user-agent": "DropBox/1.0",
        "Idempotency-Key": `email-2fa/${input.purpose}/${input.challengeId}`,
      },
      body: JSON.stringify({
        from: Deno.env.get("RESEND_FROM")?.trim() || DEFAULT_FROM,
        to: [input.email],
        template: {
          id: "security-2fa-code",
          variables: {
            FIRST_NAMe: name,
            CODE: input.code,
            ACTION_TITLE: title,
          },
        },
        tags: [{ name: "event", value: `two_factor_${input.purpose}` }],
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

  if (!upstream.ok) {
    const providerBody = await upstream.text().catch(() => "");
    console.error(
      `[email-2fa-edge] ${JSON.stringify({ code: "EMAIL_2FA_RESEND_FAILED", status: upstream.status, provider: providerBody.slice(0, 300) })}`,
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
}) {
  env("EMAIL_2FA_SECRET");
  env("RESEND_API_KEY");
  const challenge = await insertChallenge(input.userId, input.email, input.purpose);
  try {
    await sendCode({ ...challenge, email: input.email, name: input.name, purpose: input.purpose });
  } catch (error) {
    await consumeChallenge(challenge.challengeId).catch(() => undefined);
    throw error;
  }
  return challenge;
}

async function fetchChallenge(challengeId: string): Promise<ChallengeRow> {
  const endpoint = new URL("/rest/v1/email_2fa_challenges", env("SUPABASE_URL"));
  endpoint.searchParams.set(
    "select",
    "id,user_id,email,purpose,code_digest,expires_at,attempt_count,consumed_at,created_at",
  );
  endpoint.searchParams.set("id", `eq.${challengeId}`);
  endpoint.searchParams.set("limit", "1");
  const upstream = await fetch(endpoint, {
    headers: serviceHeaders(),
    signal: AbortSignal.timeout(8_000),
  });
  const payload = await readJson(upstream, "EMAIL_2FA_CHALLENGE_PARSE_ERROR");
  if (!upstream.ok || !Array.isArray(payload) || payload.length !== 1) {
    throw new EmailTwoFactorError(
      "Esse código não é mais válido. Solicite um novo.",
      400,
      "EMAIL_2FA_CHALLENGE_INVALID",
    );
  }
  return payload[0] as ChallengeRow;
}

async function incrementAttempts(challenge: ChallengeRow) {
  const endpoint = new URL("/rest/v1/email_2fa_challenges", env("SUPABASE_URL"));
  endpoint.searchParams.set("id", `eq.${challenge.id}`);
  endpoint.searchParams.set("consumed_at", "is.null");
  await fetch(endpoint, {
    method: "PATCH",
    headers: serviceHeaders(),
    body: JSON.stringify({
      attempt_count: Math.min(TWO_FACTOR_MAX_ATTEMPTS, challenge.attempt_count + 1),
    }),
    signal: AbortSignal.timeout(8_000),
  }).catch(() => undefined);
}

async function verifyChallenge(input: {
  challengeId: string;
  code: string;
  purpose: ChallengePurpose;
  expectedUserId?: string;
  expectedEmail?: string;
}) {
  if (!UUID_PATTERN.test(input.challengeId) || !CODE_PATTERN.test(input.code)) {
    throw new EmailTwoFactorError(
      "Informe o código de 6 dígitos enviado por e-mail.",
      400,
      "EMAIL_2FA_CODE_INVALID",
    );
  }

  const challenge = await fetchChallenge(input.challengeId);
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

  const expectedDigest = await hmacDigest(challenge.id, challenge.purpose, input.code);
  if (!constantTimeEqual(expectedDigest, challenge.code_digest)) {
    await incrementAttempts(challenge);
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

async function passwordLogin(body: Record<string, unknown>) {
  const email = normalizeEmail(body.email);
  const password = normalizePassword(body.password);
  if (!email || !password) {
    throw new EmailTwoFactorError("Informe e-mail e senha.", 400, "EMAIL_2FA_LOGIN_INPUT_INVALID");
  }

  const grant = await passwordGrant(email, password);
  const profile = await securityProfile(grant.user.id);
  if (!profile.email_2fa_enabled) {
    return { requiresTwoFactor: false, session: sessionPayload(grant) };
  }

  const confirmedEmail = grant.user.email?.toLowerCase() || email;
  const challenge = await createAndSendChallenge({
    userId: grant.user.id,
    email: confirmedEmail,
    name: profile.full_name,
    purpose: "login",
  });
  return {
    requiresTwoFactor: true,
    challengeId: challenge.challengeId,
    maskedEmail: maskEmail(confirmedEmail),
    expiresAt: challenge.expiresAt,
  };
}

async function verifyPasswordLogin(body: Record<string, unknown>) {
  const email = normalizeEmail(body.email);
  const password = normalizePassword(body.password);
  const challengeId = typeof body.challengeId === "string" ? body.challengeId : "";
  const code = typeof body.code === "string" ? body.code.trim() : "";
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
  });
  const grant = await passwordGrant(email, password);
  if (grant.user.id !== challenge.user_id) {
    throw new EmailTwoFactorError(
      "A verificação não corresponde a esta conta.",
      403,
      "EMAIL_2FA_LOGIN_USER_MISMATCH",
    );
  }
  const profile = await securityProfile(grant.user.id);
  if (!profile.email_2fa_enabled) {
    throw new EmailTwoFactorError(
      "A verificação em duas etapas não está ativa nesta conta.",
      400,
      "EMAIL_2FA_NOT_ENABLED",
    );
  }
  await consumeChallenge(challenge.id);
  return { requiresTwoFactor: false, session: sessionPayload(grant) };
}

async function enrollStart(request: Request) {
  const user = await authenticatedUser(request);
  const profile = await securityProfile(user.id);
  if (profile.email_2fa_enabled) return { alreadyEnabled: true };

  const challenge = await createAndSendChallenge({
    userId: user.id,
    email: user.email,
    name: profile.full_name,
    purpose: "enroll",
  });
  return {
    alreadyEnabled: false,
    challengeId: challenge.challengeId,
    maskedEmail: maskEmail(user.email),
    expiresAt: challenge.expiresAt,
  };
}

async function enrollVerify(request: Request, body: Record<string, unknown>) {
  const user = await authenticatedUser(request);
  const challengeId = typeof body.challengeId === "string" ? body.challengeId : "";
  const code = typeof body.code === "string" ? body.code.trim() : "";
  const challenge = await verifyChallenge({
    challengeId,
    code,
    purpose: "enroll",
    expectedUserId: user.id,
    expectedEmail: user.email,
  });

  const endpoint = new URL("/rest/v1/profiles", env("SUPABASE_URL"));
  endpoint.searchParams.set("id", `eq.${user.id}`);
  const upstream = await fetch(endpoint, {
    method: "PATCH",
    headers: serviceHeaders(),
    body: JSON.stringify({
      email_2fa_enabled: true,
      email_2fa_enabled_at: new Date().toISOString(),
      email_2fa_prompt_dismissed_at: null,
    }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!upstream.ok) {
    throw new EmailTwoFactorError(
      "O código foi confirmado, mas não foi possível ativar a proteção.",
      502,
      "EMAIL_2FA_ENABLE_FAILED",
    );
  }
  await consumeChallenge(challenge.id);
  return { enabled: true };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }

  try {
    if (request.method !== "POST") {
      throw new EmailTwoFactorError("Método não permitido.", 405, "EMAIL_2FA_METHOD_NOT_ALLOWED");
    }
    ensureAllowedOrigin(request);
    env("SUPABASE_URL");
    env("SUPABASE_SERVICE_ROLE_KEY");
    publishableKey();

    const body = await parseBody(request);
    const action = body.action;
    if (
      action !== "password-login" &&
      action !== "password-login-verify-2fa" &&
      action !== "enroll-start" &&
      action !== "enroll-verify"
    ) {
      throw new EmailTwoFactorError("Ação de segurança inválida.", 400, "EMAIL_2FA_ACTION_INVALID");
    }

    let result: unknown;
    switch (action as Action) {
      case "password-login":
        result = await passwordLogin(body);
        break;
      case "password-login-verify-2fa":
        result = await verifyPasswordLogin(body);
        break;
      case "enroll-start":
        result = await enrollStart(request);
        break;
      case "enroll-verify":
        result = await enrollVerify(request, body);
        break;
    }

    return response(request, result);
  } catch (error) {
    return errorResponse(request, error);
  }
});
