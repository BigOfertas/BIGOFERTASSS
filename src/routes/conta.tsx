import { Outlet, createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { z } from "zod";

import { AffiliateAccountPage } from "@/components/account/AffiliateAccountPage";
import { AccountDashboard, type AccountSection } from "@/components/account/AccountDashboard";
import { AccountOverview } from "@/components/account/AccountOverview";
import { EmailTwoFactorPrompt } from "@/components/account/EmailTwoFactorPrompt";
import Header from "@/components/layout/Header";
import { BRAND } from "@/config/brand";
import { useAuth } from "@/lib/auth";

const accountSearchSchema = z.object({
  secao: z.enum(["dados", "enderecos", "pedidos", "afiliados"]).optional(),
  order_nsu: z.string().trim().max(64).optional(),
  celebrate: z.literal("1").optional(),
});

type AccountRouteSection = AccountSection | "afiliados";

export const Route = createFileRoute("/conta")({
  validateSearch: (search) => accountSearchSchema.parse(search),
  component: AccountPage,
});

function AccountPage() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const search = Route.useSearch();
  const { user, loading, signOut } = useAuth();
  const section: AccountRouteSection | null = search.secao ?? null;
  const showingOrderDetail = pathname.startsWith("/conta/pedidos/");

  useEffect(() => {
    if (!loading && !user) {
      void navigate({ to: "/login", replace: true });
    }
  }, [loading, navigate, user]);

  useEffect(() => {
    if (loading || !user || showingOrderDetail || !search.order_nsu) return;

    const orderNumber = search.order_nsu.trim().toUpperCase();
    if (!/^BIG-[0-9]{4}-[0-9]{6,}$/.test(orderNumber)) return;

    void navigate({
      to: "/conta/pedidos/$orderNumber",
      params: { orderNumber },
      search: { celebrate: "1" },
      replace: true,
    });
  }, [loading, navigate, search.order_nsu, showingOrderDetail, user]);

  function handleSectionChange(nextSection: AccountRouteSection) {
    void navigate({
      to: "/conta",
      search: { secao: nextSection },
    });
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
          <p className="text-sm text-gray-500">Carregando sua conta...</p>
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
