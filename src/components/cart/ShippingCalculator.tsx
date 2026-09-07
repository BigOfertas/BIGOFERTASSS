import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Check, Gift, LoaderCircle, MapPin, RefreshCw, Truck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { BRAND } from "@/config/brand";
import type { CartItem } from "@/lib/cart";
import {
  formatPostalCode,
  formatTransitLabel,
  onlyPostalCodeDigits,
  requestShippingQuotes,
  type ShippingQuote,
  type ShippingQuoteResult,
} from "@/lib/shipping";
import { getUserFacingError } from "@/lib/user-facing-error";

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

type ShippingCalculatorProps = {
  cart: CartItem[];
  selectedQuote: ShippingQuote | null;
  onSelectionChange: (quote: ShippingQuote | null) => void;
  onPostalCodeQuoted?: (postalCode: string | null) => void;
  freeShipping?: boolean;
};

function ShippingSkeleton() {
  return (
    <div className="space-y-2" aria-label="Carregando opções de entrega">
      {[0, 1, 2].map((item) => (
        <div
          key={item}
          className="h-[76px] animate-pulse rounded-xl border border-gray-100 bg-gray-50 motion-reduce:animate-none"
        />
      ))}
    </div>
  );
}

export function ShippingCalculator({
  cart,
  selectedQuote,
  onSelectionChange,
  onPostalCodeQuoted,
  freeShipping = false,
}: ShippingCalculatorProps) {
  const [postalCode, setPostalCode] = useState("");
  const [result, setResult] = useState<ShippingQuoteResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const cartSignature = useMemo(
    () =>
      cart
        .map((item) => `${item.productId}:${item.quantity}`)
        .sort()
        .join("|"),
    [cart],
  );

  useEffect(() => {
    setResult(null);
    setErrorMessage("");
    onSelectionChange(null);
    onPostalCodeQuoted?.(null);
  }, [cartSignature, onPostalCodeQuoted, onSelectionChange]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedPostalCode = onlyPostalCodeDigits(postalCode);
    if (normalizedPostalCode.length !== 8) {
      setErrorMessage("Informe um CEP válido com 8 dígitos.");
      onPostalCodeQuoted?.(null);
      return;
    }

    setIsLoading(true);
    setErrorMessage("");
    onSelectionChange(null);
    onPostalCodeQuoted?.(null);

    try {
      const nextResult = await requestShippingQuotes(postalCode, cart);
      setResult(nextResult);

      const cheapest = nextResult.quotes.reduce<ShippingQuote | null>(
        (current, quote) => (!current || quote.totalPrice < current.totalPrice ? quote : current),
        null,
      );
      onSelectionChange(cheapest);
      onPostalCodeQuoted?.(normalizedPostalCode);
    } catch (error) {
      setResult(null);
      onPostalCodeQuoted?.(null);
      setErrorMessage(getUserFacingError(error, "Não foi possível calcular o frete agora."));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="space-y-4" aria-labelledby="shipping-calculator-title">
      <div>
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-50 text-red-600">
            <MapPin className="h-4 w-4" />
          </span>
          <div>
            <h3 id="shipping-calculator-title" className="text-sm font-bold text-gray-900">
              Calcular entrega
            </h3>
            <p className="text-[11px] text-gray-500">PAC, SEDEX e Loggi.</p>
          </div>
        </div>

        {freeShipping ? (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">
            <Gift className="h-4 w-4 flex-none" />
            Frete grátis liberado para este carrinho.
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-3 flex gap-2">
          <label className="sr-only" htmlFor="shipping-postal-code">
            CEP de destino
          </label>
          <input
            id="shipping-postal-code"
            inputMode="numeric"
            autoComplete="postal-code"
            placeholder="00000-000"
            value={postalCode}
            onChange={(event) => setPostalCode(formatPostalCode(event.target.value))}
            className="h-11 min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-900 outline-none transition focus:border-red-400 focus:ring-4 focus:ring-red-50 motion-reduce:transition-none"
          />
          <Button
            type="submit"
            disabled={isLoading}
            className="h-11 flex-none bg-gray-950 px-4 text-white transition hover:-translate-y-0.5 hover:bg-gray-800 active:translate-y-0 motion-reduce:transform-none motion-reduce:transition-none"
          >
            {isLoading ? (
              <LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" />
            ) : result ? (
              <RefreshCw className="h-4 w-4" />
            ) : (
              "Calcular"
            )}
            {result && !isLoading ? <span className="sr-only">Recalcular</span> : null}
          </Button>
        </form>
      </div>

      {isLoading ? <ShippingSkeleton /> : null}

      {errorMessage ? (
        <div
          role="alert"
          className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs leading-relaxed text-amber-900"
        >
          {errorMessage}
        </div>
      ) : null}

      {!isLoading && result ? (
        <div className="space-y-2">
          {result.quotes.map((quote) => {
            const selected = selectedQuote?.serviceId === quote.serviceId;

            return (
              <button
                key={`${quote.carrier}-${quote.serviceId}`}
                type="button"
                onClick={() => onSelectionChange(quote)}
                aria-pressed={selected}
                className={`group flex w-full items-center gap-3 rounded-xl border p-3 text-left transition duration-200 hover:-translate-y-0.5 hover:shadow-sm motion-reduce:transform-none motion-reduce:transition-none ${
                  selected
                    ? "border-red-300 bg-red-50/60 shadow-sm"
                    : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                <span
                  className={`flex h-10 w-10 flex-none items-center justify-center rounded-xl transition motion-reduce:transition-none ${
                    selected
                      ? "bg-red-600 text-white"
                      : "bg-gray-100 text-gray-600 group-hover:bg-gray-900 group-hover:text-white"
                  }`}
                >
                  {selected ? <Check className="h-5 w-5" /> : <Truck className="h-5 w-5" />}
                </span>

                <span className="min-w-0 flex-1">
                  <strong className="text-sm text-gray-950">{quote.service}</strong>
                  <span className="mt-1 block text-[11px] font-semibold text-gray-600">
                    Prazo: {formatTransitLabel(quote)}
                  </span>
                </span>

                <span className="flex-none text-right">
                  {freeShipping ? (
                    <>
                      <span className="block text-[11px] text-gray-500 line-through">
                        {currency.format(quote.totalPrice)}
                      </span>
                      <strong className="block text-sm text-emerald-700">Grátis</strong>
                    </>
                  ) : (
                    <strong className="block text-sm text-gray-950">
                      {currency.format(quote.totalPrice)}
                    </strong>
                  )}
                </span>
              </button>
            );
          })}

          {freeShipping ? (
            <p className="px-1 pt-1 text-[11px] leading-relaxed text-emerald-700">
              Cotação absorvida pela {BRAND.officialName}: você não paga o valor da entrega.
            </p>
          ) : null}

          <p className="px-1 pt-1 text-[11px] leading-relaxed text-gray-500">
            Produção em até {result.productionBusinessDays} dias úteis antes do envio.
          </p>
        </div>
      ) : null}
    </section>
  );
}
