import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Box,
  CheckCircle2,
  Clock3,
  Factory,
  PackageCheck,
  ReceiptText,
  RefreshCw,
  RotateCcw,
  ShoppingBag,
  Sparkles,
  Truck,
} from "lucide-react";

import { OrderStatusBadge } from "@/components/orders/OrderStatusBadge";
import {
  fetchAdminDashboardSnapshot,
  type AdminDashboardSnapshot,
} from "@/lib/admin-dashboard";
import type { AdminOrderRow, OrderDisplayStatus } from "@/lib/orders";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "medium",
});

const todayFormatter = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "2-digit",
  month: "long",
});

type AdminSection = "dashboard" | "orders" | "products";

function rowDisplayStatus(row: AdminOrderRow): OrderDisplayStatus {
  if (row.refund_status === "requested") return "refund_requested";
  if (row.refund_status === "canceled") return "refund_canceled";
  return row.status;
}

function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
  emphasis = false,
  onClick,
}: {
  label: string;
  value: number;
  hint: string;
  icon: typeof ShoppingBag;
  emphasis?: boolean;
  onClick?: () => void;
}) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p
            className={`text-xs font-semibold uppercase tracking-[0.12em] ${
              emphasis ? "text-emerald-50/80" : "text-slate-500"
            }`}
          >
            {label}
          </p>
          <p
            className={`mt-3 text-4xl font-black tracking-[-0.04em] ${
              emphasis ? "text-white" : "text-slate-950"
            }`}
          >
            {value}
          </p>
        </div>
        <span
          className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
            emphasis
              ? "bg-white/15 text-white"
              : "bg-emerald-50 text-emerald-700"
          }`}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>
      <p
        className={`mt-5 text-sm leading-6 ${
          emphasis ? "text-emerald-50/85" : "text-slate-500"
        }`}
      >
        {hint}
      </p>
      {onClick ? (
        <span
          className={`mt-4 inline-flex items-center gap-1 text-xs font-bold ${
            emphasis ? "text-white" : "text-emerald-700"
          }`}
        >
          Abrir
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
      ) : null}
    </>
  );

  const className = `rounded-[26px] border p-5 text-left shadow-[0_18px_55px_rgba(15,23,42,0.05)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_65px_rgba(15,23,42,0.09)] sm:p-6 ${
    emphasis
      ? "border-emerald-700 bg-gradient-to-br from-emerald-600 to-emerald-800"
      : "border-white/80 bg-white"
  }`;

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {content}
      </button>
    );
  }

  return <article className={className}>{content}</article>;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-label="Carregando dashboard administrativo">
      <div className="h-28 animate-pulse rounded-[28px] bg-white/70" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-44 animate-pulse rounded-[26px] bg-white/70"
          />
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="h-96 animate-pulse rounded-[28px] bg-white/70" />
        <div className="h-96 animate-pulse rounded-[28px] bg-white/70" />
      </div>
    </div>
  );
}

function OperationsPulse({ snapshot }: { snapshot: AdminDashboardSnapshot }) {
  const maxValue = Math.max(
    1,
    ...snapshot.statusMetrics.map((metric) => metric.total),
  );

  return (
    <section className="rounded-[28px] border border-white/80 bg-white p-5 shadow-[0_18px_55px_rgba(15,23,42,0.05)] sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">
            Pulso operacional
          </p>
          <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950">
            Pedidos por etapa
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Uma leitura rápida do que já existe no fluxo real da loja.
          </p>
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
          <Sparkles className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>

      <div className="mt-7 space-y-4">
        {snapshot.statusMetrics.map((metric) => {
          const width = metric.total === 0 ? 0 : (metric.total / maxValue) * 100;

          return (
            <div key={metric.status}>
              <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                <span className="font-bold text-slate-700">{metric.label}</span>
                <span className="font-black tabular-nums text-slate-950">
                  {metric.total}
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-300 to-emerald-600 transition-[width] duration-700 ease-out motion-reduce:transition-none"
                  style={{ width: `${width}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function RecentOrders({
  rows,
  onOpenOrders,
}: {
  rows: AdminOrderRow[];
  onOpenOrders: () => void;
}) {
  return (
    <section className="rounded-[28px] border border-white/80 bg-white p-5 shadow-[0_18px_55px_rgba(15,23,42,0.05)] sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">
            Histórico recente
          </p>
          <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950">
            Últimos pedidos
          </h2>
        </div>
        <button
          type="button"
          onClick={onOpenOrders}
          className="inline-flex h-9 items-center rounded-full border border-slate-200 bg-white px-3.5 text-xs font-bold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800"
        >
          Ver todos
          <ArrowRight className="ml-1.5 h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-5 py-12 text-center">
          <ReceiptText className="mx-auto h-7 w-7 text-slate-300" aria-hidden="true" />
          <p className="mt-3 font-black text-slate-800">Ainda não há pedidos reais</p>
          <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-500">
            O dashboard permanece vazio até o primeiro checkout real criar um pedido.
          </p>
        </div>
      ) : (
        <div className="mt-5 overflow-hidden rounded-2xl border border-slate-100">
          <div className="divide-y divide-slate-100">
            {rows.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={onOpenOrders}
                className="grid w-full gap-3 bg-white px-4 py-4 text-left transition hover:bg-emerald-50/45 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-slate-950">
                    {row.public_number}
                  </p>
                  <p className="mt-1 truncate text-xs text-slate-500">
                    {row.customer_name} • {dateFormatter.format(new Date(row.created_at))}
                  </p>
                </div>
                <div className="justify-self-start">
                  <OrderStatusBadge status={rowDisplayStatus(row)} />
                </div>
                <p className="font-black tabular-nums text-slate-950 sm:text-right">
                  {currencyFormatter.format(row.total_amount)}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export function AdminDashboard({
  onNavigate,
}: {
  onNavigate: (section: AdminSection) => void;
}) {
  const dashboardQuery = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: fetchAdminDashboardSnapshot,
    staleTime: 15_000,
  });

  if (dashboardQuery.isLoading) return <DashboardSkeleton />;

  if (dashboardQuery.error || !dashboardQuery.data) {
    return (
      <div className="rounded-[28px] border border-red-100 bg-white px-6 py-12 text-center shadow-sm">
        <RefreshCw className="mx-auto h-7 w-7 text-red-500" aria-hidden="true" />
        <h2 className="mt-4 text-xl font-black text-slate-950">
          Não foi possível carregar o dashboard
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">
          {dashboardQuery.error instanceof Error
            ? dashboardQuery.error.message
            : "Tente novamente em instantes."}
        </p>
        <button
          type="button"
          onClick={() => void dashboardQuery.refetch()}
          className="mt-5 inline-flex h-10 items-center rounded-full bg-emerald-700 px-4 text-sm font-bold text-white transition hover:bg-emerald-800"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  const snapshot = dashboardQuery.data;
  const attentionTotal =
    snapshot.pendingPayment + snapshot.inProduction + snapshot.refundRequested;

  return (
    <div className="space-y-5 sm:space-y-6">
      <section className="relative overflow-hidden rounded-[30px] border border-emerald-800/10 bg-gradient-to-br from-emerald-700 via-emerald-700 to-emerald-900 px-6 py-7 text-white shadow-[0_24px_70px_rgba(6,95,70,0.22)] sm:px-8 sm:py-8">
        <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-emerald-300/10 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold capitalize text-emerald-100">
              {todayFormatter.format(new Date())}
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] sm:text-4xl">
              Bem-vindo de volta.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-emerald-50/80 sm:text-base">
              Aqui você acompanha somente o que já existe na operação real da BIGofertas: pedidos, produção, entregas, reembolsos e catálogo.
            </p>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 px-5 py-4 backdrop-blur-sm">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-100/80">
              Atenção agora
            </p>
            <div className="mt-2 flex items-end gap-3">
              <strong className="text-4xl font-black tracking-tight">{attentionTotal}</strong>
              <span className="pb-1 text-sm text-emerald-50/80">
                {attentionTotal === 1 ? "situação ativa" : "situações ativas"}
              </span>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Pedidos"
          value={snapshot.totalOrders}
          hint="Total registrado no núcleo definitivo de pedidos."
          icon={ShoppingBag}
          onClick={() => onNavigate("orders")}
        />
        <MetricCard
          label="Em produção"
          value={snapshot.inProduction}
          hint="Pedidos que estão sendo produzidos sob encomenda."
          icon={Factory}
          emphasis
          onClick={() => onNavigate("orders")}
        />
        <MetricCard
          label="Reembolsos"
          value={snapshot.refundRequested}
          hint="Solicitações aguardando contato e resolução manual."
          icon={RotateCcw}
          onClick={() => onNavigate("orders")}
        />
        <MetricCard
          label="Produtos ativos"
          value={snapshot.activeProducts}
          hint={`${snapshot.draftProducts} ${snapshot.draftProducts === 1 ? "produto em rascunho" : "produtos em rascunho"}.`}
          icon={Box}
          onClick={() => onNavigate("products")}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <RecentOrders
          rows={snapshot.recentOrders}
          onOpenOrders={() => onNavigate("orders")}
        />
        <OperationsPulse snapshot={snapshot} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <button
          type="button"
          onClick={() => onNavigate("orders")}
          className="group rounded-[24px] border border-white/80 bg-white p-5 text-left shadow-[0_16px_50px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:shadow-lg"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
            <Clock3 className="h-5 w-5" aria-hidden="true" />
          </span>
          <p className="mt-4 text-sm font-black text-slate-950">
            {snapshot.pendingPayment} aguardando pagamento
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            O sistema apenas acompanha; a confirmação financeira virá da integração real.
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate("orders")}
          className="group rounded-[24px] border border-white/80 bg-white p-5 text-left shadow-[0_16px_50px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:shadow-lg"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
            <Truck className="h-5 w-5" aria-hidden="true" />
          </span>
          <p className="mt-4 text-sm font-black text-slate-950">
            {snapshot.shipped} em transporte
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Pedidos já marcados como enviados e aguardando conclusão da entrega.
          </p>
        </button>

        <article className="rounded-[24px] border border-white/80 bg-white p-5 shadow-[0_16px_50px_rgba(15,23,42,0.04)]">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
            <PackageCheck className="h-5 w-5" aria-hidden="true" />
          </span>
          <p className="mt-4 text-sm font-black text-slate-950">
            {snapshot.delivered} entregues
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Entregas concluídas e registradas no histórico real dos pedidos.
          </p>
        </article>
      </div>

      <section className="flex flex-col gap-4 rounded-[28px] border border-emerald-100 bg-emerald-50/70 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 flex-none items-center justify-center rounded-2xl bg-emerald-700 text-white shadow-lg shadow-emerald-700/15">
            <Factory className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="font-black text-emerald-950">Produção sob encomenda</p>
            <p className="mt-1 text-sm leading-6 text-emerald-900/70">
              A regra comercial continua simples: produção em até 5 dias úteis antes do envio, sem reserva ou baixa de estoque.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-bold text-emerald-800 shadow-sm">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          Modelo sob encomenda
        </div>
      </section>
    </div>
  );
}
