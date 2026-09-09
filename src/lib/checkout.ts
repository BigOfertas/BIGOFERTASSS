import { supabase } from "@/integrations/supabase/client";
import { legacyWorkerFallbackAvailable } from "@/lib/backend-routing";
import type { CartItem } from "@/lib/cart";

export const LAST_CHECKOUT_STORAGE_KEY = "bigofertas:last-checkout:v1";

export type CheckoutStartResult = {
  checkoutUrl: string;
  orderId: string;
  orderNumber: string;
  totalAmount: number;
};

export type LastCheckoutSnapshot = Pick<
  CheckoutStartResult,
  "orderId" | "orderNumber" | "totalAmount"
> & {
  createdAt: string;
};

type CheckoutErrorPayload = {
  error?: unknown;
  code?: unknown;
};

function edgeCheckoutUrl() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
  return supabaseUrl ? `${supabaseUrl.replace(/\/$/, "")}/functions/v1/checkout-start` : null;
}

async function postCheckout(url: string, accessToken: string, body: string) {
  return fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      accept: "application/json",
      "content-type": "application/json",
    },
    body,
  });
}

async function checkoutResponse(accessToken: string, body: string) {
  const edgeUrl = edgeCheckoutUrl();

  if (edgeUrl) {
    try {
      const edgeResponse = await postCheckout(edgeUrl, accessToken, body);

      // No domínio final não existe servidor /api na Hostinger.
      // O endpoint antigo só fica disponível no staging/localhost durante a migração.
      if (
        !legacyWorkerFallbackAvailable() ||
        (edgeResponse.status !== 404 && edgeResponse.status !== 503)
      ) {
        return edgeResponse;
      }
    } catch (error) {
      if (!legacyWorkerFallbackAvailable()) throw error;
    }
  }

  if (legacyWorkerFallbackAvailable()) {
    return postCheckout("/api/checkout/start", accessToken, body);
  }

  throw new Error("Não foi possível iniciar o pagamento agora.");
}

export function readLastCheckoutSnapshot(): LastCheckoutSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(LAST_CHECKOUT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LastCheckoutSnapshot>;
    if (
      typeof parsed.orderId !== "string" ||
      typeof parsed.orderNumber !== "string" ||
      typeof parsed.totalAmount !== "number" ||
      typeof parsed.createdAt !== "string"
    ) {
      return null;
    }
    return parsed as LastCheckoutSnapshot;
  } catch {
    return null;
  }
}

export function clearLastCheckoutSnapshot() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(LAST_CHECKOUT_STORAGE_KEY);
}

function storeLastCheckoutSnapshot(result: CheckoutStartResult) {
  if (typeof window === "undefined") return;
  const snapshot: LastCheckoutSnapshot = {
    orderId: result.orderId,
    orderNumber: result.orderNumber,
    totalAmount: result.totalAmount,
    createdAt: new Date().toISOString(),
  };
  window.sessionStorage.setItem(LAST_CHECKOUT_STORAGE_KEY, JSON.stringify(snapshot));
}

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
      customization: item.customization,
    };
  });

  const requestBody = JSON.stringify({
    addressId: input.addressId,
    shippingServiceId: input.shippingServiceId,
    idempotencyKey: input.idempotencyKey,
    items,
  });

  const response = await checkoutResponse(data.session.access_token, requestBody);

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

  storeLastCheckoutSnapshot(payload);
  return payload;
}
