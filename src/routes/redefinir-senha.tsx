import { Link, createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Eye, EyeOff, KeyRound, Loader2, ShieldAlert } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { BrandWordmark } from "@/components/brand/BrandWordmark";
import { supabase } from "@/integrations/supabase/client";
import { getUserFacingError } from "@/lib/user-facing-error";

export const Route = createFileRoute("/redefinir-senha")({
  component: ResetPasswordPage,
});

function hasRecoveryMarker() {
  if (typeof window === "undefined") return false;

  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const search = new URLSearchParams(window.location.search);

  return hash.get("type") === "recovery" || search.get("type") === "recovery";
}

function ResetPasswordPage() {
  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;
    const recoveryMarkerPresent = hasRecoveryMarker();

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;

      if (!error && data.session && recoveryMarkerPresent) {
        setAuthorized(true);
      }

      setChecking(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;

      if (event === "PASSWORD_RECOVERY" && session) {
        setAuthorized(true);
        setChecking(false);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || !authorized) return;

    setErrorMessage("");

    if (password.length < 8) {
      setErrorMessage("A nova senha precisa ter pelo menos 8 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("As duas senhas precisam ser iguais.");
      return;
    }

    setSubmitting(true);

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setErrorMessage(getUserFacingError(error, "Não foi possível alterar sua senha agora."));
      setSubmitting(false);
      return;
    }

    await supabase.auth.signOut().catch(() => undefined);
    setSuccess(true);
    setSubmitting(false);

    if (typeof window !== "undefined") {
      window.history.replaceState({}, document.title, "/redefinir-senha");
    }
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
          {checking ? (
            <div className="py-8 text-center text-muted-foreground">
              <Loader2 className="mx-auto h-6 w-6 animate-spin" aria-hidden="true" />
              <p className="mt-3 text-sm">Verificando seu link...</p>
            </div>
          ) : success ? (
            <div className="text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
              </span>

              <h1 className="mt-4 text-2xl font-black tracking-tight text-foreground">
                Senha alterada
              </h1>

              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Sua nova senha foi salva. Agora você já pode entrar novamente.
              </p>

              <Link
                to="/login"
                className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-md bg-red-600 px-4 text-sm font-bold text-white transition hover:bg-red-700 active:scale-[0.99]"
              >
                Entrar com a nova senha
              </Link>
            </div>
          ) : !authorized ? (
            <div className="text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
                <ShieldAlert className="h-7 w-7" aria-hidden="true" />
              </span>

              <h1 className="mt-4 text-2xl font-black tracking-tight text-foreground">
                Link inválido ou expirado
              </h1>

              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Solicite um novo e-mail de recuperação para criar outra senha.
              </p>

              <Link
                to="/esqueci-senha"
                className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-md bg-red-600 px-4 text-sm font-bold text-white transition hover:bg-red-700 active:scale-[0.99]"
              >
                Solicitar novo link
              </Link>
            </div>
          ) : (
            <form onSubmit={(event) => void handleSubmit(event)} aria-busy={submitting}>
              <div className="text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600">
                  <KeyRound className="h-7 w-7" aria-hidden="true" />
                </span>

                <h1 className="mt-4 text-2xl font-black tracking-tight text-foreground">
                  Crie uma nova senha
                </h1>

                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Escolha uma senha nova e diferente da anterior.
                </p>
              </div>

              <div className="mt-6 space-y-2">
                <label htmlFor="newPassword" className="text-sm font-semibold text-foreground">
                  Nova senha
                </label>
                <div className="relative">
                  <input
                    id="newPassword"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    autoFocus
                    required
                    minLength={8}
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      if (errorMessage) setErrorMessage("");
                    }}
                    className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 pr-11 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-red-600 focus:ring-2 focus:ring-red-600/10"
                    placeholder="Mínimo de 8 caracteres"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center text-muted-foreground transition hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                  </button>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <label htmlFor="confirmNewPassword" className="text-sm font-semibold text-foreground">
                  Confirmar nova senha
                </label>
                <div className="relative">
                  <input
                    id="confirmNewPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    minLength={8}
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
                    onClick={() => setShowConfirmPassword((value) => !value)}
                    aria-label={showConfirmPassword ? "Ocultar confirmação da senha" : "Mostrar confirmação da senha"}
                    className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center text-muted-foreground transition hover:text-foreground"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                  </button>
                </div>
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
                    Salvando...
                  </>
                ) : (
                  "Salvar nova senha"
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
