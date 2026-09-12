import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Mail,
  MailCheck,
  Phone,
  ShieldCheck,
  User,
  UserPlus,
} from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { TurnstileWidget, isTurnstileEnabled } from "@/components/security/TurnstileWidget";
import { AuthSplitShell } from "@/components/ui/auth-split-shell";
import {
  captureAffiliateReferralFromSearch,
  clearPendingAffiliateReferralCode,
  getPendingAffiliateReferralCode,
  validateAffiliateReferralCode,
} from "@/lib/affiliate-referral";
import { useAuth } from "@/lib/auth";
import { formatBrazilianPhone, isValidBrazilianPhone } from "@/lib/brasil";

export const Route = createFileRoute("/cadastro")({
  component: RegisterPage,
});

type ReferralValidation = "idle" | "checking" | "valid" | "invalid" | "unavailable";
type RegistrationStep = 1 | 2;

function RegisterPage() {
  const { user, loading, isOwner, signUp, resendSignUpConfirmation, signOut } = useAuth();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [registrationStep, setRegistrationStep] = useState<RegistrationStep>(1);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [registrationSent, setRegistrationSent] = useState(false);
  const [referralCode, setReferralCode] = useState<string | null>(() =>
    getPendingAffiliateReferralCode(),
  );
  const [referralValidation, setReferralValidation] = useState<ReferralValidation>("idle");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const turnstileRequired = isTurnstileEnabled();

  useEffect(() => {
    const captured =
      typeof window === "undefined"
        ? null
        : captureAffiliateReferralFromSearch(window.location.search);
    const pending = captured ?? getPendingAffiliateReferralCode();

    if (!pending) {
      setReferralCode(null);
      setReferralValidation("idle");
      return;
    }

    setReferralCode(pending);
    setReferralValidation("checking");
    let active = true;

    void validateAffiliateReferralCode(pending)
      .then((valid) => {
        if (!active) return;
        if (valid) {
          setReferralValidation("valid");
          return;
        }

        clearPendingAffiliateReferralCode();
        setReferralCode(null);
        setReferralValidation("invalid");
      })
      .catch(() => {
        if (active) setReferralValidation("unavailable");
      });

    return () => {
      active = false;
    };
  }, []);

  const nameValid = fullName.trim().length >= 2;
  const phoneValid = isValidBrazilianPhone(phone);
  const passwordValid = password.length >= 8;
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const stepOneReady = nameValid && phoneValid && email.trim().length > 0;
  const formReady = stepOneReady && passwordValid && passwordsMatch;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (registrationStep === 1) {
      if (!stepOneReady) return;
      setErrorMessage("");
      setRegistrationStep(2);
      return;
    }

    if (!formReady || submitting) return;
    if (turnstileRequired && !turnstileToken) {
      setErrorMessage("Conclua a verificação de segurança para continuar.");
      return;
    }

    setSubmitting(true);
    setErrorMessage("");

    const { error } = await signUp(
      email.trim(),
      password,
      fullName.trim(),
      phone,
      referralValidation === "invalid" ? null : referralCode,
      turnstileToken,
    );

    if (error) {
      setErrorMessage(error.message);
      setTurnstileToken(null);
      setTurnstileResetKey((value) => value + 1);
      setSubmitting(false);
      return;
    }

    clearPendingAffiliateReferralCode();
    setRegistrationSent(true);
    setPassword("");
    setConfirmPassword("");
    setSubmitting(false);
  }

  async function handleResend() {
    if (!email.trim() || resending) return;
    setResending(true);
    setErrorMessage("");
    const { error } = await resendSignUpConfirmation(email.trim());
    if (error) setErrorMessage(error.message);
    setResending(false);
  }

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    await signOut();
    setSigningOut(false);
  }

  if (loading) {
    return (
      <main className="auth-split-page flex min-h-[100dvh] items-center justify-center px-4">
        <div className="auth-form-card rounded-xl p-5">
          <Loader2 className="h-6 w-6 animate-spin text-red-600 motion-reduce:animate-none" />
        </div>
      </main>
    );
  }

  if (user) {
    return (
      <AuthSplitShell
        mode="signup"
        eyebrow="Área do cliente"
        title="Você já está conectado"
        description="Use sua conta atual ou saia dela para criar um novo cadastro."
      >
        <div className="auth-form-card rounded-[1.25rem] p-6 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="h-6 w-6" />
          </span>
          <p className="mt-4 text-sm leading-6 text-gray-500">Sua sessão atual continua ativa.</p>
          <div className="mt-6 space-y-2.5">
            <Link
              to={isOwner ? "/admin" : "/conta"}
              className="premium-action flex h-12 items-center justify-center rounded-xl px-4 text-sm font-black"
            >
              Abrir minha conta
            </Link>
            <button
              type="button"
              onClick={() => void handleSignOut()}
              disabled={signingOut}
              className="h-11 w-full rounded-xl border border-gray-200 bg-white text-sm font-bold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
            >
              {signingOut ? "Saindo..." : "Sair e criar outra conta"}
            </button>
          </div>
        </div>
      </AuthSplitShell>
    );
  }

  if (registrationSent) {
    return (
      <AuthSplitShell
        mode="signup"
        eyebrow="Cadastro criado"
        title="Agora confirme seu e-mail"
        description={
          <>
            Enviamos uma confirmação para <strong className="text-gray-900">{email.trim()}</strong>.
            Sua conta só poderá ser acessada depois dessa confirmação.
          </>
        }
        footer={
          <p className="text-xs leading-5 text-gray-400">
            Não encontrou? Verifique também a caixa de spam.
          </p>
        }
      >
        <div className="auth-form-card rounded-[1.25rem] p-6 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <MailCheck className="h-7 w-7" />
          </span>
          <h2 className="mt-4 text-lg font-black tracking-[-0.025em] text-gray-950">
            E-mail de confirmação enviado
          </h2>
          <p className="mt-2 text-sm leading-6 text-gray-500">
            Abra a mensagem da DropBox e use o link de confirmação para liberar seu acesso.
          </p>

          {errorMessage ? (
            <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorMessage}
            </p>
          ) : null}

          <div className="mt-6 space-y-2.5">
            <Link
              to="/login"
              className="premium-action flex h-12 items-center justify-center rounded-xl px-4 text-sm font-black"
            >
              Ir para entrar
            </Link>
            <button
              type="button"
              onClick={() => void handleResend()}
              disabled={resending}
              className="h-11 w-full rounded-xl border border-gray-200 bg-white text-sm font-bold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
            >
              {resending ? "Reenviando..." : "Reenviar e-mail de confirmação"}
            </button>
          </div>
        </div>
      </AuthSplitShell>
    );
  }

  const inputClass =
    "h-[54px] w-full rounded-xl bg-transparent pl-11 pr-4 text-sm text-gray-950 outline-none placeholder:text-gray-400";

  return (
    <AuthSplitShell
      mode="signup"
      eyebrow="Criar conta"
      title="Entre para o jogo"
      description="Seu cadastro continua simples: pedimos somente os dados essenciais para criar e proteger sua conta DropBox."
      footer={
        <p className="text-sm text-gray-500">
          Já tem conta?{" "}
          <Link
            to="/login"
            className="font-black text-red-600 transition hover:text-red-700 hover:underline"
          >
            Entrar
          </Link>
        </p>
      }
    >
      {referralValidation !== "idle" ? (
        <div
          className={`mb-4 rounded-xl border px-4 py-3 text-sm leading-5 shadow-sm ${
            referralValidation === "valid"
              ? "border-emerald-200 bg-emerald-50/90 text-emerald-800"
              : referralValidation === "invalid"
                ? "border-amber-200 bg-amber-50/90 text-amber-800"
                : "border-gray-200 bg-white text-gray-600"
          }`}
        >
          <div className="flex items-start gap-2.5">
            {referralValidation === "checking" ? (
              <Loader2 className="mt-0.5 h-4 w-4 flex-none animate-spin motion-reduce:animate-none" />
            ) : (
              <UserPlus className="mt-0.5 h-4 w-4 flex-none" />
            )}
            <div>
              <p className="font-black">
                {referralValidation === "checking"
                  ? "Verificando sua indicação"
                  : referralValidation === "valid"
                    ? "Cadastro por indicação"
                    : referralValidation === "invalid"
                      ? "Link de indicação não ativo"
                      : "Indicação recebida"}
              </p>
              <p className="mt-1 text-xs leading-5">
                {referralValidation === "checking"
                  ? "Estamos confirmando o código antes do cadastro."
                  : referralValidation === "valid"
                    ? "Ao criar uma conta nova, ela ficará vinculada ao afiliado que convidou você."
                    : referralValidation === "invalid"
                      ? "Você pode criar sua conta normalmente; nenhuma indicação será vinculada."
                      : "Não foi possível validar o código agora. O cadastro continua normalmente e o servidor fará a verificação final."}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mb-3 px-1">
        <div className="auth-step-track" aria-label={`Etapa ${registrationStep} de 2`}>
          <div className={`auth-step-item ${registrationStep === 1 ? "is-active" : "is-complete"}`}>
            <div className="auth-step-line" />
            <div className="mt-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.13em] text-gray-500">
              <User className="h-3.5 w-3.5" aria-hidden="true" />
              1. Seus dados
            </div>
          </div>
          <div className={`auth-step-item ${registrationStep === 2 ? "is-active" : ""}`}>
            <div className="auth-step-line" />
            <div className="mt-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.13em] text-gray-500">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              2. Segurança
            </div>
          </div>
        </div>
      </div>

      <form
        onSubmit={(event) => void handleSubmit(event)}
        className="auth-form-card rounded-[1.25rem] p-5 sm:p-6"
      >
        {registrationStep === 1 ? (
          <div className="space-y-4">
            <div className="mb-1">
              <p className="text-[11px] font-black uppercase tracking-[0.15em] text-red-600">
                Etapa 1 de 2
              </p>
              <h2 className="mt-1 text-lg font-black tracking-[-0.02em] text-gray-950">
                Dados essenciais
              </h2>
              <p className="mt-1 text-xs leading-5 text-gray-400">
                Apenas nome, telefone e e-mail. Nada além do necessário agora.
              </p>
            </div>

            <label className="block text-sm font-bold text-gray-800">
              Nome
              <div className="auth-input-wrap relative mt-1.5 rounded-xl">
                <User className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  autoFocus
                  required
                  minLength={2}
                  maxLength={120}
                  autoComplete="name"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  className={inputClass}
                  placeholder="Seu nome"
                />
              </div>
            </label>

            <label className="block text-sm font-bold text-gray-800">
              Telefone
              <div className="auth-input-wrap relative mt-1.5 rounded-xl">
                <Phone className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  required
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  maxLength={15}
                  value={phone}
                  onChange={(event) => setPhone(formatBrazilianPhone(event.target.value))}
                  className={inputClass}
                  placeholder="(84) 9 9999-9999"
                />
              </div>
              {phone && !phoneValid ? (
                <span className="mt-1.5 block text-xs text-amber-700">
                  Informe um telefone com um DDD brasileiro válido.
                </span>
              ) : null}
            </label>

            <label className="block text-sm font-bold text-gray-800">
              E-mail
              <div className="auth-input-wrap relative mt-1.5 rounded-xl">
                <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  required
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className={inputClass}
                  placeholder="seuemail@exemplo.com"
                />
              </div>
            </label>

            <button
              type="submit"
              disabled={!stepOneReady}
              className="premium-action mt-1 flex h-[52px] w-full items-center justify-center rounded-xl px-4 text-sm font-black transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Continuar
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="mb-1 flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.15em] text-red-600">
                  Etapa 2 de 2
                </p>
                <h2 className="mt-1 text-lg font-black tracking-[-0.02em] text-gray-950">
                  Proteja sua conta
                </h2>
                <p className="mt-1 text-xs leading-5 text-gray-400">
                  Defina sua senha para finalizar o cadastro.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setRegistrationStep(1);
                  setErrorMessage("");
                }}
                className="inline-flex flex-none items-center gap-1 text-xs font-bold text-gray-500 transition hover:text-red-600"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                Voltar
              </button>
            </div>

            <label className="block text-sm font-bold text-gray-800">
              Senha
              <div className="auth-input-wrap relative mt-1.5 rounded-xl">
                <ShieldCheck className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  autoFocus
                  required
                  minLength={8}
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className={`${inputClass} pr-12`}
                  placeholder="Mínimo de 8 caracteres"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute right-0 top-0 flex h-[54px] w-12 items-center justify-center text-gray-400 transition hover:text-gray-900"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              <span
                className={`mt-1.5 block text-xs ${password && !passwordValid ? "text-amber-700" : "text-gray-400"}`}
              >
                Pelo menos 8 caracteres.
              </span>
            </label>

            <label className="block text-sm font-bold text-gray-800">
              Confirmar senha
              <div className="auth-input-wrap relative mt-1.5 rounded-xl">
                <ShieldCheck className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  required
                  minLength={8}
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className={`${inputClass} pr-12`}
                  placeholder="Digite a senha novamente"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((current) => !current)}
                  className="absolute right-0 top-0 flex h-[54px] w-12 items-center justify-center text-gray-400 transition hover:text-gray-900"
                  aria-label={showConfirmPassword ? "Ocultar confirmação" : "Mostrar confirmação"}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
              {confirmPassword && !passwordsMatch ? (
                <span className="mt-1.5 block text-xs text-amber-700">
                  As senhas não coincidem.
                </span>
              ) : null}
            </label>

            <TurnstileWidget
              action="signup"
              onTokenChange={setTurnstileToken}
              resetKey={turnstileResetKey}
            />

            {errorMessage ? (
              <p
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                {errorMessage}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={!formReady || submitting || (turnstileRequired && !turnstileToken)}
              className="premium-action flex h-[52px] w-full items-center justify-center rounded-xl px-4 text-sm font-black transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" />
                  Criando conta...
                </>
              ) : (
                "Criar conta"
              )}
            </button>

            <p className="text-center text-xs leading-5 text-gray-400">
              Depois do cadastro, confirme seu e-mail para liberar o acesso.
            </p>
          </div>
        )}
      </form>
    </AuthSplitShell>
  );
}
