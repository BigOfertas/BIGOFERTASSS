import { supabase } from "@/integrations/supabase/client";
import { getUserFacingError } from "@/lib/user-facing-error";

export type CelebrationOrder = {
  public_number: string;
  payment_status: string;
  status: string;
  post_purchase_seen_at?: string | null;
};

type RpcError = { message: string };

type CelebrationRpcClient = {
  rpc(
    name: "claim_my_order_celebration",
    args: { p_public_number: string },
  ): Promise<{ data: string | null; error: RpcError | null }>;
};

const celebrationRpc = supabase as unknown as CelebrationRpcClient;

export function isConfirmedPurchase(order: Pick<CelebrationOrder, "payment_status" | "status">) {
  return (
    order.payment_status === "paid" &&
    ["paid", "in_production", "shipped", "delivered"].includes(order.status)
  );
}

export function hasPendingCelebration(order: CelebrationOrder) {
  return isConfirmedPurchase(order) && order.post_purchase_seen_at == null;
}

export async function claimOrderCelebration(publicNumber: string) {
  const normalizedNumber = decodeURIComponent(publicNumber).trim().toUpperCase();
  const { data, error } = await celebrationRpc.rpc("claim_my_order_celebration", {
    p_public_number: normalizedNumber,
  });

  if (error) {
    throw new Error(
      getUserFacingError(error, "Não foi possível preparar a confirmação visual do pedido."),
    );
  }

  return data === normalizedNumber;
}
