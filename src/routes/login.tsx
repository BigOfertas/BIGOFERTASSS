import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  MailCheck,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function Brand() {
  return (
    <Link to="/" className="text-2xl font-black italic tracking-tight text-foreground">
      <span className="text-red-600">BIG</span>ofertas
    </Link>
  );
}

function LoginPage() {
  const navigate = useNavigate();
  const {
    user,
    loading,
    isOwner,
    signIn,
    verifySignInTwoFactor,
    signOut,
  } = useAuth();

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
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="text-center text-muted-foreground">
          <Loader2 className="mx-auto h-6 w-6 animate-spin" aria-hidden="true" />
          <p className="mt-3 text-sm">Carregando sua conta...</p>
        </div>
      </main>
    );
  }

  if (user) {
    return (
      <main className="hidden min-h-screen items-center justify-center bg-background px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <Brand />
            <h1 className="mt-6 text-2xl font-semibold tracking-tight text-foreground">
              Sua conta
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">Você já está conectado.</p>
          </div>

          <div className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm">
            <div className="rounded-lg bg-muted px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                E-mail conectado
              </p>
              <p className="mt-1 break-all text-sm font-medium text-foreground">
                {user.email ?? "Conta autenticada"}
              </p>
            </div>

            <Link
              to={isOwner ? "/admin" : "/conta"}
              className="inline-flex h-11 w-full items-center justify-center rounded-md bg-red-600 px-4 text-sm font-bold text-white transition hover:bg-red-700 active:scale-[0.99]"
            >
              {isOwner ? "Abrir painel administrativo" : "Abrir minha conta"}
            </Link>

            <Link
              to="/"
              className="inline-flex h-10 w-full items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              Voltar à loja
            </Link>

            <button
              type="button"
              onClick={() => void handleSignOut()}
              disabled={signingOut}
              className="inline-flex h-10 w-full items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
            >
              {signingOut ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saindo...
                </>
              ) : (
                "Sair para entrar com outra conta"
              )}
            </button>

            {errorMessage ? (
              <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {errorMessage}
              </p>
            ) : null}
          </div>
        </div>
      </main>
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
      <main className="flex min-h-screen items-center justify-center bg-[#f7f7f7] px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <Brand />
          </div>

          <form
            onSubmit={(event) => void handleVerifySecurityCode(event)}
            className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-sm"
          >
            <div className="text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                <ShieldCheck className="h-7 w-7" aria-hidden="true" />
              </span>
              <h1 className="mt-4 text-2xl font-black tracking-tight text-foreground">
                Verificação em duas etapas
              </h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Sua senha foi confirmada. Enviamos um código de segurança para{" "}
                <strong className="text-foreground">{maskedEmail}</strong>.
              </p>
            </div>

            <div className="space-y-2">
              <label htmlFor="securityCode" className="text-sm font-semibold text-foreground">
                Código de 6 dígitos
              </label>
              <div className="relative">
                <MailCheck className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-gray-400" />
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
                  className="h-12 w-full rounded-md border border-input bg-background pl-10 pr-3 text-center text-xl font-black tracking-[0.32em] text-foreground outline-none transition focus:border-red-600 focus:ring-2 focus:ring-red-600/10"
                  placeholder="000000"
                />
              </div>
              <p className="text-xs leading-5 text-muted-foreground">
                {expiresLabel
                  ? `Este código expira por volta de ${expiresLabel}.`
                  : "O código expira em 10 minutos."}
              </p>
            </div>

            {errorMessage ? (
              <p role="alert" className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {errorMessage}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={verifyingCode || securityCode.length !== 6}
              className="inline-flex h-11 w-full items-center justify-center rounded-md bg-red-600 px-4 text-sm font-bold text-white transition hover:bg-red-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
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

            <button
              type="button"
              onClick={resetTwoFactorStep}
              className="inline-flex h-10 w-full items-center justify-center text-sm font-semibold text-gray-500 transition hover:text-gray-900"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar e usar outra conta
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f7f7] px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Brand />
          <h1 className="mt-6 text-2xl font-bold tracking-tight text-foreground">Entrar</h1>
          <p className="mt-2 text-sm text-muted-foreground">Acesse sua conta para continuar.</p>
        </div>

        <form
          onSubmit={(event) => void handleSubmit(event)}
          aria-busy={submitting}
          className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm"
        >
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium text-foreground">
              E-mail
            </label>
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
              className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-red-600 focus:ring-2 focus:ring-red-600/10"
              placeholder="seuemail@exemplo.com"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="password" className="text-sm font-medium text-foreground">
                Senha
              </label>
              <Link
                to="/esqueci-senha"
                className="text-xs font-semibold text-red-600 underline-offset-4 transition hover:text-red-700 hover:underline"
              >
                Esqueci minha senha
              </Link>
            </div>

            <div className="relative">
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
                className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 pr-11 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-red-600 focus:ring-2 focus:ring-red-600/10"
                placeholder="Sua senha"
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                aria-pressed={showPassword}
                className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center text-muted-foreground transition hover:text-foreground"
              >
                {showPassword ? (
                  <EyeOff className="h-4.5 w-4.5" aria-hidden="true" />
                ) : (
                  <Eye className="h-4.5 w-4.5" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          {errorMessage ? (
            <p role="alert" className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {errorMessage}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex h-11 w-full items-center justify-center rounded-md bg-red-600 px-4 text-sm font-bold text-white transition hover:bg-red-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
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

          <p className="text-center text-xs leading-5 text-muted-foreground">
            O acesso só é liberado depois da confirmação do e-mail.
          </p>

          <p className="text-center text-sm text-muted-foreground">
            Ainda não tem uma conta?{" "}
            <Link to="/cadastro" className="font-semibold text-red-600 underline-offset-4 hover:underline">
              Criar conta
            </Link>
          </p>
        </form>

        <p className="mt-4 text-center text-xs leading-relaxed text-muted-foreground">
          Você pode voltar à loja a qualquer momento sem perder o carrinho salvo neste navegador.
        </p>
      </div>
    </main>
  );
}
