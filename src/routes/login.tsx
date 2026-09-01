import { Link, createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";

import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { user, loading, isOwner, signIn, signOut } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitting) {
      return;
    }

    setErrorMessage("");
    setSubmitting(true);

    const { error } = await signIn(email, password);

    if (error) {
      setErrorMessage(
        error.message === "Invalid login credentials"
          ? "E-mail ou senha incorretos."
          : error.message,
      );
    }

    setSubmitting(false);
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
        <p className="text-sm text-muted-foreground">Carregando conta...</p>
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
              className="text-2xl font-bold tracking-tight text-foreground"
            >
              BIGofertas
            </Link>

            <h1 className="mt-6 text-2xl font-semibold tracking-tight text-foreground">
              Sua conta
            </h1>

            <p className="mt-2 text-sm text-muted-foreground">
              Você já está conectado.
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
              <p className="mt-2 text-xs text-muted-foreground">
                Perfil: {isOwner ? "owner" : "customer"}
              </p>
            </div>

            {isOwner ? (
              <Link
                to="/admin"
                className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                Abrir painel administrativo
              </Link>
            ) : (
              <Link
                to="/conta"
                className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
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
              {signingOut ? "Saindo..." : "Sair para entrar com outra conta"}
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
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link
            to="/"
            className="text-2xl font-bold tracking-tight text-foreground"
          >
            BIGofertas
          </Link>

          <h1 className="mt-6 text-2xl font-semibold tracking-tight text-foreground">
            Entrar
          </h1>

          <p className="mt-2 text-sm text-muted-foreground">
            Acesse sua conta para continuar.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm"
        >
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
              onChange={(event) => setEmail(event.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20"
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

            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20"
              placeholder="Sua senha"
            />
          </div>

          {errorMessage ? (
            <p
              role="alert"
              className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {errorMessage}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Entrando..." : "Entrar"}
          </button>

          <p className="text-center text-sm text-muted-foreground">
            Ainda não tem uma conta?{" "}
            <Link
              to="/cadastro"
              className="font-medium text-foreground underline underline-offset-4"
            >
              Criar conta
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
