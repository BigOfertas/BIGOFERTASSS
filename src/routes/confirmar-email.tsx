import { Link, createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Loader2, MailWarning, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AuthSplitShell } from "@/components/ui/auth-split-shell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/confirmar-email")({
  component: ConfirmEmailPage,
});

type ConfirmationState = "verifying" | "success" | "expired" | "error";

const TRANSIENT_RETRY_DELAYS_MS = [0, 1_200, 2_500] as const;

function wait(delayMs: number) {
  if (delayMs <= 0) return Promise.resolve();
  return new Promise<void>((resolve) => window.setTimeout(resolve, delayMs));
}

function isTransientConfirmationError(error: unknown) {
  if (!error || typeof error !== "object") return true;

  const candidate = error as {
    status?: number;
    message?: string;
    name?: string;
  };
  const status = typeof candidate.status === "number" ? candidate.status : 0;
  const source = `${candidate.name ?? ""} ${candidate.message ?? ""}`.toLowerCase();

  return (
    status === 0 ||
    status >= 500 ||
    source.includes("gateway") ||
    source.includes("timeout") ||
    source.includes("timed out") ||
    source.includes("fetch") ||
    source.includes("network")
  );
}

function isExpiredConfirmationError(error: unknown) {
  if (!error || typeof error !== "object") return false;

  const candidate = error as {
    code?: string;
    message?: string;
  };
  const source = `${candidate.code ?? ""} ${candidate.message ?? ""}`.toLowerCase();

  return (
    source.includes("otp_expired") ||
    source.includes("token has expired") ||
    source.includes("token is expired") ||
    source.includes("invalid token") ||
    source.includes("token has been used")
  );
}

function ConfirmEmailPage() {
  const tokenHash = useMemo(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("token_hash")?.trim() ?? "";
  }, []);
  const tokenHashRef = useRef(tokenHash);
  const [state, setState] = useState<ConfirmationState>(tokenHash ? "verifying" : "expired");
  const [attempt, setAttempt] = useState(0);
  const [running, setRunning] = useState(false);

  const verifyConfirmation = useCallback(async () => {
    const currentTokenHash = tokenHashRef.current;
    if (!currentTokenHash || running) return;

    setRunning(true);
    setState("verifying");

    let finalError: unknown = null;

    for (let index = 0; index < TRANSIENT_RETRY_DELAYS_MS.length; index += 1) {
      const delay = TRANSIENT_RETRY_DELAYS_MS[index] ?? 0;
      if (delay > 0) await wait(delay);

      setAttempt(index + 1);

      const { error } = await supabase.auth.verifyOtp({
        token_hash: currentTokenHash,
        type: "email",
      });

      if (!error) {
        setState("success");
        setRunning(false);

        if (typeof window !== "undefined") {
          window.history.replaceState(null, "", "/confirmar-email");
          window.setTimeout(() => {
            window.location.replace("/conta?email_confirmado=1");
          }, 900);
        }
        return;
      }

      finalError = error;
      if (!isTransientConfirmationError(error)) break;
    }

    setRunning(false);
    setState(isExpiredConfirmationError(finalError) ? "expired" : "error");
  }, [running]);

  useEffect(() => {
    if (!tokenHashRef.current) return;
    void verifyConfirmation();
  }, [verifyConfirmation]);

  const content = (() => {
    if (state === "success") {
      return {
        eyebrow: "E-mail confirmado",
        title: "Sua conta está pronta",
        description: "Confirmação concluída com segurança. Estamos abrindo sua conta DropBox.",
        icon: <CheckCircle2 className="h-7 w-7" aria-hidden="true" />,
        iconClass: "bg-emerald-50 text-emerald-700",
      };
    }

    if (state === "expired") {
      return {
        eyebrow: "Link de confirmação",
        title: "Este link não está mais disponível",
        description:
          "Ele pode ter expirado ou já ter sido usado. Se você já confirmou a conta, tente entrar normalmente.",
        icon: <MailWarning className="h-7 w-7" aria-hidden="true" />,
        iconClass: "bg-amber-50 text-amber-700",
      };
    }

    if (state === "error") {
      return {
        eyebrow: "Confirmação protegida",
        title: "Não conseguimos confirmar agora",
        description:
          "O serviço de autenticação demorou para responder. Sua conta não foi perdida; você pode tentar novamente por esta mesma tela.",
        icon: <RefreshCw className="h-7 w-7" aria-hidden="true" />,
        iconClass: "bg-red-50 text-red-700",
      };
    }

    return {
      eyebrow: "Confirmando e-mail",
      title: "Só um instante",
      description:
        "Estamos validando seu cadastro com segurança. Se o serviço oscilar, a DropBox tenta novamente automaticamente.",
      icon: <Loader2 className="h-7 w-7 animate-spin motion-reduce:animate-none" aria-hidden="true" />,
      iconClass: "bg-gray-100 text-gray-800",
    };
  })();

  return (
    <AuthSplitShell
      mode="signup"
      eyebrow={content.eyebrow}
      title={content.title}
      description={content.description}
      footer={
        <p className="text-xs leading-5 text-gray-400">
          A confirmação acontece dentro do site oficial da DropBox.
        </p>
      }
    >
      <div className="auth-form-card rounded-[1.25rem] p-6 text-center sm:p-7">
        <span
          className={`mx-auto flex h-14 w-14 items-center justify-center rounded-xl ${content.iconClass}`}
        >
          {content.icon}
        </span>

        {state === "verifying" ? (
          <>
            <p className="mt-4 text-sm font-bold text-gray-900">Validando seu cadastro…</p>
            <p className="mt-1.5 text-xs leading-5 text-gray-400">
              {attempt > 1
                ? `Nova tentativa segura ${attempt} de ${TRANSIENT_RETRY_DELAYS_MS.length}.`
                : "Isso normalmente leva apenas alguns segundos."}
            </p>
          </>
        ) : null}

        {state === "success" ? (
          <p className="mt-4 text-sm leading-6 text-gray-500">
            Tudo certo. Você será direcionado automaticamente para sua conta.
          </p>
        ) : null}

        {state === "error" ? (
          <div className="mt-6 space-y-2.5">
            <button
              type="button"
              onClick={() => void verifyConfirmation()}
              disabled={running}
              className="premium-action flex h-12 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-black disabled:opacity-60"
            >
              {running ? (
                <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Tentar novamente
            </button>
            <Link
              to="/login"
              className="flex h-11 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-bold text-gray-700 transition hover:bg-gray-50"
            >
              Ir para entrar
            </Link>
          </div>
        ) : null}

        {state === "expired" ? (
          <div className="mt-6 space-y-2.5">
            <Link
              to="/login"
              className="premium-action flex h-12 items-center justify-center rounded-xl px-4 text-sm font-black"
            >
              Tentar entrar
            </Link>
            <Link
              to="/cadastro"
              className="flex h-11 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-bold text-gray-700 transition hover:bg-gray-50"
            >
              Voltar ao cadastro
            </Link>
          </div>
        ) : null}
      </div>
    </AuthSplitShell>
  );
}
