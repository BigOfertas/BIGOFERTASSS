import { CheckCircle2, LoaderCircle, MapPin, PackageCheck, ShieldCheck, Truck } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  formatPostalCode,
  formatTotalDeliveryLabel,
  formatTransitLabel,
  onlyPostalCodeDigits,
  requestProductShippingQuotes,
  type ShippingQuoteResult,
} from "@/lib/shipping";
import { getUserFacingError } from "@/lib/user-facing-error";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const benefits = [
  { icon: ShieldCheck, label: "Compra segura" },
  { icon: PackageCheck, label: "Pedido acompanhado" },
  { icon: MapPin, label: "Prazo pelo seu CEP" },
] as const;

export function ProductShippingCalculator({
  productId,
  quantity,
}: {
  productId: string;
  quantity: number;
}) {
  const [postalCode, setPostalCode] = useState("");
  const [result, setResult] = useState<ShippingQuoteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (onlyPostalCodeDigits(postalCode).length !== 8) {
      setError("Informe um CEP válido com 8 dígitos.");
      setResult(null);
      return;
    }
    setLoading(true);
    setError("");
    try {
      setResult(await requestProductShippingQuotes(postalCode, productId, quantity));
    } catch (caught) {
      setResult(null);
      setError(getUserFacingError(caught, "Não foi possível calcular a entrega agora."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <section
        className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5"
        aria-labelledby="product-shipping-title"
      >
        <div className="flex items-center gap-2">
          <Truck className="h-4.5 w-4.5 text-red-600" aria-hidden="true" />
          <h2 id="product-shipping-title" className="text-sm font-black text-gray-950">
            Entrega para o seu CEP
          </h2>
        </div>
        <p className="mt-1 text-xs leading-5 text-gray-500">
          Veja o frete e a previsão completa, já considerando preparação e transporte.
        </p>

        <form onSubmit={submit} className="mt-4 flex gap-2">
          <label htmlFor="product-postal-code" className="sr-only">
            CEP
          </label>
          <input
            id="product-postal-code"
            value={postalCode}
            onChange={(event) => setPostalCode(formatPostalCode(event.target.value))}
            inputMode="numeric"
            autoComplete="postal-code"
            placeholder="Digite seu CEP"
            className="h-11 min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3.5 text-sm font-semibold outline-none focus:border-red-500 focus:ring-4 focus:ring-red-50"
          />
          <Button
            type="submit"
            disabled={loading}
            className="h-11 bg-gray-950 px-5 text-xs font-black text-white hover:bg-red-600"
          >
            {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : "Calcular"}
          </Button>
        </form>

        {error ? (
          <p role="alert" className="mt-3 text-xs font-semibold text-red-700">
            {error}
          </p>
        ) : null}

        {result ? (
          <div className="mt-4 space-y-2.5">
            {result.quotes.map((quote) => (
              <div
                key={`${quote.carrier}-${quote.serviceId}`}
                className="rounded-lg border border-gray-200 bg-gray-50/70 px-3.5 py-3.5"
              >
                <div className="flex items-start gap-3">
                  <CheckCircle2
                    className="mt-0.5 h-4 w-4 flex-none text-emerald-600"
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <strong className="block text-xs text-gray-950">{quote.service}</strong>
                        <span className="mt-0.5 block text-[11px] text-gray-500">
                          Transporte: {formatTransitLabel(quote)}
                        </span>
                      </div>
                      <strong className="flex-none text-xs text-gray-950">
                        {currency.format(quote.totalPrice)}
                      </strong>
                    </div>
                    <p className="mt-2 text-[11px] font-bold text-gray-800">
                      Previsão total:{" "}
                      {formatTotalDeliveryLabel(result.productionBusinessDays, quote)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
            <p className="pt-1 text-[11px] leading-5 text-gray-500">
              A previsão soma até {result.productionBusinessDays} dias úteis de preparação ao prazo
              informado pela transportadora.
            </p>
          </div>
        ) : null}
      </section>

      <div className="grid grid-cols-3 divide-x divide-gray-200 border-y border-gray-100 py-3">
        {benefits.map(({ icon: Icon, label }) => (
          <div key={label} className="flex min-w-0 flex-col items-center gap-1.5 px-2 text-center">
            <Icon className="h-4 w-4 text-red-600" aria-hidden="true" />
            <span className="text-[10px] font-bold leading-4 text-gray-700">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
