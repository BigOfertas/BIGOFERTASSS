import {
  Ban,
  CheckCircle2,
  Clock3,
  Factory,
  HandCoins,
  PackageCheck,
  RotateCcw,
  ShoppingBag,
  Truck,
  XCircle,
} from "lucide-react";

import type { OrderTimelineEntry } from "@/lib/orders";

const EVENT_CONFIG: Record<
  string,
  { label: string; icon: typeof Clock3; tone: string }
> = {
  order_created: {
    label: "Pedido criado",
    icon: ShoppingBag,
    tone: "bg-gray-950 text-white",
  },
  payment_confirmed: {
    label: "Pagamento confirmado",
    icon: CheckCircle2,
    tone: "bg-emerald-600 text-white",
  },
  production_started: {
    label: "Produção iniciada",
    icon: Factory,
    tone: "bg-sky-600 text-white",
  },
  order_shipped: {
    label: "Pedido enviado",
    icon: Truck,
    tone: "bg-indigo-600 text-white",
  },
  order_delivered: {
    label: "Pedido entregue",
    icon: PackageCheck,
    tone: "bg-emerald-600 text-white",
  },
  order_canceled: {
    label: "Pedido cancelado",
    icon: Ban,
    tone: "bg-gray-600 text-white",
  },
  refund_requested: {
    label: "Reembolso solicitado",
    icon: RotateCcw,
    tone: "bg-orange-500 text-white",
  },
  refund_confirmed: {
    label: "Reembolso confirmado",
    icon: HandCoins,
    tone: "bg-violet-600 text-white",
  },
  refund_canceled: {
    label: "Reembolso cancelado",
    icon: XCircle,
    tone: "bg-rose-600 text-white",
  },
};

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function OrderTimeline({ entries }: { entries: OrderTimelineEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 p-5 text-sm text-gray-500">
        A timeline ainda não possui eventos registrados.
      </div>
    );
  }

  return (
    <ol className="relative" aria-label="Histórico do pedido">
      {entries.map((entry, index) => {
        const config = EVENT_CONFIG[entry.event_type] ?? {
          label: "Atualização do pedido",
          icon: Clock3,
          tone: "bg-gray-600 text-white",
        };
        const Icon = config.icon;
        const last = index === entries.length - 1;

        return (
          <li
            key={entry.id}
            className="order-timeline-entry relative grid grid-cols-[44px_minmax(0,1fr)] gap-3 pb-7 last:pb-0"
            style={{ animationDelay: `${Math.min(index * 70, 420)}ms` }}
          >
            {!last ? (
              <span
                className="absolute bottom-0 left-[21px] top-11 w-px bg-gradient-to-b from-gray-300 to-gray-100"
                aria-hidden="true"
              />
            ) : null}
            <span
              className={`relative z-10 flex h-11 w-11 items-center justify-center rounded-full shadow-sm ring-4 ring-white ${config.tone}`}
              aria-hidden="true"
            >
              <Icon className="h-4.5 w-4.5" />
            </span>
            <div className="pt-0.5">
              <div className="flex flex-wrap items-baseline justify-between gap-1.5">
                <h3 className="text-sm font-extrabold text-gray-950">
                  {config.label}
                </h3>
                <time className="text-[11px] font-medium text-gray-400">
                  {dateFormatter.format(new Date(entry.created_at))}
                </time>
              </div>
              {entry.message ? (
                <p className="mt-1 text-sm leading-6 text-gray-600">
                  {entry.message}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
