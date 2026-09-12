import { CheckCircle2, Heart, PackageCheck, ShoppingBag } from "lucide-react";
import { useEffect } from "react";

import type { OrderDetail } from "@/lib/orders";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const CONFETTI = Array.from({ length: 30 }, (_, index) => ({
  id: index,
  side: index % 2 === 0 ? "left" : "right",
  lane: (index * 37) % 92,
  delay: ((index * 113) % 900) / 1000,
  duration: 2.2 + ((index * 17) % 13) / 10,
  rotation: (index * 47) % 180,
  shape: index % 3,
  color: ["#ef4444", "#111827", "#f59e0b", "#2563eb", "#16a34a", "#9333ea"][index % 6],
}));

function celebrationCopy(status: OrderDetail["order"]["status"]) {
  if (status === "in_production") {
    return "Seu pagamento foi confirmado e seu pedido já está em produção. Acompanhe cada novidade por aqui.";
  }
  if (status === "shipped" || status === "delivered") {
    return "Seu pagamento foi confirmado. Obrigado por escolher a DropBox — acompanhe todos os detalhes do seu pedido por aqui.";
  }
  return "Seu pagamento foi confirmado e seu pedido já está seguindo para preparação. A partir de agora, você pode acompanhar cada etapa por aqui.";
}

export function PostPurchaseCelebration({
  detail,
  onDone,
}: {
  detail: OrderDetail;
  onDone: () => void;
}) {
  const units = detail.items.reduce((total, item) => total + item.quantity, 0);

  useEffect(() => {
    const timeout = window.setTimeout(onDone, 4300);
    return () => window.clearTimeout(timeout);
  }, [onDone]);

  return (
    <div
      className="post-purchase-celebration fixed inset-0 z-[80] flex items-center justify-center overflow-hidden bg-white/96 px-4 py-8"
      role="status"
      aria-live="polite"
    >
      <style>{`
        @keyframes dropbox-confetti-fall {
          0% { opacity: 0; transform: translate3d(0, -18vh, 0) rotate(0deg); }
          12% { opacity: 0.95; }
          88% { opacity: 0.9; }
          100% { opacity: 0; transform: translate3d(0, 112vh, 0) rotate(460deg); }
        }
        @keyframes dropbox-celebration-card {
          0% { opacity: 0; transform: translate3d(0, 12px, 0) scale(0.985); }
          14% { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
          88% { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
          100% { opacity: 0; transform: translate3d(0, -4px, 0) scale(0.995); }
        }
        @keyframes dropbox-celebration-backdrop {
          0% { opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { opacity: 0; }
        }
        .post-purchase-celebration { animation: dropbox-celebration-backdrop 4.3s ease both; }
        .post-purchase-celebration-card { animation: dropbox-celebration-card 4.3s cubic-bezier(.22,.8,.22,1) both; }
        .post-purchase-confetti { animation-name: dropbox-confetti-fall; animation-timing-function: linear; animation-fill-mode: both; will-change: transform, opacity; }
        @media (prefers-reduced-motion: reduce) {
          .post-purchase-celebration, .post-purchase-celebration-card { animation: none; }
          .post-purchase-confetti { display: none; }
        }
      `}</style>

      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-[24vw] min-w-20 max-w-72 overflow-hidden"
        aria-hidden="true"
      >
        {CONFETTI.filter((piece) => piece.side === "left").map((piece) => (
          <span
            key={piece.id}
            className="post-purchase-confetti absolute -top-8 block h-2.5 w-2.5"
            style={{
              left: `${piece.lane}%`,
              backgroundColor: piece.color,
              animationDelay: `${piece.delay}s`,
              animationDuration: `${piece.duration}s`,
              rotate: `${piece.rotation}deg`,
              ...(piece.shape === 1
                ? { borderRadius: "999px 2px 999px 2px" }
                : piece.shape === 2
                  ? { clipPath: "polygon(50% 0, 100% 100%, 0 100%)" }
                  : {}),
            }}
          />
        ))}
      </div>

      <div
        className="pointer-events-none absolute inset-y-0 right-0 w-[24vw] min-w-20 max-w-72 overflow-hidden"
        aria-hidden="true"
      >
        {CONFETTI.filter((piece) => piece.side === "right").map((piece) => (
          <span
            key={piece.id}
            className="post-purchase-confetti absolute -top-8 block h-2.5 w-2.5"
            style={{
              right: `${piece.lane}%`,
              backgroundColor: piece.color,
              animationDelay: `${piece.delay}s`,
              animationDuration: `${piece.duration}s`,
              rotate: `${piece.rotation}deg`,
              ...(piece.shape === 1
                ? { borderRadius: "999px 2px 999px 2px" }
                : piece.shape === 2
                  ? { clipPath: "polygon(50% 0, 100% 100%, 0 100%)" }
                  : {}),
            }}
          />
        ))}
      </div>

      <section className="post-purchase-celebration-card relative z-10 w-full max-w-2xl rounded-[28px] border border-gray-200 bg-white px-5 py-7 text-center shadow-[0_24px_70px_rgba(15,23,42,0.14)] sm:px-9 sm:py-9">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-600 text-white shadow-lg shadow-red-600/20">
          <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
        </div>

        <p className="mt-5 text-xs font-black uppercase tracking-[0.18em] text-red-600">
          Compra confirmada
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-gray-950 sm:text-4xl">
          Muito obrigado pela sua compra!
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-gray-600 sm:text-base sm:leading-7">
          {celebrationCopy(detail.order.status)}
        </p>

        <div className="mt-6 grid grid-cols-3 gap-2.5 text-left sm:gap-3">
          <div className="rounded-2xl bg-gray-50 p-3 sm:p-4">
            <ShoppingBag className="h-4 w-4 text-red-600" aria-hidden="true" />
            <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-gray-500">
              Pedido
            </p>
            <p className="mt-0.5 truncate text-xs font-black text-gray-950 sm:text-sm">
              {detail.order.public_number}
            </p>
          </div>
          <div className="rounded-2xl bg-gray-50 p-3 sm:p-4">
            <PackageCheck className="h-4 w-4 text-red-600" aria-hidden="true" />
            <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-gray-500">
              Itens
            </p>
            <p className="mt-0.5 text-xs font-black text-gray-950 sm:text-sm">
              {units} {units === 1 ? "item" : "itens"}
            </p>
          </div>
          <div className="rounded-2xl bg-gray-50 p-3 sm:p-4">
            <Heart className="h-4 w-4 text-red-600" aria-hidden="true" />
            <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-gray-500">
              Total
            </p>
            <p className="mt-0.5 text-xs font-black text-gray-950 sm:text-sm">
              {currencyFormatter.format(detail.order.total_amount)}
            </p>
          </div>
        </div>

        <p className="mt-5 text-xs font-medium text-gray-500">
          Esta mensagem aparece somente na primeira abertura após a confirmação da compra.
        </p>
      </section>
    </div>
  );
}
