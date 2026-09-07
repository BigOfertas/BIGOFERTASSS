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

const STANDARD_STEPS = [
  {
    eventType: "order_created",
    label: "Pedido criado",
    icon: ShoppingBag,
    futureCopy: "O pedido será registrado assim que o checkout for concluído.",
  },
  {
    eventType: "payment_confirmed",
    label: "Pagamento confirmado",
    icon: CheckCircle2,
    futureCopy: "Aguardando a confirmação do pagamento.",
  },
  {
    eventType: "production_started",
    label: "Produção iniciada",
    icon: Factory,
    futureCopy: "Depois do pagamento, o pedido entra em produção.",
  },
  {
    eventType: "order_shipped",
    label: "Pedido enviado",
    icon: Truck,
    futureCopy: "O rastreio aparecerá quando o pacote for enviado.",
  },
  {
    eventType: "order_delivered",
    label: "Pedido entregue",
    icon: PackageCheck,
    futureCopy: "Última etapa do acompanhamento do pedido.",
  },
] as const;

const INCIDENT_CONFIG: Record<string, { label: string; icon: typeof Clock3; tone: string }> = {
  order_canceled: {
    label: "Pedido cancelado",
    icon: Ban,
    tone: "border-gray-300 bg-gray-100 text-gray-800",
  },
  refund_requested: {
    label: "Reembolso solicitado",
    icon: RotateCcw,
    tone: "border-orange-300 bg-orange-50 text-orange-900",
  },
  refund_confirmed: {
    label: "Reembolso confirmado",
    icon: HandCoins,
    tone: "border-violet-300 bg-violet-50 text-violet-900",
  },
  refund_canceled: {
    label: "Reembolso cancelado",
    icon: XCircle,
    tone: "border-rose-300 bg-rose-50 text-rose-900",
  },
};

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function OrderTimeline({ entries }: { entries: OrderTimelineEntry[] }) {
  const entryByType = new Map<string, OrderTimelineEntry>();

  for (const entry of entries) {
    if (!entryByType.has(entry.event_type)) {
      entryByType.set(entry.event_type, entry);
    }
  }

  const reachedIndexes = STANDARD_STEPS.flatMap((step, index) =>
    entryByType.has(step.eventType) ? [index] : [],
  );
  const currentIndex = reachedIndexes.length > 0 ? Math.max(...reachedIndexes) : 0;
  const incidents = entries.filter((entry) => INCIDENT_CONFIG[entry.event_type]);

  return (
    <div className="space-y-6">
      <ol aria-label="Etapas do pedido" className="overflow-hidden py-1">
        {STANDARD_STEPS.map((step, index) => {
          const entry = entryByType.get(step.eventType);
          const reached = Boolean(entry);
          const current = reached && index === currentIndex;
          const completed = reached && index < currentIndex;
          const future = !reached;
          const Icon = step.icon;
          const indent = index * 18;
          const connectorReached = index < currentIndex;

          return (
            <li key={step.eventType} className="relative">
              <div
                className="order-timeline-entry relative grid grid-cols-[52px_minmax(0,1fr)] gap-3"
                style={{
                  paddingLeft: `${indent}px`,
                  animationDelay: `${Math.min(index * 70, 280)}ms`,
                }}
              >
                <span
                  className={`relative z-10 flex h-12 w-12 items-center justify-center rounded-full border-[3px] shadow-[0_3px_0_rgba(15,23,42,0.14),0_8px_18px_rgba(15,23,42,0.10)] transition-colors motion-reduce:transition-none ${
                    current
                      ? "border-red-700 bg-red-600 text-white"
                      : completed
                        ? "border-gray-950 bg-gray-950 text-white"
                        : "border-gray-300 bg-gray-100 text-gray-400 shadow-[0_2px_0_rgba(15,23,42,0.08)]"
                  }`}
                  aria-hidden="true"
                >
                  <Icon className="h-5 w-5" />
                </span>

                <div
                  className={`min-w-0 rounded-2xl border px-4 py-3.5 shadow-[0_2px_0_rgba(15,23,42,0.08)] sm:px-5 ${
                    current
                      ? "border-red-300 bg-red-50/90"
                      : completed
                        ? "border-gray-300 bg-white"
                        : "border-gray-200 bg-gray-50/80"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3
                        className={`text-sm font-black ${
                          future ? "text-gray-400" : "text-gray-950"
                        }`}
                      >
                        {step.label}
                      </h3>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.1em] ${
                          current
                            ? "bg-red-600 text-white"
                            : completed
                              ? "bg-gray-900 text-white"
                              : "bg-gray-200 text-gray-500"
                        }`}
                      >
                        {current ? "Etapa atual" : completed ? "Concluído" : "Aguardando"}
                      </span>
                    </div>

                    {entry ? (
                      <time className="text-[11px] font-bold text-gray-500">
                        {dateFormatter.format(new Date(entry.created_at))}
                      </time>
                    ) : null}
                  </div>

                  <p
                    className={`mt-1.5 text-sm leading-6 ${
                      future ? "text-gray-400" : "text-gray-600"
                    }`}
                  >
                    {entry?.message || step.futureCopy}
                  </p>
                </div>
              </div>

              {index < STANDARD_STEPS.length - 1 ? (
                <div
                  className={`h-8 w-[18px] rounded-bl-xl border-b-[6px] border-l-[6px] ${
                    connectorReached ? "border-gray-950" : "border-gray-200"
                  }`}
                  style={{ marginLeft: `${indent + 23}px` }}
                  aria-hidden="true"
                />
              ) : null}
            </li>
          );
        })}
      </ol>

      {incidents.length > 0 ? (
        <section className="rounded-2xl border-2 border-gray-300 bg-white p-4 shadow-[0_3px_0_rgba(15,23,42,0.10),0_12px_28px_rgba(15,23,42,0.08)] sm:p-5">
          <div className="mb-3 flex items-center gap-2">
            <Clock3 className="h-4.5 w-4.5 text-gray-700" aria-hidden="true" />
            <h3 className="text-sm font-black text-gray-950">Ocorrências do pedido</h3>
          </div>

          <div className="space-y-2.5">
            {incidents.map((entry) => {
              const config = INCIDENT_CONFIG[entry.event_type];
              const Icon = config.icon;

              return (
                <article key={entry.id} className={`rounded-xl border px-3.5 py-3 ${config.tone}`}>
                  <div className="flex items-start gap-3">
                    <Icon className="mt-0.5 h-4.5 w-4.5 flex-none" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="text-sm font-black">{config.label}</p>
                        <time className="text-[11px] font-bold opacity-65">
                          {dateFormatter.format(new Date(entry.created_at))}
                        </time>
                      </div>
                      {entry.message ? (
                        <p className="mt-1 text-xs leading-5 opacity-80">{entry.message}</p>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
