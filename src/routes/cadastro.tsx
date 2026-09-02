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
import {
  formatBrazilianCpf,
  formatBrazilianPhone,
  isValidBrazilianCpf,
  isValidBrazilianPhone,
} from "@/lib/brasil";

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
  const [phone, setPhone] = useState("");
  const [cpf, setCpf] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [resendingConfirmation, setResendingConfirmation] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const nameValid = fullName.trim().length >= 2;
  const phoneValid = isValidBrazilianPhone(phone);
  const cpfValid = isValidBrazilianCpf(cpf);
  const passwordLongEnough = password.length >= 6;
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const formReady =
    nameValid &&
    email.trim().length > 0 &&
    phoneValid &&
    cpfValid &&
    passwordLongEnough &&
    passwordsMatch;

  function clearMessages() {
    if (errorMessage) setErrorMessage("");
    if (successMessage) setSuccessMessage("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitting) return;

    setErrorMessage("");
    setSuccessMessage("");

    if (!nameValid) {
      setErrorMessage("Informe seu nome completo.");
      return;
    }

    if (!phoneValid) {
      setErrorMessage("Informe um telefone com um DDD brasileiro válido.");
      return;
    }

    if (!cpfValid) {
      setErrorMessage("Informe um CPF válido.");
      return;
    }

    if (!passwordLongEnough) {
      setErrorMessage("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    if (!passwordsMatch) {
      setErrorMessage("As senhas não coincidem.");
      return;
    }

    setSubmitting(true);

    const { error } = await signUp(
      email.trim(),
      password,
      fullName.trim(),
      phone,
      cpf,
    );

    if (error) {
      setErrorMessage(error.message);
      setSubmitting(false);
      return;
    }

    setSuccessMessage(
      "Conta criada. Enviamos um e-mail de confirmação; use o link mais recente recebido para voltar à BIGofertas.",
    );
    setPassword("");
    setConfirmPassword("");
    setSubmitting(false);
  }

  async function handleResendConfirmation() {
    if (resendingConfirmation) return;

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
      <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <Link to="/" className="text-2xl font-black italic tracking-tight text-foreground">
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

            <Link
              to={isOwner ? "/admin" : "/conta"}
              className="inline-flex h-11 w-full items-center justify-center rounded-md bg-red-600 px-4 text-sm font-bold text-white transition hover:bg-red-700 active:scale-[0.99]"
            >
              {isOwner ? "Voltar ao painel administrativo" : "Abrir minha conta"}
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
                "Sair para criar outra conta"
              )}
            </button>
          </div>
        </div>
      </main>
    );
  }

  const inputClass =
    "flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-red-600 focus:ring-2 focus:ring-red-600/10";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f7f7] px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link to="/" className="text-2xl font-black italic tracking-tight text-foreground">
            <span className="text-red-600">BIG</span>ofertas
          </Link>
          <h1 className="mt-6 text-2xl font-bold tracking-tight text-foreground">
            Criar conta
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Preencha seus dados para deixar a conta pronta para compras e entregas.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          aria-busy={submitting}
          className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm"
        >
          <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs leading-relaxed text-gray-500">
            Os campos abaixo são obrigatórios. Complementos de endereço serão opcionais na sua área de cliente.
          </p>

          <div className="space-y-2">
            <label htmlFor="fullName" className="text-sm font-semibold text-foreground">
              Nome completo
            </label>
            <input
              id="fullName"
              type="text"
              autoComplete="name"
              autoFocus
              required
              minLength={2}
              maxLength={120}
              value={fullName}
              onChange={(event) => {
                setFullName(event.target.value);
                clearMessages();
              }}
              className={inputClass}
              placeholder="Seu nome completo"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-semibold text-foreground">
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
                clearMessages();
              }}
              className={inputClass}
              placeholder="seuemail@exemplo.com"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="phone" className="text-sm font-semibold text-foreground">
                Telefone
              </label>
              <input
                id="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                required
                value={phone}
                onChange={(event) => {
                  setPhone(formatBrazilianPhone(event.target.value));
                  clearMessages();
                }}
                className={inputClass}
                placeholder="(84) 99999-9999"
                aria-invalid={phone.length > 0 && !phoneValid}
              />
              <p className={`text-xs ${phone.length > 0 && !phoneValid ? "text-amber-700" : "text-gray-400"}`}>
                {phone.length > 0 && !phoneValid
                  ? "Use um DDD brasileiro existente."
                  : "Aceitamos telefone fixo ou celular com DDD válido."}
              </p>
            </div>

            <div className="space-y-2">
              <label htmlFor="cpf" className="text-sm font-semibold text-foreground">
                CPF
              </label>
              <input
                id="cpf"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                required
                value={cpf}
                onChange={(event) => {
                  setCpf(formatBrazilianCpf(event.target.value));
                  clearMessages();
                }}
                className={inputClass}
                placeholder="000.000.000-00"
                aria-invalid={cpf.length > 0 && !cpfValid}
              />
              <p className={`text-xs ${cpf.length > 0 && !cpfValid ? "text-amber-700" : "text-gray-400"}`}>
                {cpf.length > 0 && !cpfValid
                  ? "Confira os 11 dígitos do CPF."
                  : "O CPF ficará vinculado à sua conta."}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-semibold text-foreground">
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
                  clearMessages();
                }}
                className={`${inputClass} pr-11`}
                placeholder="Mínimo de 6 caracteres"
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center text-muted-foreground transition hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
              </button>
            </div>
            <div className="flex items-center gap-2 text-xs">
              {passwordLongEnough ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <Circle className="h-3.5 w-3.5 text-gray-300" />
              )}
              <span className={passwordLongEnough ? "text-emerald-700" : "text-muted-foreground"}>
                Pelo menos 6 caracteres
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="confirmPassword" className="text-sm font-semibold text-foreground">
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
                  clearMessages();
                }}
                className={`${inputClass} pr-11`}
                placeholder="Digite a senha novamente"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((visible) => !visible)}
                aria-label={showConfirmPassword ? "Ocultar confirmação da senha" : "Mostrar confirmação da senha"}
                className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center text-muted-foreground transition hover:text-foreground"
              >
                {showConfirmPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
              </button>
            </div>
            {confirmPassword ? (
              <div className="flex items-center gap-2 text-xs">
                {passwordsMatch ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <Circle className="h-3.5 w-3.5 text-amber-500" />
                )}
                <span className={passwordsMatch ? "text-emerald-700" : "text-amber-700"}>
                  {passwordsMatch ? "As senhas coincidem" : "As senhas ainda não coincidem"}
                </span>
              </div>
            ) : null}
          </div>

          {errorMessage ? (
            <p role="alert" className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {errorMessage}
            </p>
          ) : null}

          {successMessage ? (
            <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {successMessage}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={submitting || !formReady}
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
              {resendingConfirmation ? "Enviando..." : "Reenviar e-mail de confirmação"}
            </button>
          </div>

          <p className="text-center text-sm text-muted-foreground">
            Já possui uma conta?{" "}
            <Link to="/login" className="font-semibold text-red-600 underline-offset-4 hover:underline">
              Entrar
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
