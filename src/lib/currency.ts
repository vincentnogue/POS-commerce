/**
 * CURRENCY CONVERSION LIBRARY
 * Secure, real-time currency conversion with caching
 */

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
};

// Local storage cache key
const CACHE_KEY = 'exchange_rates_cache';
const CACHE_EXPIRY_MS = 1000 * 60 * 60; // 1 hour

interface CachedRates {
  rates: ExchangeRate;
  timestamp: number;
}

/**
 * Get cached exchange rates or fetch new ones if expired
 */
export async function getExchangeRates(): Promise<ExchangeRate> {
  const cached = getCachedRates();

  if (cached && !isExpired(cached.timestamp)) {
    return cached.rates;
  }

  // Fetch from open-exchange-rates API
  const rates = await fetchExchangeRates();

  // Cache locally
  localStorage.setItem(
    CACHE_KEY,
    JSON.stringify({
      rates,
      timestamp: Date.now(),
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
 * Fetch exchange rates from API
 * In production, this calls your backend edge function for security
 */
async function fetchExchangeRates(): Promise<ExchangeRate> {
  try {
    // Call your backend edge function (never expose API key to frontend)
    const response = await fetch('/api/exchange-rates', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch rates');
    }

    const data = await response.json();
    return data.rates;
  } catch (error) {
    console.error('Exchange rate fetch error:', error);
    // Return fallback rates (hardcoded for offline support)
    return getFallbackRates();
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
  };

  return {
    symbol: config.symbol,
    position: config.position,
    name: names[currency] || currency,
  };
}
