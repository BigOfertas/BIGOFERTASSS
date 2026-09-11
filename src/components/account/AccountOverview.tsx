import {
  BadgePercent,
  CheckCircle2,
  ChevronRight,
  LogOut,
  Mail,
  MapPin,
  Package,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AccountSecurityPanel } from "@/components/account/AccountSecurityPanel";
import type { AccountSection } from "@/components/account/AccountDashboard";
import { BRAND } from "@/config/brand";
import {
  fetchCustomerAccount,
  type CustomerAddress,
  type CustomerProfile,
} from "@/lib/customer-account";

type AccountOverviewSection = AccountSection | "afiliados";

type AccountOverviewProps = {
  email: string;
  onNavigate: (section: AccountOverviewSection) => void;
  onSignOut: () => Promise<void>;
};

function profileIsComplete(profile: CustomerProfile | null) {
  return Boolean(profile?.full_name?.trim() && profile.phone?.trim() && profile.cpf?.trim());
}

export function AccountOverview({ email, onNavigate, onSignOut }: AccountOverviewProps) {
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;

    void fetchCustomerAccount()
      .then((snapshot) => {
        if (!active) return;
        setProfile(snapshot.profile);
        setAddresses(snapshot.addresses);
      })
      .catch(() => {
        if (!active) return;
        setErrorMessage("Não foi possível carregar os dados da sua conta agora.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const firstName = useMemo(() => profile?.full_name?.trim().split(/\s+/)[0] ?? "", [profile]);
  const complete = profileIsComplete(profile);

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    setErrorMessage("");

    try {
      await onSignOut();
    } catch {
      setErrorMessage("Não foi possível sair da conta agora.");
      setSigningOut(false);
    }
  }

  const actions: Array<{
    section: AccountOverviewSection;
    title: string;
    description: string;
    meta: string;
    icon: typeof Package;
  }> = [
    {
      section: "pedidos",
      title: "Meus pedidos",
      description: "Acompanhe pagamento, produção, envio e entrega das suas compras.",
      meta: "Ver histórico",
      icon: Package,
    },
    {
      section: "enderecos",
      title: "Endereços",
      description: "Organize os endereços usados para receber seus pedidos.",
      meta: loading
        ? "Carregando"
        : addresses.length === 0
          ? "Nenhum cadastrado"
          : `${addresses.length} ${addresses.length === 1 ? "endereço" : "endereços"}`,
      icon: MapPin,
    },
    {
      section: "dados",
      title: "Dados pessoais",
      description: "Mantenha nome, telefone, CPF e e-mail atualizados.",
      meta: loading ? "Carregando" : complete ? "Cadastro completo" : "Revisar cadastro",
      icon: UserRound,
    },
    {
      section: "afiliados",
      title: "Afiliados",
      description: "Acesse indicações, comissões, saques e os recursos do programa.",
      meta: "Abrir área de afiliados",
      icon: BadgePercent,
    },
  ];

  return (
    <div className="bg-transparent py-7 sm:py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <section className="account-command-hero rounded-[1.8rem] px-5 py-7 text-white sm:px-8 sm:py-9 lg:px-10 lg:py-10">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)] lg:items-end">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-red-300">
                Área do cliente
              </p>
              <h1 className="sport-heading mt-3 max-w-[11ch] text-5xl text-white sm:text-6xl lg:text-7xl">
                {firstName ? `Olá, ${firstName}.` : "Sua conta. Seu controle."}
              </h1>
              <p className="mt-5 max-w-xl text-sm leading-6 text-white/62 sm:text-[15px] sm:leading-7">
                Pedidos, endereços, dados pessoais e afiliados em um painel mais direto para você encontrar o que precisa sem perder tempo.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <button
                type="button"
                onClick={() => onNavigate("dados")}
                className="rounded-2xl border border-white/10 bg-white/[0.07] p-4 text-left transition hover:bg-white/[0.11]"
              >
                <span className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-white/55">
                  {complete ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-300" aria-hidden="true" />
                  ) : (
                    <ShieldCheck className="h-4 w-4 text-amber-300" aria-hidden="true" />
                  )}
                  Cadastro
                </span>
                <strong className="mt-2 block text-sm font-extrabold text-white">
                  {loading ? "Carregando..." : complete ? "Tudo em dia" : "Precisa de revisão"}
                </strong>
              </button>

              <button
                type="button"
                onClick={() => onNavigate("enderecos")}
                className="rounded-2xl border border-white/10 bg-white/[0.07] p-4 text-left transition hover:bg-white/[0.11]"
              >
                <span className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-white/55">
                  <MapPin className="h-4 w-4 text-red-300" aria-hidden="true" />
                  Entrega
                </span>
                <strong className="mt-2 block text-sm font-extrabold text-white">
                  {loading
                    ? "Carregando..."
                    : addresses.length === 0
                      ? "Cadastre um endereço"
                      : `${addresses.length} ${addresses.length === 1 ? "endereço salvo" : "endereços salvos"}`}
                </strong>
              </button>
            </div>
          </div>
        </section>

        {errorMessage ? (
          <div
            role="alert"
            className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm"
          >
            {errorMessage}
          </div>
        ) : null}

        <div className="mt-8 grid gap-7 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className="min-w-0">
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <p className="display-kicker">Acesso rápido</p>
                <h2 className="sport-heading mt-2 text-3xl text-gray-950 sm:text-4xl">
                  O que você quer fazer?
                </h2>
              </div>
              <span className="hidden text-xs font-semibold text-gray-400 sm:block">
                Tudo em poucos cliques
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {actions.map(({ section, title, description, meta, icon: Icon }) => (
                <button
                  key={section}
                  type="button"
                  onClick={() => onNavigate(section)}
                  className="account-action-card group min-h-52 w-full rounded-[1.45rem] p-5 text-left sm:p-6"
                >
                  <div className="flex items-start justify-between gap-4">
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-red-100 bg-red-50 text-red-600 shadow-sm">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <ChevronRight
                      className="h-5 w-5 text-gray-300 transition-transform duration-200 group-hover:translate-x-1 group-hover:text-red-500 motion-reduce:transition-none"
                      aria-hidden="true"
                    />
                  </div>

                  <h3 className="sport-heading mt-6 text-[1.7rem] text-gray-950">{title}</h3>
                  <p className="mt-2 max-w-sm text-sm leading-6 text-gray-600">{description}</p>
                  <p className="mt-5 text-xs font-black uppercase tracking-[0.1em] text-gray-400">
                    {meta}
                  </p>
                </button>
              ))}
            </div>

            <div id="seguranca" className="scroll-mt-40">
              <AccountSecurityPanel email={email} />
            </div>
          </section>

          <aside className="account-profile-card h-fit overflow-hidden rounded-[1.45rem] lg:sticky lg:top-28">
            <div className="p-5 sm:p-6">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-gray-400">
                Conta conectada
              </p>

              <div className="mt-5 flex items-center gap-3">
                <span className="flex h-12 w-12 flex-none items-center justify-center rounded-2xl bg-gray-950 text-white shadow-md">
                  <UserRound className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-extrabold text-gray-950">
                    {profile?.full_name || `Cliente ${BRAND.officialName}`}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-gray-500">{email}</p>
                </div>
              </div>

              <div className="mt-6 border-t border-gray-100 pt-5">
                <div className="flex items-start gap-2.5 text-sm text-gray-600">
                  <Mail className="mt-0.5 h-4 w-4 flex-none text-gray-400" aria-hidden="true" />
                  <span className="break-all">{email}</span>
                </div>
              </div>

              <div className="mt-5 grid gap-2">
                <button
                  type="button"
                  onClick={() => onNavigate("dados")}
                  className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-gray-950 px-4 text-sm font-black text-white transition hover:bg-red-600"
                >
                  Gerenciar meus dados
                </button>
                <button
                  type="button"
                  disabled={signingOut}
                  onClick={() => void handleSignOut()}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-sm font-bold text-gray-700 transition hover:border-red-200 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  {signingOut ? "Saindo..." : "Sair da conta"}
                </button>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
