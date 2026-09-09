import { Outlet, createFileRoute, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { CheckCircle2, PackageCheck, X } from "lucide-react";
import { useEffect, useState } from "react";
import { z } from "zod";

import { AffiliateAccountPage } from "@/components/account/AffiliateAccountPage";
import { AccountDashboard, type AccountSection } from "@/components/account/AccountDashboard";
import { AccountOverview } from "@/components/account/AccountOverview";
import { EmailTwoFactorPrompt } from "@/components/account/EmailTwoFactorPrompt";
import Header from "@/components/layout/Header";
import { BRAND } from "@/config/brand";
import { useAuth } from "@/lib/auth";
import {
  clearLastCheckoutSnapshot,
  readLastCheckoutSnapshot,
  type LastCheckoutSnapshot,
} from "@/lib/checkout";

const accountSearchSchema = z.object({
  secao: z.enum(["dados", "enderecos", "pedidos", "afiliados"]).optional(),
});

type AccountRouteSection = AccountSection | "afiliados";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export const Route = createFileRoute("/conta")({
  validateSearch: (search) => accountSearchSchema.parse(search),
  component: AccountPage,
});

function AccountPage() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const search = Route.useSearch();
  const { user, loading, signOut } = useAuth();
  const [lastCheckout, setLastCheckout] = useState<LastCheckoutSnapshot | null>(null);
  const section: AccountRouteSection | null = search.secao ?? null;
  const showingOrderDetail = pathname.startsWith("/conta/pedidos/");

  useEffect(() => {
    if (!loading && !user) {
      void navigate({ to: "/login", replace: true });
    }
  }, [loading, navigate, user]);

  useEffect(() => {
    if (typeof window === "undefined" || showingOrderDetail) return;
    setLastCheckout(readLastCheckoutSnapshot());
  }, [showingOrderDetail]);

  function handleSectionChange(nextSection: AccountRouteSection) {
    void navigate({
      to: "/conta",
      search: { secao: nextSection },
    });
  }

  function dismissCheckoutConfirmation() {
    clearLastCheckoutSnapshot();
    setLastCheckout(null);
  }

  async function handleSignOut() {
    const { error } = await signOut();

    if (error) {
      throw new Error(error.message);
    }

    await navigate({ to: "/login", replace: true });
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-white">
        <Header />
        <main className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xl animate-pulse space-y-3 px-4">
            <div className="h-6 w-52 rounded bg-gray-100" />
            <div className="h-28 rounded-xl bg-gray-100" />
          </div>
        </main>
      </div>
    );
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white">
        <p className="text-sm text-gray-500">Redirecionando...</p>
      </main>
    );
  }

  if (showingOrderDetail) {
    return <Outlet />;
  }

  const fallbackAccountLabel = `Conta ${BRAND.officialName}`;

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Header />
      <EmailTwoFactorPrompt />

      {lastCheckout ? (
        <section className="mx-auto mt-6 w-full max-w-7xl px-4 sm:px-6 lg:px-8" aria-label="Confirmação do pedido">
          <div className="relative overflow-hidden rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 sm:p-6">
            <button
              type="button"
              onClick={dismissCheckoutConfirmation}
              aria-label="Fechar confirmação do pedido"
              className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full text-emerald-800 hover:bg-white"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-emerald-600 text-white">
                <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1 pr-8 sm:pr-0">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-700">Pedido recebido</p>
                <h1 className="mt-1 text-xl font-black tracking-tight text-gray-950 sm:text-2xl">
                  Pedido {lastCheckout.orderNumber}
                </h1>
                <p className="mt-1 text-sm leading-6 text-gray-600">
                  Total {currency.format(lastCheckout.totalAmount)}. Se você acabou de pagar, a confirmação pode levar alguns instantes para aparecer no status do pedido.
                </p>
              </div>
              <div className="flex flex-none flex-col gap-2 sm:items-end">
                <Link
                  to="/conta/pedidos/$orderNumber"
                  params={{ orderNumber: lastCheckout.orderNumber }}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 text-xs font-black text-white hover:bg-emerald-800"
                >
                  <PackageCheck className="h-4 w-4" />
                  Acompanhar pedido
                </Link>
                <button type="button" onClick={dismissCheckoutConfirmation} className="text-xs font-bold text-gray-500 hover:text-gray-900">
                  Entendi
                </button>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <main className="flex-1">
        {section === "afiliados" ? (
          <AffiliateAccountPage onNavigate={handleSectionChange} />
        ) : section ? (
          <AccountDashboard
            email={user.email ?? fallbackAccountLabel}
            section={section}
            onSectionChange={handleSectionChange}
            onSignOut={handleSignOut}
          />
        ) : (
          <AccountOverview
            email={user.email ?? fallbackAccountLabel}
            onNavigate={handleSectionChange}
            onSignOut={handleSignOut}
          />
        )}
      </main>
    </div>
  );
}
