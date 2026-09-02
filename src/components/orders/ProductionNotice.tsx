import { Clock3, Factory } from "lucide-react";

export function ProductionNotice({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-red-100 bg-gradient-to-br from-red-50 via-white to-orange-50 ${
        compact ? "p-4" : "p-5 sm:p-6"
      }`}
    >
      <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-red-100/60 blur-2xl" />
      <div className="relative flex items-start gap-3.5">
        <div className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-red-600 text-white shadow-lg shadow-red-600/20">
          <Factory className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <p className="text-sm font-black tracking-tight text-gray-950">
            Produzido especialmente para você
          </p>
          <p className="mt-1 flex items-start gap-1.5 text-sm leading-6 text-gray-600">
            <Clock3
              className="mt-1 h-4 w-4 flex-none text-red-600"
              aria-hidden="true"
            />
            <span>
              <strong className="font-extrabold text-gray-900">
                Produção em até 5 dias úteis antes do envio.
              </strong>{" "}
              O prazo de transporte será informado separadamente pela
              transportadora.
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
