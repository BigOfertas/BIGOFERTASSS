import {
  ArrowLeft,
  BadgePercent,
  Home,
  MapPin,
  Package,
  UserRound,
} from "lucide-react";

import { AffiliateAccountPanel } from "@/components/account/AffiliateAccountPanel";
import type { AccountSection } from "@/components/account/AccountDashboard";

export function AffiliateAccountPage({
  onNavigate,
}: {
  onNavigate: (section: AccountSection | "afiliados") => void;
}) {
  const navigation = [
    { section: "dados" as const, label: "Minha conta", icon: UserRound },
    { section: "enderecos" as const, label: "Endereços", icon: MapPin },
    { section: "pedidos" as const, label: "Pedidos", icon: Package },
    { section: "afiliados" as const, label: "Afiliados", icon: BadgePercent },
  ];

  return (
    <div className="bg-[#f7f7f7] py-7 sm:py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-5 flex flex-wrap items-center gap-2 text-sm text-gray-500">
          <Home className="h-4 w-4" aria-hidden="true" />
          <button type="button" onClick={() => onNavigate("dados")} className="hover:text-red-600">
            Minha conta
          </button>
          <span>/</span>
          <span className="font-medium text-gray-900">Afiliados</span>
        </div>

        <div className="mb-6 flex flex-col gap-4 border-b border-gray-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-red-600">
              Área do cliente
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-gray-950 sm:text-4xl">
              Afiliados
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
              Sua área para acompanhar indicações, comissões e saques quando o programa estiver ativo.
            </p>
          </div>

          <button
            type="button"
            onClick={() => onNavigate("dados")}
            className="inline-flex h-10 w-fit items-center justify-center rounded-lg border border-gray-200 bg-white px-4 text-sm font-bold text-gray-700 transition hover:bg-gray-50 hover:text-red-600"
          >
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
            Voltar para Minha Conta
          </button>
        </div>

        <nav className="mb-5 flex gap-2 overflow-x-auto pb-1" aria-label="Navegação da conta">
          {navigation.map(({ section, label, icon: Icon }) => {
            const active = section === "afiliados";
            return (
              <button
                key={section}
                type="button"
                onClick={() => onNavigate(section)}
                aria-current={active ? "page" : undefined}
                className={`inline-flex h-10 flex-none items-center rounded-lg border px-3 text-sm font-semibold transition ${
                  active
                    ? "border-red-200 bg-red-50 text-red-700"
                    : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-950"
                }`}
              >
                <Icon className="mr-2 h-4 w-4" aria-hidden="true" />
                {label}
              </button>
            );
          })}
        </nav>

        <AffiliateAccountPanel />
      </div>
    </div>
  );
}
