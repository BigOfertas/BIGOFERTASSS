import { fetchAdminCatalog } from "@/lib/admin-products";
import {
  fetchAdminOrders,
  type AdminOrderRow,
  type OrderDisplayStatus,
} from "@/lib/orders";

export type AdminDashboardStatusMetric = {
  status: OrderDisplayStatus;
  label: string;
  total: number;
};

export type AdminDashboardSnapshot = {
  totalOrders: number;
  pendingPayment: number;
  paid: number;
  inProduction: number;
  shipped: number;
  delivered: number;
  refundRequested: number;
  refunded: number;
  activeProducts: number;
  draftProducts: number;
  recentOrders: AdminOrderRow[];
  statusMetrics: AdminDashboardStatusMetric[];
};

async function fetchStatusTotal(status: string) {
  const result = await fetchAdminOrders({
    search: "",
    status,
    sort: "newest",
    page: 1,
    pageSize: 1,
  });

  return result.total;
}

export async function fetchAdminDashboardSnapshot(): Promise<AdminDashboardSnapshot> {
  const [
    recent,
    pendingPayment,
    paid,
    inProduction,
    shipped,
    delivered,
    refundRequested,
    refunded,
    catalog,
  ] = await Promise.all([
    fetchAdminOrders({
      search: "",
      status: "all",
      sort: "newest",
      page: 1,
      pageSize: 6,
    }),
    fetchStatusTotal("pending_payment"),
    fetchStatusTotal("paid"),
    fetchStatusTotal("in_production"),
    fetchStatusTotal("shipped"),
    fetchStatusTotal("delivered"),
    fetchStatusTotal("refund_requested"),
    fetchStatusTotal("refunded"),
    fetchAdminCatalog(),
  ]);

  const activeProducts = catalog.products.filter(
    (product) => product.status === "active",
  ).length;
  const draftProducts = catalog.products.filter(
    (product) => product.status === "draft",
  ).length;

  return {
    totalOrders: recent.total,
    pendingPayment,
    paid,
    inProduction,
    shipped,
    delivered,
    refundRequested,
    refunded,
    activeProducts,
    draftProducts,
    recentOrders: recent.rows,
    statusMetrics: [
      { status: "pending_payment", label: "Aguardando", total: pendingPayment },
      { status: "paid", label: "Pagos", total: paid },
      { status: "in_production", label: "Produção", total: inProduction },
      { status: "shipped", label: "Enviados", total: shipped },
      { status: "delivered", label: "Entregues", total: delivered },
      {
        status: "refund_requested",
        label: "Reembolso",
        total: refundRequested,
      },
    ],
  };
}
