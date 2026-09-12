import { useQuery } from "@tanstack/react-query";
import {
  ChevronRight,
  CircleDollarSign,
  Link2,
  Loader2,
  Mail,
  MessageCircle,
  Phone,
  ShoppingBag,
  UserRound,
  UsersRound,
  WalletCards,
} from "lucide-react";
import { useMemo, useState } from "react";

import { AffiliateAdmin } from "@/components/admin/AffiliateAdmin";
import { supabase } from "@/integrations/supabase/client";
import {
  listAdminAffiliateCommissions,
  listAdminAffiliateOrders,
  listAdminAffiliateReferrals,
  listAdminAffiliates,
  type AdminAffiliateReferralRow,
} from "@/lib/admin-affiliates";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "medium",
});

function money(value: number | null | undefined) {
  return currencyFormatter.format(Number.isFinite(Number(value)) ? Number(value) : 0);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : dateFormatter.format(date);
}

function onlyDigits(value: string | null | undefined) {
  return (value ?? "").replace(/\D/g, "");
}

function formatPhone(value: string | null | undefined) {
  const digits = onlyDigits(value);
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return value?.trim() || "Não informado";
}

function whatsappUrl(value: string | null | undefined) {
  const digits = onlyDigits(value);
  if (digits.length !== 10 && digits.length !== 11 && !digits.startsWith("55")) return null;
  const international = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${international}`;
}

function paymentLabel(value: string) {
  if (value === "paid") return "Pago";
  if (value === "pending") return "Pendente";
  if (value === "failed") return "Falhou";
  if (value === "refunded") return "Reembolsado";
  return value || "—";
}

type OwnerContactProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  created_at: string;
};

async function fetchOwnerContactProfile(userId: string): Promise<OwnerContactProfile | null> {
  if (!userId) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, phone, created_at")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

function MetricCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: typeof UsersRound;
}) {
  return (
    <article className="rounded-xl border border-gray-200 bg-white p-4">
      <Icon className="h-4.5 w-4.5 text-red-600" aria-hidden="true" />
      <p className="mt-3 text-xl font-black tracking-tight text-gray-950">{value}</p>
      <p className="mt-1 text-[11px] font-semibold text-gray-500">{label}</p>
    </article>
  );
}

function ContactActions({ profile }: { profile: OwnerContactProfile | null | undefined }) {
  const whatsapp = whatsappUrl(profile?.phone);
  const email = profile?.email?.trim() || null;

  if (!whatsapp && !email) {
    return <p className="text-xs text-gray-400">Nenhum contato disponível para esta conta.</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {whatsapp ? (
        <a
          href={whatsapp}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-9 items-center rounded-lg bg-emerald-600 px-3 text-xs font-black text-white transition hover:bg-emerald-700"
        >
          <MessageCircle className="mr-1.5 h-4 w-4" aria-hidden="true" />
          Chamar no WhatsApp
        </a>
      ) : null}
      {email ? (
        <a
          href={`mailto:${email}`}
          className="inline-flex h-9 items-center rounded-lg border border-gray-200 bg-white px-3 text-xs font-bold text-gray-700 transition hover:border-red-200 hover:text-red-700"
        >
          <Mail className="mr-1.5 h-4 w-4" aria-hidden="true" />
          Enviar e-mail
        </a>
      ) : null}
    </div>
  );
}

function CustomerDetail({
  referral,
  orders,
}: {
  referral: AdminAffiliateReferralRow;
  orders: ReturnType<typeof listAdminAffiliateOrders> extends Promise<infer T> ? T : never;
}) {
  const profileQuery = useQuery({
    queryKey: ["admin-affiliate", "contact-profile", referral.referred_user_id],
    queryFn: () => fetchOwnerContactProfile(referral.referred_user_id),
    staleTime: 30_000,
  });
  const profile = profileQuery.data;
  const customerOrders = orders
    .filter((row) => row.referred_user_id === referral.referred_user_id)
    .slice(0, 5);

  return (
    <div className="mt-3 rounded-xl border border-red-100 bg-red-50/35 p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-black text-gray-950">
            {profile?.full_name || referral.referred_name || "Cliente"}
          </p>
          <p className="mt-1 break-all text-xs text-gray-500">
            {profile?.email || referral.referred_email || "E-mail não informado"}
          </p>
          <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-gray-700">
            <Phone className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
            {profileQuery.isLoading ? "Carregando telefone..." : formatPhone(profile?.phone)}
          </p>
        </div>
        <ContactActions profile={profile} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-lg bg-white px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Indicado em</p>
          <p className="mt-1 text-xs font-bold text-gray-800">{formatDate(referral.referred_at)}</p>
        </div>
        <div className="rounded-lg bg-white px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Pedidos</p>
          <p className="mt-1 text-xs font-bold text-gray-800">
            {referral.paid_orders_count}/{referral.orders_count} pagos
          </p>
        </div>
        <div className="rounded-lg bg-white px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
            Vendas pagas
          </p>
          <p className="mt-1 text-xs font-bold text-gray-800">
            {money(referral.paid_sales_amount)}
          </p>
        </div>
        <div className="rounded-lg bg-white px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
            Comissão gerada
          </p>
          <p className="mt-1 text-xs font-bold text-gray-800">
            {money(referral.generated_commission_amount)}
          </p>
        </div>
      </div>

      {customerOrders.length > 0 ? (
        <div className="mt-4">
          <p className="text-[11px] font-black uppercase tracking-[0.08em] text-gray-500">
            Pedidos recentes
          </p>
          <div className="mt-2 divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-100 bg-white">
            {customerOrders.map((order) => (
              <div
                key={order.order_id}
                className="grid gap-1 px-3 py-2.5 text-xs sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:gap-4"
              >
                <div>
                  <p className="font-black text-gray-900">{order.public_number}</p>
                  <p className="mt-0.5 text-[11px] text-gray-400">{formatDate(order.created_at)}</p>
                </div>
                <span className="text-gray-600">{paymentLabel(order.payment_status)}</span>
                <span className="font-black tabular-nums text-gray-900">
                  {money(order.total_amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function AffiliateAdminWorkspace() {
  const [selectedAffiliateId, setSelectedAffiliateId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"summary" | "customers">("summary");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  const affiliatesQuery = useQuery({
    queryKey: ["admin-affiliate", "affiliates", ""],
    queryFn: () => listAdminAffiliates(""),
    staleTime: 15_000,
  });
  const referralsQuery = useQuery({
    queryKey: ["admin-affiliate", "referrals"],
    queryFn: listAdminAffiliateReferrals,
    staleTime: 15_000,
  });
  const ordersQuery = useQuery({
    queryKey: ["admin-affiliate", "orders"],
    queryFn: listAdminAffiliateOrders,
    staleTime: 15_000,
  });
  const commissionsQuery = useQuery({
    queryKey: ["admin-affiliate", "commissions"],
    queryFn: listAdminAffiliateCommissions,
    staleTime: 15_000,
  });

  const affiliates = useMemo(() => affiliatesQuery.data ?? [], [affiliatesQuery.data]);
  const referrals = useMemo(() => referralsQuery.data ?? [], [referralsQuery.data]);
  const orders = useMemo(() => ordersQuery.data ?? [], [ordersQuery.data]);
  const commissions = useMemo(() => commissionsQuery.data ?? [], [commissionsQuery.data]);

  const selectedAffiliate = useMemo(
    () => affiliates.find((row) => row.affiliate_id === selectedAffiliateId) ?? null,
    [affiliates, selectedAffiliateId],
  );

  const affiliateReferrals = useMemo(
    () => referrals.filter((row) => row.affiliate_id === selectedAffiliateId),
    [referrals, selectedAffiliateId],
  );
  const affiliateOrders = useMemo(
    () => orders.filter((row) => row.affiliate_id === selectedAffiliateId),
    [orders, selectedAffiliateId],
  );
  const affiliateCommissions = useMemo(
    () => commissions.filter((row) => row.affiliate_id === selectedAffiliateId),
    [commissions, selectedAffiliateId],
  );

  const affiliateUserId = selectedAffiliate?.user_id ?? "";
  const affiliateProfileQuery = useQuery({
    queryKey: ["admin-affiliate", "contact-profile", affiliateUserId],
    queryFn: () => fetchOwnerContactProfile(affiliateUserId),
    enabled: Boolean(affiliateUserId),
    staleTime: 30_000,
  });

  const paidOrders = affiliateReferrals.reduce((total, row) => total + row.paid_orders_count, 0);
  const paidSales = affiliateReferrals.reduce(
    (total, row) => total + Number(row.paid_sales_amount || 0),
    0,
  );
  const generatedCommission = affiliateReferrals.reduce(
    (total, row) => total + Number(row.generated_commission_amount || 0),
    0,
  );

  function chooseAffiliate(affiliateId: string) {
    setSelectedAffiliateId(affiliateId);
    setActiveTab("summary");
    setSelectedCustomerId(null);
  }

  const dataLoading =
    affiliatesQuery.isLoading ||
    referralsQuery.isLoading ||
    ordersQuery.isLoading ||
    commissionsQuery.isLoading;
  const dataError =
    affiliatesQuery.error || referralsQuery.error || ordersQuery.error || commissionsQuery.error;

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-5 py-5 sm:px-6">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-red-600">
            Gestão individual
          </p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-gray-950">
            Painel individual dos afiliados
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">
            Abra um afiliado para acompanhar os resultados dele, ver os clientes indicados e acessar
            os dados de contato de cada cliente.
          </p>
        </div>

        {dataLoading ? (
          <div className="px-6 py-10 text-center">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-red-600 motion-reduce:animate-none" />
            <p className="mt-3 text-sm font-semibold text-gray-500">Carregando afiliados...</p>
          </div>
        ) : dataError ? (
          <p className="px-6 py-10 text-center text-sm font-semibold text-red-600">
            Não foi possível carregar o painel individual agora.
          </p>
        ) : affiliates.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-gray-500">
            Ainda não há afiliados cadastrados.
          </p>
        ) : (
          <div className="p-4 sm:p-5">
            <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar sm:grid sm:grid-cols-2 sm:overflow-visible xl:grid-cols-3">
              {affiliates.map((affiliate) => {
                const selected = affiliate.affiliate_id === selectedAffiliateId;
                return (
                  <button
                    key={affiliate.affiliate_id}
                    type="button"
                    onClick={() => chooseAffiliate(affiliate.affiliate_id)}
                    className={`min-w-[260px] rounded-xl border p-4 text-left transition sm:min-w-0 ${
                      selected
                        ? "border-red-300 bg-red-50 shadow-sm"
                        : "border-gray-200 bg-white hover:border-red-200 hover:bg-red-50/30"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-gray-950">
                          {affiliate.full_name || affiliate.email || "Afiliado"}
                        </p>
                        <p className="mt-1 inline-flex items-center gap-1 font-mono text-[11px] font-bold text-red-600">
                          <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
                          {affiliate.referral_code}
                        </p>
                      </div>
                      <ChevronRight
                        className={`h-4.5 w-4.5 flex-none ${selected ? "text-red-600" : "text-gray-300"}`}
                        aria-hidden="true"
                      />
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-gray-500">
                      <span>{affiliate.referred_customers_count} clientes</span>
                      <span className="font-bold text-gray-800">
                        {money(affiliate.available_balance)} disponível
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {selectedAffiliate ? (
              <div className="mt-5 overflow-hidden rounded-xl border border-gray-200 bg-gray-50/60">
                <div className="flex flex-col gap-4 border-b border-gray-200 bg-white px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-black text-gray-950">
                        {selectedAffiliate.full_name || selectedAffiliate.email || "Afiliado"}
                      </h2>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${
                          selectedAffiliate.status === "active"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {selectedAffiliate.status === "active" ? "Ativo" : "Pausado"}
                      </span>
                    </div>
                    <p className="mt-1 break-all text-xs text-gray-500">
                      {affiliateProfileQuery.data?.email ||
                        selectedAffiliate.email ||
                        "E-mail não informado"}
                    </p>
                    <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-gray-700">
                      <Phone className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
                      {affiliateProfileQuery.isLoading
                        ? "Carregando telefone..."
                        : formatPhone(affiliateProfileQuery.data?.phone)}
                    </p>
                  </div>
                  <ContactActions profile={affiliateProfileQuery.data} />
                </div>

                <div className="flex gap-1 border-b border-gray-200 bg-white px-4 pt-2 sm:px-5">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("summary");
                      setSelectedCustomerId(null);
                    }}
                    className={`border-b-2 px-3 py-2.5 text-xs font-black ${
                      activeTab === "summary"
                        ? "border-red-600 text-red-700"
                        : "border-transparent text-gray-500 hover:text-gray-900"
                    }`}
                  >
                    Resumo
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("customers")}
                    className={`border-b-2 px-3 py-2.5 text-xs font-black ${
                      activeTab === "customers"
                        ? "border-red-600 text-red-700"
                        : "border-transparent text-gray-500 hover:text-gray-900"
                    }`}
                  >
                    Clientes indicados ({affiliateReferrals.length})
                  </button>
                </div>

                {activeTab === "summary" ? (
                  <div className="p-4 sm:p-5">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
                      <MetricCard
                        label="Clientes indicados"
                        value={affiliateReferrals.length}
                        icon={UsersRound}
                      />
                      <MetricCard label="Pedidos pagos" value={paidOrders} icon={ShoppingBag} />
                      <MetricCard
                        label="Vendas pagas"
                        value={money(paidSales)}
                        icon={CircleDollarSign}
                      />
                      <MetricCard
                        label="Comissão pendente"
                        value={money(selectedAffiliate.pending_commission_amount)}
                        icon={WalletCards}
                      />
                      <MetricCard
                        label="Saldo disponível"
                        value={money(selectedAffiliate.available_balance)}
                        icon={WalletCards}
                      />
                      <MetricCard
                        label="Saques pagos"
                        value={money(selectedAffiliate.paid_withdrawal_amount)}
                        icon={CircleDollarSign}
                      />
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-gray-200 bg-white p-4">
                        <p className="text-[11px] font-black uppercase tracking-[0.08em] text-gray-400">
                          Comissão gerada pelos indicados
                        </p>
                        <p className="mt-2 text-2xl font-black text-gray-950">
                          {money(generatedCommission)}
                        </p>
                      </div>
                      <div className="rounded-xl border border-gray-200 bg-white p-4">
                        <p className="text-[11px] font-black uppercase tracking-[0.08em] text-gray-400">
                          Registros de comissão
                        </p>
                        <p className="mt-2 text-2xl font-black text-gray-950">
                          {affiliateCommissions.length}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 sm:p-5">
                    {affiliateReferrals.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-gray-300 bg-white px-5 py-10 text-center">
                        <UsersRound className="mx-auto h-6 w-6 text-gray-300" aria-hidden="true" />
                        <p className="mt-2 text-sm font-bold text-gray-800">
                          Nenhum cliente indicado
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          Quando alguém criar a conta pelo link deste afiliado, aparecerá aqui.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {affiliateReferrals.map((referral) => {
                          const open = selectedCustomerId === referral.referred_user_id;
                          return (
                            <div key={referral.referred_user_id}>
                              <button
                                type="button"
                                onClick={() =>
                                  setSelectedCustomerId(open ? null : referral.referred_user_id)
                                }
                                className={`flex w-full items-center justify-between gap-3 rounded-xl border bg-white px-4 py-3 text-left transition ${
                                  open ? "border-red-200" : "border-gray-200 hover:border-red-200"
                                }`}
                              >
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-black text-gray-950">
                                    {referral.referred_name || "Cliente"}
                                  </p>
                                  <p className="mt-0.5 truncate text-xs text-gray-500">
                                    {referral.referred_email || "E-mail não informado"}
                                  </p>
                                </div>
                                <div className="flex flex-none items-center gap-3">
                                  <div className="hidden text-right sm:block">
                                    <p className="text-xs font-black text-gray-800">
                                      {referral.paid_orders_count}/{referral.orders_count} pagos
                                    </p>
                                    <p className="mt-0.5 text-[11px] text-gray-400">
                                      {money(referral.paid_sales_amount)} em vendas
                                    </p>
                                  </div>
                                  <ChevronRight
                                    className={`h-4 w-4 text-gray-400 transition-transform ${open ? "rotate-90" : ""}`}
                                    aria-hidden="true"
                                  />
                                </div>
                              </button>
                              {open ? (
                                <CustomerDetail referral={referral} orders={affiliateOrders} />
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-5 rounded-xl border border-dashed border-gray-300 bg-gray-50 px-5 py-10 text-center">
                <UserRound className="mx-auto h-7 w-7 text-gray-300" aria-hidden="true" />
                <p className="mt-3 text-sm font-black text-gray-900">Selecione um afiliado acima</p>
                <p className="mt-1 text-xs text-gray-500">
                  O painel individual e a lista de clientes aparecerão aqui.
                </p>
              </div>
            )}
          </div>
        )}
      </section>

      <AffiliateAdmin />
    </div>
  );
}