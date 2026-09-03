import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Box,
  Clock3,
  Factory,
  PackageCheck,
  ReceiptText,
  RefreshCw,
  RotateCcw,
  ShoppingBag,
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
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-gray-500">
            {label}
          </p>
          <p className="mt-2 text-3xl font-black tracking-tight text-gray-950">
            {value}
          </p>
        </div>
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-lg ${
            emphasis ? "bg-red-600 text-white" : "bg-gray-100 text-gray-700"
          }`}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>

      <p className="mt-4 min-h-10 text-sm leading-5 text-gray-500">{hint}</p>

      {onClick ? (
        <span className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-red-600">
          Abrir
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
      ) : null}
    </>
  );

  const className = `rounded-xl border p-5 text-left transition motion-reduce:transition-none ${
    emphasis
      ? "border-red-200 bg-red-50/40 hover:border-red-300"
      : "border-gray-200 bg-white hover:border-gray-300"
  } hover:shadow-[0_8px_24px_rgba(0,0,0,0.05)]`;

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
    <div className="space-y-6" aria-label="Carregando painel administrativo">
      <div className="h-20 animate-pulse rounded-xl border border-gray-200 bg-white" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-40 animate-pulse rounded-xl border border-gray-200 bg-white"
          />
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <div className="h-96 animate-pulse rounded-xl border border-gray-200 bg-white" />
        <div className="h-96 animate-pulse rounded-xl border border-gray-200 bg-white" />
      </div>
    </div>
  );
}

function OperationsOverview({
  snapshot,
}: {
  snapshot: AdminDashboardSnapshot;
}) {
  const maxValue = Math.max(
    1,
    ...snapshot.statusMetrics.map((metric) => metric.total),
  );

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-gray-500">
          Operação
        </p>
        <h2 className="mt-1 text-lg font-bold text-gray-950">Pedidos por etapa</h2>
        <p className="mt-1 text-sm leading-6 text-gray-500">
          Veja rapidamente onde os pedidos estão no fluxo da loja.
        </p>
      </div>

      <div className="mt-6 space-y-4">
        {snapshot.statusMetrics.map((metric) => {
          const width = metric.total === 0 ? 0 : (metric.total / maxValue) * 100;

          return (
            <div key={metric.status}>
              <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                <span className="font-semibold text-gray-700">{metric.label}</span>
                <span className="font-bold tabular-nums text-gray-950">
                  {metric.total}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-red-600 transition-[width] duration-500 motion-reduce:transition-none"
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
    <section className="rounded-xl border border-gray-200 bg-white">
      <div className="flex items-center justify-between gap-4 border-b border-gray-100 px-5 py-4 sm:px-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-gray-500">
            Pedidos
          </p>
          <h2 className="mt-1 text-lg font-bold text-gray-950">Mais recentes</h2>
        </div>
        <button
          type="button"
          onClick={onOpenOrders}
          className="inline-flex h-9 items-center rounded-lg border border-gray-200 bg-white px-3 text-xs font-bold text-gray-700 transition hover:bg-gray-50 hover:text-red-600 motion-reduce:transition-none"
        >
          Ver todos
          <ArrowRight className="ml-1.5 h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="px-5 py-12 text-center sm:px-6">
          <ReceiptText className="mx-auto h-7 w-7 text-gray-300" aria-hidden="true" />
          <p className="mt-3 font-bold text-gray-900">Ainda não há pedidos</p>
          <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-gray-500">
            Assim que uma compra for iniciada, os pedidos mais recentes aparecerão aqui.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {rows.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={onOpenOrders}
              className="grid w-full gap-3 px-5 py-4 text-left transition hover:bg-gray-50 motion-reduce:transition-none sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:px-6"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-gray-950">
                  {row.public_number}
                </p>
                <p className="mt-1 truncate text-xs text-gray-500">
                  {row.customer_name} • {dateFormatter.format(new Date(row.created_at))}
                </p>
              </div>
              <div className="justify-self-start">
                <OrderStatusBadge status={rowDisplayStatus(row)} />
              </div>
              <p className="font-bold tabular-nums text-gray-950 sm:text-right">
                {currencyFormatter.format(row.total_amount)}
              </p>
            </button>
          ))}
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
      <div className="rounded-xl border border-red-200 bg-white px-6 py-12 text-center">
        <RefreshCw className="mx-auto h-7 w-7 text-red-500" aria-hidden="true" />
        <h2 className="mt-4 text-xl font-bold text-gray-950">
          Não foi possível carregar o painel
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-gray-500">
          Tente novamente em instantes.
        </p>
        <button
          type="button"
          onClick={() => void dashboardQuery.refetch()}
          className="mt-5 inline-flex h-10 items-center rounded-lg bg-red-600 px-4 text-sm font-bold text-white transition hover:bg-red-700 motion-reduce:transition-none"
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
    <div className="space-y-6">
      <section className="flex flex-col gap-4 border-b border-gray-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium capitalize text-gray-500">
            {todayFormatter.format(new Date())}
          </p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-gray-950">
            Visão geral
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">
            Pedidos, produção, entregas e catálogo em uma visão rápida da operação.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigate("orders")}
          className="flex w-fit items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-left transition hover:border-red-300 motion-reduce:transition-none"
        >
          <span className="text-2xl font-black tabular-nums text-red-700">
            {attentionTotal}
          </span>
          <span>
            <span className="block text-xs font-bold text-red-800">Precisam de atenção</span>
            <span className="mt-0.5 block text-[11px] text-red-700/75">
              Pagamento, produção ou reembolso
            </span>
          </span>
          <ArrowRight className="h-4 w-4 text-red-500" aria-hidden="true" />
        </button>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Pedidos"
          value={snapshot.totalOrders}
          hint="Total de pedidos registrados na loja."
          icon={ShoppingBag}
          onClick={() => onNavigate("orders")}
        />
        <MetricCard
          label="Em produção"
          value={snapshot.inProduction}
          hint="Pedidos que estão sendo preparados para envio."
          icon={Factory}
          emphasis
          onClick={() => onNavigate("orders")}
        />
        <MetricCard
          label="Reembolsos"
          value={snapshot.refundRequested}
          hint="Solicitações aguardando atendimento."
          icon={RotateCcw}
          onClick={() => onNavigate("orders")}
        />
        <MetricCard
          label="Produtos ativos"
          value={snapshot.activeProducts}
          hint={`${snapshot.draftProducts} ${
            snapshot.draftProducts === 1 ? "produto em rascunho" : "produtos em rascunho"
          }.`}
          icon={Box}
          onClick={() => onNavigate("products")}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <RecentOrders
          rows={snapshot.recentOrders}
          onOpenOrders={() => onNavigate("orders")}
        />
        <OperationsOverview snapshot={snapshot} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <button
          type="button"
          onClick={() => onNavigate("orders")}
          className="rounded-xl border border-gray-200 bg-white p-5 text-left transition hover:border-gray-300 hover:shadow-[0_8px_24px_rgba(0,0,0,0.05)] motion-reduce:transition-none"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
            <Clock3 className="h-4.5 w-4.5" aria-hidden="true" />
          </span>
          <p className="mt-4 text-sm font-bold text-gray-950">
            {snapshot.pendingPayment} aguardando pagamento
          </p>
          <p className="mt-1 text-xs leading-5 text-gray-500">
            Pedidos que ainda aguardam confirmação do pagamento.
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate("orders")}
          className="rounded-xl border border-gray-200 bg-white p-5 text-left transition hover:border-gray-300 hover:shadow-[0_8px_24px_rgba(0,0,0,0.05)] motion-reduce:transition-none"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
            <Truck className="h-4.5 w-4.5" aria-hidden="true" />
          </span>
          <p className="mt-4 text-sm font-bold text-gray-950">
            {snapshot.shipped} em transporte
          </p>
          <p className="mt-1 text-xs leading-5 text-gray-500">
            Pedidos enviados que ainda não foram marcados como entregues.
          </p>
        </button>

        <article className="rounded-xl border border-gray-200 bg-white p-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
            <PackageCheck className="h-4.5 w-4.5" aria-hidden="true" />
          </span>
          <p className="mt-4 text-sm font-bold text-gray-950">
            {snapshot.delivered} entregues
          </p>
          <p className="mt-1 text-xs leading-5 text-gray-500">
            Pedidos concluídos e registrados no histórico.
          </p>
        </article>
      </div>

      <section className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-gray-100 text-gray-700">
            <Factory className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="font-bold text-gray-950">Produção sob encomenda</p>
            <p className="mt-1 text-sm leading-6 text-gray-600">
              A loja trabalha com produção em até 5 dias úteis antes do envio.
            </p>
          </div>
        </div>
        <span className="text-xs font-semibold text-gray-500">
          Regra atual da operação
        </span>
      </section>
    </div>
  );
}
