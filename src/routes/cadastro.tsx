import { Link, createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Eye, EyeOff, Loader2, MailCheck, UserPlus } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

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

function RegisterPage() {
  const { user, loading, isOwner, signUp, resendSignUpConfirmation, signOut } = useAuth();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [registrationSent, setRegistrationSent] = useState(false);
  const [referralCode, setReferralCode] = useState<string | null>(() =>
    getPendingAffiliateReferralCode(),
  );
  const [referralValidation, setReferralValidation] = useState<ReferralValidation>("idle");

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
  const formReady =
    nameValid && phoneValid && email.trim().length > 0 && passwordValid && passwordsMatch;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!formReady || submitting) return;

    setSubmitting(true);
    setErrorMessage("");

    const { error } = await signUp(
      email.trim(),
      password,
      fullName.trim(),
      phone,
      referralValidation === "invalid" ? null : referralCode,
    );

    if (error) {
      setErrorMessage(error.message);
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
        <div className="auth-form-card rounded-2xl p-5">
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
        <div className="auth-form-card rounded-[1.7rem] p-6 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="h-6 w-6" />
          </span>
          <p className="mt-4 text-sm leading-6 text-gray-500">Sua sessão atual continua ativa.</p>
          <div className="mt-6 space-y-2.5">
            <Link
              to={isOwner ? "/admin" : "/conta"}
              className="premium-action flex h-12 items-center justify-center rounded-2xl px-4 text-sm font-black"
            >
              Abrir minha conta
            </Link>
            <button
              type="button"
              onClick={() => void handleSignOut()}
              disabled={signingOut}
              className="h-11 w-full rounded-2xl border border-gray-200 bg-white text-sm font-bold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
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
        <div className="auth-form-card rounded-[1.7rem] p-6 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
            <MailCheck className="h-7 w-7" />
          </span>
          <h2 className="mt-4 text-lg font-black tracking-[-0.025em] text-gray-950">
            E-mail de confirmação enviado
          </h2>
          <p className="mt-2 text-sm leading-6 text-gray-500">
            Abra a mensagem da DropBox e use o link de confirmação para liberar seu acesso.
          </p>

          {errorMessage ? (
            <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorMessage}
            </p>
          ) : null}

          <div className="mt-6 space-y-2.5">
            <Link
              to="/login"
              className="premium-action flex h-12 items-center justify-center rounded-2xl px-4 text-sm font-black"
            >
              Ir para entrar
            </Link>
            <button
              type="button"
              onClick={() => void handleResend()}
              disabled={resending}
              className="h-11 w-full rounded-2xl border border-gray-200 bg-white text-sm font-bold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
            >
              {resending ? "Reenviando..." : "Reenviar e-mail de confirmação"}
            </button>
          </div>
        </div>
      </AuthSplitShell>
    );
  }

  const inputClass =
    "h-12 w-full rounded-2xl bg-transparent px-4 text-sm text-gray-950 outline-none placeholder:text-gray-400";

  return (
    <AuthSplitShell
      mode="signup"
      eyebrow="Criar conta"
      title="Faça seu cadastro"
      description="Crie sua conta DropBox com os dados essenciais para acessar pedidos, endereços e sua área do cliente."
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
          className={`mb-4 rounded-2xl border px-4 py-3 text-sm leading-5 shadow-sm ${
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

      <form
        onSubmit={handleSubmit}
        className="auth-form-card space-y-4 rounded-[1.7rem] p-5 sm:p-6"
      >
        <label className="block text-sm font-bold text-gray-800">
          Nome
          <div className="auth-input-wrap mt-1.5 rounded-2xl">
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
          <div className="auth-input-wrap mt-1.5 rounded-2xl">
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
          <div className="auth-input-wrap mt-1.5 rounded-2xl">
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

        <label className="block text-sm font-bold text-gray-800">
          Senha
          <div className="auth-input-wrap relative mt-1.5 rounded-2xl">
            <input
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
              className="absolute right-0 top-0 flex h-12 w-12 items-center justify-center text-gray-400 transition hover:text-gray-900"
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
          <div className="auth-input-wrap relative mt-1.5 rounded-2xl">
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
              className="absolute right-0 top-0 flex h-12 w-12 items-center justify-center text-gray-400 transition hover:text-gray-900"
              aria-label={showConfirmPassword ? "Ocultar confirmação" : "Mostrar confirmação"}
            >
              {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
          {confirmPassword && !passwordsMatch ? (
            <span className="mt-1.5 block text-xs text-amber-700">As senhas não coincidem.</span>
          ) : null}
        </label>

        {errorMessage ? (
          <p
            role="alert"
            className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {errorMessage}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={!formReady || submitting}
          className="premium-action flex h-12 w-full items-center justify-center rounded-2xl px-4 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-50"
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
      </form>
    </AuthSplitShell>
  );
}
