import { supabase } from "@/integrations/supabase/client";
import type { CartItem } from "@/lib/cart";

export type CheckoutStartResult = {
  checkoutUrl: string;
  orderId: string;
  orderNumber: string;
  totalAmount: number;
};

type CheckoutErrorPayload = {
  error?: unknown;
  code?: unknown;
};

export async function startInfinitePayCheckout(input: {
  addressId: string;
  shippingServiceId: number;
  idempotencyKey: string;
  cart: CartItem[];
}): Promise<CheckoutStartResult> {
  const { data, error } = await supabase.auth.getSession();

  if (error || !data.session?.access_token) {
    throw new Error("Entre na sua conta para finalizar a compra.");
  }

  const items = input.cart.map((item) => {
    if (!item.variantId) {
      throw new Error("Revise as opções dos produtos antes de continuar.");
    }

    return {
      productId: item.productId,
      variantId: item.variantId,
      quantity: item.quantity,
    };
  });

  const response = await fetch("/api/checkout/start", {
    method: "POST",
    headers: {
      authorization: `Bearer ${data.session.access_token}`,
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      addressId: input.addressId,
      shippingServiceId: input.shippingServiceId,
      idempotencyKey: input.idempotencyKey,
      items,
    }),
  });

  let payload: (CheckoutStartResult & CheckoutErrorPayload) | null = null;
  try {
    payload = (await response.json()) as CheckoutStartResult & CheckoutErrorPayload;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(
      payload && typeof payload.error === "string"
        ? payload.error
        : "Não foi possível iniciar o pagamento agora.",
    );
  }

  if (
    !payload ||
    typeof payload.checkoutUrl !== "string" ||
    typeof payload.orderId !== "string" ||
    typeof payload.orderNumber !== "string" ||
    typeof payload.totalAmount !== "number"
  ) {
    throw new Error("A resposta do pagamento foi inválida. Tente novamente.");
  }

  let checkoutUrl: URL;
  try {
    checkoutUrl = new URL(payload.checkoutUrl);
  } catch {
    throw new Error("O link de pagamento retornado é inválido.");
  }

  if (checkoutUrl.protocol !== "https:") {
    throw new Error("O link de pagamento retornado é inválido.");
  }

  return payload;
}
