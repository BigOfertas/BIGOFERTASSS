import {
  ArrowLeft,
  BadgePercent,
  Home,
  MapPin,
  Package,
  UserRound,
} from "lucide-react";

import { AffiliateSelfServicePanel } from "@/components/account/AffiliateSelfServicePanel";
import type { AccountSection } from "@/components/account/AccountDashboard";
import { LiquidGlassCard } from "@/components/ui/liquid-glass-card";

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
    <div className="bg-transparent py-7 sm:py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-5 flex flex-wrap items-center gap-2 text-sm text-gray-500">
          <Home className="h-4 w-4" aria-hidden="true" />
          <button type="button" onClick={() => onNavigate("dados")} className="hover:text-red-600">
            Minha conta
          </button>
          <span>/</span>
          <span className="font-medium text-gray-900">Afiliados</span>
        </div>

        <div className="mb-6 flex flex-col gap-4 border-b border-white/70 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="display-kicker">Área do cliente</p>
            <h1 className="display-title mt-2">Afiliados</h1>
            <p className="section-copy mt-3 max-w-2xl">
              Ative seu link exclusivo, acompanhe clientes indicados, comissões e seu histórico de saques.
            </p>
          </div>

          <LiquidGlassCard
            as="button"
            type="button"
            onClick={() => onNavigate("dados")}
            interactive
            blurIntensity="md"
            shadowIntensity="sm"
            glowIntensity="xs"
            borderRadius="16px"
            className="inline-flex h-10 w-fit items-center justify-center px-4 text-sm font-bold text-gray-700 hover:text-red-600"
          >
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
            Voltar para Minha Conta
          </LiquidGlassCard>
        </div>

        <nav className="mb-6 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap" aria-label="Navegação da conta">
          {navigation.map(({ section, label, icon: Icon }) => {
            const active = section === "afiliados";
            return (
              <LiquidGlassCard
                key={section}
                as="button"
                type="button"
                onClick={() => onNavigate(section)}
                aria-current={active ? "page" : undefined}
                active={active}
                interactive
                blurIntensity="md"
                shadowIntensity={active ? "md" : "sm"}
                glowIntensity={active ? "sm" : "xs"}
                borderRadius="18px"
                className={`inline-flex min-h-12 items-center justify-center px-4 text-sm font-bold sm:min-w-36 ${
                  active ? "text-red-700" : "text-gray-600 hover:text-gray-950"
                }`}
              >
                <span
                  className={`mr-2 flex h-7 w-7 items-center justify-center rounded-lg border border-white/75 shadow-sm ${
                    active ? "bg-red-50/90 text-red-600" : "bg-white/65 text-gray-500"
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                {label}
              </LiquidGlassCard>
            );
          })}
        </nav>

        <AffiliateSelfServicePanel />
      </div>
    </div>
  );
}
