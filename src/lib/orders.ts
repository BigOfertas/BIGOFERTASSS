import type { Json, Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { buildR2PublicImageUrl } from "@/lib/product-images";

export type Order = Tables<"orders">;
export type OrderItem = Tables<"order_items">;
export type OrderTimelineEntry = Tables<"order_timeline">;
export type RefundRequest = Tables<"refund_requests">;

export type RefundReason =
  "arrependimento" | "tamanho" | "produto" | "entrega" | "outro";

export type OrderDisplayStatus =
  Order["status"] | "refund_requested" | "refund_canceled";

export type OrderSummary = {
  order: Order;
  items: OrderItem[];
  refundRequest: RefundRequest | null;
};

export type OrderDetail = OrderSummary & {
  timeline: OrderTimelineEntry[];
};

export type AdminOrderRow = {
  id: string;
  public_number: string;
  status: Order["status"];
  payment_status: Order["payment_status"];
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  total_amount: number;
  currency: string;
  item_count: number;
  refund_request_id: string | null;
  refund_status: RefundRequest["status"] | null;
  refund_reason: string | null;
  refund_created_at: string | null;
  created_at: string;
  total_count: number;
};

export type AdminOrderFilters = {
  search: string;
  status: string;
  sort: "newest" | "oldest" | "total_desc" | "total_asc";
  page: number;
  pageSize?: number;
};

type RpcError = { message: string };

type OrderRpcClient = {
  rpc(
    name: "request_my_order_refund",
    args: { p_order_id: string; p_reason: string; p_message: string | null },
  ): Promise<{ data: RefundRequest | null; error: RpcError | null }>;
  rpc(
    name: "owner_transition_order",
    args: {
      p_order_id: string;
      p_new_status: Order["status"];
      p_note: string | null;
      p_tracking_code: string | null;
    },
  ): Promise<{ data: Order | null; error: RpcError | null }>;
  rpc(
    name: "owner_resolve_refund_request",
    args: {
      p_request_id: string;
      p_resolution: "refunded" | "canceled";
      p_note: string | null;
    },
  ): Promise<{ data: RefundRequest | null; error: RpcError | null }>;
  rpc(
    name: "admin_list_orders",
    args: {
      p_search: string | null;
      p_status: string;
      p_sort: AdminOrderFilters["sort"];
      p_page: number;
      p_page_size: number;
    },
  ): Promise<{ data: AdminOrderRow[] | null; error: RpcError | null }>;
};

const orderRpc = supabase as unknown as OrderRpcClient;

export const REFUND_REASON_LABELS: Record<RefundReason, string> = {
  arrependimento: "Mudei de ideia",
  tamanho: "Tamanho ou ajuste",
  produto: "Problema com o produto",
  entrega: "Problema com a entrega",
  outro: "Outro motivo",
};

function throwIfError(error: RpcError | null, fallback: string) {
  if (error) throw new Error(error.message || fallback);
}

export function getOrderDisplayStatus(
  order: Pick<Order, "status">,
  refundRequest: Pick<RefundRequest, "status"> | null,
): OrderDisplayStatus {
  if (refundRequest?.status === "requested") return "refund_requested";
  if (refundRequest?.status === "canceled") return "refund_canceled";
  return order.status;
}

export function canRequestRefund(summary: OrderSummary) {
  return (
    !summary.refundRequest &&
    ["paid", "in_production", "shipped", "delivered"].includes(
      summary.order.status,
    )
  );
}

export function getOrderItemImageUrl(item: OrderItem) {
  return (
    (item.image_storage_key
      ? buildR2PublicImageUrl(item.image_storage_key)
      : null) ?? item.image_url
  );
}

export function parseSelectedOptions(value: Json) {
  if (!Array.isArray(value)) return [];

  return value.flatMap((option) => {
    if (!option || typeof option !== "object" || Array.isArray(option))
      return [];
    const optionName = option["option_name"];
    const valueLabel = option["value_label"];

    if (typeof optionName !== "string" || typeof valueLabel !== "string") {
      return [];
    }

    return [{ optionName, valueLabel }];
  });
}

async function fetchOrderRelations(orderIds: string[]) {
  if (orderIds.length === 0) {
    return { items: [] as OrderItem[], refunds: [] as RefundRequest[] };
  }

  const [itemsResult, refundsResult] = await Promise.all([
    supabase
      .from("order_items")
      .select("*")
      .in("order_id", orderIds)
      .order("created_at", { ascending: true }),
    supabase
      .from("refund_requests")
      .select("*")
      .in("order_id", orderIds)
      .order("created_at", { ascending: false }),
  ]);

  if (itemsResult.error) throw itemsResult.error;
  if (refundsResult.error) throw refundsResult.error;

  return {
    items: itemsResult.data ?? [],
    refunds: refundsResult.data ?? [],
  };
}

export async function fetchMyOrders(): Promise<OrderSummary[]> {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw error;

  const orders = data ?? [];
  const relations = await fetchOrderRelations(orders.map((order) => order.id));
  const itemsByOrder = new Map<string, OrderItem[]>();
  const refundByOrder = new Map<string, RefundRequest>();

  for (const item of relations.items) {
    const current = itemsByOrder.get(item.order_id) ?? [];
    current.push(item);
    itemsByOrder.set(item.order_id, current);
  }

  for (const refund of relations.refunds) {
    if (!refundByOrder.has(refund.order_id)) {
      refundByOrder.set(refund.order_id, refund);
    }
  }

  return orders.map((order) => ({
    order,
    items: itemsByOrder.get(order.id) ?? [],
    refundRequest: refundByOrder.get(order.id) ?? null,
  }));
}

export async function fetchOrderDetail(
  publicNumber: string,
): Promise<OrderDetail | null> {
  const normalizedNumber = decodeURIComponent(publicNumber)
    .trim()
    .toUpperCase();
  const { data: order, error } = await supabase
    .from("orders")
    .select("*")
    .eq("public_number", normalizedNumber)
    .maybeSingle();

  if (error) throw error;
  if (!order) return null;

  const [relations, timelineResult] = await Promise.all([
    fetchOrderRelations([order.id]),
    supabase
      .from("order_timeline")
      .select("*")
      .eq("order_id", order.id)
      .order("created_at", { ascending: true }),
  ]);

  if (timelineResult.error) throw timelineResult.error;

  return {
    order,
    items: relations.items,
    refundRequest: relations.refunds[0] ?? null,
    timeline: timelineResult.data ?? [],
  };
}

export async function requestOrderRefund(
  orderId: string,
  reason: RefundReason,
  message: string,
) {
  const result = await orderRpc.rpc("request_my_order_refund", {
    p_order_id: orderId,
    p_reason: reason,
    p_message: message.trim() || null,
  });

  throwIfError(result.error, "Não foi possível solicitar o reembolso.");
  if (!result.data) throw new Error("A solicitação não foi confirmada.");
  return result.data;
}

export async function fetchAdminOrders(filters: AdminOrderFilters) {
  const pageSize = filters.pageSize ?? 20;
  const result = await orderRpc.rpc("admin_list_orders", {
    p_search: filters.search.trim() || null,
    p_status: filters.status,
    p_sort: filters.sort,
    p_page: Math.max(1, filters.page),
    p_page_size: pageSize,
  });

  throwIfError(result.error, "Não foi possível carregar os pedidos.");
  const rows = result.data ?? [];

  return {
    rows,
    total: rows[0]?.total_count ?? 0,
    pageSize,
  };
}

export async function transitionOrder(
  orderId: string,
  status: Order["status"],
  trackingCode = "",
  note = "",
) {
  const result = await orderRpc.rpc("owner_transition_order", {
    p_order_id: orderId,
    p_new_status: status,
    p_note: note.trim() || null,
    p_tracking_code: trackingCode.trim() || null,
  });

  throwIfError(result.error, "Não foi possível atualizar o pedido.");
  if (!result.data) throw new Error("A atualização não foi confirmada.");
  return result.data;
}

export async function resolveRefundRequest(
  requestId: string,
  resolution: "refunded" | "canceled",
  note = "",
) {
  const result = await orderRpc.rpc("owner_resolve_refund_request", {
    p_request_id: requestId,
    p_resolution: resolution,
    p_note: note.trim() || null,
  });

  throwIfError(result.error, "Não foi possível resolver o reembolso.");
  if (!result.data) throw new Error("A resolução não foi confirmada.");
  return result.data;
}
