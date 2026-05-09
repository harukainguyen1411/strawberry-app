import type { CurrencyCode, Money } from '@/types/firestore'

const LOCALE_BY_CURRENCY: Record<CurrencyCode, string> = {
  USD: 'en-US',
  EUR: 'en-IE',
}

export interface FormatOptions {
  signDisplay?: 'auto' | 'always' | 'exceptZero' | 'never'
}

export interface UseMoneyFormatReturn {
  format: (money: Money, options?: FormatOptions) => string
}

/**
 * Format a raw float quantity for display: cap at 6 decimal places and strip
 * trailing zeros so e.g. 52.497975839999995 → "52.497976" and 12 → "12".
 *
 * Domain: finite numbers (negative or non-negative). Behavior is undefined
 * for NaN and ±Infinity — callers should validate the holding quantity is a
 * finite real number before display. (In portfolio-tracker, quantities come
 * from Firestore typed as `number`; CSV imports validate finiteness upstream.)
 */
export function formatQuantity(qty: number): string {
  return parseFloat(qty.toFixed(6)).toString()
}

export function useMoneyFormat(): UseMoneyFormatReturn {
  return {
    format(money, options) {
      const formatter = new Intl.NumberFormat(LOCALE_BY_CURRENCY[money.currency], {
        style: 'currency',
        currency: money.currency,
        signDisplay: options?.signDisplay ?? 'auto',
      })
      return formatter.format(money.amount)
    },
  }
}
