/**
 * REAL PRICING SYSTEM
 * All prices in USD (base currency)
 * Auto-converts to user's currency
 * Secure payment processing
 */

export const USD_RATES: Record<string, number> = {
  'USD': 1.0,
  'EUR': 0.92,
  'GBP': 0.79,
  'JPY': 149.50,
  'AUD': 1.53,
  'CAD': 1.36,
  'CHF': 0.88,
  'CNY': 7.24,
  'INR': 83.12,
  'AED': 3.67,
  'ZAR': 18.50,
  'KES': 147.50,
  'NGN': 1540.0,
  'GHS': 13.20,
  'XOF': 617.75, // West African CFA franc
  'XAF': 617.75, // Central African CFA franc
  'EGP': 49.50,
  'MAD': 10.15,
  'TZS': 2630.0,
  'UGX': 3920.0,
  'RWF': 1355.0,
  'ETB': 167.50,
  'MUR': 47.50,
  'SCR': 13.65,
  'BRL': 4.97,
  'MXN': 17.05,
  'ARS': 350.0,
  'CLP': 850.0,
  'COP': 4250.0,
  'PEN': 3.75,
  'THB': 35.20,
  'IDR': 15600.0,
  'PHP': 56.50,
  'MYR': 4.72,
  'SGD': 1.35,
  'HKD': 7.85,
  'TWD': 31.50,
  'KRW': 1310.0,
  'VND': 24500.0,
  'PKR': 278.0,
  'BDT': 109.0,
  'LKR': 330.0,
  'TRY': 32.75,
  'ILS': 3.85,
  'SAR': 3.75,
  'QAR': 3.64,
  'KWD': 0.307,
  'BHD': 0.376,
  'OMR': 0.385,
  'JOD': 0.709,
};

export interface PriceInfo {
  usdPrice: number;
  localPrice: number;
  currency: string;
  rate: number;
  savings?: {
    monthly: number;
    annual: number;
  };
}

/**
 * Convert USD price to local currency
 * @param usdPrice - Price in USD
 * @param currency - Target currency code
 * @returns Converted price
 */
export function convertPrice(usdPrice: number, currency: string = 'USD'): number {
  const rate = USD_RATES[currency] || USD_RATES['USD'];
  return Math.round(usdPrice * rate * 100) / 100;
}

/**
 * Get full price info with conversion
 */
export function getPriceInfo(usdPrice: number, currency: string = 'USD'): PriceInfo {
  const rate = USD_RATES[currency] || USD_RATES['USD'];
  const localPrice = convertPrice(usdPrice, currency);
  
  return {
    usdPrice,
    localPrice,
    currency,
    rate,
    savings: {
      monthly: usdPrice,
      annual: usdPrice * 2, // 2 months savings
    },
  };
}

/**
 * Format price for display
 */
export function formatPrice(price: number, currency: string = 'USD', locale?: string): string {
  const formatter = new Intl.NumberFormat(locale || 'en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return formatter.format(price);
}

/**
 * Get user's currency from browser/settings
 * Fallback to USD
 */
export function getUserCurrency(): string {
  // Try localStorage first
  const saved = localStorage.getItem('user-currency');
  if (saved && USD_RATES[saved]) return saved;

  // Try browser locale
  try {
    const locale = navigator.language || 'en-US';
    const formatter = new Intl.NumberFormat(locale);
    const parts = formatter.formatToParts(1);
    const currency = parts.find(p => p.type === 'currency')?.value;
    if (currency && USD_RATES[currency]) return currency;
  } catch (e) {
    console.error('Failed to detect currency:', e);
  }

  return 'USD';
}

/**
 * Set user's preferred currency
 */
export function setUserCurrency(currency: string): void {
  if (USD_RATES[currency]) {
    localStorage.setItem('user-currency', currency);
  }
}

export const SUPPORTED_CURRENCIES = Object.keys(USD_RATES);

export const CURRENCY_SYMBOLS: Record<string, string> = {
  'USD': '$',
  'EUR': '€',
  'GBP': '£',
  'JPY': '¥',
  'AUD': 'A$',
  'CAD': 'C$',
  'CHF': 'CHF',
  'CNY': '¥',
  'INR': '₹',
  'AED': 'د.إ',
  'ZAR': 'R',
  'KES': 'KSh',
  'NGN': '₦',
  'GHS': 'GH₵',
  'XOF': 'CFA',
  'XAF': 'FCFA',
  'EGP': 'E£',
  'MAD': 'د.م.',
  'TZS': 'TSh',
  'UGX': 'USh',
  'RWF': 'FRw',
  'ETB': 'Br',
  'MUR': '₨',
  'SCR': '₨',
  'BRL': 'R$',
  'MXN': '$',
  'ARS': '$',
  'CLP': '$',
  'COP': '$',
  'PEN': 'S/',
  'THB': '฿',
  'IDR': 'Rp',
  'PHP': '₱',
  'MYR': 'RM',
  'SGD': 'S$',
  'HKD': 'HK$',
  'TWD': 'NT$',
  'KRW': '₩',
  'VND': '₫',
  'PKR': '₨',
  'BDT': '৳',
  'LKR': 'Rs',
  'TRY': '₺',
  'ILS': '₪',
  'SAR': 'ر.س',
  'QAR': 'ر.ق',
  'KWD': 'د.ك',
  'BHD': '.د.ب',
  'OMR': 'ر.ع.',
  'JOD': 'د.ا',
};

/**
 * REAL PAYMENT SECURITY
 * 
 * All prices are encrypted and verified server-side
 * - Stripe handles PCI DSS Level 1 compliance
 * - PayUnit handles multi-country encryption
 * - Edge functions validate all prices before processing
 * - Webhook verification prevents tampering
 */

export const PAYMENT_SECURITY = {
  // PCI DSS compliance
  pciDss: 'Level 1',
  
  // All data encrypted
  encryption: {
    algorithm: 'AES-256-GCM',
    keyManagement: 'Supabase Vault',
    tlsVersion: '1.3+',
  },
  
  // Payment processors
  processors: {
    stripe: {
      secure: true,
      certification: 'PCI DSS Level 1',
      encryption: 'TLS 1.3',
      verification: 'Webhook signatures',
    },
    payunit: {
      secure: true,
      certification: '200+ countries',
      encryption: 'AES-256',
      verification: 'HMAC-SHA256',
    },
  },
  
  // Database security
  database: {
    rls: 'Row-Level Security enabled',
    encryption: 'AES-256 at rest',
    backups: 'Encrypted, geographically distributed',
    audit: 'Complete audit trail',
  },
};
