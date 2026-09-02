import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { z } from "zod";

import {
  AccountDashboard,
  type AccountSection,
} from "@/components/account/AccountDashboard";
import { EmailTwoFactorPrompt } from "@/components/account/EmailTwoFactorPrompt";
import Footer from "@/components/layout/Footer";
import Header from "@/components/layout/Header";
import { useAuth } from "@/lib/auth";

const accountSearchSchema = z.object({
  secao: z.enum(["dados", "enderecos", "pedidos"]).optional(),
});

export const Route = createFileRoute("/conta")({
  validateSearch: (search) => accountSearchSchema.parse(search),
  component: AccountPage,
});

function AccountPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const { user, loading, signOut } = useAuth();
  const section: AccountSection = search.secao ?? "dados";

  useEffect(() => {
    if (!loading && !user) {
      void navigate({ to: "/login", replace: true });
    }
  }, [loading, navigate, user]);

  function handleSectionChange(nextSection: AccountSection) {
    void navigate({
      to: "/conta",
      search: nextSection === "dados" ? {} : { secao: nextSection },
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

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Header />
      <EmailTwoFactorPrompt />
      <main className="flex-1">
        <AccountDashboard
          email={user.email ?? "Conta BIGofertas"}
          section={section}
          onSectionChange={handleSectionChange}
          onSignOut={handleSignOut}
        />
      </main>
      <Footer />
    </div>
  );
}
