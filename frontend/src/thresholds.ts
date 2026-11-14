// Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
import type { Threshold } from './api'
import { FALLBACK_THRESHOLDS } from './fallback'
/** Find a threshold by exact id, then by id keyword, then in the local fallback list. */
export function findThr(list: Threshold[] | null | undefined, id: string, kw?: RegExp): Threshold | undefined {
  const l = list ?? []
  return l.find(x => x.id === id) ?? (kw ? l.find(x => kw.test(x.id)) : undefined) ?? FALLBACK_THRESHOLDS.find(x => x.id === id)
}
export const numVal = (t?: Threshold) => (t ? parseFloat(String(t.value)) : NaN)
