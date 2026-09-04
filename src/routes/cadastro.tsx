import { Link, createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Eye, EyeOff, Loader2, MailCheck } from "lucide-react";
import { useState, type FormEvent } from "react";

import { BrandWordmark } from "@/components/brand/BrandWordmark";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/cadastro")({
  component: RegisterPage,
});

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

  const nameValid = fullName.trim().length >= 2;
  const passwordValid = password.length >= 8;
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const formReady = nameValid && email.trim().length > 0 && passwordValid && passwordsMatch;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!formReady || submitting) return;

    setSubmitting(true);
    setErrorMessage("");

    const { error } = await signUp(email.trim(), password, fullName.trim());

    if (error) {
      setErrorMessage(error.message);
      setSubmitting(false);
      return;
    }

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
      <main className="flex min-h-screen items-center justify-center bg-[#f7f7f7] px-4">
        <Loader2 className="h-6 w-6 animate-spin text-red-600 motion-reduce:animate-none" />
      </main>
    );
  }

  if (user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f7f7] px-4 py-12">
        <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm">
          <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
          <h1 className="mt-4 text-xl font-black text-gray-950">Você já está conectado</h1>
          <p className="mt-2 text-sm text-gray-500">
            Use sua conta atual ou saia para criar outra.
          </p>
          <div className="mt-6 space-y-2">
            <Link
              to={isOwner ? "/admin" : "/conta"}
              className="flex h-11 items-center justify-center rounded-lg bg-red-600 px-4 text-sm font-bold text-white hover:bg-red-700"
            >
              Abrir minha conta
            </Link>
            <button
              type="button"
              onClick={() => void handleSignOut()}
              disabled={signingOut}
              className="h-11 w-full rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
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
      <main className="flex min-h-screen items-center justify-center bg-[#f7f7f7] px-4 py-12">
        <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-7 text-center shadow-sm">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
            <MailCheck className="h-7 w-7" />
          </span>
          <h1 className="mt-5 text-2xl font-black tracking-tight text-gray-950">
            Confirme seu e-mail
          </h1>
          <p className="mt-3 text-sm leading-6 text-gray-600">
            Enviamos uma confirmação para <strong>{email.trim()}</strong>. Sua conta só poderá ser acessada depois que o e-mail for confirmado.
          </p>
          {errorMessage ? (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorMessage}
            </p>
          ) : null}
          <div className="mt-6 space-y-2">
            <Link
              to="/login"
              className="flex h-11 items-center justify-center rounded-lg bg-red-600 px-4 text-sm font-bold text-white hover:bg-red-700"
            >
              Ir para entrar
            </Link>
            <button
              type="button"
              onClick={() => void handleResend()}
              disabled={resending}
              className="h-11 w-full rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {resending ? "Reenviando..." : "Reenviar e-mail de confirmação"}
            </button>
          </div>
        </div>
      </main>
    );
  }

  const inputClass =
    "h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-950 outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-50";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f7f7] px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-7 text-center">
          <Link to="/" className="text-2xl font-black italic tracking-tight text-gray-950">
            <BrandWordmark />
          </Link>
          <h1 className="mt-5 text-2xl font-black tracking-tight text-gray-950">Criar conta</h1>
          <p className="mt-2 text-sm text-gray-500">
            Comece com o básico. Os dados de compra serão preenchidos só quando você finalizar um pedido.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
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
            <span className={`mt-1.5 block text-xs ${password && !passwordValid ? "text-amber-700" : "text-gray-400"}`}>
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
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorMessage}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={!formReady || submitting}
            className="flex h-12 w-full items-center justify-center rounded-lg bg-red-600 px-4 text-sm font-black text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-300"
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
