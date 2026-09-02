export const PROGRESSIVE_DISCOUNT_TIERS = [
  { minimumUnits: 45, percent: 35, freeShipping: true },
  { minimumUnits: 30, percent: 20, freeShipping: false },
  { minimumUnits: 15, percent: 15, freeShipping: false },
  { minimumUnits: 10, percent: 10, freeShipping: false },
  { minimumUnits: 5, percent: 5, freeShipping: false },
] as const;

export type ProgressiveDiscount = {
  units: number;
  percent: number;
  rate: number;
  discountAmount: number;
  subtotalAfterDiscount: number;
  freeShipping: boolean;
  nextTier: {
    minimumUnits: number;
    percent: number;
    freeShipping: boolean;
    unitsRemaining: number;
  } | null;
};

export function getProgressiveDiscount(
  units: number,
  subtotal: number,
): ProgressiveDiscount {
  const normalizedUnits = Number.isFinite(units) ? Math.max(0, Math.trunc(units)) : 0;
  const normalizedSubtotal = Number.isFinite(subtotal) ? Math.max(0, subtotal) : 0;

  const activeTier = PROGRESSIVE_DISCOUNT_TIERS.find(
    (tier) => normalizedUnits >= tier.minimumUnits,
  );
  const percent = activeTier?.percent ?? 0;
  const rate = percent / 100;
  const discountAmount = Number((normalizedSubtotal * rate).toFixed(2));

  const ascendingTiers = [...PROGRESSIVE_DISCOUNT_TIERS].reverse();
  const next = ascendingTiers.find((tier) => normalizedUnits < tier.minimumUnits) ?? null;

  return {
    units: normalizedUnits,
    percent,
    rate,
    discountAmount,
    subtotalAfterDiscount: Number((normalizedSubtotal - discountAmount).toFixed(2)),
    freeShipping: activeTier?.freeShipping ?? false,
    nextTier: next
      ? {
          minimumUnits: next.minimumUnits,
          percent: next.percent,
          freeShipping: next.freeShipping,
          unitsRemaining: next.minimumUnits - normalizedUnits,
        }
      : null,
  };
}
