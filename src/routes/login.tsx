import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Eye, EyeOff, KeyRound, Loader2, MailCheck, ShieldCheck } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { AuthSplitShell } from "@/components/ui/auth-split-shell";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { user, loading, isOwner, signIn, verifySignInTwoFactor, signOut } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [challengeExpiresAt, setChallengeExpiresAt] = useState("");
  const [securityCode, setSecurityCode] = useState("");

  useEffect(() => {
    if (loading || !user) return;

    void navigate({
      to: isOwner ? "/admin" : "/conta",
      replace: true,
    });
  }, [isOwner, loading, navigate, user]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setErrorMessage("");
    setSubmitting(true);

    const result = await signIn(email.trim(), password);

    if (result.error) {
      setErrorMessage(result.error.message);
    } else if (result.requiresTwoFactor) {
      setChallengeId(result.challengeId ?? "");
      setMaskedEmail(result.maskedEmail ?? email.trim());
      setChallengeExpiresAt(result.expiresAt ?? "");
      setSecurityCode("");
    }

    setSubmitting(false);
  }

  async function handleVerifySecurityCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (verifyingCode || !challengeId) return;

    const normalizedCode = securityCode.replace(/\D/g, "").slice(0, 6);
    if (normalizedCode.length !== 6) {
      setErrorMessage("Digite os 6 números enviados para o seu e-mail.");
      return;
    }

    setErrorMessage("");
    setVerifyingCode(true);

    const { error } = await verifySignInTwoFactor(
      email.trim(),
      password,
      challengeId,
      normalizedCode,
    );

    if (error) setErrorMessage(error.message);
    setVerifyingCode(false);
  }

  function resetTwoFactorStep() {
    setChallengeId("");
    setMaskedEmail("");
    setChallengeExpiresAt("");
    setSecurityCode("");
    setErrorMessage("");
  }

  async function handleSignOut() {
    if (signingOut) return;

    setErrorMessage("");
    setSigningOut(true);
    const { error } = await signOut();
    if (error) setErrorMessage(error.message);
    setSigningOut(false);
  }

  if (loading) {
    return (
      <main className="auth-split-page flex min-h-[100dvh] items-center justify-center px-4">
        <div className="auth-form-card rounded-2xl px-6 py-5 text-center text-gray-500">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-red-600" aria-hidden="true" />
          <p className="mt-3 text-sm">Carregando sua conta...</p>
        </div>
      </main>
    );
  }

  if (user) {
    return (
      <AuthSplitShell
        mode="signin"
        eyebrow="Área do cliente"
        title="Sua conta já está conectada"
        description="Estamos direcionando você para sua área da DropBox."
      >
        <div className="auth-form-card rounded-[1.6rem] p-6">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-gray-400">
            E-mail conectado
          </p>
          <p className="mt-2 break-all text-sm font-bold text-gray-900">
            {user.email ?? "Conta autenticada"}
          </p>

          <div className="mt-5 space-y-2.5">
            <Link
              to={isOwner ? "/admin" : "/conta"}
              className="premium-action flex h-12 w-full items-center justify-center rounded-2xl px-4 text-sm font-black"
            >
              {isOwner ? "Abrir painel administrativo" : "Abrir minha conta"}
            </Link>
            <button
              type="button"
              onClick={() => void handleSignOut()}
              disabled={signingOut}
              className="h-11 w-full rounded-2xl border border-gray-200 bg-white text-sm font-bold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
            >
              {signingOut ? "Saindo..." : "Sair e entrar com outra conta"}
            </button>
          </div>

          {errorMessage ? (
            <p
              role="alert"
              className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {errorMessage}
            </p>
          ) : null}
        </div>
      </AuthSplitShell>
    );
  }

  if (challengeId) {
    const expiresLabel = challengeExpiresAt
      ? new Intl.DateTimeFormat("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date(challengeExpiresAt))
      : null;

    return (
      <AuthSplitShell
        mode="signin"
        eyebrow="Proteção da conta"
        title="Confirme que é você"
        description="Sua senha foi validada. Agora conclua a verificação em duas etapas."
        footer={
          <button
            type="button"
            onClick={resetTwoFactorStep}
            className="inline-flex items-center gap-2 text-sm font-bold text-gray-500 transition hover:text-red-600"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar e usar outra conta
          </button>
        }
      >
        <form
          onSubmit={(event) => void handleVerifySecurityCode(event)}
          className="auth-form-card rounded-[1.7rem] p-5 sm:p-6"
        >
          <div className="mb-5 flex items-start gap-3 rounded-2xl bg-emerald-50 px-4 py-3 text-emerald-800">
            <ShieldCheck className="mt-0.5 h-5 w-5 flex-none" aria-hidden="true" />
            <div>
              <p className="text-sm font-black">Código enviado</p>
              <p className="mt-1 text-xs leading-5 text-emerald-700">
                Enviamos o código de segurança para <strong>{maskedEmail}</strong>.
              </p>
            </div>
          </div>

          <label htmlFor="securityCode" className="block text-sm font-bold text-gray-800">
            Código de 6 dígitos
            <div className="auth-input-wrap relative mt-1.5 rounded-2xl">
              <MailCheck className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                id="securityCode"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                maxLength={6}
                value={securityCode}
                onChange={(event) => {
                  setSecurityCode(event.target.value.replace(/\D/g, "").slice(0, 6));
                  if (errorMessage) setErrorMessage("");
                }}
                className="h-12 w-full rounded-2xl bg-transparent pl-11 pr-4 text-center text-xl font-black tracking-[0.3em] outline-none"
                placeholder="000000"
              />
            </div>
          </label>

          <p className="mt-2 text-xs leading-5 text-gray-400">
            {expiresLabel
              ? `Este código expira por volta de ${expiresLabel}.`
              : "O código expira em 10 minutos."}
          </p>

          {errorMessage ? (
            <p
              role="alert"
              className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {errorMessage}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={verifyingCode || securityCode.length !== 6}
            className="premium-action mt-5 inline-flex h-12 w-full items-center justify-center rounded-2xl px-4 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-50"
          >
            {verifyingCode ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Confirmando...
              </>
            ) : (
              <>
                <KeyRound className="mr-2 h-4 w-4" />
                Confirmar e entrar
              </>
            )}
          </button>
        </form>
      </AuthSplitShell>
    );
  }

  return (
    <AuthSplitShell
      mode="signin"
      eyebrow="Área do cliente"
      title="Entre na sua conta"
      description="Use o e-mail e a senha cadastrados na DropBox para acompanhar seus pedidos e gerenciar sua conta."
      footer={
        <p className="text-sm text-gray-500">
          Ainda não tem uma conta?{" "}
          <Link
            to="/cadastro"
            className="font-black text-red-600 transition hover:text-red-700 hover:underline"
          >
            Criar conta
          </Link>
        </p>
      }
    >
      <form
        onSubmit={(event) => void handleSubmit(event)}
        aria-busy={submitting}
        className="auth-form-card space-y-4 rounded-[1.7rem] p-5 sm:p-6"
      >
        <label htmlFor="email" className="block text-sm font-bold text-gray-800">
          E-mail
          <div className="auth-input-wrap mt-1.5 rounded-2xl">
            <input
              id="email"
              type="email"
              autoComplete="email"
              autoFocus
              required
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                if (errorMessage) setErrorMessage("");
              }}
              className="h-12 w-full rounded-2xl bg-transparent px-4 text-sm outline-none placeholder:text-gray-400"
              placeholder="seuemail@exemplo.com"
            />
          </div>
        </label>

        <label htmlFor="password" className="block text-sm font-bold text-gray-800">
          <span className="flex items-center justify-between gap-3">
            <span>Senha</span>
            <Link
              to="/esqueci-senha"
              className="text-xs font-bold text-red-600 transition hover:text-red-700 hover:underline"
            >
              Esqueci minha senha
            </Link>
          </span>
          <div className="auth-input-wrap relative mt-1.5 rounded-2xl">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                if (errorMessage) setErrorMessage("");
              }}
              className="h-12 w-full rounded-2xl bg-transparent px-4 pr-12 text-sm outline-none placeholder:text-gray-400"
              placeholder="Sua senha"
            />
            <button
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              aria-pressed={showPassword}
              className="absolute right-0 top-0 flex h-12 w-12 items-center justify-center text-gray-400 transition hover:text-gray-900"
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
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
          disabled={submitting}
          className="premium-action inline-flex h-12 w-full items-center justify-center rounded-2xl px-4 text-sm font-black transition hover:brightness-[0.96] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Entrando...
            </>
          ) : (
            "Entrar"
          )}
        </button>

        <p className="text-center text-xs leading-5 text-gray-400">
          O acesso é liberado após a confirmação do e-mail cadastrado.
        </p>
      </form>
    </AuthSplitShell>
  );
}
