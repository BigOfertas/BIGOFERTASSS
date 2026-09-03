import { supabase } from "@/integrations/supabase/client";
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
};

const securityRpc = supabase as unknown as SecurityRpcClient;

async function authenticatedRequest(path: string, body?: unknown) {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) {
    throw new Error("Entre novamente na sua conta para continuar.");
  }

  const response = await fetch(path, {
    method: "POST",
    headers: {
      authorization: `Bearer ${data.session.access_token}`,
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify(body ?? {}),
  });

  let payload: Record<string, unknown> | null = null;
  try {
    const decoded = await response.json();
    payload = decoded && typeof decoded === "object" && !Array.isArray(decoded)
      ? (decoded as Record<string, unknown>)
      : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message =
      payload && typeof payload["error"] === "string" ? payload["error"] : undefined;
    throw new Error(
      getUserFacingError(
        message,
        "Não foi possível concluir a verificação de segurança agora.",
      ),
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

export async function startEmailTwoFactorEnrollment() {
  const payload = await authenticatedRequest("/api/auth/email-2fa/enroll/start");

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

export async function verifyEmailTwoFactorEnrollment(
  challengeId: string,
  code: string,
) {
  const payload = await authenticatedRequest("/api/auth/email-2fa/enroll/verify", {
    challengeId,
    code,
  });

  if (payload["enabled"] !== true) {
    throw new Error("Não foi possível ativar a verificação em duas etapas. Tente novamente.");
  }
}
