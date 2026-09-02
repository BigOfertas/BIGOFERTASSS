import { Link, createFileRoute } from "@tanstack/react-router";
import {
  CheckCircle2,
  Circle,
  Eye,
  EyeOff,
  Loader2,
  MailCheck,
} from "lucide-react";
import { useState, type FormEvent } from "react";

import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/cadastro")({
  component: RegisterPage,
});

function RegisterPage() {
  const {
    user,
    loading,
    isOwner,
    signUp,
    resendSignUpConfirmation,
    signOut,
  } = useAuth();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [resendingConfirmation, setResendingConfirmation] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const passwordLongEnough = password.length >= 6;
  const passwordsMatch =
    confirmPassword.length > 0 && password === confirmPassword;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitting) {
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");

    if (!passwordLongEnough) {
      setErrorMessage("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    if (!passwordsMatch) {
      setErrorMessage("As senhas não coincidem.");
      return;
    }

    setSubmitting(true);

    const normalizedEmail = email.trim();
    const { error } = await signUp(
      normalizedEmail,
      password,
      fullName.trim(),
    );

    if (error) {
      setErrorMessage(error.message);
      setSubmitting(false);
      return;
    }

    setSuccessMessage(
      "Conta criada. Enviamos um e-mail de confirmação; ao confirmar, você voltará para a BIGofertas.",
    );
    setPassword("");
    setConfirmPassword("");
    setSubmitting(false);
  }

  async function handleResendConfirmation() {
    if (resendingConfirmation) {
      return;
    }

    const normalizedEmail = email.trim();

    if (!normalizedEmail) {
      setSuccessMessage("");
      setErrorMessage("Digite o e-mail da conta acima para reenviar a confirmação.");
      return;
    }

    setResendingConfirmation(true);
    setErrorMessage("");
    setSuccessMessage("");

    const { error } = await resendSignUpConfirmation(normalizedEmail);

    if (error) {
      setErrorMessage(
        error.message.toLowerCase().includes("rate limit")
          ? "Aguarde um pouco antes de pedir outro e-mail de confirmação."
          : error.message,
      );
      setResendingConfirmation(false);
      return;
    }

    setSuccessMessage(
      "Novo e-mail de confirmação enviado. Use o link mais recente recebido.",
    );
    setResendingConfirmation(false);
  }

  async function handleSignOut() {
    if (signingOut) {
      return;
    }

    setErrorMessage("");
    setSigningOut(true);

    const { error } = await signOut();

    if (error) {
      setErrorMessage(error.message);
    }

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
      <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <Link
              to="/"
              className="text-2xl font-black italic tracking-tight text-foreground"
            >
              <span className="text-red-600">BIG</span>ofertas
            </Link>

            <h1 className="mt-6 text-2xl font-semibold tracking-tight text-foreground">
              Conta já conectada
            </h1>

            <p className="mt-2 text-sm text-muted-foreground">
              Para criar outra conta, saia da sessão atual primeiro.
            </p>
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

            {isOwner ? (
              <Link
                to="/admin"
                className="inline-flex h-11 w-full items-center justify-center rounded-md bg-red-600 px-4 text-sm font-bold text-white transition hover:bg-red-700 active:scale-[0.99]"
              >
                Voltar ao painel administrativo
              </Link>
            ) : (
              <Link
                to="/conta"
                className="inline-flex h-11 w-full items-center justify-center rounded-md bg-red-600 px-4 text-sm font-bold text-white transition hover:bg-red-700 active:scale-[0.99]"
              >
                Abrir minha conta
              </Link>
            )}

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
                "Sair para criar outra conta"
              )}
            </button>

            {errorMessage ? (
              <p
                role="alert"
                className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {errorMessage}
              </p>
            ) : null}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f7f7] px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link
            to="/"
            className="text-2xl font-black italic tracking-tight text-foreground"
          >
            <span className="text-red-600">BIG</span>ofertas
          </Link>

          <h1 className="mt-6 text-2xl font-bold tracking-tight text-foreground">
            Criar conta
          </h1>

          <p className="mt-2 text-sm text-muted-foreground">
            Leva menos de um minuto e você pode completar seus dados depois.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          aria-busy={submitting}
          className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm"
        >
          <div className="space-y-2">
            <label
              htmlFor="fullName"
              className="text-sm font-medium text-foreground"
            >
              Nome
            </label>

            <input
              id="fullName"
              type="text"
              autoComplete="name"
              autoFocus
              value={fullName}
              onChange={(event) => {
                setFullName(event.target.value);
                if (errorMessage) setErrorMessage("");
              }}
              className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-red-600 focus:ring-2 focus:ring-red-600/10"
              placeholder="Seu nome"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="email"
              className="text-sm font-medium text-foreground"
            >
              E-mail
            </label>

            <input
              id="email"
              type="email"
              autoComplete="email"
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
            <label
              htmlFor="password"
              className="text-sm font-medium text-foreground"
            >
              Senha
            </label>

            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                minLength={6}
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  if (errorMessage) setErrorMessage("");
                }}
                className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 pr-11 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-red-600 focus:ring-2 focus:ring-red-600/10"
                placeholder="Mínimo de 6 caracteres"
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

            <div className="flex items-center gap-2 text-xs">
              {passwordLongEnough ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <Circle className="h-3.5 w-3.5 text-gray-300" />
              )}
              <span
                className={
                  passwordLongEnough ? "text-emerald-700" : "text-muted-foreground"
                }
              >
                Pelo menos 6 caracteres
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="confirmPassword"
              className="text-sm font-medium text-foreground"
            >
              Confirmar senha
            </label>

            <div className="relative">
              <input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(event) => {
                  setConfirmPassword(event.target.value);
                  if (errorMessage) setErrorMessage("");
                }}
                className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 pr-11 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-red-600 focus:ring-2 focus:ring-red-600/10"
                placeholder="Digite a senha novamente"
              />
              <button
                type="button"
                onClick={() =>
                  setShowConfirmPassword((visible) => !visible)
                }
                aria-label={
                  showConfirmPassword
                    ? "Ocultar confirmação da senha"
                    : "Mostrar confirmação da senha"
                }
                aria-pressed={showConfirmPassword}
                className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center text-muted-foreground transition hover:text-foreground"
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4.5 w-4.5" aria-hidden="true" />
                ) : (
                  <Eye className="h-4.5 w-4.5" aria-hidden="true" />
                )}
              </button>
            </div>

            {confirmPassword ? (
              <div className="flex items-center gap-2 text-xs">
                {passwordsMatch ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <Circle className="h-3.5 w-3.5 text-amber-500" />
                )}
                <span
                  className={
                    passwordsMatch ? "text-emerald-700" : "text-amber-700"
                  }
                >
                  {passwordsMatch ? "As senhas coincidem" : "As senhas ainda não coincidem"}
                </span>
              </div>
            ) : null}
          </div>

          {errorMessage ? (
            <p
              role="alert"
              className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {errorMessage}
            </p>
          ) : null}

          {successMessage ? (
            <p
              role="status"
              className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
            >
              {successMessage}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={submitting || !passwordLongEnough || !passwordsMatch}
            className="inline-flex h-11 w-full items-center justify-center rounded-md bg-red-600 px-4 text-sm font-bold text-white transition hover:bg-red-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Criando conta...
              </>
            ) : (
              "Criar conta"
            )}
          </button>

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-center">
            <p className="text-xs leading-relaxed text-muted-foreground">
              Já criou a conta, mas precisa de outro link de confirmação?
            </p>
            <button
              type="button"
              onClick={() => void handleResendConfirmation()}
              disabled={resendingConfirmation}
              className="mt-2 inline-flex items-center justify-center text-sm font-semibold text-red-600 transition hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {resendingConfirmation ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <MailCheck className="mr-2 h-4 w-4" />
              )}
              {resendingConfirmation
                ? "Reenviando..."
                : "Reenviar e-mail de confirmação"}
            </button>
          </div>

          <p className="text-center text-sm text-muted-foreground">
            Já possui uma conta?{" "}
            <Link
              to="/login"
              className="font-semibold text-red-600 underline-offset-4 hover:underline"
            >
              Entrar
            </Link>
          </p>
        </form>

        <p className="mt-4 text-center text-xs leading-relaxed text-muted-foreground">
          Depois do cadastro, você poderá salvar dados de contato e endereços na sua área de cliente.
        </p>
      </div>
    </main>
  );
}
