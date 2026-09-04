import { BRAND } from "@/config/brand";
import { callSupabaseRpc } from "@/lib/supabase-rpc";

const REFERRAL_STORAGE_KEY = "store:affiliate-referral-code";
const REFERRAL_CODE_PATTERN = /^[A-Z0-9]{8,16}$/;

export function normalizeAffiliateReferralCode(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return REFERRAL_CODE_PATTERN.test(normalized) ? normalized : null;
}

function browserSessionStorage() {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function rememberAffiliateReferralCode(value: unknown) {
  const normalized = normalizeAffiliateReferralCode(value);
  if (!normalized) return null;

  browserSessionStorage()?.setItem(REFERRAL_STORAGE_KEY, normalized);
  return normalized;
}

export function captureAffiliateReferralFromSearch(search: string) {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  return rememberAffiliateReferralCode(params.get("ref"));
}

export function getPendingAffiliateReferralCode() {
  return normalizeAffiliateReferralCode(
    browserSessionStorage()?.getItem(REFERRAL_STORAGE_KEY) ?? null,
  );
}

export function clearPendingAffiliateReferralCode() {
  browserSessionStorage()?.removeItem(REFERRAL_STORAGE_KEY);
}

export function buildAffiliateRegistrationUrl(referralCode: string) {
  const normalized = normalizeAffiliateReferralCode(referralCode);
  if (!normalized) return null;

  const url = new URL("/cadastro", `${BRAND.siteUrl}/`);
  url.searchParams.set("ref", normalized);
  return url.toString();
}

export async function validateAffiliateReferralCode(referralCode: string) {
  const normalized = normalizeAffiliateReferralCode(referralCode);
  if (!normalized) return false;

  return callSupabaseRpc<boolean>("resolve_affiliate_referral_code", {
    p_code: normalized,
  });
}
