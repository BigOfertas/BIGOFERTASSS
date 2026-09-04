import { callSupabaseRpc } from "@/lib/supabase-rpc";

export type AffiliateDashboard = {
  isAffiliate: boolean;
  programEnabled: boolean;
  rulesComplete: boolean;
  status: "active" | "disabled" | null;
  referralCode: string | null;
  commissionRateBps: number | null;
  commissionBaseMode: "items_after_discount" | "order_total" | null;
  holdDays: number | null;
  minimumWithdrawal: number | null;
  withdrawalMethod: string | null;
  referralsCount: number;
  pendingAmount: number;
  availableAmount: number;
  requestedWithdrawalAmount: number;
  paidWithdrawalAmount: number;
};

export type AffiliateReferralRow = {
  referred_at: string;
  display_name: string;
  masked_email: string;
  commissions_count: number;
  generated_commission_amount: number;
};

export type AffiliateCommissionRow = {
  id: string;
  affiliate_id: string;
  referred_user_id: string;
  order_id: string;
  order_public_number: string;
  sale_amount: number;
  commission_base_amount: number;
  commission_rate_bps: number;
  commission_amount: number;
  status: "pending" | "available" | "cancelled";
  available_at: string;
  available_since: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  created_at: string;
};

export type AffiliateWithdrawalRow = {
  id: string;
  affiliate_id: string;
  amount: number;
  destination_snapshot: Record<string, unknown>;
  status: "requested" | "paid" | "rejected";
  rejection_reason: string | null;
  requested_at: string;
  processed_at: string | null;
};

function recordValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown) {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function nullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeDashboard(value: unknown): AffiliateDashboard {
  const row = recordValue(value);
  const status = row.status === "active" || row.status === "disabled" ? row.status : null;
  const base =
    row.commissionBaseMode === "items_after_discount" || row.commissionBaseMode === "order_total"
      ? row.commissionBaseMode
      : null;

  return {
    isAffiliate: row.isAffiliate === true,
    programEnabled: row.programEnabled === true,
    rulesComplete: row.rulesComplete === true,
    status,
    referralCode: text(row.referralCode),
    commissionRateBps: nullableNumber(row.commissionRateBps),
    commissionBaseMode: base,
    holdDays: nullableNumber(row.holdDays),
    minimumWithdrawal: nullableNumber(row.minimumWithdrawal),
    withdrawalMethod: text(row.withdrawalMethod),
    referralsCount: numberValue(row.referralsCount),
    pendingAmount: numberValue(row.pendingAmount),
    availableAmount: numberValue(row.availableAmount),
    requestedWithdrawalAmount: numberValue(row.requestedWithdrawalAmount),
    paidWithdrawalAmount: numberValue(row.paidWithdrawalAmount),
  };
}

export async function fetchMyAffiliateDashboard() {
  return normalizeDashboard(
    await callSupabaseRpc<unknown>("get_my_affiliate_dashboard"),
  );
}

export async function fetchMyAffiliateReferrals() {
  return callSupabaseRpc<AffiliateReferralRow[]>("list_my_affiliate_referrals", {
    p_limit: 100,
    p_offset: 0,
  });
}

export async function fetchMyAffiliateCommissions() {
  return callSupabaseRpc<AffiliateCommissionRow[]>("list_my_affiliate_commissions", {
    p_limit: 100,
    p_offset: 0,
  });
}

export async function fetchMyAffiliateWithdrawals() {
  return callSupabaseRpc<AffiliateWithdrawalRow[]>("list_my_affiliate_withdrawals", {
    p_limit: 100,
    p_offset: 0,
  });
}
