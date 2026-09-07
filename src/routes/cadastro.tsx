import { Link, createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Eye, EyeOff, Loader2, MailCheck, UserPlus } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { BrandWordmark } from "@/components/brand/BrandWordmark";
import {
  captureAffiliateReferralFromSearch,
  clearPendingAffiliateReferralCode,
  getPendingAffiliateReferralCode,
  validateAffiliateReferralCode,
} from "@/lib/affiliate-referral";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/cadastro")({
  component: RegisterPage,
});

type ReferralValidation = "idle" | "checking" | "valid" | "invalid" | "unavailable";

function RegisterPage() {
  const { user, loading, isOwner, signUp, resendSignUpConfirmation, signOut } = useAuth();
  const [fullName, setFullName] = useState("");
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
  const passwordValid = password.length >= 8;
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const formReady = nameValid && email.trim().length > 0 && passwordValid && passwordsMatch;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!formReady || submitting) return;

    setSubmitting(true);
    setErrorMessage("");

    const { error } = await signUp(
      email.trim(),
      password,
      fullName.trim(),
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
      <main className="app-shell flex min-h-screen items-center justify-center px-4">
        <div className="glass-card rounded-2xl p-5">
          <Loader2 className="h-6 w-6 animate-spin text-red-600 motion-reduce:animate-none" />
        </div>
      </main>
    );
  }

  if (user) {
    return (
      <main className="app-shell flex min-h-screen items-center justify-center px-4 py-12">
        <div className="glass-panel w-full max-w-sm rounded-[1.5rem] p-6 text-center">
          <span className="glass-card mx-auto flex h-12 w-12 items-center justify-center rounded-2xl text-emerald-600">
            <CheckCircle2 className="h-6 w-6" />
          </span>
          <h1 className="display-title-sm mt-4">Você já está conectado</h1>
          <p className="mt-2 text-sm text-gray-500">
            Use sua conta atual ou saia para criar outra.
          </p>
          <div className="mt-6 space-y-2">
            <Link
              to={isOwner ? "/admin" : "/conta"}
              className="premium-action flex h-11 items-center justify-center rounded-xl px-4 text-sm font-bold"
            >
              Abrir minha conta
            </Link>
            <button
              type="button"
              onClick={() => void handleSignOut()}
              disabled={signingOut}
              className="glass-card h-11 w-full rounded-xl text-sm font-semibold text-gray-700 disabled:opacity-50"
            >
              {signingOut ? "Saindo..." : "Sair e criar outra conta"}
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (registrationSent) {
    return (
      <main className="app-shell flex min-h-screen items-center justify-center px-4 py-12">
        <div className="glass-panel w-full max-w-md rounded-[1.6rem] p-7 text-center">
          <span className="glass-card mx-auto flex h-14 w-14 items-center justify-center rounded-2xl text-emerald-700">
            <MailCheck className="h-7 w-7" />
          </span>
          <p className="display-kicker mt-5">Cadastro criado</p>
          <h1 className="display-title-sm mt-2">Confirme seu e-mail</h1>
          <p className="mt-3 text-sm leading-6 text-gray-600">
            Enviamos uma confirmação para <strong>{email.trim()}</strong>. Sua conta só poderá ser
            acessada depois que o e-mail for confirmado.
          </p>
          {errorMessage ? (
            <p className="mt-4 rounded-xl border border-red-200 bg-red-50/90 px-3 py-2 text-sm text-red-700">
              {errorMessage}
            </p>
          ) : null}
          <div className="mt-6 space-y-2">
            <Link
              to="/login"
              className="premium-action flex h-11 items-center justify-center rounded-xl px-4 text-sm font-bold"
            >
              Ir para entrar
            </Link>
            <button
              type="button"
              onClick={() => void handleResend()}
              disabled={resending}
              className="glass-card h-11 w-full rounded-xl text-sm font-semibold text-gray-700 disabled:opacity-50"
            >
              {resending ? "Reenviando..." : "Reenviar e-mail de confirmação"}
            </button>
          </div>
        </div>
      </main>
    );
  }

  const inputClass =
    "glass-input h-11 w-full rounded-xl px-3 text-sm text-gray-950 outline-none focus:border-red-500 focus:ring-4 focus:ring-red-50/70";

  return (
    <main className="app-shell flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-7 text-center">
          <Link to="/" className="brand-lockup px-5 py-2 text-2xl">
            <BrandWordmark />
          </Link>
          <p className="display-kicker mt-6">Área do cliente</p>
          <h1 className="display-title-sm mt-2">Criar conta</h1>
          <p className="mt-2 text-sm leading-6 text-gray-500">
            Comece com o básico. Os dados de compra serão preenchidos só quando você finalizar um
            pedido.
          </p>
        </div>

        {referralValidation !== "idle" ? (
          <div
            className={`mb-4 rounded-2xl border px-4 py-3 text-sm leading-5 shadow-sm ${
              referralValidation === "valid"
                ? "border-emerald-200 bg-emerald-50/90 text-emerald-800"
                : referralValidation === "invalid"
                  ? "border-amber-200 bg-amber-50/90 text-amber-800"
                  : "glass-card text-gray-600"
            }`}
          >
            <div className="flex items-start gap-2.5">
              {referralValidation === "checking" ? (
                <Loader2 className="mt-0.5 h-4 w-4 flex-none animate-spin motion-reduce:animate-none" />
              ) : (
                <UserPlus className="mt-0.5 h-4 w-4 flex-none" />
              )}
              <div>
                <p className="font-bold">
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

        <form onSubmit={handleSubmit} className="glass-panel space-y-4 rounded-[1.6rem] p-6">
          <label className="block text-sm font-semibold text-gray-800">
            Nome
            <input
              autoFocus
              required
              minLength={2}
              maxLength={120}
              autoComplete="name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              className={`${inputClass} mt-1.5`}
              placeholder="Seu nome"
            />
          </label>

          <label className="block text-sm font-semibold text-gray-800">
            E-mail
            <input
              required
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={`${inputClass} mt-1.5`}
              placeholder="seuemail@exemplo.com"
            />
          </label>

          <label className="block text-sm font-semibold text-gray-800">
            Senha
            <div className="relative mt-1.5">
              <input
                required
                minLength={8}
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className={`${inputClass} pr-11`}
                placeholder="Mínimo de 8 caracteres"
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center text-gray-400 hover:text-gray-700"
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <span
              className={`mt-1.5 block text-xs ${password && !passwordValid ? "text-amber-700" : "text-gray-400"}`}
            >
              Pelo menos 8 caracteres.
            </span>
          </label>

          <label className="block text-sm font-semibold text-gray-800">
            Confirmar senha
            <div className="relative mt-1.5">
              <input
                required
                minLength={8}
                type={showConfirmPassword ? "text" : "password"}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className={`${inputClass} pr-11`}
                placeholder="Digite a senha novamente"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((current) => !current)}
                className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center text-gray-400 hover:text-gray-700"
                aria-label={showConfirmPassword ? "Ocultar confirmação" : "Mostrar confirmação"}
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {confirmPassword && !passwordsMatch ? (
              <span className="mt-1.5 block text-xs text-amber-700">As senhas não coincidem.</span>
            ) : null}
          </label>

          {errorMessage ? (
            <p
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50/90 px-3 py-2 text-sm text-red-700"
            >
              {errorMessage}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={!formReady || submitting}
            className="premium-action flex h-12 w-full items-center justify-center rounded-xl px-4 text-sm font-black disabled:cursor-not-allowed disabled:opacity-50"
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

          <p className="text-center text-xs leading-5 text-gray-500">
            Depois do cadastro, confirme seu e-mail para poder entrar.
          </p>
        </form>

        <p className="mt-5 text-center text-sm text-gray-500">
          Já tem conta?{" "}
          <Link to="/login" className="font-bold text-red-600 hover:text-red-700">
            Entrar
          </Link>
        </p>
      </div>
    </main>
  );
}
