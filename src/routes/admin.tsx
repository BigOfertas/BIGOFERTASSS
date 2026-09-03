import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Box,
  LayoutDashboard,
  LogOut,
  ShoppingBag,
  Store,
  UserRound,
} from "lucide-react";
import { useEffect, useState } from "react";

import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { OrderAdmin } from "@/components/admin/OrderAdmin";
import { ProductAdmin } from "@/components/admin/ProductAdmin";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

type AdminSection = "dashboard" | "orders" | "products";

const NAV_ITEMS: Array<{
  id: AdminSection;
  label: string;
  icon: typeof LayoutDashboard;
}> = [
  { id: "dashboard", label: "Visão geral", icon: LayoutDashboard },
  { id: "orders", label: "Pedidos", icon: ShoppingBag },
  { id: "products", label: "Produtos", icon: Box },
];

function AdminPage() {
  const navigate = useNavigate();
  const { user, loading, isOwner, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [section, setSection] = useState<AdminSection>("dashboard");

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
      setErrorMessage(error.message);
      setSigningOut(false);
      return;
    }

    await navigate({ to: "/login", replace: true });
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#eceeeb]">
        <div className="rounded-full border border-white bg-white/80 px-5 py-3 text-sm font-semibold text-slate-500 shadow-sm">
          Carregando painel...
        </div>
      </main>
    );
  }

  if (!user || !isOwner) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#eceeeb]">
        <p className="text-sm font-medium text-slate-500">Redirecionando...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#e9ebe8] p-2 sm:p-4 lg:p-6">
      <div className="mx-auto min-h-[calc(100vh-1rem)] max-w-[1480px] overflow-hidden rounded-[30px] border border-white/80 bg-[#f5f6f3] shadow-[0_30px_100px_rgba(15,23,42,0.08)] sm:min-h-[calc(100vh-2rem)] lg:min-h-[calc(100vh-3rem)]">
        <header className="px-3 pt-3 sm:px-5 sm:pt-5">
          <div className="flex min-h-16 items-center justify-between gap-4 rounded-[24px] border border-white/90 bg-white px-4 py-3 shadow-[0_12px_35px_rgba(15,23,42,0.04)] sm:px-5">
            <Link
              to="/"
              className="flex min-w-0 items-center gap-3 rounded-xl outline-none transition focus-visible:ring-2 focus-visible:ring-emerald-500"
              aria-label="Voltar para a loja BIGofertas"
            >
              <span className="flex h-10 w-10 flex-none items-center justify-center rounded-2xl bg-emerald-700 text-white shadow-md shadow-emerald-700/15">
                <Store className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="hidden sm:block">
                <p className="text-base font-black tracking-tight text-slate-950">
                  BIGofertas
                </p>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">
                  Administração
                </p>
              </div>
            </Link>

            <nav
              className="hidden items-center rounded-full bg-[#f3f4f2] p-1 lg:flex"
              aria-label="Seções administrativas"
            >
              {NAV_ITEMS.map((item) => {
                const active = section === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSection(item.id)}
                    aria-current={active ? "page" : undefined}
                    className={`rounded-full px-5 py-2 text-sm font-bold transition duration-200 ${
                      active
                        ? "bg-white text-slate-950 shadow-sm"
                        : "text-slate-500 hover:text-emerald-800"
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </nav>

            <div className="flex items-center gap-2">
              <div className="hidden max-w-56 items-center gap-3 rounded-full border border-slate-100 bg-white py-1.5 pl-2 pr-3 md:flex">
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                  <UserRound className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-xs font-black text-slate-900">
                    {user.email}
                  </p>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Proprietário
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={signingOut}
                onClick={() => void handleSignOut()}
                className="inline-flex h-10 items-center justify-center rounded-full border border-slate-200 bg-white px-3.5 text-xs font-bold text-slate-700 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <LogOut className="mr-1.5 h-4 w-4" aria-hidden="true" />
                {signingOut ? "Saindo..." : "Sair"}
              </button>
            </div>
          </div>
        </header>

        <div className="grid gap-0 lg:grid-cols-[84px_minmax(0,1fr)]">
          <aside className="hidden px-4 py-6 lg:block" aria-label="Atalhos do painel">
            <div className="sticky top-6 flex min-h-[520px] flex-col items-center justify-between rounded-[28px] border border-white/80 bg-white px-2 py-3 shadow-[0_16px_45px_rgba(15,23,42,0.04)]">
              <div className="space-y-2">
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const active = section === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      title={item.label}
                      aria-label={item.label}
                      aria-current={active ? "page" : undefined}
                      onClick={() => setSection(item.id)}
                      className={`flex h-12 w-12 items-center justify-center rounded-2xl transition duration-200 ${
                        active
                          ? "bg-emerald-700 text-white shadow-lg shadow-emerald-700/20"
                          : "text-slate-500 hover:bg-emerald-50 hover:text-emerald-800"
                      }`}
                    >
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </button>
                  );
                })}
              </div>

              <Link
                to="/"
                title="Abrir loja"
                aria-label="Abrir loja"
                className="flex h-12 w-12 items-center justify-center rounded-2xl text-slate-500 transition hover:bg-emerald-50 hover:text-emerald-800"
              >
                <Store className="h-5 w-5" aria-hidden="true" />
              </Link>
            </div>
          </aside>

          <div className="min-w-0 px-3 pb-6 pt-4 sm:px-5 sm:pb-8 lg:pl-2 lg:pr-7 lg:pt-6">
            <nav
              className="mb-5 flex gap-2 overflow-x-auto rounded-2xl bg-white p-1.5 shadow-sm lg:hidden"
              aria-label="Seções administrativas"
            >
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = section === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSection(item.id)}
                    aria-current={active ? "page" : undefined}
                    className={`inline-flex h-10 flex-none items-center rounded-xl px-3.5 text-sm font-bold transition ${
                      active
                        ? "bg-emerald-700 text-white shadow-sm"
                        : "text-slate-500 hover:bg-emerald-50 hover:text-emerald-800"
                    }`}
                  >
                    <Icon className="mr-2 h-4 w-4" aria-hidden="true" />
                    {item.label}
                  </button>
                );
              })}
            </nav>

            {errorMessage ? (
              <p
                role="alert"
                className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
              >
                {errorMessage}
              </p>
            ) : null}

            {section === "dashboard" ? (
              <AdminDashboard onNavigate={setSection} />
            ) : section === "orders" ? (
              <OrderAdmin />
            ) : (
              <ProductAdmin />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
