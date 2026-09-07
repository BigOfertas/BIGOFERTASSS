import { supabase } from "@/integrations/supabase/client";
import { legacyWorkerFallbackAvailable } from "@/lib/backend-routing";
import { getUserFacingError } from "@/lib/user-facing-error";

export type AccountSecurityStatus = {
  email_2fa_enabled: boolean;
  email_2fa_enabled_at: string | null;
  email_2fa_prompt_dismissed_at: string | null;
};

type SecurityRpcResult<T> = Promise<{
  data: T | null;
  error: { message: string } | null;
}>;

type SecurityRpcClient = {
  rpc(name: "get_my_security_status"): SecurityRpcResult<AccountSecurityStatus[]>;
  rpc(name: "dismiss_my_email_2fa_prompt"): SecurityRpcResult<null>;
  rpc(name: "disable_my_email_2fa"): SecurityRpcResult<null>;
};

const securityRpc = supabase as unknown as SecurityRpcClient;

function authEdgeUrl() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
  return supabaseUrl ? `${supabaseUrl.replace(/\/$/, "")}/functions/v1/auth-email-2fa` : null;
}

async function postSecurityRequest(
  url: string,
  accessToken: string,
  body: Record<string, unknown>,
) {
  return fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

async function authenticatedRequest(input: {
  action: "enroll-start" | "enroll-verify";
  legacyPath: string;
  body?: Record<string, unknown>;
}) {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) {
    throw new Error("Entre novamente na sua conta para continuar.");
  }

  const accessToken = data.session.access_token;
  const body = input.body ?? {};
  const edgeUrl = authEdgeUrl();
  let response: Response;

  if (edgeUrl) {
    try {
      const edgeResponse = await postSecurityRequest(edgeUrl, accessToken, {
        action: input.action,
        ...body,
      });
      if (edgeResponse.status < 500 || !legacyWorkerFallbackAvailable()) {
        response = edgeResponse;
      } else {
        response = await postSecurityRequest(input.legacyPath, accessToken, body);
      }
    } catch (requestError) {
      if (!legacyWorkerFallbackAvailable()) throw requestError;
      response = await postSecurityRequest(input.legacyPath, accessToken, body);
    }
  } else if (legacyWorkerFallbackAvailable()) {
    response = await postSecurityRequest(input.legacyPath, accessToken, body);
  } else {
    throw new Error("A verificação de segurança está temporariamente indisponível.");
  }

  let payload: Record<string, unknown> | null = null;
  try {
    const decoded = await response.json();
    payload =
      decoded && typeof decoded === "object" && !Array.isArray(decoded)
        ? (decoded as Record<string, unknown>)
        : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message = payload && typeof payload["error"] === "string" ? payload["error"] : undefined;
    throw new Error(
      getUserFacingError(message, "Não foi possível concluir a verificação de segurança agora."),
    );
  }

  return payload ?? {};
}

export async function fetchAccountSecurityStatus() {
  const result = await securityRpc.rpc("get_my_security_status");
  if (result.error) {
    throw new Error(
      getUserFacingError(
        result.error,
        "Não foi possível carregar as opções de segurança da conta.",
      ),
    );
  }

  const status = result.data?.[0];
  if (!status) {
    throw new Error("Não foi possível carregar as opções de segurança da conta.");
  }

  return status;
}

export async function dismissEmailTwoFactorPrompt() {
  const result = await securityRpc.rpc("dismiss_my_email_2fa_prompt");
  if (result.error) {
    throw new Error(getUserFacingError(result.error, "Não foi possível salvar sua escolha."));
  }
}

export async function disableEmailTwoFactor() {
  const result = await securityRpc.rpc("disable_my_email_2fa");
  if (result.error) {
    throw new Error(
      getUserFacingError(
        result.error,
        "Não foi possível desativar a verificação em duas etapas agora.",
      ),
    );
  }
}

export async function startEmailTwoFactorEnrollment() {
  const payload = await authenticatedRequest({
    action: "enroll-start",
    legacyPath: "/api/auth/email-2fa/enroll/start",
  });

  if (payload["alreadyEnabled"] === true) {
    return { alreadyEnabled: true as const };
  }

  if (
    typeof payload["challengeId"] !== "string" ||
    typeof payload["maskedEmail"] !== "string" ||
    typeof payload["expiresAt"] !== "string"
  ) {
    throw new Error("Não foi possível iniciar a verificação em duas etapas. Tente novamente.");
  }

  return {
    alreadyEnabled: false as const,
    challengeId: payload["challengeId"],
    maskedEmail: payload["maskedEmail"],
    expiresAt: payload["expiresAt"],
  };
}

export async function verifyEmailTwoFactorEnrollment(challengeId: string, code: string) {
  const payload = await authenticatedRequest({
    action: "enroll-verify",
    legacyPath: "/api/auth/email-2fa/enroll/verify",
    body: { challengeId, code },
  });

  if (payload["enabled"] !== true) {
    throw new Error("Não foi possível ativar a verificação em duas etapas. Tente novamente.");
  }
}

export async function sendAccountPasswordReset(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) {
    throw new Error("Não foi possível identificar o e-mail da sua conta.");
  }

  const redirectTo =
    typeof window !== "undefined"
      ? new URL("/redefinir-senha", window.location.origin).toString()
      : undefined;

  const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
    ...(redirectTo ? { redirectTo } : {}),
  });

  if (error) {
    throw new Error(
      getUserFacingError(error, "Não foi possível enviar o link para redefinir a senha agora."),
    );
  }
}

export async function signOutOtherAccountSessions() {
  const { error } = await supabase.auth.signOut({ scope: "others" });
  if (error) {
    throw new Error(
      getUserFacingError(error, "Não foi possível encerrar as outras sessões agora."),
    );
  }
}
