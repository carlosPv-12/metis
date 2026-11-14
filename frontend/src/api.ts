// Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
// Typed contracts with the backend (see README). Vite proxy: /api -> http://localhost:8000
// Every call has a local fallback so no screen breaks if an endpoint is missing or the backend is down.
import type { Lang } from './i18n'
import crewFile from '../../data/crew_lena.json'
import bloodFile from '../../data/blood_osd569.json'
import { FALLBACK_STATION, FALLBACK_THRESHOLDS, FALLBACK_GRAPH, fallbackReply } from './fallback'

export type Metric = 'resting_hr_bpm' | 'hrv_ms' | 'sleep_h' | 'co2_night_peak_mmhg' | 'mood_1_5'
export interface Day { date: string; mission_day: number; resting_hr_bpm: number; hrv_ms: number; sleep_h: number; co2_night_peak_mmhg: number; mood_1_5: number }
export interface Baseline { mean: number; sd: number; band_low: number; band_high: number }
export interface Sourced { value: number; source: string }
export interface CrewSummary { id: string; name: string; role: string; today_out_of_band: Metric[] }
export interface CrewList { co2_limit_mmhg: Sourced; simulated: boolean; crew: CrewSummary[] }
export interface CrewDetail extends CrewSummary { fictional: boolean; simulated: boolean; baseline: Record<Metric, Baseline>; days: Day[]; sources: Record<Metric, string>; co2_limit_mmhg: Sourced }
export interface BloodAnalyte { analyte: string; unit: string; baseline_mean?: number; baseline_min?: number; baseline_max?: number; r_plus_1?: number; ref_min?: number | null; ref_max?: number | null; outside_personal_band?: boolean; outside_reference_range?: boolean; note?: string }
export interface Blood { source: string; url: string; real_data: boolean; baseline: string; crew: Record<string, { id: string; analytes: BloodAnalyte[]; n_outside_personal_band: number; n_outside_reference: number }> }
export type FlowId = 'companion_collapse' | 'self_chest_pressure'
export interface TriageOption { id: string; label: string; next: string }
export interface Src { title: string; url?: string }
export type TriageNode =
  | { type: 'question'; text: string; why: string; options: TriageOption[] }
  | { type: 'result'; level: 'rojo' | 'naranja' | 'amarillo' | 'verde'; title: string; steps: string[]; surgeon_summary: string; warning: string }
export interface TriageStep { flow: FlowId; flow_title: string; node_id: string; node: TriageNode; offline: boolean; say?: string; sources?: Src[]; escalate?: boolean; lang?: string }
export interface Say { text: string; source: 'llm' | 'fallback' | string; latency_ms?: number; ai_generated?: boolean }
export interface Chat { text: string; source: string; latency_ms?: number; safety: 'ok' | 'escalated' }
export interface Status { llm: { ok: boolean; model?: string }; tts: { ok: boolean; engine?: string; voices?: unknown }; stt: { ok: boolean; engine?: string; model?: string }; offline: boolean }
export interface Threshold { id: string; label_en: string; label_es: string; value: number | string; unit: string; rule?: string; source_title: string; source_url?: string; verified: boolean }
export interface StationCrew { id: string; name: string; role?: string; role_en?: string; role_es?: string; status: 'ok' | 'watch' | 'alarm' | string; location?: string; hr?: number; alerts?: string[]; note_en?: string; note_es?: string }
export interface StationEvent { id?: string | number; ts?: string; t?: string; type: string; crew_id?: string; payload?: Record<string, unknown>; text_en?: string; text_es?: string }
export interface Station {
  mission_day: number
  crew: StationCrew[]
  alerts: { id?: string; level: string; crew_id?: string; text_en?: string; text_es?: string; text?: string }[]
  environment: { module: string; module_en?: string; module_es?: string; co2_mmhg: number; temp_c?: number; rh_pct?: number; o2_kpa?: number }[]
  comms: { one_way_delay_s: number; next_window_min?: number; link?: string; range_max_s?: number; scenario_en?: string; scenario_es?: string }
  headsets: { crew_id: string; battery_pct: number; link: string; worn?: boolean }[]
  medkit: { item_en?: string; item_es?: string; item?: string; qty: number; min?: number; expires?: string }[]
  packet?: { id?: string; sent_at_s?: number; eta_s?: number; status?: string } | null
}
export interface Graph { nodes: { id: string; type: string; label_en: string; label_es: string }[]; edges: { source: string; target: string; relation: string }[] }

/** Opened as a local file (double-click on metis-demo.html): there is no backend, so skip every fetch
 *  (no console noise, no waiting) and go straight to the local fallbacks. Served over http: unchanged. */
export const NO_SERVER = typeof location !== 'undefined' && location.protocol === 'file:'

async function j<T>(path: string, body?: unknown, timeout = 8000): Promise<T> {
  if (NO_SERVER) throw new Error('no server (file://)')
  const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), timeout)
  try {
    const r = await fetch(path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctl.signal } : { signal: ctl.signal })
    if (!r.ok) throw new Error(path + ' -> ' + r.status)
    return await r.json()
  } finally { clearTimeout(tm) }
}
/** Try the API; on any failure return the local fallback and flag it. */
async function withFallback<T>(p: Promise<T>, fb: () => T): Promise<T & { _fallback?: boolean }> {
  try { return (await p) as T & { _fallback?: boolean } } catch { return { ...(fb() as object), _fallback: true } as T & { _fallback?: boolean } }
}

type CrewFile = { co2_limit_mmhg: Sourced; crew: Record<string, CrewDetail> }
const CF = crewFile as unknown as CrewFile

export const api = {
  health: () => j<{ status: string; llm_configured: boolean; offline_ready: boolean }>('/api/health'),
  status: () => withFallback(j<Status>('/api/status', undefined, 4000), () => ({ llm: { ok: false }, tts: { ok: false }, stt: { ok: false }, offline: true }) as Status),
  crew: () => withFallback(j<CrewList>('/api/crew'), () => ({ co2_limit_mmhg: CF.co2_limit_mmhg, simulated: true, crew: Object.values(CF.crew).map(c => ({ id: c.id, name: c.name, role: c.role, today_out_of_band: c.today_out_of_band })) })),
  crewOne: (id: string) => withFallback(j<CrewDetail>('/api/crew/' + id), () => ({ ...(CF.crew[id] ?? CF.crew.lena), simulated: true, co2_limit_mmhg: CF.co2_limit_mmhg })),
  blood: () => withFallback(j<Blood>('/api/blood'), () => bloodFile as unknown as Blood),
  thresholds: () => withFallback(j<Threshold[]>('/api/thresholds'), () => FALLBACK_THRESHOLDS).then(r => (Array.isArray(r) ? r : FALLBACK_THRESHOLDS)),
  station: () => withFallback(j<Station>('/api/station', undefined, 4000), () => FALLBACK_STATION),
  // Events: backend first; if the endpoint is missing, a local store (localStorage) keeps the console working across tabs.
  events: () => j<StationEvent[] | { events: StationEvent[] }>('/api/station/events', undefined, 4000).then(r => (Array.isArray(r) ? r : r.events ?? [])).catch(() => localEvents()),
  postEvent: (type: string, crew_id: string, payload: Record<string, unknown> = {}) => j<unknown>('/api/station/events', { type, crew_id, payload }, 4000).catch(() => {
    const ev: StationEvent = { type, crew_id, payload, ts: new Date().toISOString() }
    try { localStorage.setItem('metis.events', JSON.stringify([...localEvents(), ev].slice(-50))) } catch { /* ignore */ }
    return ev
  }),
  graph: () => withFallback(j<Graph>('/api/brain/graph'), () => FALLBACK_GRAPH),
  // Hands-free: the backend matches the spoken answer to an option with a fixed rule (no AI). understood=false -> ask again.
  triageVoice: (flow: FlowId, lang: Lang, node_id: string, text: string) =>
    j<TriageStep & { understood: boolean; heard: string; answer?: string; answer_label?: string; say?: string }>('/api/triage/voice', { flow, node_id, text, lang }, 8000),
  // Spoken orders on the triage result («alert the crew») and yes/no confirmations. Fixed rule, no AI.
  // Always-on ear: was «Metis» said? is it an emergency? (fixed rule, no AI)
  wake: (text: string, lang: Lang) =>
    j<{ heard: string; wake: boolean; command: string; emergency: boolean; end: boolean }>('/api/voice/wake', { text, lang }, 8000),
  triageCommand: (text: string, lang: Lang) =>
    j<{ heard: string; actions: string[]; confirm: boolean | null }>('/api/triage/command', { text, lang }, 8000),
  triage: (flow: FlowId, lang: Lang, node_id?: string, answer?: string) =>
    j<TriageStep>('/api/triage/step', { flow, node_id: node_id ?? null, answer: answer ?? null, lang }),
  // Old backend contract (no latency_ms) ignores `lang`: use the local scripted line instead.
  say: (crew_id: string, lang: Lang, context = 'morning_checkin') =>
    withFallback(j<Say>('/api/metis/say', { crew_id, context, lang, topic: 'greeting' }, 20000).then(r => { if (r.latency_ms === undefined) throw new Error('old contract'); return r }), () => ({ text: fallbackReply('greeting', lang, crew_id).text, source: 'fallback' })),
  chat: (crew_id: string, message: string, lang: Lang, history: { role: string; content: string }[]) =>
    withFallback(j<Chat>('/api/metis/chat', { crew_id, message, lang, history }, 30000), () => fallbackReply(message, lang)),
  tts: async (text: string, lang: Lang): Promise<Blob | null> => {
    if (NO_SERVER) return null
    try {
      const r = await fetch('/api/voice/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, lang }) })
      if (!r.ok) return null
      const b = await r.blob(); return b.size > 100 ? b : null
    } catch { return null }
  },
  // lang: the EN/ES of the screen. Without it whisper has to guess the language and mishears short phrases.
  stt: async (audio: Blob, lang?: Lang): Promise<{ text: string; lang?: string; latency_ms?: number } | null> => {
    if (NO_SERVER) return null
    try {
      const fd = new FormData(); fd.append('audio', audio, 'speech.webm'); if (lang) fd.append('lang', lang)
      const r = await fetch('/api/voice/stt', { method: 'POST', body: fd })
      if (!r.ok) return null
      return await r.json()
    } catch { return null }
  },
}

export const localCrew = CF
function localEvents(): StationEvent[] { try { return JSON.parse(localStorage.getItem('metis.events') ?? '[]') } catch { return [] } }
