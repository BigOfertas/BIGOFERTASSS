import {
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

import type { AccountSection } from "@/components/account/AccountDashboard";
import { AccountSecurityPanel } from "@/components/account/AccountSecurityPanel";
import {
  fetchCustomerAccount,
  type CustomerAddress,
  type CustomerProfile,
} from "@/lib/customer-account";

type AccountOverviewProps = {
  email: string;
  onNavigate: (section: AccountSection) => void;
  onSignOut: () => Promise<void>;
};

function profileIsComplete(profile: CustomerProfile | null) {
  return Boolean(
    profile?.full_name?.trim() &&
      profile.phone?.trim() &&
      profile.cpf?.trim(),
  );
}

export function AccountOverview({
  email,
  onNavigate,
  onSignOut,
}: AccountOverviewProps) {
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

  const firstName = useMemo(
    () => profile?.full_name?.trim().split(/\s+/)[0] ?? "",
    [profile],
  );
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
    section: AccountSection;
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
  ];

  return (
    <div className="bg-[#f5f5f5] py-8 sm:py-10">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <header className="mb-7 flex flex-col gap-3 border-b border-gray-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-red-600">Área do cliente</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-gray-950 sm:text-4xl">
              {firstName ? `Olá, ${firstName}` : "Minha conta"}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">
              Encontre rapidamente o que precisa para acompanhar suas compras e manter seus dados em dia.
            </p>
          </div>

          {!loading ? (
            <div
              className={`inline-flex w-fit items-center gap-2 text-sm font-semibold ${
                complete ? "text-emerald-700" : "text-amber-700"
              }`}
            >
              {complete ? (
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              ) : (
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              )}
              {complete ? "Conta pronta para comprar" : "Complete seus dados"}
            </div>
          ) : null}
        </header>

        {errorMessage ? (
          <div
            role="alert"
            className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {errorMessage}
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <section className="min-w-0">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-gray-950">O que você quer fazer?</h2>
              <p className="mt-1 text-sm text-gray-500">
                As funções mais usadas da sua conta estão aqui.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {actions.map(({ section, title, description, meta, icon: Icon }) => (
                <button
                  key={section}
                  type="button"
                  onClick={() => onNavigate(section)}
                  className="group min-h-52 rounded-xl border border-gray-200 bg-white p-5 text-left shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition hover:border-gray-300 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] motion-reduce:transition-none"
                >
                  <div className="flex items-start justify-between gap-4">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 text-red-600">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <ChevronRight
                      className="h-5 w-5 text-gray-300 transition group-hover:translate-x-0.5 group-hover:text-gray-500 motion-reduce:transition-none"
                      aria-hidden="true"
                    />
                  </div>

                  <h3 className="mt-5 text-base font-bold text-gray-950">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-gray-600">{description}</p>
                  <p className="mt-4 text-xs font-semibold text-gray-500">{meta}</p>
                </button>
              ))}
            </div>

            <AccountSecurityPanel email={email} />
          </section>

          <aside className="h-fit rounded-xl border border-gray-200 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-gray-400">
              Conta conectada
            </p>

            <div className="mt-4 flex items-center gap-3">
              <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-gray-100 text-gray-700">
                <UserRound className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-gray-950">
                  {profile?.full_name || "Cliente BIGofertas"}
                </p>
                <p className="mt-0.5 truncate text-xs text-gray-500">{email}</p>
              </div>
            </div>

            <div className="mt-5 border-t border-gray-100 pt-4">
              <div className="flex items-start gap-2.5 text-sm text-gray-600">
                <Mail className="mt-0.5 h-4 w-4 flex-none text-gray-400" aria-hidden="true" />
                <span className="break-all">{email}</span>
              </div>
            </div>

            <button
              type="button"
              disabled={signingOut}
              onClick={() => void handleSignOut()}
              className="mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              {signingOut ? "Saindo..." : "Sair da conta"}
            </button>
          </aside>
        </div>
      </div>
    </div>
  );
}
