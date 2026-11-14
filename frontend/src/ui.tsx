// Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
import { createContext, useContext, type ReactNode } from 'react'
import type { Baseline, Day, Metric } from './api'
import { useT, type Key } from './i18n'

export const CrewCtx = createContext<{ crewId: string; setCrewId: (id: string) => void }>({ crewId: 'lena', setCrewId: () => {} })
export const useCrew = () => useContext(CrewCtx)

export const METRICS: Metric[] = ['resting_hr_bpm', 'hrv_ms', 'sleep_h', 'co2_night_peak_mmhg']
export const UNIT: Record<Metric, Key> = { resting_hr_bpm: 'u_bpm', hrv_ms: 'u_ms', sleep_h: 'u_h', co2_night_peak_mmhg: 'u_mmhg', mood_1_5: 'u_h' }
export const DEC: Record<Metric, number> = { resting_hr_bpm: 0, hrv_ms: 0, sleep_h: 1, co2_night_peak_mmhg: 2, mood_1_5: 0 }
/** Is a high value bad (+1) or a low value bad (-1)? */
const DIR: Record<Metric, 1 | -1> = { resting_hr_bpm: 1, hrv_ms: -1, sleep_h: -1, co2_night_peak_mmhg: 1, mood_1_5: -1 }

export type Level = 'ok' | 'watch' | 'alarm' | 'nodata'
export function levelOf(m: Metric, v: number | undefined, b: Baseline | undefined): Level {
  if (v == null || !b) return 'nodata'
  const z = ((v - b.mean) / (b.sd || 1)) * DIR[m]
  if (m === 'co2_night_peak_mmhg' && v > 4.5) return 'alarm'
  if (z > 10) return 'alarm'
  if (v < b.band_low || v > b.band_high) return z > 0 ? 'watch' : 'ok'
  return 'ok'
}
export const fmt = (v: number | undefined, d = 1) => (v == null || Number.isNaN(v) ? '—' : v.toFixed(d))

export function LevelTag({ level }: { level: Level }) {
  const t = useT()
  const k: Record<Level, Key> = { ok: 'st_nominal', watch: 'st_watch', alarm: 'st_alarm', nodata: 'st_nodata' }
  const cls = level === 'nodata' ? 'sim' : level
  return <span className={`tag ${cls}`}><Shape level={level} />{t(k[level])}</span>
}
/** Colour is never the only cue: each level also has a shape. */
export function Shape({ level, size = 9 }: { level: Level; size?: number }) {
  const s = size
  if (level === 'alarm') return <svg width={s} height={s} viewBox="0 0 10 10" aria-hidden><path d="M5 0.5 L9.5 9.5 L0.5 9.5Z" fill="currentColor" /></svg>
  if (level === 'watch') return <svg width={s} height={s} viewBox="0 0 10 10" aria-hidden><rect x="1.5" y="1.5" width="7" height="7" transform="rotate(45 5 5)" fill="currentColor" /></svg>
  if (level === 'nodata') return <svg width={s} height={s} viewBox="0 0 10 10" aria-hidden><circle cx="5" cy="5" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
  return <svg width={s} height={s} viewBox="0 0 10 10" aria-hidden><circle cx="5" cy="5" r="4.2" fill="currentColor" /></svg>
}

/** Tiny SVG sparkline with the personal band. Pure function of its props (safe for frame capture). */
export function Spark({ days, m, b, w = 220, h = 54, color }: { days: Day[]; m: Metric; b?: Baseline; w?: number; h?: number; color?: string }) {
  const vals = days.map(d => d[m] as number)
  const lo = Math.min(...vals, b?.band_low ?? Infinity), hi = Math.max(...vals, b?.band_high ?? -Infinity)
  const pad = (hi - lo) * 0.12 || 1
  const y = (v: number) => h - 4 - ((v - (lo - pad)) / (hi - lo + 2 * pad)) * (h - 8)
  const x = (i: number) => 2 + (i / (vals.length - 1)) * (w - 4)
  const d = vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const last = vals[vals.length - 1]
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden>
      {b && <rect x={0} width={w} y={y(b.band_high)} height={Math.max(1, y(b.band_low) - y(b.band_high))} fill="rgba(46,150,245,.10)" />}
      <path d={d} fill="none" stroke={color ?? 'var(--metis)'} strokeWidth={1.8} vectorEffect="non-scaling-stroke" />
      {vals.length > 0 && <circle cx={x(vals.indexOf(Math.max(...vals)))} cy={y(Math.max(...vals))} r={3.5} fill={color ?? 'var(--metis)'} stroke="white" strokeWidth={1.5} />}
      <circle cx={x(vals.length - 1)} cy={y(last)} r={3.2} fill={color ?? 'var(--metis)'} />
    </svg>
  )
}

export function MetisLine({ children, speaking, small }: { children: ReactNode; speaking?: boolean; small?: boolean }) {
  return (
    <div className="metis-line">
      <div className={`orb ${speaking ? 'speaking' : ''}`} style={small ? { width: 32, height: 32 } : undefined} />
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  )
}

export function Card({ title, right, children, className = '', style }: { title?: ReactNode; right?: ReactNode; children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return <section className={`card ${className}`} style={style}>{title && <h3>{title}{right && <span className="r">{right}</span>}</h3>}{children}</section>
}

export function Page({ title, sub, right, children }: { title: string; sub?: string; right?: ReactNode; children: ReactNode }) {
  return (
    <div className="page">
      <div className="row between page-heading" style={{ alignItems: 'flex-start', gap: 20 }}>
        <div><h1 className="h1">{title}</h1>{sub && <p className="sub">{sub}</p>}</div>
        {right}
      </div>
      {children}
    </div>
  )
}

export function Loading() { const t = useT(); return <div className="muted" style={{ padding: 40 }}>{t('loading')}</div> }

/** Earth delay with its scenario label, the Mars range and the HRP source (tooltip). */
/** The Earth-delay sentence under the delay value was removed at the user's request (14-nov): renders nothing.
 *  Kept so existing callers compile; new code should not use it. */
export function DelayInfo(_props: { comms?: unknown }) { return null }
