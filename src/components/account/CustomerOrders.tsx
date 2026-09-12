import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, CalendarDays, Package, RefreshCw, ShoppingBag } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { OrderStatusBadge } from "@/components/orders/OrderStatusBadge";
import {
  fetchMyOrders,
  getOrderDisplayStatus,
  getOrderItemImageUrl,
  type OrderSummary,
} from "@/lib/orders";
import { hasPendingCelebration, type CelebrationOrder } from "@/lib/post-purchase";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "medium",
});

function OrdersSkeleton() {
  return (
    <div className="space-y-4" aria-label="Carregando histórico de pedidos">
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={index}
          className="overflow-hidden rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6"
        >
          <div className="flex animate-pulse flex-col gap-5 sm:flex-row sm:items-center motion-reduce:animate-none">
            <div className="h-20 w-20 rounded-xl bg-gray-100" />
            <div className="flex-1 space-y-3">
              <div className="h-4 w-44 rounded bg-gray-200" />
              <div className="h-3 w-32 rounded bg-gray-100" />
              <div className="h-3 w-56 max-w-full rounded bg-gray-100" />
            </div>
            <div className="h-10 w-28 rounded-lg bg-gray-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function CustomerOrders() {
  const navigate = useNavigate();
  const redirectingRef = useRef(false);
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const loadedOrders = await fetchMyOrders();
      setOrders(loadedOrders);

      const newestUnseenPaidOrder = loadedOrders.find((summary) =>
        hasPendingCelebration(summary.order as CelebrationOrder),
      );

      if (newestUnseenPaidOrder && !redirectingRef.current) {
        redirectingRef.current = true;
        await navigate({
          to: "/conta/pedidos/$orderNumber",
          params: { orderNumber: newestUnseenPaidOrder.order.public_number },
          search: { celebrate: "1" },
          replace: true,
        });
      }
    } catch {
      setErrorMessage("Não foi possível carregar seus pedidos agora. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  if (loading) return <OrdersSkeleton />;

  if (errorMessage) {
    return (
      <div className="rounded-2xl border border-red-200 bg-white px-5 py-10 text-center shadow-sm sm:px-8">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
          <RefreshCw className="h-5 w-5" aria-hidden="true" />
        </div>
        <h2 className="mt-4 text-lg font-black text-gray-950">
          Não foi possível abrir seus pedidos
        </h2>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-gray-500">{errorMessage}</p>
        <button
          type="button"
          onClick={() => void loadOrders()}
          className="mt-5 inline-flex h-10 items-center justify-center rounded-lg bg-gray-950 px-4 text-sm font-bold text-white transition hover:bg-red-600 active:scale-[0.99] motion-reduce:transition-none"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white px-5 py-12 text-center shadow-sm sm:px-8 sm:py-14">
        <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-950 text-white shadow-xl shadow-gray-900/15">
          <ShoppingBag className="h-7 w-7" aria-hidden="true" />
          <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-red-600 ring-4 ring-white" />
        </div>
        <h2 className="mt-6 text-xl font-black tracking-tight text-gray-950">
          Seus pedidos aparecerão aqui
        </h2>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-gray-500">
          Depois da sua primeira compra, você poderá acompanhar cada etapa nesta área.
        </p>
        <Link
          to="/products"
          search={{}}
          className="mt-6 inline-flex h-11 items-center justify-center rounded-lg bg-red-600 px-5 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-red-700 hover:shadow-lg active:translate-y-0 motion-reduce:transform-none motion-reduce:transition-none"
        >
          Ver produtos
          <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="text-2xl font-black tracking-tight text-gray-950">Meus pedidos</h2>
        <p className="text-sm text-gray-500">
          {orders.length} {orders.length === 1 ? "pedido" : "pedidos"}
        </p>
      </div>

      {orders.map((summary) => {
        const { order, items, refundRequest } = summary;
        const previewItem = items[0];
        const previewImage = previewItem ? getOrderItemImageUrl(previewItem) : null;
        const units = items.reduce((total, item) => total + item.quantity, 0);

        return (
          <article
            key={order.id}
            className="group overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-lg motion-reduce:transform-none motion-reduce:transition-none"
          >
            <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-6">
              <div className="flex h-20 w-20 flex-none items-center justify-center overflow-hidden rounded-xl border border-gray-100 bg-gray-50">
                {previewImage ? (
                  <img
                    src={previewImage}
                    alt={previewItem?.image_alt_text ?? previewItem?.product_name ?? "Pedido"}
                    className="h-full w-full object-contain p-1.5 transition-transform duration-300 group-hover:scale-105 motion-reduce:transform-none motion-reduce:transition-none"
                  />
                ) : (
                  <Package className="h-7 w-7 text-gray-300" aria-hidden="true" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h3 className="text-lg font-black tracking-tight text-gray-950">
                    {order.public_number}
                  </h3>
                  <OrderStatusBadge status={getOrderDisplayStatus(order, refundRequest)} />
                </div>
                <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-gray-500">
                  <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                  {dateFormatter.format(new Date(order.created_at))}
                  <span aria-hidden="true">•</span>
                  {units} {units === 1 ? "item" : "itens"}
                </p>
                <p className="mt-2 line-clamp-1 text-sm text-gray-600">
                  {items.map((item) => item.product_name).join(", ")}
                </p>
              </div>

              <div className="flex items-center justify-between gap-4 border-t border-gray-100 pt-4 sm:block sm:border-0 sm:pt-0 sm:text-right">
                <p className="text-lg font-black text-gray-950">
                  {currencyFormatter.format(order.total_amount)}
                </p>
                <Link
                  to="/conta/pedidos/$orderNumber"
                  params={{ orderNumber: order.public_number }}
                  search={{}}
                  className="mt-0 inline-flex h-10 items-center justify-center rounded-lg border border-gray-300 bg-white px-4 text-sm font-bold text-gray-800 transition hover:border-red-600 hover:bg-red-50 hover:text-red-700 sm:mt-3 motion-reduce:transition-none"
                >
                  Ver detalhes
                  <ArrowRight
                    className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none motion-reduce:transition-none"
                    aria-hidden="true"
                  />
                </Link>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
