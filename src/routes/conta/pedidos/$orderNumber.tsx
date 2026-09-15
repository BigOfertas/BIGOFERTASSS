import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, FileQuestion, Loader2, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import Header from "@/components/layout/Header";
import { OrderDetailContent } from "@/components/orders/OrderDetailContent";
import { PostPurchaseCelebration } from "@/components/orders/PostPurchaseCelebration";
import { RefundRequestDialog } from "@/components/orders/RefundRequestDialog";
import { BRAND } from "@/config/brand";
import { useAuth } from "@/lib/auth";
import {
  canRequestRefund,
  fetchOrderDetail,
  requestOrderRefund,
  type RefundReason,
} from "@/lib/orders";
import {
  claimOrderCelebration,
  isConfirmedPurchase,
  type CelebrationOrder,
} from "@/lib/post-purchase";

const orderDetailSearchSchema = z.object({
  celebrate: z.literal("1").optional(),
});

export const Route = createFileRoute("/conta/pedidos/$orderNumber")({
  validateSearch: (search) => orderDetailSearchSchema.parse(search),
  head: () => ({
    meta: [
      { title: `Detalhe do pedido | ${BRAND.officialName}` },
      {
        name: "description",
        content: `Acompanhe os detalhes e o histórico do seu pedido ${BRAND.officialName}.`,
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
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [requestingRefund, setRequestingRefund] = useState(false);
  const [celebrationVisible, setCelebrationVisible] = useState(false);
  const celebrationClaimAttemptedRef = useRef(false);
  const paymentPollCountRef = useRef(0);

  useEffect(() => {
    if (!authLoading && !user) {
      void navigate({ to: "/login", replace: true });
    }
  }, [authLoading, navigate, user]);

  const detailQuery = useQuery({
    queryKey: ["my-order", orderNumber],
    queryFn: () => fetchOrderDetail(orderNumber),
    enabled: Boolean(user),
    staleTime: 5_000,
  });

  const detail = detailQuery.data;
  const confirmedPurchase = detail ? isConfirmedPurchase(detail.order as CelebrationOrder) : false;
  const waitingForReturnConfirmation =
    search.celebrate === "1" && Boolean(detail) && !confirmedPurchase;

  useEffect(() => {
    paymentPollCountRef.current = 0;
  }, [orderNumber]);

  useEffect(() => {
    if (!waitingForReturnConfirmation || paymentPollCountRef.current >= 24) return;

    const timeout = window.setTimeout(() => {
      paymentPollCountRef.current += 1;
      void detailQuery.refetch();
    }, 2_000);

    return () => window.clearTimeout(timeout);
  }, [detailQuery, waitingForReturnConfirmation]);

  useEffect(() => {
    if (
      search.celebrate !== "1" ||
      !detail ||
      !confirmedPurchase ||
      celebrationClaimAttemptedRef.current
    ) {
      return;
    }

    celebrationClaimAttemptedRef.current = true;

    void (async () => {
      try {
        const claimed = await claimOrderCelebration(orderNumber);
        if (claimed) setCelebrationVisible(true);

        await navigate({
          to: "/conta/pedidos/$orderNumber",
          params: { orderNumber },
          search: {},
          replace: true,
        });
      } catch {
        celebrationClaimAttemptedRef.current = false;
      }
    })();
  }, [confirmedPurchase, detail, navigate, orderNumber, search.celebrate]);

  const handleCelebrationDone = useCallback(() => {
    setCelebrationVisible(false);
  }, []);

  async function handleRefundRequest(reason: RefundReason, message: string) {
    const currentDetail = detailQuery.data;
    if (!currentDetail || requestingRefund) return;

    setRequestingRefund(true);
    try {
      await requestOrderRefund(currentDetail.order.id, reason, message);
      await detailQuery.refetch();
      setRefundDialogOpen(false);
      toast.success("Solicitação registrada. O proprietário entrará em contato.");
    } finally {
      setRequestingRefund(false);
    }
  }

  if (authLoading || (!user && !detailQuery.error)) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50">
        <Loader2 className="h-6 w-6 animate-spin text-red-600" aria-label="Carregando" />
      </main>
    );
  }

  if (!user) return null;

  return (
    <div className="flex min-h-screen flex-col bg-[#f6f6f6] dark:bg-black">
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
              <FileQuestion className="mx-auto h-10 w-10 text-red-600" aria-hidden="true" />
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
              <FileQuestion className="mx-auto h-10 w-10 text-gray-400" aria-hidden="true" />
              <h1 className="mt-4 text-xl font-black text-gray-950">Pedido não encontrado</h1>
              <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-gray-500">
                O pedido não existe ou não pertence à sua conta.
              </p>
            </div>
          ) : null}

          {waitingForReturnConfirmation ? (
            <div className="mb-5 flex items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm font-semibold text-amber-900">
              <Loader2
                className="h-4 w-4 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
              Confirmando seu pagamento com segurança. Isso costuma levar apenas alguns instantes.
            </div>
          ) : null}

          {detailQuery.data ? (
            <OrderDetailContent
              detail={detailQuery.data}
              actions={
                canRequestRefund(detailQuery.data) ? (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm leading-6 text-gray-600">
                      Precisa resolver algo com este pedido? Envie uma solicitação simples.
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
                    Sua solicitação de reembolso está registrada. O proprietário entrará em contato
                    diretamente.
                  </p>
                ) : null
              }
            />
          ) : null}
        </div>
      </main>

      {celebrationVisible && detailQuery.data ? (
        <PostPurchaseCelebration detail={detailQuery.data} onDone={handleCelebrationDone} />
      ) : null}

      <RefundRequestDialog
        open={refundDialogOpen}
        onOpenChange={setRefundDialogOpen}
        loading={requestingRefund}
        onSubmit={handleRefundRequest}
      />
    </div>
  );
}
