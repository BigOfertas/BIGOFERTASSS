import { Link } from "@tanstack/react-router";
import { ArrowRight, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { CartItem } from "@/lib/cart";
import type { ShippingQuote } from "@/lib/shipping";

export function CheckoutPanel({
  cart,
  hasBlockingIssues,
}: {
  cart: CartItem[];
  selectedShipping: ShippingQuote | null;
  quotedPostalCode: string | null;
  hasBlockingIssues: boolean;
}) {
  const disabled = cart.length === 0 || hasBlockingIssues;

  return (
    <div className="space-y-2">
      {disabled ? (
        <Button type="button" disabled className="w-full py-6 text-lg font-bold">
          Revise o carrinho para continuar
        </Button>
      ) : (
        <Button
          asChild
          className="w-full bg-red-600 py-6 text-lg font-bold text-white transition hover:bg-red-700 motion-reduce:transition-none"
        >
          <Link to="/checkout">
            Finalizar compra
            <ArrowRight className="ml-2 h-5 w-5" aria-hidden="true" />
          </Link>
        </Button>
      )}

      <p className="flex items-center justify-center gap-1.5 text-center text-[11px] leading-relaxed text-gray-500">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
        Checkout em 4 etapas. Pagamento processado pela InfinitePay.
      </p>
    </div>
  );
}
