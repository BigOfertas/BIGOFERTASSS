import {
  Ban,
  CheckCircle2,
  Clock3,
  Factory,
  HandCoins,
  PackageCheck,
  RotateCcw,
  Truck,
  XCircle,
} from "lucide-react";

import { BRAND } from "@/config/brand";
import type { OrderDisplayStatus } from "@/lib/orders";

const STATUS_CONFIG: Record<
  OrderDisplayStatus,
  {
    label: string;
    description: string;
    className: string;
    icon: typeof Clock3;
  }
> = {
  pending_payment: {
    label: "Aguardando pagamento",
    description: "O pagamento ainda precisa ser confirmado.",
    className: "border-amber-200 bg-amber-50 text-amber-800",
    icon: Clock3,
  },
  paid: {
    label: "Pago",
    description: "Pagamento confirmado; o pedido seguirá para produção.",
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
    icon: CheckCircle2,
  },
  in_production: {
    label: "Em produção",
    description: "Seu pedido está em produção.",
    className: "border-sky-200 bg-sky-50 text-sky-800",
    icon: Factory,
  },
  shipped: {
    label: "Enviado",
    description: "O pedido saiu para transporte.",
    className: "border-indigo-200 bg-indigo-50 text-indigo-800",
    icon: Truck,
  },
  delivered: {
    label: "Entregue",
    description: "Entrega concluída.",
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
    icon: PackageCheck,
  },
  canceled: {
    label: "Cancelado",
    description: "O pedido foi cancelado.",
    className: "border-gray-200 bg-gray-100 text-gray-700",
    icon: Ban,
  },
  refund_requested: {
    label: "Reembolso solicitado",
    description: `A ${BRAND.officialName} entrará em contato.`,
    className: "border-orange-200 bg-orange-50 text-orange-800",
    icon: RotateCcw,
  },
  refunded: {
    label: "Reembolsado",
    description: "O reembolso foi concluído.",
    className: "border-violet-200 bg-violet-50 text-violet-800",
    icon: HandCoins,
  },
  refund_canceled: {
    label: "Reembolso cancelado",
    description: "A solicitação de reembolso foi encerrada.",
    className: "border-rose-200 bg-rose-50 text-rose-800",
    icon: XCircle,
  },
};

export function getOrderStatusConfig(status: OrderDisplayStatus) {
  return STATUS_CONFIG[status];
}

export function OrderStatusBadge({
  status,
  showIcon = true,
}: {
  status: OrderDisplayStatus;
  showIcon?: boolean;
}) {
  const config = getOrderStatusConfig(status);
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.08em] ${config.className}`}
    >
      {showIcon ? <Icon className="h-3.5 w-3.5" aria-hidden="true" /> : null}
      {config.label}
    </span>
  );
}
