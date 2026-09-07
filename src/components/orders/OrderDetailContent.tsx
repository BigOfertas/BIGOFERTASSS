import {
  AlertTriangle,
  CreditCard,
  Mail,
  MapPin,
  Package,
  Phone,
  ReceiptText,
  Truck,
  UserRound,
} from "lucide-react";

import { OrderShippingControl } from "@/components/admin/OrderShippingControl";
import { OrderStatusBadge } from "@/components/orders/OrderStatusBadge";
import { OrderTimeline } from "@/components/orders/OrderTimeline";
import { ProductionNotice } from "@/components/orders/ProductionNotice";
import { BRAND } from "@/config/brand";
import { formatBrazilianPhone } from "@/lib/brasil";
import {
  REFUND_REASON_LABELS,
  getOrderDisplayStatus,
  getOrderItemImageUrl,
  parseSelectedOptions,
  type OrderDetail,
  type RefundReason,
} from "@/lib/orders";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "long",
  timeStyle: "short",
});

function formatPostalCode(value: string) {
  return value.length === 8 ? `${value.slice(0, 5)}-${value.slice(5)}` : value;
}

function paymentLabel(status: OrderDetail["order"]["payment_status"]) {
  return {
    pending: "Aguardando confirmação",
    paid: "Pagamento confirmado",
    failed: "Pagamento não confirmado",
    canceled: "Pagamento cancelado",
    refunded: "Reembolso registrado",
  }[status];
}

function refundStatusLabel(status: OrderDetail["refundRequest"] extends infer _T ? string : never) {
  return (
    {
      requested: "Aguardando atendimento",
      refunded: "Reembolso registrado",
      canceled: "Solicitação cancelada",
    }[status] ?? status
  );
}

export function OrderDetailContent({
  detail,
  ownerView = false,
  actions,
}: {
  detail: OrderDetail;
  ownerView?: boolean;
  actions?: React.ReactNode;
}) {
  const { order, items, timeline, refundRequest } = detail;
  const displayStatus = getOrderDisplayStatus(order, refundRequest);
  const units = items.reduce((total, item) => total + item.quantity, 0);
  const hasPendingRefund = refundRequest?.status === "requested";
  const usesDedicatedShippingControl =
    ownerView && order.status === "in_production" && !hasPendingRefund;

  return (
    <div className="space-y-5 sm:space-y-6">
      {ownerView && refundRequest ? (
        <section
          className={`overflow-hidden rounded-2xl border-2 shadow-[0_16px_40px_rgba(194,65,12,0.14)] ${
            hasPendingRefund
              ? "border-orange-400 bg-gradient-to-br from-orange-50 via-white to-red-50"
              : "border-orange-200 bg-orange-50/70"
          }`}
        >
          <div className="p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 gap-3">
                <span
                  className={`flex h-12 w-12 flex-none items-center justify-center rounded-xl text-white shadow-sm ${
                    hasPendingRefund ? "bg-orange-600" : "bg-orange-500"
                  }`}
                >
                  <AlertTriangle className="h-5.5 w-5.5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-orange-700">
                    Reembolso — atenção do administrador
                  </p>
                  <h2 className="mt-1 text-xl font-black tracking-tight text-orange-950 sm:text-2xl">
                    {refundStatusLabel(refundRequest.status)}
                  </h2>
                  <p className="mt-2 text-sm font-bold text-orange-900">
                    Motivo:{" "}
                    {REFUND_REASON_LABELS[refundRequest.reason as RefundReason] ??
                      refundRequest.reason}
                  </p>
                  {refundRequest.message ? (
                    <p className="mt-2 max-w-3xl whitespace-pre-wrap text-sm leading-6 text-orange-950/80">
                      {refundRequest.message}
                    </p>
                  ) : null}
                </div>
              </div>

              {hasPendingRefund ? (
                <span className="inline-flex w-fit items-center rounded-full border border-orange-300 bg-orange-100 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-orange-800">
                  Resolver antes de alterar o pedido
                </span>
              ) : null}
            </div>

            {hasPendingRefund && actions ? (
              <div className="mt-5 border-t border-orange-200/80 pt-5">{actions}</div>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="relative overflow-hidden border-b border-gray-100 bg-gradient-to-br from-gray-950 via-gray-900 to-red-950 px-5 py-6 text-white sm:px-7 sm:py-7">
          <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-red-600/20 blur-3xl" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-red-300">Pedido</p>
              <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">
                {order.public_number}
              </h1>
              <p className="mt-2 text-sm text-gray-300">
                Criado em {dateFormatter.format(new Date(order.created_at))}
              </p>
            </div>
            <OrderStatusBadge status={displayStatus} />
          </div>
        </div>

        {usesDedicatedShippingControl ? (
          <div className="border-b border-gray-100 bg-sky-50/30 px-4 py-4 sm:px-6">
            <OrderShippingControl orderId={order.id} publicNumber={order.public_number} />
          </div>
        ) : actions && !(ownerView && hasPendingRefund) ? (
          <div className="border-b border-gray-100 bg-gray-50/70 px-5 py-4 sm:px-7">{actions}</div>
        ) : null}

        <div className="p-5 sm:p-7">
          <ProductionNotice compact />
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.75fr)]">
        <div className="space-y-5">
          <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <header className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4 sm:px-6">
              <div className="flex items-center gap-2.5">
                <Package className="h-5 w-5 text-red-600" aria-hidden="true" />
                <h2 className="font-black text-gray-950">Itens do pedido</h2>
              </div>
              <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-600">
                {units} {units === 1 ? "unidade" : "unidades"}
              </span>
            </header>

            <div className="divide-y divide-gray-100">
              {items.map((item) => {
                const imageUrl = getOrderItemImageUrl(item);
                const options = parseSelectedOptions(item.selected_options);

                return (
                  <article
                    key={item.id}
                    className="group flex gap-4 p-5 transition-colors hover:bg-gray-50/70 motion-reduce:transition-none sm:p-6"
                  >
                    <div className="flex h-20 w-20 flex-none items-center justify-center overflow-hidden rounded-xl border border-gray-100 bg-gray-50 sm:h-24 sm:w-24">
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={item.image_alt_text ?? item.product_name}
                          className="h-full w-full object-contain p-1.5 transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transform-none motion-reduce:transition-none"
                        />
                      ) : (
                        <Package className="h-7 w-7 text-gray-300" aria-hidden="true" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h3 className="font-extrabold leading-snug text-gray-950">
                            {item.product_name}
                          </h3>
                          {item.variant_name ? (
                            <p className="mt-0.5 text-sm text-gray-500">{item.variant_name}</p>
                          ) : null}
                          {ownerView ? (
                            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.1em] text-gray-400">
                              SKU {item.variant_sku}
                            </p>
                          ) : null}
                        </div>
                        <p className="whitespace-nowrap font-black text-gray-950">
                          {currencyFormatter.format(item.line_total)}
                        </p>
                      </div>

                      {options.length > 0 ? (
                        <dl className="mt-3 flex flex-wrap gap-2">
                          {options.map((option) => (
                            <div
                              key={`${item.id}-${option.optionName}`}
                              className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-600"
                            >
                              <dt className="inline font-semibold">{option.optionName}: </dt>
                              <dd className="inline">{option.valueLabel}</dd>
                            </div>
                          ))}
                        </dl>
                      ) : null}

                      <p className="mt-3 text-xs text-gray-500">
                        {item.quantity} × {currencyFormatter.format(item.unit_price)}
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-6 flex items-center gap-2.5">
              <ReceiptText className="h-5 w-5 text-red-600" aria-hidden="true" />
              <h2 className="font-black text-gray-950">Acompanhamento</h2>
            </div>
            <OrderTimeline entries={timeline} />
          </section>
        </div>

        <aside className="space-y-5">
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="font-black text-gray-950">Resumo de valores</h2>
            <dl className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between gap-4 text-gray-600">
                <dt>Subtotal</dt>
                <dd>{currencyFormatter.format(order.subtotal_amount)}</dd>
              </div>
              {order.discount_amount > 0 ? (
                <div className="flex justify-between gap-4 text-emerald-700">
                  <dt>Desconto</dt>
                  <dd>-{currencyFormatter.format(order.discount_amount)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-4 text-gray-600">
                <dt>Frete</dt>
                <dd>
                  {order.shipping_provider
                    ? currencyFormatter.format(order.shipping_amount)
                    : "Não informado"}
                </dd>
              </div>
              <div className="flex items-end justify-between gap-4 border-t border-gray-100 pt-4">
                <dt className="font-extrabold text-gray-950">Total</dt>
                <dd className="text-xl font-black text-red-600">
                  {currencyFormatter.format(order.total_amount)}
                </dd>
              </div>
            </dl>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center gap-2.5">
              <MapPin className="h-5 w-5 text-red-600" aria-hidden="true" />
              <h2 className="font-black text-gray-950">Endereço de entrega</h2>
            </div>
            <address className="mt-4 not-italic text-sm leading-6 text-gray-600">
              <p className="font-bold text-gray-900">{order.address_recipient_name}</p>
              <p>
                {order.address_street}, {order.address_number}
                {order.address_complement ? ` — ${order.address_complement}` : ""}
              </p>
              <p>{order.address_neighborhood}</p>
              <p>
                {order.address_city} — {order.address_state}
              </p>
              <p>CEP {formatPostalCode(order.address_postal_code)}</p>
            </address>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center gap-2.5">
              <Truck className="h-5 w-5 text-red-600" aria-hidden="true" />
              <h2 className="font-black text-gray-950">Entrega</h2>
            </div>
            {order.shipping_provider ? (
              <div className="mt-4 text-sm text-gray-600">
                <p className="font-bold text-gray-900">
                  {ownerView
                    ? [order.shipping_provider, order.shipping_service].filter(Boolean).join(" — ")
                    : (order.shipping_service ?? "Entrega")}
                </p>
                {order.shipping_transit_business_days !== null ? (
                  <p className="mt-1.5">
                    Prazo: {order.shipping_transit_business_days} dias úteis após a produção.
                  </p>
                ) : null}

                {order.shipping_tracking_code ? (
                  <div
                    className={`mt-4 rounded-xl border p-4 ${
                      ownerView
                        ? "border-sky-200 bg-sky-50/70"
                        : "border-emerald-200 bg-emerald-50/80"
                    }`}
                  >
                    <p
                      className={`text-[11px] font-black uppercase tracking-[0.13em] ${
                        ownerView ? "text-sky-700" : "text-emerald-700"
                      }`}
                    >
                      {ownerView ? "Rastreio salvo" : "Código de rastreio"}
                    </p>
                    <p className="mt-2 break-all font-mono text-base font-black tracking-wide text-gray-950">
                      {order.shipping_tracking_code}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-gray-600">
                      {ownerView
                        ? "Este é exatamente o código exibido para o cliente na área de pedidos."
                        : "Este código fica disponível aqui em Minha Conta → Pedidos para você acompanhar a entrega."}
                    </p>
                  </div>
                ) : !ownerView && order.status === "shipped" ? (
                  <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <p className="text-xs font-black uppercase tracking-wide text-amber-800">
                      Rastreio em atualização
                    </p>
                    <p className="mt-1.5 text-xs leading-5 text-amber-900/80">
                      O pedido já foi enviado, mas o código de rastreio ainda não está disponível
                      aqui.
                    </p>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="mt-3 text-sm leading-6 text-gray-500">
                A entrega ainda não foi definida para este pedido.
              </p>
            )}
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center gap-2.5">
              <CreditCard className="h-5 w-5 text-red-600" aria-hidden="true" />
              <h2 className="font-black text-gray-950">Pagamento</h2>
            </div>
            <p className="mt-3 text-sm font-bold text-gray-900">
              {paymentLabel(order.payment_status)}
            </p>
            {order.payment_method ? (
              <p className="mt-1 text-sm text-gray-500">Método: {order.payment_method}</p>
            ) : null}
          </section>

          {ownerView ? (
            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-center gap-2.5">
                <UserRound className="h-5 w-5 text-red-600" aria-hidden="true" />
                <h2 className="font-black text-gray-950">Cliente</h2>
              </div>
              <div className="mt-4 space-y-2.5 text-sm text-gray-600">
                <p className="font-bold text-gray-900">{order.customer_name}</p>
                <p className="flex items-center gap-2 break-all">
                  <Mail className="h-4 w-4 flex-none text-gray-400" aria-hidden="true" />
                  {order.customer_email}
                </p>
                <p className="flex items-center gap-2">
                  <Phone className="h-4 w-4 flex-none text-gray-400" aria-hidden="true" />
                  {formatBrazilianPhone(order.customer_phone)}
                </p>
              </div>
            </section>
          ) : null}

          {!ownerView && refundRequest ? (
            <section className="rounded-2xl border border-orange-200 bg-orange-50/70 p-5 shadow-sm sm:p-6">
              <h2 className="font-black text-orange-950">Solicitação de reembolso</h2>
              <p className="mt-2 text-sm font-bold text-orange-900">
                {REFUND_REASON_LABELS[refundRequest.reason as RefundReason] ?? refundRequest.reason}
              </p>
              {refundRequest.message ? (
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-orange-900/80">
                  {refundRequest.message}
                </p>
              ) : null}
              <p className="mt-3 text-xs text-orange-800/70">
                A {BRAND.officialName} entrará em contato para dar continuidade.
              </p>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
