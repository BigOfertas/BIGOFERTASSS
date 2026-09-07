import { useQuery } from "@tanstack/react-query";
import {
  CircleDollarSign,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Link2,
  Loader2,
  RefreshCw,
  Share2,
  Sparkles,
  UserRoundPlus,
  UsersRound,
  WalletCards,
} from "lucide-react";
import { useState } from "react";

import { AffiliateWithdrawalForm } from "@/components/account/AffiliateWithdrawalForm";
import { BRAND } from "@/config/brand";
import {
  activateMyAffiliate,
  deactivateMyAffiliate,
  fetchMyAffiliateCommissions,
  fetchMyAffiliateDashboard,
  fetchMyAffiliateReferrals,
  fetchMyAffiliateWithdrawals,
  type AffiliateCommissionRow,
  type AffiliateWithdrawalRow,
} from "@/lib/affiliates";
import { buildAffiliateRegistrationUrl } from "@/lib/affiliate-referral";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "medium",
});

function money(value: number) {
  return currencyFormatter.format(Number.isFinite(value) ? value : 0);
}

function commissionStatus(row: AffiliateCommissionRow) {
  if (row.status === "available") {
    return { label: "Disponível", className: "bg-emerald-50 text-emerald-700" };
  }
  if (row.status === "cancelled") {
    return { label: "Cancelada", className: "bg-gray-100 text-gray-600" };
  }
  return { label: "Pendente", className: "bg-amber-50 text-amber-700" };
}

function withdrawalStatus(row: AffiliateWithdrawalRow) {
  if (row.status === "paid") {
    return { label: "Pago", className: "bg-emerald-50 text-emerald-700" };
  }
  if (row.status === "rejected") {
    return { label: "Não aprovado", className: "bg-red-50 text-red-700" };
  }
  return { label: "Solicitado", className: "bg-amber-50 text-amber-700" };
}

function LoadingState() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white px-6 py-14 text-center shadow-sm">
      <Loader2 className="mx-auto h-6 w-6 animate-spin text-red-600 motion-reduce:animate-none" />
      <p className="mt-3 text-sm font-semibold text-gray-600">
        Carregando sua área de afiliados...
      </p>
    </div>
  );
}

function HowItWorks() {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-start gap-4">
        <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
          <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <h3 className="text-base font-black text-gray-950">Como funciona a indicação</h3>
          <p className="mt-1 text-sm leading-6 text-gray-600">
            O link serve para convidar uma pessoa nova a criar uma conta na {BRAND.officialName}. A
            indicação fica vinculada ao cadastro, não a um produto específico.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-4">
          <Share2 className="h-4.5 w-4.5 text-red-600" aria-hidden="true" />
          <p className="mt-3 text-sm font-bold text-gray-950">1. Convide</p>
          <p className="mt-1 text-xs leading-5 text-gray-500">
            Compartilhe seu link pessoal para uma nova pessoa criar a conta dela.
          </p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-4">
          <UserRoundPlus className="h-4.5 w-4.5 text-red-600" aria-hidden="true" />
          <p className="mt-3 text-sm font-bold text-gray-950">2. O cliente se cadastra</p>
          <p className="mt-1 text-xs leading-5 text-gray-500">
            Se o cadastro for concluído pelo seu link, essa nova conta fica vinculada à sua
            indicação.
          </p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-4">
          <CircleDollarSign className="h-4.5 w-4.5 text-red-600" aria-hidden="true" />
          <p className="mt-3 text-sm font-bold text-gray-950">3. Acompanhe as compras</p>
          <p className="mt-1 text-xs leading-5 text-gray-500">
            Quando esse cliente fizer pedidos elegíveis, as comissões aparecem no seu histórico.
          </p>
        </div>
      </div>
    </section>
  );
}

export function AffiliateAccountPanel() {
  const [copied, setCopied] = useState(false);
  const [affiliateAction, setAffiliateAction] = useState<"activate" | "deactivate" | null>(null);
  const [affiliateActionError, setAffiliateActionError] = useState<string | null>(null);

  const dashboardQuery = useQuery({
    queryKey: ["my-affiliate-dashboard"],
    queryFn: fetchMyAffiliateDashboard,
    staleTime: 20_000,
  });

  const isAffiliate = dashboardQuery.data?.isAffiliate === true;

  const referralsQuery = useQuery({
    queryKey: ["my-affiliate-referrals"],
    queryFn: fetchMyAffiliateReferrals,
    enabled: isAffiliate,
    staleTime: 20_000,
  });

  const commissionsQuery = useQuery({
    queryKey: ["my-affiliate-commissions"],
    queryFn: fetchMyAffiliateCommissions,
    enabled: isAffiliate,
    staleTime: 20_000,
  });

  const withdrawalsQuery = useQuery({
    queryKey: ["my-affiliate-withdrawals"],
    queryFn: fetchMyAffiliateWithdrawals,
    enabled: isAffiliate,
    staleTime: 20_000,
  });

  async function changeAffiliateStatus(action: "activate" | "deactivate") {
    setAffiliateAction(action);
    setAffiliateActionError(null);
    try {
      if (action === "activate") {
        await activateMyAffiliate();
      } else {
        await deactivateMyAffiliate();
      }
      await dashboardQuery.refetch();
    } catch (error) {
      setAffiliateActionError(
        error instanceof Error
          ? error.message
          : action === "activate"
            ? "Não foi possível ativar seu perfil de afiliado agora."
            : "Não foi possível desativar seu perfil de afiliado agora.",
      );
    } finally {
      setAffiliateAction(null);
    }
  }

  if (dashboardQuery.isLoading) return <LoadingState />;

  if (dashboardQuery.error || !dashboardQuery.data) {
    return (
      <div className="rounded-2xl border border-red-200 bg-white px-6 py-12 text-center shadow-sm">
        <RefreshCw className="mx-auto h-7 w-7 text-red-500" aria-hidden="true" />
        <h2 className="mt-4 text-lg font-black text-gray-950">
          Não foi possível carregar esta área
        </h2>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-gray-500">
          Tente novamente em instantes. Nenhum dado da sua conta foi alterado.
        </p>
        <button
          type="button"
          onClick={() => void dashboardQuery.refetch()}
          className="mt-5 inline-flex h-10 items-center rounded-lg bg-red-600 px-4 text-sm font-bold text-white hover:bg-red-700"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  const dashboard = dashboardQuery.data;

  if (!dashboard.isAffiliate) {
    return (
      <div className="space-y-5">
        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="relative overflow-hidden bg-gradient-to-br from-gray-950 via-gray-900 to-red-950 px-5 py-8 text-white sm:px-7">
            <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-red-600/20 blur-3xl" />
            <div className="relative max-w-2xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold text-white/85">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                Programa de afiliados
              </span>
              <h2 className="mt-5 text-2xl font-black tracking-tight sm:text-3xl">
                Ganhe indicando novos clientes
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-gray-300 sm:text-base">
                Ative seu perfil de afiliado para receber seu link exclusivo. Quando uma nova pessoa
                criar a conta por esse link, as compras elegíveis dela podem gerar comissão para
                você.
              </p>

              {dashboard.programEnabled ? (
                <button
                  type="button"
                  onClick={() => void changeAffiliateStatus("activate")}
                  disabled={affiliateAction !== null}
                  className="mt-6 inline-flex h-11 items-center rounded-xl bg-red-600 px-5 text-sm font-black text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {affiliateAction === "activate" ? (
                    <Loader2
                      className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none"
                      aria-hidden="true"
                    />
                  ) : (
                    <Link2 className="mr-2 h-4 w-4" aria-hidden="true" />
                  )}
                  {affiliateAction === "activate" ? "Ativando..." : "Quero ser afiliado"}
                </button>
              ) : (
                <div className="mt-6 inline-flex items-start gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-white/85">
                  <UsersRound className="mt-0.5 h-4.5 w-4.5 flex-none" aria-hidden="true" />
                  <span>O programa está temporariamente indisponível para novas ativações.</span>
                </div>
              )}

              {affiliateActionError ? (
                <p className="mt-3 rounded-xl border border-red-300/30 bg-red-950/40 px-4 py-3 text-sm font-semibold text-red-100">
                  {affiliateActionError}
                </p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-3 p-5 sm:grid-cols-3 sm:p-6">
            <article className="rounded-xl border border-gray-200 bg-gray-50/70 p-4 sm:p-5">
              <Link2 className="h-5 w-5 text-red-600" aria-hidden="true" />
              <h3 className="mt-4 text-sm font-extrabold text-gray-950">Link exclusivo</h3>
              <p className="mt-2 text-xs leading-5 text-gray-600">
                Seu link único é criado quando você ativa o programa e permanece o mesmo enquanto
                sua conta existir.
              </p>
            </article>
            <article className="rounded-xl border border-gray-200 bg-gray-50/70 p-4 sm:p-5">
              <UsersRound className="h-5 w-5 text-red-600" aria-hidden="true" />
              <h3 className="mt-4 text-sm font-extrabold text-gray-950">Clientes indicados</h3>
              <p className="mt-2 text-xs leading-5 text-gray-600">
                O vínculo nasce no cadastro e o histórico fica associado à conta indicada.
              </p>
            </article>
            <article className="rounded-xl border border-gray-200 bg-gray-50/70 p-4 sm:p-5">
              <WalletCards className="h-5 w-5 text-red-600" aria-hidden="true" />
              <h3 className="mt-4 text-sm font-extrabold text-gray-950">Comissões e saques</h3>
              <p className="mt-2 text-xs leading-5 text-gray-600">
                Acompanhe saldo, histórico de comissões e solicitações de saque por PIX nesta área.
              </p>
            </article>
          </div>
        </section>

        <HowItWorks />
      </div>
    );
  }

  const referralLink = dashboard.referralCode
    ? buildAffiliateRegistrationUrl(dashboard.referralCode)
    : null;
  const sharingEnabled =
    dashboard.programEnabled && dashboard.status === "active" && Boolean(referralLink);
  const listsLoading =
    referralsQuery.isLoading || commissionsQuery.isLoading || withdrawalsQuery.isLoading;
  const listsError = referralsQuery.error || commissionsQuery.error || withdrawalsQuery.error;

  async function copyReferralLink() {
    if (!sharingEnabled || !referralLink || typeof navigator === "undefined") return;
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="relative overflow-hidden bg-gradient-to-br from-gray-950 via-gray-900 to-red-950 px-5 py-7 text-white sm:px-7 sm:py-8">
          <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-red-600/20 blur-3xl" />
          <div className="relative">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold text-white/85">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Sua área de afiliados
            </span>
            <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.75fr)] lg:items-end">
              <div>
                <h2 className="text-2xl font-black tracking-tight sm:text-3xl">
                  Convide novos clientes para criar uma conta
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-300 sm:text-base">
                  As compras futuras das contas cadastradas pela sua indicação ficam vinculadas ao
                  seu histórico de afiliado.
                </p>
                {!dashboard.programEnabled ? (
                  <p className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm font-semibold text-amber-100">
                    O programa está temporariamente indisponível. Seu histórico e seu código
                    permanecem preservados, mas novas indicações ficam bloqueadas até a reabertura.
                  </p>
                ) : dashboard.status === "disabled" ? (
                  <p className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm font-semibold text-amber-100">
                    Você desativou sua participação. Seu histórico e seu link exclusivo foram
                    preservados, mas o link não aceita novas indicações enquanto estiver desativado.
                  </p>
                ) : null}

                {affiliateActionError ? (
                  <p className="mt-3 rounded-xl border border-red-300/30 bg-red-950/40 px-4 py-3 text-sm font-semibold text-red-100">
                    {affiliateActionError}
                  </p>
                ) : null}
              </div>

              <div className="rounded-xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-white/60">
                  Seu link exclusivo
                </p>
                <p className="mt-2 break-all text-sm font-semibold text-white">
                  {referralLink ?? "Link ainda não disponível"}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void copyReferralLink()}
                    disabled={!sharingEnabled}
                    className="inline-flex h-10 items-center rounded-lg bg-white px-4 text-sm font-black text-gray-950 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {copied ? (
                      <ClipboardCheck className="mr-2 h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Copy className="mr-2 h-4 w-4" aria-hidden="true" />
                    )}
                    {copied ? "Link copiado" : "Copiar link"}
                  </button>

                  {dashboard.programEnabled && dashboard.status === "disabled" ? (
                    <button
                      type="button"
                      onClick={() => void changeAffiliateStatus("activate")}
                      disabled={affiliateAction !== null}
                      className="inline-flex h-10 items-center rounded-lg bg-red-600 px-4 text-sm font-black text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {affiliateAction === "activate" ? (
                        <Loader2
                          className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none"
                          aria-hidden="true"
                        />
                      ) : null}
                      {affiliateAction === "activate" ? "Reativando..." : "Reativar meu link"}
                    </button>
                  ) : dashboard.status === "active" ? (
                    <button
                      type="button"
                      onClick={() => void changeAffiliateStatus("deactivate")}
                      disabled={affiliateAction !== null}
                      className="inline-flex h-10 items-center rounded-lg border border-white/25 bg-transparent px-4 text-sm font-bold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {affiliateAction === "deactivate" ? (
                        <Loader2
                          className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none"
                          aria-hidden="true"
                        />
                      ) : null}
                      {affiliateAction === "deactivate"
                        ? "Desativando..."
                        : "Desativar programa de afiliado"}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4 sm:p-6">
          <article className="rounded-xl border border-gray-200 bg-gray-50/70 p-4">
            <UsersRound className="h-5 w-5 text-red-600" aria-hidden="true" />
            <p className="mt-3 text-2xl font-black text-gray-950">{dashboard.referralsCount}</p>
            <p className="mt-1 text-xs font-semibold text-gray-500">Clientes indicados</p>
          </article>
          <article className="rounded-xl border border-gray-200 bg-gray-50/70 p-4">
            <CircleDollarSign className="h-5 w-5 text-amber-600" aria-hidden="true" />
            <p className="mt-3 text-2xl font-black text-gray-950">
              {money(dashboard.pendingAmount)}
            </p>
            <p className="mt-1 text-xs font-semibold text-gray-500">Comissões pendentes</p>
          </article>
          <article className="rounded-xl border border-gray-200 bg-gray-50/70 p-4">
            <WalletCards className="h-5 w-5 text-emerald-600" aria-hidden="true" />
            <p className="mt-3 text-2xl font-black text-gray-950">
              {money(dashboard.availableAmount)}
            </p>
            <p className="mt-1 text-xs font-semibold text-gray-500">Saldo disponível</p>
          </article>
          <article className="rounded-xl border border-gray-200 bg-gray-50/70 p-4">
            <CheckCircle2 className="h-5 w-5 text-blue-600" aria-hidden="true" />
            <p className="mt-3 text-2xl font-black text-gray-950">
              {money(dashboard.paidWithdrawalAmount)}
            </p>
            <p className="mt-1 text-xs font-semibold text-gray-500">Saques pagos</p>
          </article>
        </div>
      </section>

      {dashboard.rulesComplete && dashboard.commissionTiers.length > 0 ? (
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <h3 className="font-black text-gray-950">Sua comissão por peça</h3>
          <p className="mt-1 text-xs leading-5 text-gray-500">
            A faixa mais alta atingida no pedido define o valor pago por cada peça daquele pedido.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {dashboard.commissionTiers.map((tier) => (
              <div
                key={tier.minUnits}
                className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-3"
              >
                <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-gray-500">
                  {tier.minUnits === 1 ? "Padrão" : `${tier.minUnits}+ peças`}
                </p>
                <p className="mt-1 text-lg font-black text-gray-950">{money(tier.amountPerUnit)}</p>
                <p className="text-[11px] text-gray-500">por peça</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <AffiliateWithdrawalForm dashboard={dashboard} />

      {!dashboard.rulesComplete ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:p-6">
          <h3 className="font-black text-amber-950">Regras comerciais em definição</h3>
          <p className="mt-2 text-sm leading-6 text-amber-900/75">
            Os valores fixos de comissão por peça, o prazo de liberação, o saque mínimo e a forma de
            pagamento ainda estão sendo definidos. Nenhum valor é estimado nesta tela antes dessa
            configuração.
          </p>
        </section>
      ) : null}

      {listsLoading ? (
        <LoadingState />
      ) : listsError ? (
        <section className="rounded-2xl border border-red-200 bg-white p-6 text-center shadow-sm">
          <p className="font-bold text-gray-950">Parte do histórico não pôde ser carregada.</p>
          <button
            type="button"
            onClick={() => {
              void referralsQuery.refetch();
              void commissionsQuery.refetch();
              void withdrawalsQuery.refetch();
            }}
            className="mt-4 inline-flex h-10 items-center rounded-lg border border-gray-200 bg-white px-4 text-sm font-bold text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
            Tentar novamente
          </button>
        </section>
      ) : (
        <>
          <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-5 py-4 sm:px-6">
              <h3 className="font-black text-gray-950">Clientes indicados</h3>
              <p className="mt-1 text-xs leading-5 text-gray-500">
                Pessoas que criaram uma conta usando seu link. O e-mail aparece parcialmente oculto
                por privacidade.
              </p>
            </div>
            {(referralsQuery.data ?? []).length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-gray-500">
                Nenhum novo cliente foi cadastrado pela sua indicação ainda.
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {(referralsQuery.data ?? []).map((row) => (
                  <div
                    key={`${row.masked_email}-${row.referred_at}`}
                    className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:px-6"
                  >
                    <div>
                      <p className="text-sm font-bold text-gray-950">{row.display_name}</p>
                      <p className="mt-1 text-xs text-gray-500">
                        {row.masked_email} • desde {dateFormatter.format(new Date(row.referred_at))}
                      </p>
                    </div>
                    <p className="text-xs font-semibold text-gray-500">
                      {row.commissions_count}{" "}
                      {row.commissions_count === 1 ? "comissão" : "comissões"}
                    </p>
                    <p className="text-sm font-black tabular-nums text-gray-950">
                      {money(row.generated_commission_amount)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-5 py-4 sm:px-6">
              <h3 className="font-black text-gray-950">Comissões</h3>
              <p className="mt-1 text-xs leading-5 text-gray-500">
                Histórico das comissões ligadas aos pedidos dos seus clientes indicados.
              </p>
            </div>
            {(commissionsQuery.data ?? []).length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-gray-500">
                Ainda não há comissões registradas.
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {(commissionsQuery.data ?? []).map((row) => {
                  const status = commissionStatus(row);
                  return (
                    <div
                      key={row.id}
                      className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:px-6"
                    >
                      <div>
                        <p className="text-sm font-bold text-gray-950">
                          Pedido {row.order_public_number}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          Registrada em {dateFormatter.format(new Date(row.created_at))}
                        </p>
                        {row.commission_units && row.commission_unit_amount ? (
                          <p className="mt-1 text-xs font-semibold text-gray-600">
                            {row.commission_units} peças × {money(row.commission_unit_amount)} por
                            peça
                          </p>
                        ) : null}
                      </div>
                      <span
                        className={`w-fit rounded-full px-2.5 py-1 text-[11px] font-bold ${status.className}`}
                      >
                        {status.label}
                      </span>
                      <p className="text-sm font-black tabular-nums text-gray-950">
                        {money(row.commission_amount)}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div>
                <h3 className="font-black text-gray-950">Saques</h3>
                <p className="mt-1 text-xs leading-5 text-gray-500">
                  Histórico de solicitações e pagamentos do seu saldo de afiliado. O saldo
                  disponível permanece acumulado até você solicitar o saque.
                </p>
              </div>
              <span className="w-fit rounded-lg bg-gray-100 px-3 py-2 text-xs font-bold text-gray-600">
                Forma de recebimento: {dashboard.withdrawalMethod ?? "A definir"}
              </span>
            </div>
            {(withdrawalsQuery.data ?? []).length === 0 ? (
              <div className="px-6 py-10 text-center">
                <p className="text-sm text-gray-500">Ainda não há solicitações de saque.</p>
                {!dashboard.rulesComplete ? (
                  <p className="mx-auto mt-2 max-w-lg text-xs leading-5 text-gray-400">
                    A solicitação de saque será liberada depois que as regras comerciais e a forma
                    de pagamento forem confirmadas.
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {(withdrawalsQuery.data ?? []).map((row) => {
                  const status = withdrawalStatus(row);
                  return (
                    <div
                      key={row.id}
                      className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:px-6"
                    >
                      <div>
                        <p className="text-sm font-bold text-gray-950">
                          Solicitação de {dateFormatter.format(new Date(row.requested_at))}
                        </p>
                        {row.status === "rejected" && row.rejection_reason ? (
                          <p className="mt-1 text-xs text-red-600">{row.rejection_reason}</p>
                        ) : null}
                      </div>
                      <span
                        className={`w-fit rounded-full px-2.5 py-1 text-[11px] font-bold ${status.className}`}
                      >
                        {status.label}
                      </span>
                      <p className="text-sm font-black tabular-nums text-gray-950">
                        {money(row.amount)}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}

      <HowItWorks />
    </div>
  );
}
