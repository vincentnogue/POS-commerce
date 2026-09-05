import { describe, it, expect } from 'vitest';
import {
  calcSubtotal,
  calcTaxTotal,
  calcPromotionValue,
  calcManualDiscountValue,
  calcLoyaltyDiscountValue,
  calcDiscountTotal,
  calcTotal,
} from '../cartMath';

// This is the exact arithmetic that decides how much a real customer pays
// at checkout (see POSPage.tsx) — it had zero test coverage anywhere in
// the codebase before this file. Edge cases here are chosen because a bug
// in any of them means either overcharging a real customer or undercharging
// (losing the merchant real money), not a cosmetic UI glitch.

describe('calcSubtotal', () => {
  it('sums quantity × unit price across lines', () => {
    expect(calcSubtotal([{ quantity: 2, unit_price: 10 }, { quantity: 1, unit_price: 5 }])).toBe(25);
  });

  it('returns 0 for an empty cart', () => {
    expect(calcSubtotal([])).toBe(0);
  });
});

describe('calcTaxTotal', () => {
  it('applies each line\'s own tax rate', () => {
    const cart = [
      { quantity: 1, unit_price: 100, product: { tax_rate: 20 } }, // 20
      { quantity: 2, unit_price: 50, product: { tax_rate: 10 } },  // 10
    ];
    expect(calcTaxTotal(cart)).toBe(30);
  });

  it('treats a 0% tax rate as no tax', () => {
    expect(calcTaxTotal([{ quantity: 3, unit_price: 10, product: { tax_rate: 0 } }])).toBe(0);
  });

  it('coerces a string tax_rate (as stored/passed around loosely elsewhere in the app)', () => {
    expect(calcTaxTotal([{ quantity: 1, unit_price: 100, product: { tax_rate: '15' } }])).toBe(15);
  });
});

describe('calcPromotionValue', () => {
  it('computes a percent discount as a share of the base', () => {
    expect(calcPromotionValue({ type: 'percent', value: 10 }, 200)).toBe(20);
  });

  it('applies a fixed discount at face value when it fits within the base', () => {
    expect(calcPromotionValue({ type: 'fixed', value: 15 }, 200)).toBe(15);
  });

  it('caps a fixed discount at the base amount — never discounts more than the sale is worth', () => {
    expect(calcPromotionValue({ type: 'fixed', value: 500 }, 30)).toBe(30);
  });

  it('a 100% percent discount takes the base to exactly 0, not negative', () => {
    expect(calcPromotionValue({ type: 'percent', value: 100 }, 75)).toBe(75);
  });
});

describe('calcManualDiscountValue', () => {
  it('returns 0 when not manager-approved, regardless of the typed amount', () => {
    expect(calcManualDiscountValue(false, 50)).toBe(0);
  });

  it('returns the amount once approved', () => {
    expect(calcManualDiscountValue(true, 50)).toBe(50);
  });

  it('clamps a negative amount to 0 even if approved', () => {
    expect(calcManualDiscountValue(true, -20)).toBe(0);
  });

  it('treats NaN/garbage input as 0', () => {
    expect(calcManualDiscountValue(true, NaN)).toBe(0);
  });
});

describe('calcLoyaltyDiscountValue', () => {
  it('multiplies points redeemed by the configured point value', () => {
    expect(calcLoyaltyDiscountValue(100, 0.01)).toBeCloseTo(1);
  });

  it('is 0 when no points are redeemed', () => {
    expect(calcLoyaltyDiscountValue(0, 0.01)).toBe(0);
  });
});

describe('calcDiscountTotal', () => {
  it('sums manual + loyalty (when enabled) + promotion', () => {
    const total = calcDiscountTotal({
      manualDiscountValue: 10,
      loyaltyDiscountEnabled: true,
      loyaltyDiscountValue: 5,
      promotionValue: 20,
    });
    expect(total).toBe(35);
  });

  it('excludes the loyalty component when the mechanism is disabled for this tenant', () => {
    const total = calcDiscountTotal({
      manualDiscountValue: 10,
      loyaltyDiscountEnabled: false,
      loyaltyDiscountValue: 5,
      promotionValue: 20,
    });
    expect(total).toBe(30);
  });
});

describe('calcTotal', () => {
  it('is subtotal + tax − discounts', () => {
    expect(calcTotal(100, 18, 20)).toBe(98);
  });

  it('never goes negative — stacked discounts cannot make the sale free money for the customer', () => {
    expect(calcTotal(50, 0, 1000)).toBe(0);
  });

  it('is exactly 0 when discounts exactly cover subtotal + tax', () => {
    expect(calcTotal(100, 10, 110)).toBe(0);
  });
});

describe('a full realistic checkout scenario', () => {
  it('computes the same total a cashier would see on the receipt', () => {
    // Cart: 2× item at $25 (20% tax), 1× item at $40 (0% tax)
    const cart = [
      { quantity: 2, unit_price: 25, product: { tax_rate: 20 } },
      { quantity: 1, unit_price: 40, product: { tax_rate: 0 } },
    ];
    const subtotal = calcSubtotal(cart); // 50 + 40 = 90
    const taxTotal = calcTaxTotal(cart); // 10 + 0 = 10
    expect(subtotal).toBe(90);
    expect(taxTotal).toBe(10);

    // 10% automatic promotion on subtotal + a manager-approved $5 discount
    const promotionValue = calcPromotionValue({ type: 'percent', value: 10 }, subtotal); // 9
    const manualDiscountValue = calcManualDiscountValue(true, 5); // 5
    const discountTotal = calcDiscountTotal({
      manualDiscountValue,
      loyaltyDiscountEnabled: false,
      loyaltyDiscountValue: 0,
      promotionValue,
    });
    expect(discountTotal).toBe(14);

    const total = calcTotal(subtotal, taxTotal, discountTotal);
    expect(total).toBe(86); // 90 + 10 - 14
  });
});
