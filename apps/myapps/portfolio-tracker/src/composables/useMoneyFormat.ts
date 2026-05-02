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
