import type { Promotion } from './types';

// Extracted from POSPage.tsx's inline checkout math (subtotal/tax/discount/
// total computation) so it can actually be unit tested — this is the exact
// arithmetic that decides how much a real customer pays at checkout, and
// it had zero test coverage anywhere in the codebase before this. Every
// function here is a straight, behavior-preserving extraction of the
// formula that was already live in POSPage.tsx; nothing here changes what
// a sale actually charges.

export type CartLine = {
  quantity: number;
  unit_price: number;
  product: { tax_rate: number | string };
};

/** Sum of quantity × unit price across the cart, before tax or discounts. */
export function calcSubtotal(cart: { quantity: number; unit_price: number }[]): number {
  return cart.reduce((s, i) => s + i.quantity * i.unit_price, 0);
}

/** Sum of each line's tax (quantity × unit price × tax_rate%). */
export function calcTaxTotal(cart: CartLine[]): number {
  return cart.reduce((s, i) => s + i.quantity * i.unit_price * (Number(i.product.tax_rate) / 100), 0);
}

/**
 * A promotion's discount value against a given base amount.
 * - percent: a share of the base (e.g. 10% off).
 * - fixed: a flat amount, but never more than the base itself — a $50
 *   fixed-amount coupon on a $30 cart discounts $30, not $50 (can't take
 *   the total below zero from this promotion alone).
 */
export function calcPromotionValue(promotion: Pick<Promotion, 'type' | 'value'>, base: number): number {
  return promotion.type === 'percent' ? base * (promotion.value / 100) : Math.min(promotion.value, base);
}

/**
 * A manual (manager-approved) discount amount. Returns 0 if not approved —
 * a discount a cashier typed in but that never got manager PIN approval
 * must never silently apply.
 */
export function calcManualDiscountValue(approved: boolean, amount: number): number {
  return approved ? Math.max(0, amount || 0) : 0;
}

/** Points redeemed converted to a currency discount at the tenant's configured point value. */
export function calcLoyaltyDiscountValue(pointsRedeemed: number, pointValue: number): number {
  return pointsRedeemed * pointValue;
}

export type DiscountInputs = {
  manualDiscountValue: number;
  loyaltyDiscountEnabled: boolean;
  loyaltyDiscountValue: number;
  promotionValue: number;
};

/** Total of every discount actually in effect for this sale. */
export function calcDiscountTotal({ manualDiscountValue, loyaltyDiscountEnabled, loyaltyDiscountValue, promotionValue }: DiscountInputs): number {
  return manualDiscountValue + (loyaltyDiscountEnabled ? loyaltyDiscountValue : 0) + promotionValue;
}

/**
 * Final amount due. Clamped to never go below zero — stacked discounts
 * (manual + loyalty + a promotion) could otherwise combine to a negative
 * total, which would mean paying the customer instead of charging them.
 */
export function calcTotal(subtotal: number, taxTotal: number, discountTotal: number): number {
  return Math.max(0, subtotal + taxTotal - discountTotal);
}
