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
export interface Packet extends StationEvent { direction: 'to_earth' | 'to_ship'; delay_s?: number; sent_ts?: string; arrives_ts?: string
  arrives_in_s: number | null; reply_in_s?: number | null; status: 'queued_no_link' | 'in_transit' | 'delivered' | 'delivered_awaiting_reply' | 'reply_window_open'
  name?: string; summary_en?: string }
export interface GroundView { viewer: { id: 'ground'; role: 'ground' }; realtime_data: true; crew: StationCrew[]; alerts: Station['alerts']
  vitals: VitalsSnapshot['crew']; checks: VitalsCheck[]; ship: ShipState; mission: Mission
  inbox: Packet[]; outbox: Packet[]; events: StationEvent[]; note_en: string; note_es: string }
export interface ShipSystem { id: string; group: 'life_support' | 'power' | 'radiation'; label_en: string; label_es: string; value: number; unit: string
  nominal: { low: number | null; high: number | null }; status: 'ok' | 'watch' | 'fault'; note_en: string; note_es: string
  source: string; source_url: string; verified: boolean; simulated: true }
export interface ShipState { systems: ShipSystem[]; worst_status: 'ok' | 'watch' | 'fault'
  alerts: { id: string; level: string; source: 'ship'; text_en: string; text_es: string }[]
  /** Only for who may see that person's health data (themselves, CMO, ground); otherwise null. */
  co2_sleep_link: { crew_id: string; name: string; nights: number; nights_over_limit: number; high_co2_mmhg: number; r: number
    sleep_h_over_limit: number | null; sleep_h_other: number | null; text_en: string; text_es: string } | null
  mission: { day: number; planned_days: number; env: string; link: string } }
export interface MedKit { inventory: { id: string; category_en: string; category_es: string; qty: number; min: number; low: boolean
    expires_in_days: number; expires_before_mission_end: boolean; source: string; verified_category: boolean }[]
  mission_days_left: number; summary_en: string; summary_es: string; context_en: string; context_es: string
  plans: Record<string, { en: string; es: string; category: string }>; plan_note: { en: string; es: string }; no_doses: true }
export interface Mission { env: 'iss' | 'eva' | 'moon' | 'mars' | 'blackout'; mars_delay_min: number; one_way_delay_s: number | null
  round_trip_s: number | null; link: 'realtime' | 'delayed' | 'none'; label_en: string; label_es: string; note_en: string; note_es: string; source: string }
// ---- Roles (backend/roles.py; contract in API.md, «Roles a bordo y Tierra») ----
export type CrewRole = 'crew' | 'commander' | 'cmo'
export type Viewer = string            // a crew id ('lena', 'kenji'…) or 'ground'
/** A wellbeing check-in as the backend sends it (backend/wellbeing.py). `note` only for its owner, or for ground if shared with it. */
export interface ApiCheckIn { id: string; ts: number; crew_id: string; instrument: string; answers: Record<string, number>; tags: string[]; note?: string; shared: boolean; note_shared: boolean
  scores?: { total: number; band: string; gad2: number; phq2: number; anxiety_positive: boolean; mood_positive: boolean } }
export interface WbAdvice { code: string; en: string; es: string; flow: string | null; source: { title: string; url: string } }
export type WbRiskId = 'stress' | 'mood' | 'fatigue' | 'sleep' | 'isolation' | 'conflict'
export type WbLevel = 'low' | 'watch' | 'high'
export interface WbWhy { code: 'hrv_low' | 'rhr_high' | 'sleep_low' | 'co2' | 'answer' | 'tag' | 'phq2' | 'gad2'; value?: number; nights?: number; q?: string; tag?: string }
export interface WbRisk { id: WbRiskId; score: number; level: WbLevel; why: WbWhy[] }
/** What ground may see about how someone feels, as that person chose (never answers or notes). */
export interface WbGroundSummary { crew_id: string; share_level: 'none' | 'summary' | 'signals'; severe_flag?: boolean; overall?: 'ok' | 'watch' | 'high'; trend?: 'up' | 'down' | 'flat'; areas?: { id: WbRiskId; level: WbLevel }[] }
export type Access = 'full' | 'summary'
export interface Fitness { status: 'fit' | 'limited' | 'unfit'; by: 'default' | 'cmo' | 'ground'; ts: number | null }
export interface RolesDoc { roles: Record<string, CrewRole>; defaults: Record<string, CrewRole>
  permissions: Record<CrewRole | 'ground', { self: 'full' | 'summary' | 'none'; others: 'full' | 'summary' | 'none'; ship: boolean }>
  labels: Record<CrewRole | 'ground', { en: string; es: string }>; summary_fields: string[]; emergency_events: string[] }
const vq = (viewer?: Viewer) => (viewer ? `?viewer=${encodeURIComponent(viewer)}` : '')
export interface LiveVitals { t: number; hr_bpm: number; rr_brpm: number; spo2_pct: number | null; temp_c: number; activity: number; pulse: boolean }
export interface VitalsAlert { id: string; crew_id: string; level: 'watch' | 'warning' | 'alarm'; rule: string; metrics: string[]; text_en: string; text_es: string; text?: string }
export interface VitalsCheck { crew_id: string; name: string; level: 'watch' | 'warning' | 'alarm'; state: 'asking' | 'escalated'; asked_at: number; answer: 'ok' | 'help' | null
  advice_en: string; advice_es: string; seconds_left: number; reason?: 'no_answer' | 'help' | 'no_pulse'; escalated_at?: number; instructions_en?: string; instructions_es?: string }
export interface VitalsSnapshot { crew: { id: string; name: string; status: string; now: LiveVitals; scenario: string; trend_hr_bpm_per_min: number }[]; alerts: VitalsAlert[]; checks: VitalsCheck[]; now: number; method: { en: string; es: string } }
export interface StationCrew { id: string; name: string; role?: string; role_en?: string; role_es?: string; status: 'ok' | 'watch' | 'alarm' | string; location?: string; hr?: number; alerts?: string[]; note_en?: string; note_es?: string; vitals?: LiveVitals }
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

async function j<T>(path: string, body?: unknown, timeout = 8000, method = 'POST'): Promise<T> {
  if (NO_SERVER) throw new Error('no server (file://)')
  const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), timeout)
  try {
    const r = await fetch(path, body ? { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctl.signal } : { signal: ctl.signal })
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
  // viewer (optional): who is looking — a crew id or 'ground'. The backend then applies the roles (see Roles below).
  station: (viewer?: Viewer) => withFallback(j<Station>('/api/station' + vq(viewer), undefined, 4000), () => FALLBACK_STATION),
  // Wellbeing check-ins ("How I feel"), kept on board by the backend. viewer = the crew member, or 'ground' (only what was sent).
  wbList: (crew_id: string, viewer: Viewer) => j<ApiCheckIn[]>(`/api/wellbeing/checkins?${new URLSearchParams({ crew_id, viewer })}`, undefined, 4000),
  wbAdd: (b: { crew_id: string; instrument: string; answers: Record<string, number>; tags: string[]; note: string; share: boolean; share_note: boolean }) =>
    j<ApiCheckIn & { advice: WbAdvice[] }>('/api/wellbeing/checkins', b, 5000),
  wbPhq4Due: (crew_id: string) => j<{ phq4_due: boolean }>(`/api/wellbeing/instrument?${new URLSearchParams({ crew_id })}`, undefined, 4000).then(r => r.phq4_due),
  wbAdvice: (crew_id: string) => j<WbAdvice[]>(`/api/wellbeing/advice?${new URLSearchParams({ crew_id })}`, undefined, 4000),
  wbRisks: (crew_id: string) => j<{ crew_id: string; risks: WbRisk[] }>(`/api/wellbeing/risks?${new URLSearchParams({ crew_id })}`, undefined, 4000).then(r => r.risks),
  wbGround: (crew_id: string) => j<WbGroundSummary>(`/api/wellbeing/risks?${new URLSearchParams({ crew_id, viewer: 'ground' })}`, undefined, 4000),
  wbShare: (id: string, with_note: boolean) => j<ApiCheckIn>(`/api/wellbeing/checkins/${encodeURIComponent(id)}/share`, { with_note }, 5000),
  wbShareLevel: (crew_id: string) => j<{ crew_id: string; level: string }>(`/api/wellbeing/share?${new URLSearchParams({ crew_id })}`, undefined, 4000),
  wbSetShareLevel: (crew_id: string, level: string) => j<{ crew_id: string; level: string }>('/api/wellbeing/share', { crew_id, level }, 4000, 'PUT'),
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
  // Live earpiece vitals (simulated) and early warnings computed by fixed rules against each person's baseline.
  vitals: (viewer?: Viewer) => j<VitalsSnapshot>('/api/vitals' + vq(viewer), undefined, 4000),
  // Ground view (flight surgeon / mission control): everything live; messages travel with the link delay.
  ground: () => j<GroundView>('/api/ground', undefined, 5000),
  groundReply: (b: { crew_id?: string | null; text_en: string; text_es?: string; fitness?: Fitness['status'] | null; packet_id?: number | null }) =>
    j<StationEvent>('/api/ground/reply', b, 5000),
  eventsAs: (viewer: Viewer) => j<StationEvent[]>('/api/station/events' + vq(viewer), undefined, 4000),
  // Ship state (life support, power, radiation) and the medical kit with pre-approved plans. See API.md, «Estado de la nave».
  ship: (viewer?: Viewer) => j<ShipState>('/api/ship' + vq(viewer), undefined, 4000),
  meds: () => j<MedKit>('/api/meds', undefined, 4000),
  // Mission environment (Settings): the backend uses its delay for packets to Earth; «blackout» queues them.
  mission: () => j<Mission>('/api/mission', undefined, 4000),
  setMission: (env: Mission['env'], mars_delay_min?: number) => j<Mission & { released: number }>('/api/mission', { env, mars_delay_min }, 4000, 'PUT'),
  // Roles on board and the Ground view (crew: own data only; commander: main traits of everyone; CMO and ground: all).
  roles: () => j<RolesDoc>('/api/roles', undefined, 4000),
  setRole: (crew_id: string, role: CrewRole) => j<RolesDoc>('/api/roles', { crew_id, role }, 4000, 'PUT'),
  resetRoles: () => j<RolesDoc>('/api/roles/reset', {}, 4000),
  // Fit / limited / unfit for duty: only the CMO or ground decide it (403 otherwise); the commander sees it.
  setFitness: (crew_id: string, status: Fitness['status'], viewer: Viewer) =>
    j<Fitness>(`/api/crew/${crew_id}/fitness`, { status, viewer }, 4000, 'PUT'),
  crewAs: (id: string, viewer: Viewer) => j<CrewDetail & { access: Access; fitness: Fitness }>(`/api/crew/${id}` + vq(viewer), undefined, 4000),
  vitalsScenario: (crew_id: string, kind: 'normal' | 'deterioration' | 'exercise' | 'collapse') =>
    j<{ ok: boolean }>('/api/vitals/scenario', { crew_id, kind }, 4000),
  vitalsReset: () => j<{ ok: boolean }>('/api/vitals/reset', {}, 4000),
  // The affected person's answer to «are you okay?» (fixed rule): «help», «alert the crew», «no» -> the crew is alerted.
  vitalsCheckin: (crew_id: string, text: string) =>
    j<{ answer: 'ok' | 'help' | null; state: string; heard: string; say_en?: string; say_es?: string }>('/api/vitals/checkin', { crew_id, text }, 6000),
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
  // hint: the answers we expect («Yes. No.»). whisper gets short answers right much more often with it.
  stt: async (audio: Blob, lang?: Lang, hint?: string): Promise<{ text: string; lang?: string; latency_ms?: number } | null> => {
    if (NO_SERVER) return null
    try {
      const fd = new FormData(); fd.append('audio', audio, 'speech.webm'); if (lang) fd.append('lang', lang); if (hint) fd.append('hint', hint)
      const r = await fetch('/api/voice/stt', { method: 'POST', body: fd })
      if (!r.ok) return null
      return await r.json()
    } catch { return null }
  },
}

export const localCrew = CF
function localEvents(): StationEvent[] { try { return JSON.parse(localStorage.getItem('metis.events') ?? '[]') } catch { return [] } }
