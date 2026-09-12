import { CheckCircle2, Heart, PackageCheck, ShoppingBag } from "lucide-react";
import { useEffect, useState, type CSSProperties } from "react";

import type { OrderDetail } from "@/lib/orders";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const CELEBRATION_DURATION_MS = 60_000;
const CELEBRATION_EXIT_MS = 700;

const CONFETTI = Array.from({ length: 168 }, (_, index) => {
  const side = index % 2 === 0 ? "left" : "right";
  const desktopLane = side === "left" ? (index * 37) % 24 : 76 + ((index * 41) % 24);
  const drift = -18 + ((index * 29) % 37);

  return {
    id: index,
    desktopLane,
    mobileLane: (index * 53) % 100,
    delay: ((index * 127) % 5600) / 1000,
    duration: 3.2 + ((index * 19) % 28) / 10,
    rotation: 300 + ((index * 47) % 680),
    drift,
    startDrift: drift * -0.18,
    size: 6 + ((index * 11) % 6),
    shape: index % 3,
    opacity: 0.72 + ((index * 13) % 25) / 100,
    color: ["#ef4444", "#111827", "#f59e0b", "#2563eb", "#16a34a", "#9333ea"][index % 6],
  };
});

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
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const exitTimeout = window.setTimeout(
      () => setLeaving(true),
      CELEBRATION_DURATION_MS - CELEBRATION_EXIT_MS,
    );
    const doneTimeout = window.setTimeout(onDone, CELEBRATION_DURATION_MS);

    return () => {
      window.clearTimeout(exitTimeout);
      window.clearTimeout(doneTimeout);
    };
  }, [onDone]);

  return (
    <div
      className={`post-purchase-celebration fixed inset-0 z-[80] flex items-center justify-center overflow-hidden bg-white/88 px-4 py-8 transition-opacity duration-700 ${
        leaving ? "opacity-0" : "opacity-100"
      }`}
      role="status"
      aria-live="polite"
    >
      <style>{`
        @keyframes dropbox-confetti-fall {
          0% {
            opacity: 0;
            transform: translate3d(var(--confetti-start-drift), -16vh, 0) rotate(0deg);
          }
          8% { opacity: var(--confetti-opacity); }
          90% { opacity: var(--confetti-opacity); }
          100% {
            opacity: 0;
            transform: translate3d(var(--confetti-drift), 116vh, 0) rotate(var(--confetti-rotation));
          }
        }
        @keyframes dropbox-celebration-card-in {
          0% { opacity: 0; transform: translate3d(0, 22px, 0) scale(0.965); }
          68% { opacity: 1; transform: translate3d(0, -2px, 0) scale(1.008); }
          100% { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
        }
        .post-purchase-confetti {
          left: var(--confetti-mobile-left);
          animation-name: dropbox-confetti-fall;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
          animation-fill-mode: both;
        }
        .post-purchase-celebration-card {
          animation: dropbox-celebration-card-in 760ms cubic-bezier(.2,.82,.2,1) both;
        }
        @media (min-width: 768px) {
          .post-purchase-confetti { left: var(--confetti-desktop-left); }
        }
        @media (prefers-reduced-motion: reduce) {
          .post-purchase-celebration { transition: none; }
          .post-purchase-celebration-card { animation: none; }
          .post-purchase-confetti { display: none; }
        }
      `}</style>

      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
        {CONFETTI.map((piece) => (
          <span
            key={piece.id}
            className="post-purchase-confetti absolute -top-6 block"
            style={
              {
                "--confetti-mobile-left": `${piece.mobileLane}%`,
                "--confetti-desktop-left": `${piece.desktopLane}%`,
                "--confetti-start-drift": `${piece.startDrift}vw`,
                "--confetti-drift": `${piece.drift}vw`,
                "--confetti-rotation": `${piece.rotation}deg`,
                "--confetti-opacity": piece.opacity,
                width: `${piece.size}px`,
                height: `${piece.size}px`,
                backgroundColor: piece.color,
                animationDelay: `-${piece.delay}s`,
                animationDuration: `${piece.duration}s`,
                ...(piece.shape === 1
                  ? { borderRadius: "999px 2px 999px 2px" }
                  : piece.shape === 2
                    ? { clipPath: "polygon(50% 0, 100% 100%, 0 100%)" }
                    : {}),
              } as CSSProperties
            }
          />
        ))}
      </div>

      <div className="relative z-20 w-full max-w-2xl">
        <div
          className="pointer-events-none absolute -inset-3 -z-10 rounded-[34px] bg-white/60 shadow-[0_48px_130px_-32px_rgba(15,23,42,0.58),0_24px_70px_-34px_rgba(220,38,38,0.58)] sm:-inset-5 sm:rounded-[40px]"
          aria-hidden="true"
        />

        <section className="post-purchase-celebration-card relative overflow-hidden rounded-[28px] border border-white/90 bg-white px-5 py-7 text-center shadow-[0_36px_100px_-26px_rgba(15,23,42,0.46),0_18px_44px_-24px_rgba(220,38,38,0.42)] ring-1 ring-gray-950/5 sm:px-9 sm:py-9">
          <div
            className="pointer-events-none absolute inset-x-10 -top-16 h-32 rounded-full bg-red-500/10 blur-3xl"
            aria-hidden="true"
          />

          <div className="relative">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-600 text-white shadow-[0_12px_30px_rgba(220,38,38,0.28)]">
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
              <div className="rounded-2xl border border-gray-100 bg-gray-50/90 p-3 shadow-sm sm:p-4">
                <ShoppingBag className="h-4 w-4 text-red-600" aria-hidden="true" />
                <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-gray-500">
                  Pedido
                </p>
                <p className="mt-0.5 truncate text-xs font-black text-gray-950 sm:text-sm">
                  {detail.order.public_number}
                </p>
              </div>
              <div className="rounded-2xl border border-gray-100 bg-gray-50/90 p-3 shadow-sm sm:p-4">
                <PackageCheck className="h-4 w-4 text-red-600" aria-hidden="true" />
                <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-gray-500">
                  Itens
                </p>
                <p className="mt-0.5 text-xs font-black text-gray-950 sm:text-sm">
                  {units} {units === 1 ? "item" : "itens"}
                </p>
              </div>
              <div className="rounded-2xl border border-gray-100 bg-gray-50/90 p-3 shadow-sm sm:p-4">
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
          </div>
        </section>
      </div>
    </div>
  );
}
