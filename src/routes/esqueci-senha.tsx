import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, Loader2, Mail } from "lucide-react";
import { useState, type FormEvent } from "react";

import { BrandWordmark } from "@/components/brand/BrandWordmark";
import { supabase } from "@/integrations/supabase/client";
import { getUserFacingError } from "@/lib/user-facing-error";

export const Route = createFileRoute("/esqueci-senha")({
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return;

    setSubmitting(true);
    setErrorMessage("");

    const redirectTo =
      typeof window !== "undefined"
        ? new URL("/redefinir-senha", window.location.origin).toString()
        : undefined;

    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      ...(redirectTo ? { redirectTo } : {}),
    });

    if (error) {
      setErrorMessage(
        getUserFacingError(error, "Não foi possível enviar o e-mail de recuperação agora."),
      );
    } else {
      setSent(true);
    }

    setSubmitting(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f7f7] px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link to="/" className="text-2xl font-black italic tracking-tight text-foreground">
            <BrandWordmark />
          </Link>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          {sent ? (
            <div className="text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
              </span>

              <h1 className="mt-4 text-2xl font-black tracking-tight text-foreground">
                Confira seu e-mail
              </h1>

              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Se existir uma conta cadastrada com <strong className="text-foreground">{email.trim()}</strong>, você receberá um link para criar uma nova senha.
              </p>

              <p className="mt-3 text-xs leading-5 text-muted-foreground">
                O envio pode levar alguns instantes. Confira também a caixa de spam ou lixo eletrônico.
              </p>

              <Link
                to="/login"
                className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-md bg-red-600 px-4 text-sm font-bold text-white transition hover:bg-red-700 active:scale-[0.99]"
              >
                Voltar para entrar
              </Link>
            </div>
          ) : (
            <form onSubmit={(event) => void handleSubmit(event)} aria-busy={submitting}>
              <div className="text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600">
                  <Mail className="h-7 w-7" aria-hidden="true" />
                </span>

                <h1 className="mt-4 text-2xl font-black tracking-tight text-foreground">
                  Esqueceu sua senha?
                </h1>

                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Informe o e-mail da sua conta. Enviaremos um link para você criar uma nova senha.
                </p>
              </div>

              <div className="mt-6 space-y-2">
                <label htmlFor="recoveryEmail" className="text-sm font-semibold text-foreground">
                  E-mail
                </label>
                <input
                  id="recoveryEmail"
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

              {errorMessage ? (
                <p role="alert" className="mt-4 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {errorMessage}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={submitting}
                className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-md bg-red-600 px-4 text-sm font-bold text-white transition hover:bg-red-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  "Enviar link de recuperação"
                )}
              </button>

              <Link
                to="/login"
                className="mt-3 inline-flex h-10 w-full items-center justify-center text-sm font-semibold text-muted-foreground transition hover:text-foreground"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar para entrar
              </Link>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
