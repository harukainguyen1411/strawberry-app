/**
 * V0.17 — usePortfolio: Firestore subscription for the dashboard.
 *
 * Subscribes to:
 *   - users/{uid}/positions/* — per-position docs (native currency)
 *   - users/{uid}/cash/*      — per-broker cash balances
 *   - users/{uid}             — for baseCurrency
 *   - users/{uid}/meta/fx     — FX rates + overrides for converting to base
 *
 * Derives:
 *   - holdings: Holding[] — positions converted to base for marketValue + pl
 *   - summary: PortfolioSummary | null — totalValue (base), positionsCount,
 *     cashTotal (base), dayChange/dayChangePct (null in v0 — no historical
 *     snapshot yet)
 *
 * Tested only via the V0.18 Playwright happy path against the Firebase
 * emulator. V0.17's vitest suite mocks this composable (see
 * src/views/__tests__/DashboardView.test.ts).
 *
 * Refs V0.17
 */

import { computed, onScopeDispose, ref, watch, type ComputedRef, type Ref } from 'vue'
import { collection, doc, onSnapshot, type Unsubscribe } from 'firebase/firestore'
import { db } from '@/firebase/config'
import { useAuth } from '@/composables/useAuth'
import type { CurrencyCode, Cash, FxMeta, Holding, Money, Position } from '@/types/firestore'

export class FxRateMissingError extends Error {
  constructor(public readonly pair: string) {
    super(`FX rate missing for ${pair}`)
    this.name = 'FxRateMissingError'
  }
}

// Throws on missing rate to match the server's portfolio-tools/money.ts
// semantics — silent identity-fallback would let mixed-currency totals
// render confidently wrong (e.g. EUR-base summary that's actually
// EUR + USD numerically). The v0 FX seed (V0.5) covers USD↔EUR, so this
// branch is reachable only via a corrupted users/{uid}/meta/fx doc.
function convertMoney(m: Money, to: CurrencyCode, fx: FxMeta | null): Money {
  if (m.currency === to) return m
  const key = `${m.currency}->${to}`
  const rate = fx?.overrides?.[key] ?? fx?.rates?.[key]
  if (rate == null) throw new FxRateMissingError(key)
  return { amount: m.amount * rate, currency: to }
}

export type PortfolioStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface PortfolioSummary {
  totalValue: Money
  dayChange: Money | null
  dayChangePct: number | null
  positionsCount: number
  cashTotal: Money
}

export interface UsePortfolioReturn {
  status: ComputedRef<PortfolioStatus>
  loading: ComputedRef<boolean>
  holdings: ComputedRef<Holding[]>
  summary: ComputedRef<PortfolioSummary | null>
  baseCurrency: ComputedRef<CurrencyCode | null>
  error: ComputedRef<Error | null>
}

export function usePortfolio(): UsePortfolioReturn {
  const { uid } = useAuth()

  const status: Ref<PortfolioStatus> = ref('idle')
  const error: Ref<Error | null> = ref(null)
  const positions: Ref<Position[]> = ref([])
  const cash: Ref<Cash[]> = ref([])
  const fx: Ref<FxMeta | null> = ref(null)
  const baseCurrency: Ref<CurrencyCode | null> = ref(null)

  let unsubscribers: Unsubscribe[] = []

  function teardown(): void {
    for (const unsub of unsubscribers) unsub()
    unsubscribers = []
  }

  function subscribe(currentUid: string | null): void {
    teardown()
    if (!currentUid) {
      status.value = 'idle'
      positions.value = []
      cash.value = []
      fx.value = null
      baseCurrency.value = null
      return
    }
    status.value = 'loading'
    error.value = null

    const positionsRef = collection(db, 'users', currentUid, 'positions')
    const cashRef = collection(db, 'users', currentUid, 'cash')
    const userRef = doc(db, 'users', currentUid)
    const fxRef = doc(db, 'users', currentUid, 'meta', 'fx')

    let positionsLoaded = false
    let cashLoaded = false
    let userLoaded = false
    let fxLoaded = false

    function maybeReady(): void {
      if (positionsLoaded && cashLoaded && userLoaded && fxLoaded) {
        status.value = 'ready'
      }
    }

    unsubscribers.push(
      onSnapshot(
        positionsRef,
        (snap) => {
          positions.value = snap.docs.map((d) => d.data() as Position)
          positionsLoaded = true
          maybeReady()
        },
        (err) => {
          error.value = err
          status.value = 'error'
        },
      ),
    )
    unsubscribers.push(
      onSnapshot(
        cashRef,
        (snap) => {
          cash.value = snap.docs.map((d) => d.data() as Cash)
          cashLoaded = true
          maybeReady()
        },
        (err) => {
          error.value = err
          status.value = 'error'
        },
      ),
    )
    unsubscribers.push(
      onSnapshot(
        userRef,
        (snap) => {
          const data = snap.data() as { baseCurrency?: CurrencyCode } | undefined
          baseCurrency.value = data?.baseCurrency ?? null
          userLoaded = true
          maybeReady()
        },
        (err) => {
          error.value = err
          status.value = 'error'
        },
      ),
    )
    unsubscribers.push(
      onSnapshot(
        fxRef,
        (snap) => {
          fx.value = (snap.data() as FxMeta | undefined) ?? null
          fxLoaded = true
          maybeReady()
        },
        (err) => {
          error.value = err
          status.value = 'error'
        },
      ),
    )
  }

  watch(uid, (next) => subscribe(next), { immediate: true })
  onScopeDispose(teardown)

  // Wrapping the whole derivation in a single try/catch keeps `holdings` and
  // `summary` consistent: either both convert cleanly or both fall back to
  // the empty/null shape and the error surfaces via `error.value`. Surfacing
  // happens via a side-effect watcher below — computeds must stay pure.
  const derived = computed<{ holdings: Holding[]; summary: PortfolioSummary | null; fxError: FxRateMissingError | null }>(() => {
    const base = baseCurrency.value
    if (!base || status.value !== 'ready') {
      return { holdings: [], summary: null, fxError: null }
    }
    try {
      const list: Holding[] = positions.value.map((p): Holding => {
        // Fallback: if marketValue is missing (e.g. legacy data or parser gap),
        // derive it from avgCost × quantity so the dashboard still renders.
        const effectiveMarketValue: Money = p.marketValue ?? {
          amount: p.avgCost.amount * p.quantity,
          currency: p.avgCost.currency,
        }
        const marketValueBase = convertMoney(effectiveMarketValue, base, fx.value)
        const costBasisBase = convertMoney(
          { amount: p.avgCost.amount * p.quantity, currency: p.avgCost.currency },
          base,
          fx.value,
        )
        const pl: Money = {
          amount: marketValueBase.amount - costBasisBase.amount,
          currency: base,
        }
        const plPct = costBasisBase.amount > 0
          ? (pl.amount / costBasisBase.amount) * 100
          : 0
        return {
          ticker: p.ticker,
          broker: p.broker,
          quantity: p.quantity,
          avgCost: p.avgCost,
          marketValue: marketValueBase,
          pl,
          plPct,
          sector: p.sector,
          assetClass: p.assetClass,
        }
      })
      const totalValueAmount = list.reduce((acc, h) => acc + h.marketValue.amount, 0)
      const cashTotalAmount = cash.value.reduce((acc, c) => {
        // Skip cash entries with no currency (placeholder rows from v0 import)
        if (!c.currency) return acc
        const converted = convertMoney({ amount: c.amount, currency: c.currency }, base, fx.value)
        return acc + converted.amount
      }, 0)
      return {
        holdings: list,
        summary: {
          totalValue: { amount: totalValueAmount + cashTotalAmount, currency: base },
          dayChange: null,
          dayChangePct: null,
          positionsCount: list.length,
          cashTotal: { amount: cashTotalAmount, currency: base },
        },
        fxError: null,
      }
    } catch (e) {
      if (e instanceof FxRateMissingError) {
        return { holdings: [], summary: null, fxError: e }
      }
      throw e
    }
  })

  const holdings = computed(() => derived.value.holdings)
  const summary = computed(() => derived.value.summary)

  watch(() => derived.value.fxError, (fxError) => {
    if (fxError) {
      error.value = fxError
      status.value = 'error'
    } else if (status.value === 'error' && error.value instanceof FxRateMissingError) {
      // FX rates recovered (e.g. fx doc updated with the missing pair).
      error.value = null
      status.value = 'ready'
    }
  })

  return {
    status: computed(() => status.value),
    loading: computed(() => status.value === 'loading' || status.value === 'idle'),
    holdings,
    summary,
    baseCurrency: computed(() => baseCurrency.value),
    error: computed(() => error.value),
  }
}
