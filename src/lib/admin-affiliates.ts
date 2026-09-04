import { callSupabaseRpc } from "@/lib/supabase-rpc";

export type AffiliateAdminOverview = {
  enabled: boolean;
  rulesComplete: boolean;
  commissionRateBps: number | null;
  commissionBaseMode: "items_after_discount" | "order_total" | null;
  holdDays: number | null;
  minimumWithdrawal: number | null;
  withdrawalMethod: string | null;
  affiliatesCount: number;
  activeAffiliatesCount: number;
  referralsCount: number;
  pendingCommissionAmount: number;
  availableCommissionGrossAmount: number;
  requestedWithdrawalAmount: number;
  paidWithdrawalAmount: number;
  unreservedAvailableAmount: number;
  requestedWithdrawalsCount: number;
  refundReviewsCount: number;
};

export type AffiliateCandidateRow = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  affiliate_id: string | null;
  affiliate_status: "active" | "disabled" | null;
  referral_code: string | null;
};

export type AdminAffiliateRow = {
  affiliate_id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  referral_code: string;
  status: "active" | "disabled";
  activated_at: string;
  referred_customers_count: number;
  pending_commission_amount: number;
  available_balance: number;
  paid_withdrawal_amount: number;
};

export type AdminAffiliateReferralRow = {
  affiliate_id: string;
  affiliate_user_id: string;
  affiliate_name: string | null;
  referred_user_id: string;
  referred_name: string | null;
  referred_email: string | null;
  referred_at: string;
  orders_count: number;
  paid_orders_count: number;
  paid_sales_amount: number;
  generated_commission_amount: number;
};

export type AdminAffiliateOrderRow = {
  affiliate_id: string;
  referred_user_id: string;
  referred_name: string | null;
  order_id: string;
  public_number: string;
  order_status: string;
  payment_status: string;
  total_amount: number;
  created_at: string;
  paid_at: string | null;
  commission_id: string | null;
  commission_status: string | null;
  commission_amount: number | null;
};

export type AdminAffiliateCommissionRow = {
  commission_id: string;
  affiliate_id: string;
  affiliate_user_id: string;
  referred_user_id: string;
  order_id: string;
  order_public_number: string;
  sale_amount: number;
  commission_units: number | null;
  commission_unit_amount: number | null;
  commission_rule_source: "global" | "affiliate" | null;
  commission_amount: number;
  status: "pending" | "available" | "cancelled";
  available_at: string;
  created_at: string;
};

export type AdminAffiliateWithdrawalRow = {
  withdrawal_id: string;
  affiliate_id: string;
  affiliate_user_id: string;
  affiliate_name: string | null;
  affiliate_email: string | null;
  amount: number;
  destination_snapshot: Record<string, unknown>;
  status: "requested" | "paid" | "rejected";
  rejection_reason: string | null;
  requested_at: string;
  processed_at: string | null;
};

export type AffiliateRefundReviewRow = {
  review_id: string;
  commission_id: string;
  order_id: string;
  order_public_number: string;
  affiliate_id: string;
  affiliate_user_id: string;
  affiliate_name: string | null;
  commission_amount: number;
  review_status: "pending" | "resolved";
  created_at: string;
  resolved_at: string | null;
  resolution_note: string | null;
};

export type AffiliateProgramDraft = {
  commissionRateBps: number | null;
  commissionBaseMode: "items_after_discount" | "order_total" | null;
  holdDays: number | null;
  minimumWithdrawal: number | null;
  withdrawalMethod: string | null;
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

function normalizeOverview(value: unknown): AffiliateAdminOverview {
  const row = recordValue(value);
  const base =
    row.commissionBaseMode === "items_after_discount" || row.commissionBaseMode === "order_total"
      ? row.commissionBaseMode
      : null;

  return {
    enabled: row.enabled === true,
    rulesComplete: row.rulesComplete === true,
    commissionRateBps: nullableNumber(row.commissionRateBps),
    commissionBaseMode: base,
    holdDays: nullableNumber(row.holdDays),
    minimumWithdrawal: nullableNumber(row.minimumWithdrawal),
    withdrawalMethod: text(row.withdrawalMethod),
    affiliatesCount: numberValue(row.affiliatesCount),
    activeAffiliatesCount: numberValue(row.activeAffiliatesCount),
    referralsCount: numberValue(row.referralsCount),
    pendingCommissionAmount: numberValue(row.pendingCommissionAmount),
    availableCommissionGrossAmount: numberValue(row.availableCommissionGrossAmount),
    requestedWithdrawalAmount: numberValue(row.requestedWithdrawalAmount),
    paidWithdrawalAmount: numberValue(row.paidWithdrawalAmount),
    unreservedAvailableAmount: numberValue(row.unreservedAvailableAmount),
    requestedWithdrawalsCount: numberValue(row.requestedWithdrawalsCount),
    refundReviewsCount: numberValue(row.refundReviewsCount),
  };
}

export async function fetchAffiliateAdminOverview() {
  return normalizeOverview(
    await callSupabaseRpc<unknown>("owner_get_affiliate_overview"),
  );
}

export function listAffiliateCandidates(search = "") {
  return callSupabaseRpc<AffiliateCandidateRow[]>("owner_list_affiliate_candidates", {
    p_search: search.trim() || null,
    p_limit: 100,
    p_offset: 0,
  });
}

export function listAdminAffiliates(search = "") {
  return callSupabaseRpc<AdminAffiliateRow[]>("owner_list_affiliates", {
    p_search: search.trim() || null,
    p_status: null,
    p_limit: 100,
    p_offset: 0,
  });
}

export function listAdminAffiliateReferrals() {
  return callSupabaseRpc<AdminAffiliateReferralRow[]>("owner_list_affiliate_referrals", {
    p_affiliate_id: null,
    p_limit: 100,
    p_offset: 0,
  });
}

export function listAdminAffiliateOrders() {
  return callSupabaseRpc<AdminAffiliateOrderRow[]>("owner_list_affiliate_referred_orders", {
    p_affiliate_id: null,
    p_referred_user_id: null,
    p_limit: 100,
    p_offset: 0,
  });
}

export function listAdminAffiliateCommissions() {
  return callSupabaseRpc<AdminAffiliateCommissionRow[]>("owner_list_affiliate_commissions", {
    p_affiliate_id: null,
    p_status: null,
    p_limit: 100,
    p_offset: 0,
  });
}

export function listAdminAffiliateWithdrawals() {
  return callSupabaseRpc<AdminAffiliateWithdrawalRow[]>("owner_list_affiliate_withdrawals", {
    p_status: null,
    p_limit: 100,
    p_offset: 0,
  });
}

export function listAffiliateRefundReviews() {
  return callSupabaseRpc<AffiliateRefundReviewRow[]>("owner_list_affiliate_refund_reviews", {
    p_status: null,
    p_limit: 100,
    p_offset: 0,
  });
}

export function saveAffiliateProgramDraft(draft: AffiliateProgramDraft) {
  return callSupabaseRpc<unknown>("owner_save_affiliate_program_draft", {
    p_commission_rate_bps: draft.commissionRateBps,
    p_commission_base_mode: draft.commissionBaseMode,
    p_hold_days: draft.holdDays,
    p_minimum_withdrawal: draft.minimumWithdrawal,
    p_withdrawal_method: draft.withdrawalMethod,
  });
}

export function configureAffiliateProgram(
  enabled: boolean,
  draft: Required<AffiliateProgramDraft>,
) {
  return callSupabaseRpc<unknown>("owner_configure_affiliate_program", {
    p_enabled: enabled,
    p_commission_rate_bps: draft.commissionRateBps,
    p_commission_base_mode: draft.commissionBaseMode,
    p_hold_days: draft.holdDays,
    p_minimum_withdrawal: draft.minimumWithdrawal,
    p_withdrawal_method: draft.withdrawalMethod,
  });
}

export function activateAffiliate(userId: string) {
  return callSupabaseRpc<unknown>("owner_activate_affiliate", {
    p_user_id: userId,
  });
}

export function disableAffiliate(userId: string) {
  return callSupabaseRpc<unknown>("owner_disable_affiliate", {
    p_user_id: userId,
  });
}

export function markAffiliateWithdrawalPaid(withdrawalId: string) {
  return callSupabaseRpc<unknown>("owner_mark_affiliate_withdrawal_paid", {
    p_withdrawal_id: withdrawalId,
  });
}

export function rejectAffiliateWithdrawal(withdrawalId: string, reason: string) {
  return callSupabaseRpc<unknown>("owner_reject_affiliate_withdrawal", {
    p_withdrawal_id: withdrawalId,
    p_reason: reason.trim(),
  });
}

export function resolveAffiliateRefundReview(reviewId: string, note: string) {
  return callSupabaseRpc<unknown>("owner_resolve_affiliate_refund_review", {
    p_review_id: reviewId,
    p_note: note.trim(),
  });
}


export type AffiliateCommissionTier = {
  minUnits: number;
  amountPerUnit: number;
  source?: "global" | "affiliate";
};

export type AffiliateFixedSettings = {
  enabled: boolean;
  rulesComplete: boolean;
  commissionTiers: AffiliateCommissionTier[];
  holdDays: number | null;
  minimumWithdrawal: number | null;
  withdrawalMethod: string | null;
};

export type AffiliateCommissionRules = {
  affiliateId: string;
  globalTiers: AffiliateCommissionTier[];
  overrides: AffiliateCommissionTier[];
  effectiveTiers: AffiliateCommissionTier[];
};

function normalizeTier(value: unknown): AffiliateCommissionTier | null {
  const row = recordValue(value);
  const minUnits = numberValue(row.minUnits);
  const amountPerUnit = numberValue(row.amountPerUnit);
  if (![1, 5, 8, 15, 25, 35].includes(minUnits) || amountPerUnit <= 0) return null;
  return {
    minUnits,
    amountPerUnit,
    source: row.source === "affiliate" ? "affiliate" : row.source === "global" ? "global" : undefined,
  };
}

function normalizeTiers(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const tier = normalizeTier(item);
    return tier ? [tier] : [];
  }).sort((a, b) => a.minUnits - b.minUnits);
}

export async function fetchAffiliateFixedSettings(): Promise<AffiliateFixedSettings> {
  const row = recordValue(await callSupabaseRpc<unknown>("owner_get_affiliate_fixed_settings"));
  return {
    enabled: row.enabled === true,
    rulesComplete: row.rulesComplete === true,
    commissionTiers: normalizeTiers(row.commissionTiers),
    holdDays: nullableNumber(row.holdDays),
    minimumWithdrawal: nullableNumber(row.minimumWithdrawal),
    withdrawalMethod: text(row.withdrawalMethod),
  };
}

export function saveAffiliateFixedSettings(settings: AffiliateFixedSettings) {
  return callSupabaseRpc<unknown>("owner_save_affiliate_fixed_settings", {
    p_enabled: settings.enabled,
    p_commission_tiers: settings.commissionTiers.map(({ minUnits, amountPerUnit }) => ({ minUnits, amountPerUnit })),
    p_hold_days: settings.holdDays,
    p_minimum_withdrawal: settings.minimumWithdrawal,
    p_withdrawal_method: settings.withdrawalMethod,
  });
}

export async function fetchAffiliateCommissionRules(affiliateId: string): Promise<AffiliateCommissionRules> {
  const row = recordValue(await callSupabaseRpc<unknown>("owner_get_affiliate_commission_rules", {
    p_affiliate_id: affiliateId,
  }));
  return {
    affiliateId: text(row.affiliateId) ?? affiliateId,
    globalTiers: normalizeTiers(row.globalTiers),
    overrides: normalizeTiers(row.overrides),
    effectiveTiers: normalizeTiers(row.effectiveTiers),
  };
}

export function saveAffiliateCommissionOverrides(affiliateId: string, overrides: AffiliateCommissionTier[]) {
  return callSupabaseRpc<unknown>("owner_save_affiliate_commission_overrides", {
    p_affiliate_id: affiliateId,
    p_overrides: overrides.map(({ minUnits, amountPerUnit }) => ({ minUnits, amountPerUnit })),
  });
}
