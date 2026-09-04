import {
  CheckCircle2,
  ChevronDown,
  KeyRound,
  Laptop,
  Loader2,
  MailCheck,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useState } from "react";

import {
  disableEmailTwoFactor,
  fetchAccountSecurityStatus,
  sendAccountPasswordReset,
  signOutOtherAccountSessions,
  startEmailTwoFactorEnrollment,
  verifyEmailTwoFactorEnrollment,
  type AccountSecurityStatus,
} from "@/lib/account-security";

type AccountSecurityPanelProps = {
  email: string;
};

type EnrollmentState = {
  challengeId: string;
  maskedEmail: string;
} | null;

export function AccountSecurityPanel({ email }: AccountSecurityPanelProps) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<AccountSecurityStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [changingTwoFactor, setChangingTwoFactor] = useState(false);
  const [enrollment, setEnrollment] = useState<EnrollmentState>(null);
  const [code, setCode] = useState("");
  const [sendingReset, setSendingReset] = useState(false);
  const [endingSessions, setEndingSessions] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!open || status) return;

    let active = true;
    setLoadingStatus(true);
    setErrorMessage("");

    void fetchAccountSecurityStatus()
      .then((nextStatus) => {
        if (active) setStatus(nextStatus);
      })
      .catch((error) => {
        if (active) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Não foi possível carregar a segurança da sua conta.",
          );
        }
      })
      .finally(() => {
        if (active) setLoadingStatus(false);
      });

    return () => {
      active = false;
    };
  }, [open, status]);

  const twoFactorEnabled = status?.email_2fa_enabled === true;

  async function handleTwoFactorToggle() {
    if (!status || changingTwoFactor) return;

    setChangingTwoFactor(true);
    setErrorMessage("");
    setMessage("");

    try {
      if (twoFactorEnabled) {
        await disableEmailTwoFactor();
        setStatus({
          ...status,
          email_2fa_enabled: false,
          email_2fa_enabled_at: null,
          email_2fa_prompt_dismissed_at: new Date().toISOString(),
        });
        setEnrollment(null);
        setCode("");
        setMessage("Verificação em duas etapas desativada.");
        return;
      }

      const result = await startEmailTwoFactorEnrollment();
      if (result.alreadyEnabled) {
        setStatus({
          ...status,
          email_2fa_enabled: true,
          email_2fa_enabled_at: status.email_2fa_enabled_at ?? new Date().toISOString(),
          email_2fa_prompt_dismissed_at: null,
        });
        setMessage("Verificação em duas etapas já está ativa.");
        return;
      }

      setEnrollment({
        challengeId: result.challengeId,
        maskedEmail: result.maskedEmail,
      });
      setMessage(`Enviamos um código para ${result.maskedEmail}.`);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível alterar a verificação em duas etapas.",
      );
    } finally {
      setChangingTwoFactor(false);
    }
  }

  async function handleConfirmEnrollment() {
    if (!enrollment || changingTwoFactor) return;

    const normalizedCode = code.replace(/\D/g, "").slice(0, 6);
    if (normalizedCode.length !== 6) {
      setErrorMessage("Informe o código de 6 dígitos enviado por e-mail.");
      return;
    }

    setChangingTwoFactor(true);
    setErrorMessage("");
    setMessage("");

    try {
      await verifyEmailTwoFactorEnrollment(enrollment.challengeId, normalizedCode);
      const nextStatus = await fetchAccountSecurityStatus();
      setStatus(nextStatus);
      setEnrollment(null);
      setCode("");
      setMessage("Verificação em duas etapas ativada com sucesso.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível confirmar o código.",
      );
    } finally {
      setChangingTwoFactor(false);
    }
  }

  async function handlePasswordReset() {
    if (sendingReset) return;
    setSendingReset(true);
    setErrorMessage("");
    setMessage("");

    try {
      await sendAccountPasswordReset(email);
      setMessage("Enviamos para seu e-mail um link para criar uma nova senha.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível enviar o link para redefinir a senha.",
      );
    } finally {
      setSendingReset(false);
    }
  }

  async function handleEndOtherSessions() {
    if (endingSessions) return;
    setEndingSessions(true);
    setErrorMessage("");
    setMessage("");

    try {
      await signOutOtherAccountSessions();
      setMessage("As outras sessões da sua conta foram encerradas.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível encerrar as outras sessões.",
      );
    } finally {
      setEndingSessions(false);
    }
  }

  return (
    <section className="glass-panel mt-6 overflow-hidden rounded-[1.4rem]">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-4 p-5 text-left sm:p-6"
        aria-expanded={open}
      >
        <div className="flex items-start gap-3">
          <span className="glass-card flex h-10 w-10 flex-none items-center justify-center rounded-xl text-gray-700">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-extrabold tracking-[-0.025em] text-gray-950">Segurança da conta</h2>
            <p className="mt-1 text-sm leading-6 text-gray-600">
              Senha, verificação em duas etapas e sessões conectadas.
            </p>
          </div>
        </div>
        <ChevronDown
          className={`h-5 w-5 flex-none text-gray-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div className="border-t border-white/70 bg-white/20 p-5 sm:p-6">
          {loadingStatus ? (
            <div className="flex items-center gap-2 py-3 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Carregando segurança da conta...
            </div>
          ) : (
            <div className="divide-y divide-white/70">
              <div className="flex flex-col gap-4 pb-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <span className="glass-card mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-xl text-gray-700">
                    <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="font-bold text-gray-950">Verificação em duas etapas</p>
                    <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-600">
                      Quando ativada, um código enviado por e-mail será solicitado ao entrar na conta.
                    </p>
                    <p className={`mt-1 text-xs font-semibold ${twoFactorEnabled ? "text-emerald-700" : "text-red-600"}`}>
                      {twoFactorEnabled ? "Ativada" : "Desativada"}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={twoFactorEnabled}
                  aria-label={twoFactorEnabled ? "Desativar verificação em duas etapas" : "Ativar verificação em duas etapas"}
                  disabled={!status || changingTwoFactor}
                  onClick={() => void handleTwoFactorToggle()}
                  className={`relative inline-flex h-8 w-14 flex-none items-center rounded-full border border-white/60 shadow-inner transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-red-500/20 disabled:cursor-not-allowed disabled:opacity-50 ${twoFactorEnabled ? "bg-emerald-500" : "bg-red-500"}`}
                >
                  <span
                    className={`inline-block h-6 w-6 rounded-full bg-white shadow-md transition-transform duration-300 ${twoFactorEnabled ? "translate-x-7" : "translate-x-1"}`}
                  />
                </button>
              </div>

              {enrollment ? (
                <div className="pb-5">
                  <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/80 p-4 shadow-sm">
                    <p className="text-sm font-bold text-emerald-900">Confirme a ativação</p>
                    <p className="mt-1 text-sm leading-6 text-emerald-800">
                      Digite o código de 6 dígitos enviado para {enrollment.maskedEmail}.
                    </p>
                    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                      <input
                        value={code}
                        onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        placeholder="000000"
                        className="glass-input h-10 w-full rounded-xl px-3 text-center text-base font-bold tracking-[0.3em] outline-none focus:border-emerald-600 sm:w-40"
                      />
                      <button
                        type="button"
                        disabled={changingTwoFactor}
                        onClick={() => void handleConfirmEnrollment()}
                        className="h-10 rounded-xl bg-gray-950 px-4 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                      >
                        Confirmar ativação
                      </button>
                      <button
                        type="button"
                        disabled={changingTwoFactor}
                        onClick={() => {
                          setEnrollment(null);
                          setCode("");
                          setMessage("");
                        }}
                        className="glass-card h-10 rounded-xl px-4 text-sm font-semibold text-gray-700"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <span className="glass-card mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-xl text-gray-700">
                    <KeyRound className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="font-bold text-gray-950">Redefinir senha</p>
                    <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-600">
                      Receba por e-mail um link para criar uma nova senha. Não é necessário informar a senha atual.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={sendingReset}
                  onClick={() => void handlePasswordReset()}
                  className="glass-card h-10 flex-none rounded-xl px-4 text-sm font-bold text-gray-800 transition hover:text-red-700 disabled:opacity-50"
                >
                  {sendingReset ? "Enviando..." : "Enviar link"}
                </button>
              </div>

              <div className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <span className="glass-card mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-xl text-gray-700">
                    <Laptop className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="font-bold text-gray-950">Outros dispositivos</p>
                    <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-600">
                      Encerre acessos abertos em outros celulares ou computadores sem sair deste dispositivo.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={endingSessions}
                  onClick={() => void handleEndOtherSessions()}
                  className="glass-card h-10 flex-none rounded-xl px-4 text-sm font-bold text-gray-800 transition hover:text-red-700 disabled:opacity-50"
                >
                  {endingSessions ? "Encerrando..." : "Encerrar outras sessões"}
                </button>
              </div>

              <div className="flex items-start gap-3 pt-5">
                <span className="glass-card mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-xl text-gray-700">
                  <MailCheck className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="font-bold text-gray-950">E-mail de acesso</p>
                  <p className="mt-1 break-all text-sm text-gray-600">{email}</p>
                  <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                    E-mail confirmado
                  </p>
                </div>
              </div>
            </div>
          )}

          {message ? (
            <p role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50/90 px-4 py-3 text-sm text-emerald-800 shadow-sm">
              {message}
            </p>
          ) : null}

          {errorMessage ? (
            <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm text-red-700 shadow-sm">
              {errorMessage}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
