// Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
// Live onboard vitals for any screen. Source: the backend's /api/vitals (Carlos), which simulates the signals that
// onboard sensors like the CSA Bio-Monitor measure today: heart rate, breathing rate, blood oxygen, skin temperature
// and physical activity, each compared with the person's own baseline. No blood pressure (the API doesn't provide it).
import { useEffect, useState } from 'react'
import { NO_SERVER, type LiveVitals, type VitalsAlert } from './api'
import type { Level } from './ui'

export type LiveKey = 'hr_bpm' | 'rr_brpm' | 'spo2_pct' | 'temp_c'
export const LIVE_KEYS: LiveKey[] = ['hr_bpm', 'rr_brpm', 'spo2_pct', 'temp_c']

export const LIVE_LABEL: Record<LiveKey, { en: string; es: string; unit: string; dec: number }> = {
  hr_bpm: { en: 'Heart rate', es: 'Pulso', unit: 'bpm', dec: 0 },
  rr_brpm: { en: 'Breathing', es: 'Respiración', unit: '/min', dec: 0 },
  spo2_pct: { en: 'Blood oxygen', es: 'Oxígeno en sangre', unit: '%', dec: 0 },
  temp_c: { en: 'Skin temperature', es: 'Temperatura de la piel', unit: '°C', dec: 1 },
}

interface Baseline { mean: number; sd: number; assumed?: boolean }
export interface LiveCrew {
  id: string; name: string; status: string; scenario: string; now: LiveVitals
  baseline?: Partial<Record<LiveKey, Baseline>>; trend_hr_bpm_per_min?: number
}
export interface Live {
  crew: LiveCrew | null
  alerts: VitalsAlert[]
  /** Last samples of this session (newest last), for small live charts. */
  history: LiveVitals[]
  /** Per-signal level vs. the personal baseline (|z| > 2 watch, > 3 alarm; no pulse / SpO₂ < 90 % alarm). */
  level: Record<LiveKey, Level>
  exercising: boolean
  online: boolean
}

const HISTORY = 90

export function levelOfLive(k: LiveKey, v: number | null | undefined, b?: Baseline, pulse = true): Level {
  if (!pulse) return 'alarm'
  if (v == null) return 'nodata'
  if (k === 'spo2_pct' && v < 90) return 'alarm'
  if (!b || !b.sd) return 'ok'
  const z = Math.abs((v - b.mean) / b.sd)
  return z > 3 ? 'alarm' : z > 2 ? 'watch' : 'ok'
}

/** Polls /api/vitals/{id} every 2 s for one crew member. Returns nulls when the backend is not reachable (standalone mode). */
export function useLiveVitals(crewId: string): Live {
  const [snap, setSnap] = useState<{ crew: LiveCrew | null; alerts: VitalsAlert[]; online: boolean }>({ crew: null, alerts: [], online: true })
  const [history, setHistory] = useState<LiveVitals[]>([])
  useEffect(() => {
    let alive = true
    setHistory([])
    const tick = async () => {
      if (NO_SERVER) { if (alive) setSnap(p => ({ ...p, online: false })); return }
      try {
        // /api/vitals/{id} (already in the backend) also returns the last 10 minutes, one sample every 10 s,
        // so the small charts are full from the first second instead of starting empty.
        const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 4000)
        const r = await fetch(`/api/vitals/${encodeURIComponent(crewId)}`, { signal: ctl.signal }).finally(() => clearTimeout(tm))
        if (!r.ok) throw new Error(String(r.status))
        const c = await r.json() as LiveCrew & { series?: LiveVitals[]; alerts?: VitalsAlert[] }
        if (!alive) return
        setSnap({ crew: c, alerts: c.alerts ?? [], online: true })
        setHistory([...(c.series ?? []), c.now].filter((v, i, a) => i === 0 || v.t !== a[i - 1].t).slice(-HISTORY))
      } catch { if (alive) setSnap(p => ({ ...p, online: false })) }
    }
    tick()
    const id = setInterval(tick, 2000)
    return () => { alive = false; clearInterval(id) }
  }, [crewId])
  const c = snap.crew
  const level = Object.fromEntries(LIVE_KEYS.map(k => [k, c ? levelOfLive(k, c.now[k] as number | null, c.baseline?.[k], c.now.pulse) : 'nodata'])) as Record<LiveKey, Level>
  return { crew: c, alerts: snap.alerts, history, level, exercising: !!c && c.now.activity > 0, online: snap.online }
}
