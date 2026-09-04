import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgePercent,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Link2,
  Loader2,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  UserPlus,
  UsersRound,
  WalletCards,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  activateAffiliate,
  configureAffiliateProgram,
  disableAffiliate,
  fetchAffiliateAdminOverview,
  listAdminAffiliateCommissions,
  listAdminAffiliateOrders,
  listAdminAffiliateReferrals,
  listAdminAffiliates,
  listAdminAffiliateWithdrawals,
  listAffiliateCandidates,
  listAffiliateRefundReviews,
  markAffiliateWithdrawalPaid,
  rejectAffiliateWithdrawal,
  resolveAffiliateRefundReview,
  saveAffiliateProgramDraft,
  type AffiliateProgramDraft,
} from "@/lib/admin-affiliates";
import { AffiliateCommissionSettings } from "@/components/admin/AffiliateCommissionSettings";
import { getUserFacingError } from "@/lib/user-facing-error";

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

function formatPercent(bps: number | null | undefined) {
  if (bps === null || bps === undefined) return "A definir";
  return `${(bps / 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
}

function formatBase(value: string | null | undefined) {
  if (value === "items_after_discount") return "Produtos após descontos, sem frete";
  if (value === "order_total") return "Total do pedido";
  return "A definir";
}

function LoadingBlock({ label = "Carregando..." }: { label?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-6 py-12 text-center">
      <Loader2 className="mx-auto h-6 w-6 animate-spin text-red-600 motion-reduce:animate-none" />
      <p className="mt-3 text-sm font-semibold text-gray-500">{label}</p>
    </div>
  );
}

function EmptyRow({ message }: { message: string }) {
  return <div className="px-5 py-10 text-center text-sm text-gray-500 sm:px-6">{message}</div>;
}

export function AffiliateAdmin() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [commissionPercent, setCommissionPercent] = useState("");
  const [commissionBaseMode, setCommissionBaseMode] = useState("");
  const [holdDays, setHoldDays] = useState("");
  const [minimumWithdrawal, setMinimumWithdrawal] = useState("");
  const [withdrawalMethod, setWithdrawalMethod] = useState("");
  const [rulesInitialized, setRulesInitialized] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [rejectionNotes, setRejectionNotes] = useState<Record<string, string>>({});
  const [refundNotes, setRefundNotes] = useState<Record<string, string>>({});

  const overviewQuery = useQuery({
    queryKey: ["admin-affiliate", "overview"],
    queryFn: fetchAffiliateAdminOverview,
    staleTime: 15_000,
  });

  const affiliatesQuery = useQuery({
    queryKey: ["admin-affiliate", "affiliates", search],
    queryFn: () => listAdminAffiliates(search),
    staleTime: 15_000,
  });

  const candidatesQuery = useQuery({
    queryKey: ["admin-affiliate", "candidates", search],
    queryFn: () => listAffiliateCandidates(search),
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

  const withdrawalsQuery = useQuery({
    queryKey: ["admin-affiliate", "withdrawals"],
    queryFn: listAdminAffiliateWithdrawals,
    staleTime: 15_000,
  });

  const refundReviewsQuery = useQuery({
    queryKey: ["admin-affiliate", "refund-reviews"],
    queryFn: listAffiliateRefundReviews,
    staleTime: 15_000,
  });

  useEffect(() => {
    const overview = overviewQuery.data;
    if (!overview || rulesInitialized) return;

    setCommissionPercent(
      overview.commissionRateBps === null ? "" : String(overview.commissionRateBps / 100),
    );
    setCommissionBaseMode(overview.commissionBaseMode ?? "");
    setHoldDays(overview.holdDays === null ? "" : String(overview.holdDays));
    setMinimumWithdrawal(
      overview.minimumWithdrawal === null ? "" : String(overview.minimumWithdrawal),
    );
    setWithdrawalMethod(overview.withdrawalMethod ?? "");
    setRulesInitialized(true);
  }, [overviewQuery.data, rulesInitialized]);

  const draft = useMemo<AffiliateProgramDraft>(() => {
    const percent = Number(commissionPercent.replace(",", "."));
    const days = Number(holdDays);
    const minimum = Number(minimumWithdrawal.replace(",", "."));

    return {
      commissionRateBps:
        commissionPercent.trim() && Number.isFinite(percent) ? Math.round(percent * 100) : null,
      commissionBaseMode:
        commissionBaseMode === "items_after_discount" || commissionBaseMode === "order_total"
          ? commissionBaseMode
          : null,
      holdDays: holdDays.trim() && Number.isInteger(days) ? days : null,
      minimumWithdrawal:
        minimumWithdrawal.trim() && Number.isFinite(minimum) ? minimum : null,
      withdrawalMethod: withdrawalMethod.trim() || null,
    };
  }, [commissionPercent, commissionBaseMode, holdDays, minimumWithdrawal, withdrawalMethod]);

  const editorRulesComplete =
    draft.commissionRateBps !== null &&
    draft.commissionRateBps >= 1 &&
    draft.commissionRateBps <= 10000 &&
    draft.commissionBaseMode !== null &&
    draft.holdDays !== null &&
    draft.holdDays >= 0 &&
    draft.holdDays <= 365 &&
    draft.minimumWithdrawal !== null &&
    draft.minimumWithdrawal >= 0.01 &&
    draft.withdrawalMethod !== null &&
    draft.withdrawalMethod.length >= 2;

  const actionMutation = useMutation({
    mutationFn: async (action: () => Promise<unknown>) => action(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-affiliate"] });
    },
  });

  async function runAction(action: () => Promise<unknown>, success: string) {
    if (actionMutation.isPending) return;
    setErrorMessage("");
    setStatusMessage("");
    try {
      await actionMutation.mutateAsync(action);
      setStatusMessage(success);
    } catch (error) {
      setErrorMessage(
        getUserFacingError(error, "Não foi possível concluir essa operação agora."),
      );
    }
  }

  function completedDraft() {
    if (!editorRulesComplete) return null;
    return {
      commissionRateBps: draft.commissionRateBps!,
      commissionBaseMode: draft.commissionBaseMode!,
      holdDays: draft.holdDays!,
      minimumWithdrawal: draft.minimumWithdrawal!,
      withdrawalMethod: draft.withdrawalMethod!,
    };
  }

  const overview = overviewQuery.data;
  const pageLoading = overviewQuery.isLoading;
  const pageError = overviewQuery.error;

  if (pageLoading) return <LoadingBlock label="Carregando programa de afiliados..." />;

  if (pageError || !overview) {
    return (
      <div className="rounded-xl border border-red-200 bg-white px-6 py-12 text-center">
        <RefreshCw className="mx-auto h-7 w-7 text-red-500" aria-hidden="true" />
        <h1 className="mt-4 text-xl font-black text-gray-950">Não foi possível carregar afiliados</h1>
        <p className="mt-2 text-sm text-gray-500">Tente novamente em instantes.</p>
        <button
          type="button"
          onClick={() => void overviewQuery.refetch()}
          className="mt-5 inline-flex h-10 items-center rounded-lg bg-red-600 px-4 text-sm font-bold text-white hover:bg-red-700"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 border-b border-gray-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-red-600">Programa de afiliados</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-gray-950">Indicações e comissões</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">
            O afiliado convida uma pessoa nova para criar uma conta. Os pedidos dessa conta indicada é que podem gerar comissão; não existe indicação de produto.
          </p>
        </div>
        <span
          className={`inline-flex w-fit items-center rounded-full px-3 py-1.5 text-xs font-black ${
            overview.enabled ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
          }`}
        >
          {overview.enabled ? "Programa ativo" : "Programa desligado"}
        </span>
      </section>

      {statusMessage ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          {statusMessage}
        </p>
      ) : null}
      {errorMessage ? (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {errorMessage}
        </p>
      ) : null}

      <AffiliateCommissionSettings />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-xl border border-gray-200 bg-white p-5">
          <UsersRound className="h-5 w-5 text-red-600" aria-hidden="true" />
          <p className="mt-3 text-3xl font-black text-gray-950">{overview.activeAffiliatesCount}</p>
          <p className="mt-1 text-xs font-semibold text-gray-500">Afiliados ativos</p>
        </article>
        <article className="rounded-xl border border-gray-200 bg-white p-5">
          <UserPlus className="h-5 w-5 text-blue-600" aria-hidden="true" />
          <p className="mt-3 text-3xl font-black text-gray-950">{overview.referralsCount}</p>
          <p className="mt-1 text-xs font-semibold text-gray-500">Clientes indicados</p>
        </article>
        <article className="rounded-xl border border-gray-200 bg-white p-5">
          <CircleDollarSign className="h-5 w-5 text-emerald-600" aria-hidden="true" />
          <p className="mt-3 text-2xl font-black text-gray-950">{money(overview.unreservedAvailableAmount)}</p>
          <p className="mt-1 text-xs font-semibold text-gray-500">Saldo disponível não reservado</p>
        </article>
        <article className="rounded-xl border border-gray-200 bg-white p-5">
          <RotateCcw className="h-5 w-5 text-amber-600" aria-hidden="true" />
          <p className="mt-3 text-3xl font-black text-gray-950">{overview.refundReviewsCount}</p>
          <p className="mt-1 text-xs font-semibold text-gray-500">Reembolsos para revisar</p>
        </article>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white">
        <div className="flex flex-col gap-4 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <h2 className="font-black text-gray-950">Participantes</h2>
            <p className="mt-1 text-xs text-gray-500">Clientes que podem ser ativados como afiliados e afiliados já cadastrados.</p>
          </div>
          <label className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar nome, e-mail ou código"
              className="h-10 w-full rounded-lg border border-gray-300 pl-9 pr-3 text-sm outline-none focus:border-red-500 focus:ring-4 focus:ring-red-50"
            />
          </label>
        </div>

        {candidatesQuery.isLoading || affiliatesQuery.isLoading ? (
          <LoadingBlock />
        ) : candidatesQuery.error || affiliatesQuery.error ? (
          <EmptyRow message="Não foi possível carregar os participantes agora." />
        ) : (
          <div className="grid gap-5 p-5 xl:grid-cols-2 sm:p-6">
            <div className="overflow-hidden rounded-xl border border-gray-200">
              <div className="border-b border-gray-100 bg-gray-50 px-4 py-3 text-xs font-black uppercase tracking-[0.08em] text-gray-500">Clientes elegíveis</div>
              {(candidatesQuery.data ?? []).length === 0 ? (
                <EmptyRow message="Nenhum cliente encontrado." />
              ) : (
                <div className="max-h-[430px] divide-y divide-gray-100 overflow-y-auto">
                  {(candidatesQuery.data ?? []).map((row) => (
                    <div key={row.user_id} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-gray-950">{row.full_name || "Cliente"}</p>
                        <p className="truncate text-xs text-gray-500">{row.email || "E-mail não informado"}</p>
                      </div>
                      {row.affiliate_id ? (
                        <span className={`flex-none rounded-full px-2.5 py-1 text-[11px] font-bold ${row.affiliate_status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>
                          {row.affiliate_status === "active" ? "Afiliado ativo" : "Afiliado pausado"}
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={!overview.enabled || actionMutation.isPending}
                          onClick={() => void runAction(() => activateAffiliate(row.user_id), "Cliente ativado como afiliado.")}
                          className="flex-none rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                        >
                          Ativar
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="overflow-hidden rounded-xl border border-gray-200">
              <div className="border-b border-gray-100 bg-gray-50 px-4 py-3 text-xs font-black uppercase tracking-[0.08em] text-gray-500">Afiliados cadastrados</div>
              {(affiliatesQuery.data ?? []).length === 0 ? (
                <EmptyRow message="Nenhum afiliado cadastrado." />
              ) : (
                <div className="max-h-[430px] divide-y divide-gray-100 overflow-y-auto">
                  {(affiliatesQuery.data ?? []).map((row) => (
                    <div key={row.affiliate_id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-gray-950">{row.full_name || row.email || "Afiliado"}</p>
                          <p className="mt-1 inline-flex items-center gap-1 text-xs font-mono font-bold text-red-600"><Link2 className="h-3.5 w-3.5" />{row.referral_code}</p>
                        </div>
                        <button
                          type="button"
                          disabled={actionMutation.isPending}
                          onClick={() => void runAction(
                            () => row.status === "active" ? disableAffiliate(row.user_id) : activateAffiliate(row.user_id),
                            row.status === "active" ? "Participação do afiliado pausada." : "Afiliado reativado.",
                          )}
                          className="flex-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                        >
                          {row.status === "active" ? "Pausar" : "Reativar"}
                        </button>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-gray-500">
                        <span>{row.referred_customers_count} indicados</span>
                        <span>{money(row.pending_commission_amount)} pendente</span>
                        <span>{money(row.available_balance)} disponível</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-5 py-4 sm:px-6">
          <h2 className="font-black text-gray-950">Clientes indicados</h2>
          <p className="mt-1 text-xs text-gray-500">Contas criadas por indicação e o resultado acumulado de seus pedidos.</p>
        </div>
        {referralsQuery.isLoading ? <LoadingBlock /> : referralsQuery.error ? <EmptyRow message="Não foi possível carregar os clientes indicados." /> : (referralsQuery.data ?? []).length === 0 ? <EmptyRow message="Ainda não há clientes indicados." /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-gray-50 text-xs font-bold text-gray-500">
                <tr><th className="px-5 py-3">Afiliado</th><th className="px-5 py-3">Cliente indicado</th><th className="px-5 py-3">Cadastro</th><th className="px-5 py-3">Pedidos pagos</th><th className="px-5 py-3">Vendas pagas</th><th className="px-5 py-3">Comissões</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(referralsQuery.data ?? []).map((row) => (
                  <tr key={`${row.affiliate_id}-${row.referred_user_id}`}>
                    <td className="px-5 py-3 font-semibold text-gray-800">{row.affiliate_name || "Afiliado"}</td>
                    <td className="px-5 py-3"><p className="font-bold text-gray-950">{row.referred_name || "Cliente"}</p><p className="text-xs text-gray-500">{row.referred_email}</p></td>
                    <td className="px-5 py-3 text-gray-600">{dateFormatter.format(new Date(row.referred_at))}</td>
                    <td className="px-5 py-3 font-bold tabular-nums text-gray-950">{row.paid_orders_count}/{row.orders_count}</td>
                    <td className="px-5 py-3 font-bold tabular-nums text-gray-950">{money(row.paid_sales_amount)}</td>
                    <td className="px-5 py-3 font-bold tabular-nums text-gray-950">{money(row.generated_commission_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-5 py-4 sm:px-6">
          <h2 className="font-black text-gray-950">Pedidos dos clientes indicados</h2>
          <p className="mt-1 text-xs text-gray-500">Todos os pedidos dessas contas, com a eventual comissão correspondente.</p>
        </div>
        {ordersQuery.isLoading ? <LoadingBlock /> : ordersQuery.error ? <EmptyRow message="Não foi possível carregar os pedidos indicados." /> : (ordersQuery.data ?? []).length === 0 ? <EmptyRow message="Ainda não há pedidos de clientes indicados." /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-gray-50 text-xs font-bold text-gray-500"><tr><th className="px-5 py-3">Pedido</th><th className="px-5 py-3">Cliente</th><th className="px-5 py-3">Data</th><th className="px-5 py-3">Pagamento</th><th className="px-5 py-3">Total</th><th className="px-5 py-3">Comissão</th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                {(ordersQuery.data ?? []).map((row) => (
                  <tr key={row.order_id}>
                    <td className="px-5 py-3 font-bold text-gray-950">{row.public_number}</td>
                    <td className="px-5 py-3 text-gray-700">{row.referred_name || "Cliente"}</td>
                    <td className="px-5 py-3 text-gray-600">{dateFormatter.format(new Date(row.created_at))}</td>
                    <td className="px-5 py-3 text-gray-600">{row.payment_status}</td>
                    <td className="px-5 py-3 font-bold tabular-nums text-gray-950">{money(row.total_amount)}</td>
                    <td className="px-5 py-3"><span className="font-bold text-gray-950">{row.commission_amount === null ? "—" : money(row.commission_amount)}</span>{row.commission_status ? <span className="ml-2 text-xs text-gray-500">{row.commission_status}</span> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-5 py-4 sm:px-6">
          <h2 className="font-black text-gray-950">Comissões</h2>
          <p className="mt-1 text-xs text-gray-500">Snapshots financeiros dos pedidos elegíveis. Uma comissão por pedido.</p>
        </div>
        {commissionsQuery.isLoading ? <LoadingBlock /> : commissionsQuery.error ? <EmptyRow message="Não foi possível carregar as comissões." /> : (commissionsQuery.data ?? []).length === 0 ? <EmptyRow message="Ainda não há comissões." /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="bg-gray-50 text-xs font-bold text-gray-500"><tr><th className="px-5 py-3">Pedido</th><th className="px-5 py-3">Venda</th><th className="px-5 py-3">Peças</th><th className="px-5 py-3">Valor por peça</th><th className="px-5 py-3">Comissão</th><th className="px-5 py-3">Status</th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                {(commissionsQuery.data ?? []).map((row) => (
                  <tr key={row.commission_id}>
                    <td className="px-5 py-3 font-bold text-gray-950">{row.order_public_number}</td>
                    <td className="px-5 py-3 tabular-nums text-gray-700">{money(row.sale_amount)}</td>
                    <td className="px-5 py-3 tabular-nums text-gray-700">{row.commission_units ?? "—"}</td>
                    <td className="px-5 py-3 text-gray-700">{row.commission_unit_amount === null ? "Histórico anterior" : money(row.commission_unit_amount)}</td>
                    <td className="px-5 py-3 font-black tabular-nums text-gray-950">{money(row.commission_amount)}</td>
                    <td className="px-5 py-3 text-gray-600">{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-5 py-4 sm:px-6">
          <h2 className="font-black text-gray-950">Saques</h2>
          <p className="mt-1 text-xs text-gray-500">Fila de solicitações. A forma de pagamento permanece “{overview.withdrawalMethod ?? "A definir"}”.</p>
        </div>
        {withdrawalsQuery.isLoading ? <LoadingBlock /> : withdrawalsQuery.error ? <EmptyRow message="Não foi possível carregar os saques." /> : (withdrawalsQuery.data ?? []).length === 0 ? <EmptyRow message="Ainda não há solicitações de saque." /> : (
          <div className="divide-y divide-gray-100">
            {(withdrawalsQuery.data ?? []).map((row) => (
              <div key={row.withdrawal_id} className="grid gap-4 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(260px,0.7fr)] lg:items-center sm:px-6">
                <div>
                  <p className="text-sm font-bold text-gray-950">{row.affiliate_name || row.affiliate_email || "Afiliado"} • {money(row.amount)}</p>
                  <p className="mt-1 text-xs text-gray-500">Solicitado em {dateFormatter.format(new Date(row.requested_at))} • {row.status}</p>
                </div>
                {row.status === "requested" ? (
                  <button
                    type="button"
                    disabled={actionMutation.isPending}
                    onClick={() => void runAction(() => markAffiliateWithdrawalPaid(row.withdrawal_id), "Saque marcado como pago.")}
                    className="h-9 rounded-lg bg-emerald-600 px-3 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    Marcar pago
                  </button>
                ) : <span className="text-xs font-bold text-gray-500">{row.status}</span>}
                {row.status === "requested" ? (
                  <div className="flex gap-2">
                    <input
                      value={rejectionNotes[row.withdrawal_id] ?? ""}
                      onChange={(event) => setRejectionNotes((current) => ({ ...current, [row.withdrawal_id]: event.target.value }))}
                      placeholder="Motivo para não aprovar"
                      className="h-9 min-w-0 flex-1 rounded-lg border border-gray-300 px-3 text-xs outline-none focus:border-red-500"
                    />
                    <button
                      type="button"
                      disabled={actionMutation.isPending || (rejectionNotes[row.withdrawal_id]?.trim().length ?? 0) < 3}
                      onClick={() => void runAction(() => rejectAffiliateWithdrawal(row.withdrawal_id, rejectionNotes[row.withdrawal_id] ?? ""), "Solicitação de saque não aprovada.")}
                      className="h-9 rounded-lg border border-red-200 bg-red-50 px-3 text-xs font-bold text-red-700 hover:bg-red-100 disabled:opacity-50"
                    >
                      Rejeitar
                    </button>
                  </div>
                ) : row.rejection_reason ? <p className="text-xs text-red-600">{row.rejection_reason}</p> : <span />}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-amber-200 bg-white">
        <div className="border-b border-amber-100 bg-amber-50 px-5 py-4 sm:px-6">
          <div className="flex items-start gap-3">
            <RotateCcw className="mt-0.5 h-5 w-5 flex-none text-amber-700" aria-hidden="true" />
            <div>
              <h2 className="font-black text-amber-950">Reembolsos após liberação de comissão</h2>
              <p className="mt-1 text-xs leading-5 text-amber-900/70">Como a regra financeira desse caso ainda depende do cliente, o sistema apenas coloca o caso em revisão. Nenhum saldo é descontado automaticamente.</p>
            </div>
          </div>
        </div>
        {refundReviewsQuery.isLoading ? <LoadingBlock /> : refundReviewsQuery.error ? <EmptyRow message="Não foi possível carregar as revisões." /> : (refundReviewsQuery.data ?? []).length === 0 ? <EmptyRow message="Nenhum reembolso desse tipo precisa de revisão." /> : (
          <div className="divide-y divide-gray-100">
            {(refundReviewsQuery.data ?? []).map((row) => (
              <div key={row.review_id} className="grid gap-4 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)] lg:items-center sm:px-6">
                <div>
                  <p className="text-sm font-bold text-gray-950">Pedido {row.order_public_number} • {money(row.commission_amount)}</p>
                  <p className="mt-1 text-xs text-gray-500">{row.affiliate_name || "Afiliado"} • aberto em {dateFormatter.format(new Date(row.created_at))} • {row.review_status}</p>
                  {row.resolution_note ? <p className="mt-2 text-xs text-gray-600">{row.resolution_note}</p> : null}
                </div>
                {row.review_status === "pending" ? (
                  <div className="flex gap-2">
                    <input
                      value={refundNotes[row.review_id] ?? ""}
                      onChange={(event) => setRefundNotes((current) => ({ ...current, [row.review_id]: event.target.value }))}
                      placeholder="Registre o que foi decidido para este caso"
                      className="h-9 min-w-0 flex-1 rounded-lg border border-gray-300 px-3 text-xs outline-none focus:border-red-500"
                    />
                    <button
                      type="button"
                      disabled={actionMutation.isPending || (refundNotes[row.review_id]?.trim().length ?? 0) < 3}
                      onClick={() => void runAction(() => resolveAffiliateRefundReview(row.review_id, refundNotes[row.review_id] ?? ""), "Revisão registrada sem ajuste financeiro automático.")}
                      className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Registrar revisão
                    </button>
                  </div>
                ) : <span className="text-xs font-bold text-emerald-700">Revisado</span>}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-xl border border-gray-200 bg-white p-4"><Clock3 className="h-4.5 w-4.5 text-red-600" /><p className="mt-3 text-xs font-bold text-gray-500">Prazo</p><p className="mt-1 text-sm font-black text-gray-950">{overview.holdDays === null ? "A definir" : `${overview.holdDays} dias`}</p></article>
        <article className="rounded-xl border border-gray-200 bg-white p-4"><WalletCards className="h-4.5 w-4.5 text-red-600" /><p className="mt-3 text-xs font-bold text-gray-500">Saque mínimo / forma</p><p className="mt-1 text-sm font-black text-gray-950">{overview.minimumWithdrawal === null ? "A definir" : money(overview.minimumWithdrawal)} • {overview.withdrawalMethod ?? "A definir"}</p></article>
      </section>
    </div>
  );
}
