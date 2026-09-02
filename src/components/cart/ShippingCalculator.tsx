import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Check,
  Gift,
  LoaderCircle,
  MapPin,
  PackageCheck,
  RefreshCw,
  Truck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import type { CartItem } from "@/lib/cart";
import {
  formatPostalCode,
  formatTransitLabel,
  onlyPostalCodeDigits,
  requestShippingQuotes,
  type ShippingQuote,
  type ShippingQuoteResult,
} from "@/lib/shipping";

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

type ShippingCalculatorProps = {
  cart: CartItem[];
  selectedQuote: ShippingQuote | null;
  onSelectionChange: (quote: ShippingQuote | null) => void;
  freeShipping?: boolean;
};

function serviceSubtitle(quote: ShippingQuote) {
  if (quote.service === "Loggi") return "Postagem em Mossoró/RN";
  return `Correios · ${quote.service}`;
}

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
  }, [cartSignature, onSelectionChange]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (onlyPostalCodeDigits(postalCode).length !== 8) {
      setErrorMessage("Informe um CEP válido com 8 dígitos.");
      return;
    }

    setIsLoading(true);
    setErrorMessage("");
    onSelectionChange(null);

    try {
      const nextResult = await requestShippingQuotes(postalCode, cart);
      setResult(nextResult);

      const cheapest = nextResult.quotes.reduce<ShippingQuote | null>(
        (current, quote) =>
          !current || quote.totalPrice < current.totalPrice ? quote : current,
        null,
      );
      onSelectionChange(cheapest);
    } catch (error) {
      setResult(null);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível calcular o frete agora.",
      );
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
            <p className="text-[11px] text-gray-500">
              PAC, SEDEX e Loggi com cotação real.
            </p>
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
            onChange={(event) =>
              setPostalCode(formatPostalCode(event.target.value))
            }
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
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <strong className="text-sm text-gray-950">{quote.service}</strong>
                    {quote.packageCount > 1 ? (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600">
                        {quote.packageCount} volumes
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-gray-500">
                    {serviceSubtitle(quote)}
                  </span>
                  <span className="mt-1 block text-[11px] font-semibold text-gray-700">
                    Transporte: {formatTransitLabel(quote)}
                  </span>
                </span>

                <span className="flex-none text-right">
                  {freeShipping ? (
                    <>
                      <strong className="block text-sm text-emerald-700">Grátis</strong>
                      <span className="text-[10px] text-gray-400 line-through">
                        {currency.format(quote.totalPrice)}
                      </span>
                    </>
                  ) : (
                    <>
                      <strong className="block text-sm text-gray-950">
                        {currency.format(quote.totalPrice)}
                      </strong>
                      <span className="text-[10px] text-gray-500">valor final</span>
                    </>
                  )}
                </span>
              </button>
            );
          })}

          <div className="mt-3 flex items-start gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-[11px] leading-relaxed text-emerald-900">
            <PackageCheck className="mt-0.5 h-4 w-4 flex-none text-emerald-700" />
            <p>
              <strong>Produção em até {result.productionBusinessDays} dias úteis antes do envio.</strong>{" "}
              O prazo acima é apenas o transporte e começa depois da produção.
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
