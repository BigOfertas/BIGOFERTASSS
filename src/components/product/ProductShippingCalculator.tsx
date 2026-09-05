import { LoaderCircle, MapPin, Truck } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  formatPostalCode,
  formatTransitLabel,
  onlyPostalCodeDigits,
  requestProductShippingQuotes,
  type ShippingQuoteResult,
} from "@/lib/shipping";
import { getUserFacingError } from "@/lib/user-facing-error";

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

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
      const next = await requestProductShippingQuotes(postalCode, productId, quantity);
      setResult(next);
    } catch (caught) {
      setResult(null);
      setError(getUserFacingError(caught, "Não foi possível calcular a entrega agora."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-gray-50/60 p-4" aria-labelledby="product-shipping-title">
      <div className="flex items-center gap-2">
        <MapPin className="h-4 w-4 text-red-600" aria-hidden="true" />
        <h2 id="product-shipping-title" className="text-sm font-black text-gray-950">
          Calcule a entrega
        </h2>
      </div>
      <p className="mt-1 text-xs leading-5 text-gray-500">
        Consulte o valor e a estimativa para o seu CEP antes de adicionar ao carrinho.
      </p>

      <form onSubmit={submit} className="mt-3 flex gap-2">
        <label htmlFor="product-postal-code" className="sr-only">CEP</label>
        <input
          id="product-postal-code"
          value={postalCode}
          onChange={(event) => setPostalCode(formatPostalCode(event.target.value))}
          inputMode="numeric"
          autoComplete="postal-code"
          placeholder="00000-000"
          className="h-10 min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 text-sm font-semibold outline-none focus:border-red-500 focus:ring-4 focus:ring-red-50"
        />
        <Button type="submit" disabled={loading} className="h-10 bg-gray-950 px-4 text-xs font-black text-white hover:bg-red-600">
          {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : "Calcular"}
        </Button>
      </form>

      {error ? <p role="alert" className="mt-3 text-xs font-semibold text-red-700">{error}</p> : null}

      {result ? (
        <div className="mt-4 space-y-2">
          {result.quotes.map((quote) => (
            <div key={`${quote.carrier}-${quote.serviceId}`} className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2.5">
              <Truck className="h-4 w-4 flex-none text-gray-500" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <strong className="block text-xs text-gray-950">{quote.service}</strong>
                <span className="block text-[11px] text-gray-500">{formatTransitLabel(quote)} após a preparação</span>
              </div>
              <strong className="flex-none text-xs text-gray-950">{currency.format(quote.totalPrice)}</strong>
            </div>
          ))}
          <p className="pt-1 text-[11px] leading-5 text-gray-500">
            Preparação em até {result.productionBusinessDays} dias úteis antes do envio. O prazo final pode variar conforme a localidade.
          </p>
        </div>
      ) : null}
    </section>
  );
}
