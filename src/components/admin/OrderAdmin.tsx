import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  Loader2,
  PackageSearch,
  RefreshCw,
  Search,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { OrderDetailContent } from "@/components/orders/OrderDetailContent";
import { OrderStatusBadge } from "@/components/orders/OrderStatusBadge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  fetchAdminOrders,
  fetchOrderDetail,
  resolveRefundRequest,
  transitionOrder,
  type AdminOrderRow,
  type Order,
  type OrderDisplayStatus,
} from "@/lib/orders";

const PAGE_SIZE = 20;

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "medium",
  timeStyle: "short",
});

type PendingAction =
  | {
      kind: "transition";
      status: Order["status"];
      orderId: string;
      title: string;
      description: string;
      confirmLabel: string;
      tone: "danger" | "warning" | "neutral";
    }
  | {
      kind: "refund";
      resolution: "refunded" | "canceled";
      requestId: string;
      title: string;
      description: string;
      confirmLabel: string;
      tone: "danger" | "warning" | "neutral";
    };

function rowDisplayStatus(row: AdminOrderRow): OrderDisplayStatus {
  if (row.refund_status === "requested") return "refund_requested";
  if (row.refund_status === "canceled") return "refund_canceled";
  return row.status;
}

function AdminOrdersSkeleton() {
  return (
    <div className="space-y-3" aria-label="Carregando pedidos">
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className="grid animate-pulse gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-[1fr_180px_120px] sm:items-center"
        >
          <div className="space-y-2">
            <div className="h-4 w-44 rounded bg-muted" />
            <div className="h-3 w-64 max-w-full rounded bg-muted" />
          </div>
          <div className="h-7 w-36 rounded-full bg-muted" />
          <div className="h-9 rounded-lg bg-muted" />
        </div>
      ))}
    </div>
  );
}

function getNextTransition(
  status: Order["status"],
): Omit<Extract<PendingAction, { kind: "transition" }>, "orderId"> | null {
  if (status === "pending_payment") {
    return {
      kind: "transition",
      status: "canceled",
      title: "Cancelar pedido?",
      description:
        "Use esta ação somente enquanto o pedido aguarda pagamento. Ela não executa nenhuma movimentação financeira.",
      confirmLabel: "Cancelar pedido",
      tone: "danger",
    };
  }

  if (status === "paid") {
    return {
      kind: "transition",
      status: "in_production",
      title: "Iniciar produção?",
      description:
        "O cliente verá que a camisa entrou em produção e que o prazo é de até 5 dias úteis antes do envio.",
      confirmLabel: "Iniciar produção",
      tone: "neutral",
    };
  }

  if (status === "in_production") {
    return {
      kind: "transition",
      status: "shipped",
      title: "Marcar como enviado?",
      description:
        "Confirme somente depois da entrega real do pacote à transportadora. O sistema não inventará prazo ou rastreio.",
      confirmLabel: "Confirmar envio",
      tone: "neutral",
    };
  }

  if (status === "shipped") {
    return {
      kind: "transition",
      status: "delivered",
      title: "Marcar como entregue?",
      description:
        "A entrega ficará registrada na timeline e preparará o evento do e-mail futuro de confirmação.",
      confirmLabel: "Confirmar entrega",
      tone: "neutral",
    };
  }

  return null;
}

export function OrderAdmin() {
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState<"newest" | "oldest" | "total_desc" | "total_asc">("newest");
  const [page, setPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState<AdminOrderRow | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [runningAction, setRunningAction] = useState(false);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(searchDraft.trim());
      setPage(1);
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [searchDraft]);

  const listQuery = useQuery({
    queryKey: ["admin-orders", search, status, sort, page],
    queryFn: () => fetchAdminOrders({ search, status, sort, page, pageSize: PAGE_SIZE }),
    staleTime: 10_000,
  });

  const detailQuery = useQuery({
    queryKey: ["admin-order-detail", selectedOrder?.public_number],
    queryFn: () => fetchOrderDetail(selectedOrder!.public_number),
    enabled: Boolean(selectedOrder),
    staleTime: 10_000,
  });

  const totalPages = Math.max(1, Math.ceil((listQuery.data?.total ?? 0) / PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const detailActions = useMemo(() => {
    const detail = detailQuery.data;
    if (!detail) return null;

    if (detail.refundRequest?.status === "requested") {
      return (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm leading-6 text-orange-900">
            Entre em contato diretamente com o cliente. Depois, registre apenas o resultado
            combinado.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                setPendingAction({
                  kind: "refund",
                  resolution: "canceled",
                  requestId: detail.refundRequest!.id,
                  title: "Cancelar solicitação de reembolso?",
                  description:
                    "Confirme somente depois de conversar com o cliente. O pedido manterá seu estado operacional atual.",
                  confirmLabel: "Reembolso cancelado",
                  tone: "warning",
                })
              }
              className="inline-flex h-10 items-center rounded-lg border border-gray-300 bg-white px-4 text-sm font-bold text-gray-800 transition hover:bg-gray-50"
            >
              Reembolso cancelado
            </button>
            <button
              type="button"
              onClick={() =>
                setPendingAction({
                  kind: "refund",
                  resolution: "refunded",
                  requestId: detail.refundRequest!.id,
                  title: "Registrar como reembolsado?",
                  description:
                    "Esta ação apenas registra que você resolveu o caso com o cliente. Nenhuma transferência financeira será executada automaticamente.",
                  confirmLabel: "Registrar reembolso",
                  tone: "neutral",
                })
              }
              className="inline-flex h-10 items-center rounded-lg bg-violet-600 px-4 text-sm font-bold text-white transition hover:bg-violet-700 active:scale-[0.99]"
            >
              Marcar reembolsado
            </button>
          </div>
        </div>
      );
    }

    const next = getNextTransition(detail.order.status);
    if (!next) {
      return (
        <p className="text-sm text-gray-600">
          Não há ação administrativa pendente para o estado atual.
        </p>
      );
    }

    return (
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-gray-600">
          Atualize apenas depois que a etapa acontecer de verdade.
        </p>
        <button
          type="button"
          onClick={() => setPendingAction({ ...next, orderId: detail.order.id })}
          className={`inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-bold transition active:scale-[0.99] ${
            next.status === "canceled"
              ? "border border-red-200 bg-white text-red-700 hover:bg-red-50"
              : "bg-gray-950 text-white hover:bg-red-600"
          }`}
        >
          {next.confirmLabel}
          {next.status !== "canceled" ? (
            <ChevronRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
          ) : null}
        </button>
      </div>
    );
  }, [detailQuery.data]);

  async function runPendingAction() {
    if (!pendingAction || runningAction) return;

    setRunningAction(true);
    setActionError("");

    try {
      if (pendingAction.kind === "transition") {
        await transitionOrder(pendingAction.orderId, pendingAction.status);
      } else {
        await resolveRefundRequest(pendingAction.requestId, pendingAction.resolution);
      }

      setPendingAction(null);
      await Promise.all([detailQuery.refetch(), listQuery.refetch()]);
      toast.success("Pedido atualizado com segurança.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Não foi possível concluir a atualização.";
      setActionError(message);
      toast.error(message);
    } finally {
      setRunningAction(false);
    }
  }

  return (
    <section className="mt-8" aria-labelledby="order-admin-title">
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border bg-gradient-to-r from-card to-muted/40 px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-red-600">
                Operação simples
              </p>
              <h2
                id="order-admin-title"
                className="mt-1 text-2xl font-black tracking-tight text-foreground"
              >
                Pedidos
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                Pesquise, acompanhe e registre somente etapas que aconteceram de verdade.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void listQuery.refetch()}
              disabled={listQuery.isFetching}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-input bg-background px-4 text-sm font-bold text-foreground transition hover:bg-accent disabled:opacity-50"
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${listQuery.isFetching ? "animate-spin" : ""}`}
                aria-hidden="true"
              />
              Atualizar
            </button>
          </div>
        </div>

        <div className="grid gap-3 border-b border-border p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-[minmax(260px,1fr)_220px_190px]">
          <label className="relative block sm:col-span-2 xl:col-span-1">
            <span className="sr-only">Buscar pedidos</span>
            <Search
              className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder="Número, nome, e-mail ou telefone"
              className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm text-foreground outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-500/10"
            />
          </label>

          <label>
            <span className="sr-only">Filtrar por status</span>
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-500/10"
            >
              <option value="all">Todos os status</option>
              <option value="pending_payment">Aguardando pagamento</option>
              <option value="paid">Pago</option>
              <option value="in_production">Em produção</option>
              <option value="shipped">Enviado</option>
              <option value="delivered">Entregue</option>
              <option value="canceled">Cancelado</option>
              <option value="refund_requested">Reembolso solicitado</option>
              <option value="refunded">Reembolsado</option>
              <option value="refund_canceled">Reembolso cancelado</option>
            </select>
          </label>

          <label>
            <span className="sr-only">Ordenar pedidos</span>
            <select
              value={sort}
              onChange={(event) => {
                setSort(event.target.value as typeof sort);
                setPage(1);
              }}
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-500/10"
            >
              <option value="newest">Mais recentes</option>
              <option value="oldest">Mais antigos</option>
              <option value="total_desc">Maior valor</option>
              <option value="total_asc">Menor valor</option>
            </select>
          </label>
        </div>

        <div className="p-4 sm:p-5">
          {listQuery.isLoading ? <AdminOrdersSkeleton /> : null}

          {listQuery.error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-9 text-center">
              <RefreshCw className="mx-auto h-6 w-6 text-red-600" aria-hidden="true" />
              <p className="mt-3 font-bold text-red-900">Não foi possível carregar os pedidos.</p>
              <p className="mt-1 text-sm text-red-700">
                {listQuery.error instanceof Error ? listQuery.error.message : "Tente novamente."}
              </p>
            </div>
          ) : null}

          {!listQuery.isLoading && !listQuery.error && listQuery.data?.rows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-5 py-12 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <PackageSearch className="h-6 w-6" aria-hidden="true" />
              </div>
              <h3 className="mt-4 font-black text-foreground">
                {search || status !== "all"
                  ? "Nenhum pedido encontrado"
                  : "Ainda não há pedidos reais"}
              </h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                {search || status !== "all"
                  ? "Ajuste a busca ou o filtro para ver outros resultados."
                  : "Os pedidos aparecerão aqui depois que checkout, frete e pagamento reais estiverem disponíveis."}
              </p>
            </div>
          ) : null}

          {listQuery.data?.rows.length ? (
            <div className="space-y-3">
              {listQuery.data.rows.map((row) => (
                <article
                  key={row.id}
                  className="group grid gap-4 rounded-xl border border-border bg-background p-4 transition duration-200 hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h3 className="font-black tracking-tight text-foreground">
                        {row.public_number}
                      </h3>
                      <OrderStatusBadge status={rowDisplayStatus(row)} />
                    </div>
                    <p className="mt-2 truncate text-sm font-semibold text-foreground">
                      {row.customer_name}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {row.customer_email} • {row.item_count}{" "}
                      {row.item_count === 1 ? "item" : "itens"} •{" "}
                      {dateFormatter.format(new Date(row.created_at))}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-4 border-t border-border pt-3 sm:border-0 sm:pt-0">
                    <p className="font-black text-foreground">
                      {currencyFormatter.format(row.total_amount)}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setActionError("");
                        setSelectedOrder(row);
                      }}
                      className="inline-flex h-9 items-center rounded-lg border border-input bg-card px-3 text-xs font-bold text-foreground transition hover:border-red-300 hover:bg-red-50 hover:text-red-700"
                    >
                      Abrir
                      <ChevronRight
                        className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5"
                        aria-hidden="true"
                      />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : null}

          {(listQuery.data?.total ?? 0) > PAGE_SIZE ? (
            <div className="mt-5 flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                Página {page} de {totalPages} • {listQuery.data?.total} pedidos
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  className="inline-flex h-9 items-center rounded-lg border border-input bg-background px-3 text-xs font-bold text-foreground transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ArrowLeft className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                  Anterior
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  className="inline-flex h-9 items-center rounded-lg border border-input bg-background px-3 text-xs font-bold text-foreground transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Próxima
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <Dialog
        open={Boolean(selectedOrder)}
        onOpenChange={(open) => {
          if (!open && !runningAction) {
            setSelectedOrder(null);
            setActionError("");
          }
        }}
      >
        <DialogContent className="max-h-[92vh] w-[calc(100%-1rem)] max-w-6xl overflow-y-auto rounded-2xl border border-white/70 bg-[#f6f6f6] p-3 shadow-2xl sm:w-[calc(100%-2rem)] sm:p-5">
          <DialogHeader className="sr-only">
            <DialogTitle>Detalhes do pedido {selectedOrder?.public_number}</DialogTitle>
            <DialogDescription>Visualização administrativa do pedido.</DialogDescription>
          </DialogHeader>

          {detailQuery.isLoading ? (
            <div className="flex min-h-[420px] items-center justify-center">
              <Loader2
                className="h-7 w-7 animate-spin text-red-600"
                aria-label="Carregando pedido"
              />
            </div>
          ) : null}

          {detailQuery.error ? (
            <div className="flex min-h-[360px] flex-col items-center justify-center px-5 text-center">
              <RefreshCw className="h-7 w-7 text-red-600" aria-hidden="true" />
              <p className="mt-3 font-black text-gray-950">Não foi possível abrir o pedido.</p>
              <button
                type="button"
                onClick={() => void detailQuery.refetch()}
                className="mt-4 h-10 rounded-lg bg-gray-950 px-4 text-sm font-bold text-white"
              >
                Tentar novamente
              </button>
            </div>
          ) : null}

          {detailQuery.data ? (
            <OrderDetailContent detail={detailQuery.data} ownerView actions={detailActions} />
          ) : null}

          {actionError ? (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {actionError}
            </p>
          ) : null}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(pendingAction)}
        onOpenChange={(open) => {
          if (!open && !runningAction) {
            setPendingAction(null);
            setActionError("");
          }
        }}
        title={pendingAction?.title ?? "Confirmar atualização?"}
        description={pendingAction?.description ?? "Confirme a atualização do pedido."}
        confirmLabel={pendingAction?.confirmLabel ?? "Confirmar"}
        cancelLabel="Voltar"
        tone={pendingAction?.tone ?? "neutral"}
        loading={runningAction}
        onConfirm={runPendingAction}
      />
    </section>
  );
}
