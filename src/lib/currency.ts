/**
 * CURRENCY CONVERSION LIBRARY
 * Secure, real-time currency conversion with caching
 */
import { supabase } from './supabase';

export interface ExchangeRate {
  USD: number; // Base is always 1 USD
  [key: string]: number;
}

export interface ConvertedPrice {
  usd: number;
  currency: string;
  amount: number;
  formatted: string;
  rate: number;
}

// Currency symbols and formatting
const CURRENCY_CONFIG: Record<string, { symbol: string; position: 'prefix' | 'suffix' }> = {
  USD: { symbol: '$', position: 'prefix' },
  EUR: { symbol: '€', position: 'prefix' },
  GBP: { symbol: '£', position: 'prefix' },
  AED: { symbol: 'د.إ', position: 'suffix' },
  CAD: { symbol: 'C$', position: 'prefix' },
  AUD: { symbol: 'A$', position: 'prefix' },
  JPY: { symbol: '¥', position: 'prefix' },
  CNY: { symbol: '¥', position: 'prefix' },
  INR: { symbol: '₹', position: 'prefix' },
  ZAR: { symbol: 'R', position: 'prefix' },
  EGP: { symbol: 'E£', position: 'prefix' },
  NGN: { symbol: '₦', position: 'prefix' },
  KES: { symbol: 'KSh', position: 'prefix' },
  GHS: { symbol: 'GH₵', position: 'prefix' },
  BRL: { symbol: 'R$', position: 'prefix' },
  MXN: { symbol: '$', position: 'prefix' },
  SGD: { symbol: 'S$', position: 'prefix' },
  HKD: { symbol: 'HK$', position: 'prefix' },
  NZD: { symbol: 'NZ$', position: 'prefix' },
  XOF: { symbol: 'CFA', position: 'suffix' },
  XAF: { symbol: 'FCFA', position: 'suffix' },
  MAD: { symbol: 'DH', position: 'suffix' },
  TND: { symbol: 'DT', position: 'suffix' },
  DZD: { symbol: 'DA', position: 'suffix' },
  RWF: { symbol: 'FRw', position: 'suffix' },
  UGX: { symbol: 'USh', position: 'suffix' },
  TZS: { symbol: 'TSh', position: 'suffix' },
  ETB: { symbol: 'Br', position: 'suffix' },
  SAR: { symbol: 'SR', position: 'suffix' },
  QAR: { symbol: 'QR', position: 'suffix' },
};

// Local storage cache key
const CACHE_KEY = 'exchange_rates_cache';
const CACHE_EXPIRY_MS = 1000 * 60 * 60; // 1 hour

interface CachedRates {
  rates: ExchangeRate;
  timestamp: number;
  live: boolean;
  updatedAt?: string;
}

// Module-level status of the most recent fetch, so callers (the pricing
// page's currency matrix) can tell the user whether they're looking at real
// live rates or the offline fallback, instead of silently pretending
// hardcoded numbers are current.
export type RatesStatus = { live: boolean; updatedAt: string | null; error: string | null };
let lastStatus: RatesStatus = { live: false, updatedAt: null, error: null };

export function getRatesStatus(): RatesStatus {
  return lastStatus;
}

/**
 * Get cached exchange rates or fetch new ones if expired
 */
export async function getExchangeRates(): Promise<ExchangeRate> {
  const cached = getCachedRates();

  if (cached && !isExpired(cached.timestamp)) {
    lastStatus = { live: cached.live, updatedAt: cached.updatedAt ?? null, error: null };
    return cached.rates;
  }

  // Fetch real live rates via the exchange-rates Supabase Edge Function
  const { rates, live, updatedAt, error } = await fetchExchangeRates();
  lastStatus = { live, updatedAt: updatedAt ?? null, error };

  // Cache locally
  localStorage.setItem(
    CACHE_KEY,
    JSON.stringify({
      rates,
      timestamp: Date.now(),
      live,
      updatedAt,
    })
  );

  return rates;
}

/**
 * Get cached rates from localStorage
 */
function getCachedRates(): CachedRates | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    return JSON.parse(cached);
  } catch {
    return null;
  }
}

/**
 * Check if cache is expired
 */
function isExpired(timestamp: number): boolean {
  return Date.now() - timestamp > CACHE_EXPIRY_MS;
}

/**
 * Fetch real, live exchange rates from the exchange-rates Supabase Edge
 * Function (see supabase/functions/exchange-rates). That function calls a
 * free keyless provider (open.er-api.com) and returns real, current rates
 * against USD, updated at least daily.
 *
 * BUG FIX: this used to call `fetch('/api/exchange-rates')`, a route that
 * was never implemented anywhere (the app is static Cloudflare Pages, no
 * matching Pages Function). Every call failed and silently fell back to
 * hardcoded numbers, so "real-time conversion" was never actually real-time.
 */
async function fetchExchangeRates(): Promise<{
  rates: ExchangeRate;
  live: boolean;
  updatedAt?: string;
  error: string | null;
}> {
  try {
    const { data, error } = await supabase.functions.invoke('exchange-rates');
    if (error) throw error;
    if (!data?.rates) throw new Error('Exchange rate function returned no rates');

    return {
      rates: { USD: 1, ...data.rates } as ExchangeRate,
      live: true,
      updatedAt: data.updatedAt,
      error: null,
    };
  } catch (error) {
    console.error('Exchange rate fetch error:', error);
    // Offline / function-unavailable fallback so the UI can still render —
    // callers are told via `live: false` that these are not current rates.
    return {
      rates: getFallbackRates(),
      live: false,
      error: error instanceof Error ? error.message : 'Unknown error fetching live rates',
    };
  }
}

/**
 * Fallback rates for offline use
 * These are approximate rates for user experience
 */
function getFallbackRates(): ExchangeRate {
  return {
    USD: 1.0,
    EUR: 0.92,
    GBP: 0.79,
    AED: 3.67,
    CAD: 1.36,
    AUD: 1.53,
    JPY: 149.5,
    CNY: 7.24,
    INR: 83.12,
    ZAR: 18.65,
    EGP: 30.9,
    NGN: 1528.0,
    KES: 130.5,
    GHS: 13.2,
    BRL: 4.97,
    MXN: 17.05,
    SGD: 1.35,
    HKD: 7.81,
    NZD: 1.62,
    XOF: 605.0,
    XAF: 605.0,
    MAD: 9.98,
    TND: 3.1,
    DZD: 134.5,
    RWF: 1330.0,
    UGX: 3720.0,
    TZS: 2500.0,
    ETB: 123.0,
    SAR: 3.75,
    QAR: 3.64,
  };
}

/**
 * Convert USD price to another currency
 */
export async function convertPrice(
  usdAmount: number,
  currency: string
): Promise<ConvertedPrice> {
  // Handle USD base case
  if (currency === 'USD') {
    return {
      usd: usdAmount,
      currency: 'USD',
      amount: usdAmount,
      formatted: formatPrice(usdAmount, 'USD'),
      rate: 1.0,
    };
  }

  const rates = await getExchangeRates();
  const rate = rates[currency] || 1.0;
  const converted = usdAmount * rate;

  return {
    usd: usdAmount,
    currency,
    amount: converted,
    formatted: formatPrice(converted, currency),
    rate,
  };
}

/**
 * Format price with currency symbol and proper decimal places
 */
export function formatPrice(amount: number, currency: string): string {
  const config = CURRENCY_CONFIG[currency] || {
    symbol: currency,
    position: 'prefix' as const,
  };

  // Determine decimal places (JPY and some others use 0)
  const decimals = ['JPY', 'CNY', 'KRW'].includes(currency) ? 0 : 2;
  const formatted = amount.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  if (config.position === 'prefix') {
    return `${config.symbol}${formatted}`;
  } else {
    return `${formatted} ${config.symbol}`;
  }
}

/**
 * Get user's likely currency from geolocation
 */
export async function getUserCurrency(): Promise<string> {
  try {
    // Try to get from browser's locale
    const locale = navigator.language;
    if (locale) {
      const currency = new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: 'USD',
      })
        .resolvedOptions()
        .currency;
      if (currency) return currency;
    }

    // Fallback: try IP geolocation API
    const response = await fetch('https://ipapi.co/json/');
    if (response.ok) {
      const data = await response.json();
      if (data.currency) {
        return data.currency;
      }
    }

    // Default to USD
    return 'USD';
  } catch {
    return 'USD';
  }
}

/**
 * Batch convert multiple prices
 */
export async function convertPrices(
  prices: number[],
  currency: string
): Promise<ConvertedPrice[]> {
  const results: ConvertedPrice[] = [];

  for (const price of prices) {
    const converted = await convertPrice(price, currency);
    results.push(converted);
  }

  return results;
}

/**
 * Get all supported currencies
 */
export function getSupportedCurrencies(): string[] {
  return Object.keys(CURRENCY_CONFIG).sort();
}

/**
 * Get currency display info
 */
export function getCurrencyInfo(currency: string): {
  symbol: string;
  position: 'prefix' | 'suffix';
  name: string;
} {
  const config = CURRENCY_CONFIG[currency];
  if (!config) {
    return { symbol: currency, position: 'prefix', name: currency };
  }

  // Currency names (you can expand this)
  const names: Record<string, string> = {
    USD: 'US Dollar',
    EUR: 'Euro',
    GBP: 'British Pound',
    AED: 'UAE Dirham',
    CAD: 'Canadian Dollar',
    AUD: 'Australian Dollar',
    JPY: 'Japanese Yen',
    CNY: 'Chinese Yuan',
    INR: 'Indian Rupee',
    ZAR: 'South African Rand',
    EGP: 'Egyptian Pound',
    NGN: 'Nigerian Naira',
    KES: 'Kenyan Shilling',
    GHS: 'Ghanaian Cedi',
    XOF: 'West African CFA Franc',
    XAF: 'Central African CFA Franc',
    MAD: 'Moroccan Dirham',
    TND: 'Tunisian Dinar',
    DZD: 'Algerian Dinar',
    RWF: 'Rwandan Franc',
    UGX: 'Ugandan Shilling',
    TZS: 'Tanzanian Shilling',
    ETB: 'Ethiopian Birr',
    SAR: 'Saudi Riyal',
    QAR: 'Qatari Riyal',
  };

  return {
    symbol: config.symbol,
    position: config.position,
    name: names[currency] || currency,
  };
}
