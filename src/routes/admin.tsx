import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  BadgePercent,
  Box,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  ShoppingBag,
  Store,
  UserRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { AffiliateAdmin } from "@/components/admin/AffiliateAdmin";
import { OrderAdmin } from "@/components/admin/OrderAdmin";
import { ProductAdmin } from "@/components/admin/ProductAdmin";
import { ProductImageAdmin } from "@/components/admin/ProductImageAdmin";
import { BrandWordmark } from "@/components/brand/BrandWordmark";
import { LiquidGlassCard } from "@/components/ui/liquid-glass-card";
import { BRAND } from "@/config/brand";
import { useAuth } from "@/lib/auth";
import { getUserFacingError } from "@/lib/user-facing-error";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

type AdminSection = "dashboard" | "orders" | "products" | "affiliates";

const NAV_ITEMS: Array<{
  id: AdminSection;
  label: string;
  description: string;
  icon: typeof LayoutDashboard;
}> = [
  {
    id: "dashboard",
    label: "Visão geral",
    description: "Resumo da operação",
    icon: LayoutDashboard,
  },
  {
    id: "orders",
    label: "Pedidos",
    description: "Pagamento, produção e entrega",
    icon: ShoppingBag,
  },
  {
    id: "products",
    label: "Produtos",
    description: "Catálogo e disponibilidade",
    icon: Box,
  },
  {
    id: "affiliates",
    label: "Afiliados",
    description: "Indicações, comissões e saques",
    icon: BadgePercent,
  },
];

function AdminPage() {
  const navigate = useNavigate();
  const { user, loading, isOwner, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [section, setSection] = useState<AdminSection>("dashboard");

  const currentSection = useMemo(
    () => NAV_ITEMS.find((item) => item.id === section) ?? NAV_ITEMS[0],
    [section],
  );

  useEffect(() => {
    if (loading) return;

    if (!user) {
      void navigate({ to: "/login", replace: true });
      return;
    }

    if (!isOwner) {
      void navigate({ to: "/", replace: true });
    }
  }, [user, loading, isOwner, navigate]);

  async function handleSignOut() {
    if (signingOut) return;

    setErrorMessage("");
    setSigningOut(true);

    const { error } = await signOut();

    if (error) {
      setErrorMessage(
        getUserFacingError(error, "Não foi possível sair do painel agora."),
      );
      setSigningOut(false);
      return;
    }

    await navigate({ to: "/login", replace: true });
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-transparent">
        <LiquidGlassCard
          blurIntensity="md"
          shadowIntensity="sm"
          glowIntensity="xs"
          borderRadius="16px"
          className="px-5 py-3 text-sm font-semibold text-gray-500"
        >
          Carregando painel...
        </LiquidGlassCard>
      </main>
    );
  }

  if (!user || !isOwner) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-transparent">
        <p className="text-sm font-medium text-gray-500">Redirecionando...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-transparent text-gray-950">
      <div className="min-h-screen lg:grid lg:grid-cols-[268px_minmax(0,1fr)]">
        <aside className="glass-panel hidden border-r border-white/70 bg-white/58 lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
          <div className="border-b border-white/70 px-5 py-5">
            <Link
              to="/"
              className="inline-flex items-center gap-3 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-red-500/40"
              aria-label={`Abrir loja ${BRAND.officialName}`}
            >
              <span className="premium-action flex h-10 w-10 items-center justify-center rounded-xl">
                <Store className="h-4.5 w-4.5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-base font-black tracking-[-0.035em] text-gray-950">
                  <BrandWordmark />
                </p>
                <p className="text-[11px] font-semibold text-gray-400">
                  Administração
                </p>
              </div>
            </Link>
          </div>

          <nav className="flex-1 px-3 py-5" aria-label="Seções administrativas">
            <p className="mb-3 px-3 text-[11px] font-bold uppercase tracking-[0.14em] text-gray-400">
              Operação
            </p>
            <div className="space-y-2">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = section === item.id;

                return (
                  <LiquidGlassCard
                    key={item.id}
                    as="button"
                    type="button"
                    onClick={() => setSection(item.id)}
                    aria-current={active ? "page" : undefined}
                    active={active}
                    interactive
                    blurIntensity="lg"
                    shadowIntensity={active ? "md" : "sm"}
                    glowIntensity={active ? "sm" : "xs"}
                    borderRadius="18px"
                    className={`flex w-full items-center gap-3 px-3.5 py-3 text-left ${
                      active ? "text-red-700" : "text-gray-700 hover:text-gray-950"
                    }`}
                  >
                    <span
                      className={`flex h-9 w-9 flex-none items-center justify-center rounded-xl border border-white/75 shadow-sm ${
                        active ? "bg-red-50/90 text-red-600" : "bg-white/62 text-gray-500"
                      }`}
                    >
                      <Icon className="h-4.5 w-4.5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-extrabold tracking-[-0.02em]">
                        {item.label}
                      </span>
                      <span
                        className={`mt-0.5 block truncate text-[11px] ${
                          active ? "text-red-600/75" : "text-gray-400"
                        }`}
                      >
                        {item.description}
                      </span>
                    </span>
                  </LiquidGlassCard>
                );
              })}
            </div>
          </nav>

          <div className="border-t border-white/70 p-3">
            <LiquidGlassCard
              as={Link}
              to="/"
              interactive
              blurIntensity="md"
              shadowIntensity="xs"
              glowIntensity="none"
              borderRadius="16px"
              className="flex items-center gap-3 px-3 py-3 text-sm font-semibold text-gray-600 hover:text-gray-950"
            >
              <ExternalLink className="h-4.5 w-4.5 text-gray-400" aria-hidden="true" />
              Abrir loja
            </LiquidGlassCard>
            <LiquidGlassCard
              as="button"
              type="button"
              disabled={signingOut}
              onClick={() => void handleSignOut()}
              interactive
              blurIntensity="md"
              shadowIntensity="xs"
              glowIntensity="none"
              borderRadius="16px"
              className="mt-2 flex w-full items-center gap-3 px-3 py-3 text-sm font-semibold text-gray-600 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <LogOut className="h-4.5 w-4.5" aria-hidden="true" />
              {signingOut ? "Saindo..." : "Sair"}
            </LiquidGlassCard>
          </div>
        </aside>

        <div className="min-w-0">
          <header className="glass-header sticky top-0 z-30">
            <div className="flex min-h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
              <div className="flex min-w-0 items-center gap-3">
                <Link
                  to="/"
                  className="premium-action flex h-9 w-9 flex-none items-center justify-center rounded-xl lg:hidden"
                  aria-label={`Abrir loja ${BRAND.officialName}`}
                >
                  <Store className="h-4.5 w-4.5" aria-hidden="true" />
                </Link>
                <div className="min-w-0">
                  <p className="truncate text-sm font-extrabold tracking-[-0.02em] text-gray-950">
                    {currentSection.label}
                  </p>
                  <p className="hidden text-xs text-gray-500 sm:block">
                    {currentSection.description}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="hidden items-center gap-2.5 sm:flex">
                  <span className="glass-card flex h-8 w-8 items-center justify-center rounded-full text-gray-600">
                    <UserRound className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="hidden max-w-56 md:block">
                    <p className="truncate text-xs font-bold text-gray-900">{user.email}</p>
                    <p className="text-[11px] text-gray-400">Proprietário</p>
                  </div>
                </div>

                <LiquidGlassCard
                  as="button"
                  type="button"
                  disabled={signingOut}
                  onClick={() => void handleSignOut()}
                  interactive
                  blurIntensity="sm"
                  shadowIntensity="xs"
                  glowIntensity="none"
                  borderRadius="14px"
                  className="inline-flex h-9 items-center justify-center px-3 text-xs font-bold text-gray-700 disabled:cursor-not-allowed disabled:opacity-50 lg:hidden"
                >
                  <LogOut className="mr-1.5 h-4 w-4" aria-hidden="true" />
                  {signingOut ? "Saindo..." : "Sair"}
                </LiquidGlassCard>
              </div>
            </div>

            <nav
              className="flex gap-2 overflow-x-auto border-t border-white/70 px-3 py-2.5 no-scrollbar lg:hidden"
              aria-label="Seções administrativas"
            >
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = section === item.id;

                return (
                  <LiquidGlassCard
                    key={item.id}
                    as="button"
                    type="button"
                    onClick={() => setSection(item.id)}
                    aria-current={active ? "page" : undefined}
                    active={active}
                    interactive
                    blurIntensity="sm"
                    shadowIntensity={active ? "sm" : "xs"}
                    glowIntensity="none"
                    borderRadius="15px"
                    className={`inline-flex h-10 flex-none items-center px-3 text-sm font-bold ${
                      active ? "text-red-700" : "text-gray-600"
                    }`}
                  >
                    <Icon className="mr-2 h-4 w-4" aria-hidden="true" />
                    {item.label}
                  </LiquidGlassCard>
                );
              })}
            </nav>
          </header>

          <div className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            {errorMessage ? (
              <p
                role="alert"
                className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
              >
                {errorMessage}
              </p>
            ) : null}

            {section === "dashboard" ? (
              <AdminDashboard onNavigate={(next) => setSection(next)} />
            ) : section === "orders" ? (
              <OrderAdmin />
            ) : section === "products" ? (
              <>
                <ProductAdmin />
                <ProductImageAdmin />
              </>
            ) : (
              <AffiliateAdmin />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
