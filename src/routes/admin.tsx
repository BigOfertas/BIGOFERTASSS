import {
  Link,
  createFileRoute,
  useNavigate,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { OrderAdmin } from "@/components/admin/OrderAdmin";
import { ProductAdmin } from "@/components/admin/ProductAdmin";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

function AdminPage() {
  const navigate = useNavigate();

  const {
    user,
    loading,
    isOwner,
    signOut,
  } = useAuth();

  const [signingOut, setSigningOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [section, setSection] = useState<"orders" | "products">("orders");

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!user) {
      void navigate({
        to: "/login",
        replace: true,
      });

      return;
    }

    if (!isOwner) {
      void navigate({
        to: "/",
        replace: true,
      });
    }
  }, [user, loading, isOwner, navigate]);

  async function handleSignOut() {
    if (signingOut) {
      return;
    }

    setErrorMessage("");
    setSigningOut(true);

    const { error } = await signOut();

    if (error) {
      setErrorMessage(error.message);
      setSigningOut(false);
      return;
    }

    await navigate({
      to: "/login",
      replace: true,
    });
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">
          Carregando...
        </p>
      </main>
    );
  }

  if (!user || !isOwner) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">
          Redirecionando...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="text-xl font-bold tracking-tight text-foreground"
            >
              BIGofertas
            </Link>

            <span className="hidden rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground sm:inline-flex">
              Administração
            </span>
          </div>

          <button
            type="button"
            disabled={signingOut}
            onClick={() => void handleSignOut()}
            className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            {signingOut ? "Saindo..." : "Sair"}
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-medium text-muted-foreground">
              Administração
            </p>

            <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">
              Painel BIGofertas
            </h1>

            <p className="mt-3 text-muted-foreground">
              Pedidos e catálogo organizados para a operação diária da loja.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card px-5 py-4 lg:min-w-72">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Conta conectada
            </p>
            <p className="mt-1 truncate text-sm font-medium text-foreground">
              {user.email}
            </p>
            <p className="mt-2 inline-flex rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground">
              owner
            </p>
          </div>
        </div>

        {errorMessage ? (
          <p
            role="alert"
            className="mt-5 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {errorMessage}
          </p>
        ) : null}

        <nav
          className="mt-7 flex w-fit rounded-xl border border-border bg-card p-1 shadow-sm"
          aria-label="Seções administrativas"
        >
          <button
            type="button"
            onClick={() => setSection("orders")}
            aria-current={section === "orders" ? "page" : undefined}
            className={`rounded-lg px-4 py-2.5 text-sm font-bold transition ${
              section === "orders"
                ? "bg-gray-950 text-white shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            Pedidos
          </button>
          <button
            type="button"
            onClick={() => setSection("products")}
            aria-current={section === "products" ? "page" : undefined}
            className={`rounded-lg px-4 py-2.5 text-sm font-bold transition ${
              section === "products"
                ? "bg-gray-950 text-white shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            Produtos
          </button>
        </nav>

        {section === "orders" ? <OrderAdmin /> : <ProductAdmin />}
      </div>
    </main>
  );
}
