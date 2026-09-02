import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, FileQuestion, Loader2, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import Footer from "@/components/layout/Footer";
import Header from "@/components/layout/Header";
import { OrderDetailContent } from "@/components/orders/OrderDetailContent";
import { RefundRequestDialog } from "@/components/orders/RefundRequestDialog";
import { useAuth } from "@/lib/auth";
import {
  canRequestRefund,
  fetchOrderDetail,
  requestOrderRefund,
  type RefundReason,
} from "@/lib/orders";

export const Route = createFileRoute("/conta/pedidos/$orderNumber")({
  head: () => ({
    meta: [
      { title: "Detalhe do pedido | BIGofertas" },
      {
        name: "description",
        content:
          "Acompanhe os detalhes e o histórico do seu pedido BIGofertas.",
      },
    ],
  }),
  component: CustomerOrderDetailPage,
});

function DetailSkeleton() {
  return (
    <div className="space-y-5" aria-label="Carregando detalhes do pedido">
      <div className="h-48 animate-pulse rounded-2xl bg-gray-200" />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.75fr)]">
        <div className="h-[520px] animate-pulse rounded-2xl bg-gray-100" />
        <div className="space-y-5">
          <div className="h-48 animate-pulse rounded-2xl bg-gray-100" />
          <div className="h-56 animate-pulse rounded-2xl bg-gray-100" />
        </div>
      </div>
    </div>
  );
}

function CustomerOrderDetailPage() {
  const { orderNumber } = Route.useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [requestingRefund, setRequestingRefund] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      void navigate({ to: "/login", replace: true });
    }
  }, [authLoading, navigate, user]);

  const detailQuery = useQuery({
    queryKey: ["my-order", orderNumber],
    queryFn: () => fetchOrderDetail(orderNumber),
    enabled: Boolean(user),
    staleTime: 30_000,
  });

  async function handleRefundRequest(reason: RefundReason, message: string) {
    const detail = detailQuery.data;
    if (!detail || requestingRefund) return;

    setRequestingRefund(true);
    try {
      await requestOrderRefund(detail.order.id, reason, message);
      await detailQuery.refetch();
      setRefundDialogOpen(false);
      toast.success(
        "Solicitação registrada. O proprietário entrará em contato.",
      );
    } finally {
      setRequestingRefund(false);
    }
  }

  if (authLoading || (!user && !detailQuery.error)) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50">
        <Loader2
          className="h-6 w-6 animate-spin text-red-600"
          aria-label="Carregando"
        />
      </main>
    );
  }

  if (!user) return null;

  return (
    <div className="flex min-h-screen flex-col bg-[#f6f6f6]">
      <Header />
      <main className="flex-1 px-4 py-6 sm:px-6 sm:py-9 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <Link
            to="/conta"
            search={{ secao: "pedidos" }}
            className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-gray-600 transition hover:text-red-600"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Voltar aos pedidos
          </Link>

          {detailQuery.isLoading ? <DetailSkeleton /> : null}

          {detailQuery.error ? (
            <div className="rounded-2xl border border-red-200 bg-white px-5 py-12 text-center shadow-sm">
              <FileQuestion
                className="mx-auto h-10 w-10 text-red-600"
                aria-hidden="true"
              />
              <h1 className="mt-4 text-xl font-black text-gray-950">
                Não foi possível abrir o pedido
              </h1>
              <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-gray-500">
                {detailQuery.error instanceof Error
                  ? detailQuery.error.message
                  : "Tente novamente em instantes."}
              </p>
              <button
                type="button"
                onClick={() => void detailQuery.refetch()}
                className="mt-5 inline-flex h-10 items-center justify-center rounded-lg bg-gray-950 px-4 text-sm font-bold text-white transition hover:bg-red-600"
              >
                Tentar novamente
              </button>
            </div>
          ) : null}

          {!detailQuery.isLoading && !detailQuery.error && !detailQuery.data ? (
            <div className="rounded-2xl border border-gray-200 bg-white px-5 py-12 text-center shadow-sm">
              <FileQuestion
                className="mx-auto h-10 w-10 text-gray-400"
                aria-hidden="true"
              />
              <h1 className="mt-4 text-xl font-black text-gray-950">
                Pedido não encontrado
              </h1>
              <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-gray-500">
                O pedido não existe ou não pertence à sua conta.
              </p>
            </div>
          ) : null}

          {detailQuery.data ? (
            <OrderDetailContent
              detail={detailQuery.data}
              actions={
                canRequestRefund(detailQuery.data) ? (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm leading-6 text-gray-600">
                      Precisa resolver algo com este pedido? Envie uma
                      solicitação simples.
                    </p>
                    <button
                      type="button"
                      onClick={() => setRefundDialogOpen(true)}
                      className="inline-flex h-10 flex-none items-center justify-center rounded-lg border border-orange-300 bg-white px-4 text-sm font-bold text-orange-800 transition hover:-translate-y-0.5 hover:bg-orange-50 active:translate-y-0"
                    >
                      <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
                      Solicitar reembolso
                    </button>
                  </div>
                ) : detailQuery.data.refundRequest?.status === "requested" ? (
                  <p className="text-sm font-medium text-orange-800">
                    Sua solicitação de reembolso está registrada. O proprietário
                    entrará em contato diretamente.
                  </p>
                ) : null
              }
            />
          ) : null}
        </div>
      </main>
      <Footer />

      <RefundRequestDialog
        open={refundDialogOpen}
        onOpenChange={setRefundDialogOpen}
        loading={requestingRefund}
        onSubmit={handleRefundRequest}
      />
    </div>
  );
}
