import { CheckCircle2, KeyRound, Loader2, MailCheck, ShieldCheck, X } from "lucide-react";
import { useEffect, useState } from "react";

import {
  dismissEmailTwoFactorPrompt,
  fetchAccountSecurityStatus,
  startEmailTwoFactorEnrollment,
  verifyEmailTwoFactorEnrollment,
} from "@/lib/account-security";
import { getUserFacingError } from "@/lib/user-facing-error";

type PromptMode = "prompt" | "code" | "success";

export function EmailTwoFactorPrompt() {
  const [visible, setVisible] = useState(false);
  const [mode, setMode] = useState<PromptMode>("prompt");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [challengeId, setChallengeId] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [code, setCode] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;

    void fetchAccountSecurityStatus()
      .then((status) => {
        if (!active) return;
        setVisible(
          !status.email_2fa_enabled && !status.email_2fa_prompt_dismissed_at,
        );
      })
      .catch((error) => {
        console.error("Falha ao carregar a sugestão de segurança da conta:", error);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function handleDismiss() {
    if (busy) return;
    setBusy(true);
    setErrorMessage("");
    try {
      await dismissEmailTwoFactorPrompt();
      setVisible(false);
    } catch (error) {
      setErrorMessage(getUserFacingError(error, "Não foi possível salvar sua escolha."));
    } finally {
      setBusy(false);
    }
  }

  async function handleStartEnrollment() {
    if (busy) return;
    setBusy(true);
    setErrorMessage("");
    try {
      const result = await startEmailTwoFactorEnrollment();
      if (result.alreadyEnabled) {
        setMode("success");
        return;
      }

      setChallengeId(result.challengeId);
      setMaskedEmail(result.maskedEmail);
      setExpiresAt(result.expiresAt);
      setCode("");
      setMode("code");
    } catch (error) {
      setErrorMessage(getUserFacingError(error, "Não foi possível enviar o código agora."));
    } finally {
      setBusy(false);
    }
  }

  async function handleVerify() {
    const normalizedCode = code.replace(/\D/g, "").slice(0, 6);
    if (normalizedCode.length !== 6 || !challengeId || busy) return;

    setBusy(true);
    setErrorMessage("");
    try {
      await verifyEmailTwoFactorEnrollment(challengeId, normalizedCode);
      setMode("success");
    } catch (error) {
      setErrorMessage(getUserFacingError(error, "Não foi possível confirmar o código agora."));
    } finally {
      setBusy(false);
    }
  }

  if (loading || !visible) return null;

  const expiresLabel = expiresAt
    ? new Intl.DateTimeFormat("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(expiresAt))
    : null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 px-4 py-8 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="email-2fa-title"
    >
      <div className="relative w-full max-w-lg overflow-hidden rounded-[28px] border border-white/70 bg-white shadow-2xl shadow-black/20">
        <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-red-600 via-red-500 to-emerald-500" />

        {mode !== "success" ? (
          <button
            type="button"
            onClick={() => void handleDismiss()}
            disabled={busy}
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 disabled:opacity-40"
            aria-label="Fazer depois"
          >
            <X className="h-5 w-5" />
          </button>
        ) : null}

        <div className="p-6 sm:p-8">
          {mode === "prompt" ? (
            <>
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                <ShieldCheck className="h-7 w-7" aria-hidden="true" />
              </span>

              <p className="mt-6 text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
                Segurança da conta
              </p>
              <h2 id="email-2fa-title" className="mt-2 text-2xl font-black tracking-tight text-gray-950 sm:text-3xl">
                Proteja ainda mais sua conta
              </h2>
              <p className="mt-3 text-sm leading-6 text-gray-600">
                Ative a verificação em duas etapas. Quando você entrar, além da senha, a BIGofertas pedirá um código enviado para o seu e-mail.
              </p>

              <div className="mt-5 space-y-3 rounded-2xl bg-gray-50 p-4 text-sm text-gray-700">
                <p className="flex items-start gap-2.5">
                  <MailCheck className="mt-0.5 h-4 w-4 flex-none text-emerald-700" />
                  Código de 6 dígitos enviado por e-mail.
                </p>
                <p className="flex items-start gap-2.5">
                  <KeyRound className="mt-0.5 h-4 w-4 flex-none text-emerald-700" />
                  Ajuda a proteger a conta mesmo se alguém descobrir sua senha.
                </p>
              </div>

              {errorMessage ? (
                <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {errorMessage}
                </p>
              ) : null}

              <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto]">
                <button
                  type="button"
                  onClick={() => void handleStartEnrollment()}
                  disabled={busy}
                  className="inline-flex h-12 items-center justify-center rounded-xl bg-red-600 px-5 text-sm font-black text-white transition hover:bg-red-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                  Ativar verificação em duas etapas
                </button>
                <button
                  type="button"
                  onClick={() => void handleDismiss()}
                  disabled={busy}
                  className="h-12 rounded-xl border border-gray-200 px-5 text-sm font-bold text-gray-600 transition hover:bg-gray-50 hover:text-gray-900 disabled:opacity-60"
                >
                  Agora não
                </button>
              </div>

              <p className="mt-4 text-center text-[11px] leading-5 text-gray-400">
                É opcional. Você poderá ativar essa proteção depois nas configurações da conta.
              </p>
            </>
          ) : null}

          {mode === "code" ? (
            <>
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600">
                <MailCheck className="h-7 w-7" aria-hidden="true" />
              </span>
              <p className="mt-6 text-xs font-black uppercase tracking-[0.14em] text-red-600">
                Confirme seu e-mail
              </p>
              <h2 id="email-2fa-title" className="mt-2 text-2xl font-black tracking-tight text-gray-950">
                Digite o código enviado
              </h2>
              <p className="mt-3 text-sm leading-6 text-gray-600">
                Enviamos um código de segurança para <strong className="text-gray-950">{maskedEmail}</strong>.
              </p>

              <label className="mt-6 block text-sm font-bold text-gray-800" htmlFor="enroll-2fa-code">
                Código de 6 dígitos
              </label>
              <input
                id="enroll-2fa-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                maxLength={6}
                value={code}
                onChange={(event) => {
                  setCode(event.target.value.replace(/\D/g, "").slice(0, 6));
                  if (errorMessage) setErrorMessage("");
                }}
                className="mt-2 h-14 w-full rounded-xl border border-gray-200 bg-white px-4 text-center text-2xl font-black tracking-[0.35em] text-gray-950 outline-none transition focus:border-red-400 focus:ring-4 focus:ring-red-50"
                placeholder="000000"
              />
              <p className="mt-2 text-xs text-gray-500">
                {expiresLabel ? `O código expira por volta de ${expiresLabel}.` : "O código expira em 10 minutos."}
              </p>

              {errorMessage ? (
                <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {errorMessage}
                </p>
              ) : null}

              <button
                type="button"
                onClick={() => void handleVerify()}
                disabled={busy || code.length !== 6}
                className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-xl bg-red-600 px-5 text-sm font-black text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
                Confirmar e ativar
              </button>

              <button
                type="button"
                onClick={() => void handleDismiss()}
                disabled={busy}
                className="mt-2 h-10 w-full text-sm font-semibold text-gray-500 transition hover:text-gray-900"
              >
                Fazer depois
              </button>
            </>
          ) : null}

          {mode === "success" ? (
            <div className="py-2 text-center">
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                <CheckCircle2 className="h-8 w-8" aria-hidden="true" />
              </span>
              <p className="mt-6 text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
                Proteção ativada
              </p>
              <h2 id="email-2fa-title" className="mt-2 text-2xl font-black tracking-tight text-gray-950">
                Sua conta ficou mais segura
              </h2>
              <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-gray-600">
                Nos próximos acessos, sua senha será seguida por um código enviado para o seu e-mail.
              </p>
              <button
                type="button"
                onClick={() => setVisible(false)}
                className="mt-6 h-12 w-full rounded-xl bg-emerald-700 px-5 text-sm font-black text-white transition hover:bg-emerald-800"
              >
                Continuar na minha conta
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
