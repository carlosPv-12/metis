// Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
// Wellbeing check-ins ("How I feel"): private by default and kept on board by the backend (backend/wellbeing.py), so
// they survive a reload or another browser. The crew member can choose to send one to the flight surgeon; ground only
// ever receives what was sent (the backend filters it). Opened as a local file (no backend): localStorage, as before.
import { useEffect, useSyncExternalStore } from 'react'
import { api, NO_SERVER, type ApiCheckIn, type WbAdvice } from './api'

/* ---------- Questionnaires (same definitions as backend/wellbeing.py, which validates them) ----------
 * Daily: 0-10 scales in the format of NASA's in-flight Reaction Self Test (ISS 2009-2014) + Samn-Perelli fatigue (1-7,
 * USAF, approved for public release). Read against each person's own trend, not clinical cut-offs.
 * Every 14 days: PHQ-4 (Kroenke et al. 2009; Pfizer: free for download and use). Screening only, not a diagnosis. */
export const DAILY_ID = 'metis_daily_v2', PHQ4_ID = 'phq4'
export const QUESTIONS = ['sleep_hours', 'sleep_quality', 'fatigue', 'stress', 'workload', 'crew', 'mood'] as const
export type Question = typeof QUESTIONS[number]
export const PHQ4_QUESTIONS = ['phq_nervous', 'phq_worry', 'phq_interest', 'phq_down'] as const
export type PhqQuestion = typeof PHQ4_QUESTIONS[number]
export const RANGE: Record<Question | PhqQuestion, [number, number]> = {
  sleep_hours: [0, 14], sleep_quality: [0, 10], fatigue: [1, 7], stress: [0, 10], workload: [0, 10], crew: [0, 10], mood: [0, 10],
  phq_nervous: [0, 3], phq_worry: [0, 3], phq_interest: [0, 3], phq_down: [0, 3],
}
/** An answer that deserves attention (same thresholds as backend risks()). */
export function concerning(q: string, v: number) {
  switch (q) {
    case 'sleep_hours': return v < 6
    case 'sleep_quality': return v <= 4
    case 'fatigue': return v >= 5
    case 'stress': return v >= 7
    case 'workload': return v >= 8
    case 'crew': return v <= 4
    case 'mood': return v <= 3
    default: return false
  }
}
export const fmtAnswer = (q: string, v: number) => (q === 'sleep_hours' ? `${v} h` : `${v}/${RANGE[q as Question]?.[1] ?? 10}`)
export interface CheckIn { id: string; ts: number; crewId: string; instrument: string; answers: Record<string, number>; tags: string[]; note: string; shared: boolean; noteShared: boolean
  scores?: { total: number; band: string; gad2: number; phq2: number; anxiety_positive: boolean; mood_positive: boolean } }
export const isDaily = (c: CheckIn) => (c.instrument ?? DAILY_ID) === DAILY_ID && QUESTIONS.every(q => typeof c.answers[q] === 'number')
export function phq4Scores(a: Record<string, number>) {
  const gad2 = a.phq_nervous + a.phq_worry, phq2 = a.phq_interest + a.phq_down, total = gad2 + phq2
  return { total, gad2, phq2, band: total <= 2 ? 'normal' : total <= 5 ? 'mild' : total <= 8 ? 'moderate' : 'severe', anxiety_positive: gad2 >= 3, mood_positive: phq2 >= 3 }
}

const subs = new Set<() => void>()
const emit = () => subs.forEach(f => f())
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f) } }

/* ---------- without a backend (metis-demo.html opened as a file): localStorage ---------- */
const KEY = 'metis.wellbeing'
const read = (): CheckIn[] => { try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') as CheckIn[] } catch { return [] } }
let local: CheckIn[] = NO_SERVER ? read() : []
function writeLocal(next: CheckIn[]) {
  local = next.slice(-200)
  try { localStorage.setItem(KEY, JSON.stringify(local)) } catch { /* private mode: keep it in memory */ }
  emit()
}
if (NO_SERVER && typeof window !== 'undefined') window.addEventListener('storage', e => { if (e.key === KEY) { local = read(); emit() } })

/* ---------- with the backend: one cached list per (crew member, viewer) ---------- */
const fromApi = (x: ApiCheckIn): CheckIn => ({ id: x.id, ts: x.ts, crewId: x.crew_id, instrument: x.instrument, answers: x.answers, tags: x.tags,
  note: x.note ?? '', shared: x.shared, noteShared: x.note_shared, scores: x.scores })
const cache = new Map<string, CheckIn[]>()
const EMPTY: CheckIn[] = []
const key = (crewId: string, viewer: string) => `${crewId}|${viewer}`
async function refresh(crewId: string, viewer: string) {
  try { cache.set(key(crewId, viewer), (await api.wbList(crewId, viewer)).map(fromApi)); emit() } catch { /* backend down: keep what we had */ }
}
const refreshAll = (crewId: string) => { for (const k of cache.keys()) if (k.startsWith(crewId + '|')) void refresh(crewId, k.slice(crewId.length + 1)) }

/** Saves a check-in on board. shared = also send it to the flight surgeon (the backend creates the packet).
 *  Returns Metis's advice for these answers (from the backend), or null without one (the screen then uses its own). */
export async function addCheckIn(c: CheckIn, name: string): Promise<WbAdvice[] | null> {
  if (c.instrument === PHQ4_ID) c = { ...c, scores: phq4Scores(c.answers) }
  if (NO_SERVER) {
    writeLocal([...local, c])
    if (c.shared) void api.postEvent('send_flight_surgeon', c.crewId, { kind: 'wellbeing', text_en: checkInText(c, 'en', name), text_es: checkInText(c, 'es', name) })
    return null
  }
  const k = key(c.crewId, c.crewId)
  cache.set(k, [c, ...(cache.get(k) ?? [])]); emit()            // shown at once, replaced by the saved copy
  try {
    const r = await api.wbAdd({ crew_id: c.crewId, instrument: c.instrument, answers: c.answers, tags: c.tags, note: c.note, share: c.shared, share_note: c.noteShared })
    const saved = fromApi(r)
    cache.set(k, [saved, ...(cache.get(k) ?? []).filter(x => x.id !== c.id && x.id !== saved.id)]); emit()
    refreshAll(c.crewId)
    return r.advice
  } catch (e) { console.warn('[metis] check-in not saved on board:', e); return null }
}

/** Sends an earlier, private check-in to the flight surgeon. `name` is only used without a backend (local packet text). */
export async function shareCheckIn(c: CheckIn, withNote: boolean, name: string) {
  if (NO_SERVER) {
    const x = { ...c, shared: true, noteShared: withNote }
    void api.postEvent('send_flight_surgeon', c.crewId, { kind: 'wellbeing', text_en: checkInText(x, 'en', name), text_es: checkInText(x, 'es', name) })
    writeLocal(local.map(y => (y.id === c.id ? x : y))); return
  }
  try { await api.wbShare(c.id, withNote); refreshAll(c.crewId) } catch (e) { console.warn('[metis] check-in not sent:', e) }
}

/** Check-ins of one crew member, newest first. onlyShared = what ground sees (only what was sent to it). */
export function useCheckIns(crewId: string, onlyShared = false): CheckIn[] {
  const viewer = onlyShared ? 'ground' : crewId
  useEffect(() => {
    if (NO_SERVER) return
    void refresh(crewId, viewer)
    const id = setInterval(() => void refresh(crewId, viewer), onlyShared ? 5000 : 15000)   // ground: new packets arrive
    return () => clearInterval(id)
  }, [crewId, viewer, onlyShared])
  const list = useSyncExternalStore(subscribe, () => (NO_SERVER ? local : cache.get(key(crewId, viewer)) ?? EMPTY))
  if (!NO_SERVER) return list
  return list.filter(c => c.crewId === crewId && (!onlyShared || c.shared)).sort((a, b) => b.ts - a.ts)
}

export const TAGS = ['homesick', 'workload', 'crew', 'tired', 'calm', 'focused', 'bored', 'worried'] as const

export const WB_TXT = {
  en: {
    title: 'How I feel', sub: 'A private check-in. It stays on board unless you choose to send it to ground.',
    today: 'Today’s check-in', todaySub: 'Seven quick questions, about a minute. The same kind of scales NASA crews used on the ISS.',
    q: { sleep_hours: 'Sleep', sleep_quality: 'Sleep quality', fatigue: 'Fatigue', stress: 'Stress', workload: 'Workload', crew: 'Crew relations', mood: 'Mood' } as Record<Question, string>,
    ask: { sleep_hours: 'How many hours did you sleep last night?', sleep_quality: 'How well did you sleep?', fatigue: 'How tired do you feel right now?',
      stress: 'How stressed do you feel today?', workload: 'How heavy was your workload today?', crew: 'How are you getting along with the crew today?', mood: 'Overall, how is your mood today?' } as Record<Question, string>,
    ends: { sleep_quality: ['Very badly', 'Very well'], stress: ['Not at all', 'Extremely'], workload: ['Very light', 'Very heavy'], crew: ['Very badly', 'Very well'], mood: ['Very low', 'Very good'] } as Record<string, [string, string]>,
    fatigue: ['Fully alert, wide awake', 'Very lively, responsive', 'Okay, somewhat fresh', 'A little tired, less than fresh', 'Moderately tired, let down', 'Extremely tired, hard to concentrate', 'Completely exhausted'],
    phqTitle: 'Two-week check', phqSub: 'Every 14 days: four questions about the last two weeks (PHQ-4). It is a screening, not a diagnosis.',
    phqIntro: 'Over the last 2 weeks, how often have you been bothered by the following problems?',
    phq: { phq_nervous: 'Feeling nervous, anxious or on edge', phq_worry: 'Not being able to stop or control worrying', phq_interest: 'Little interest or pleasure in doing things', phq_down: 'Feeling down, depressed or hopeless' } as Record<PhqQuestion, string>,
    phqOpts: ['Not at all', 'Several days', 'More than half the days', 'Nearly every day'],
    phqSave: 'Save the two-week check', phqLater: 'Later', phqDone: 'Two-week check saved',
    adviceTitle: (n: string) => `${n}, here is what I suggest:`, openTriage: 'Check it with Metis', source: 'Source',
    scale: ['Very low', 'Low', 'Okay', 'Good', 'Very good'],
    onMind: 'On my mind', tag: { homesick: 'Missing home', workload: 'Workload', crew: 'Crew relations', tired: 'Tired', calm: 'Calm', focused: 'Focused', bored: 'Monotony', worried: 'Worried' } as Record<string, string>,
    note: 'Private note', notePh: 'Anything you want to write down. Only you see it.',
    share: 'Also send this check-in to the flight surgeon', shareNote: 'Include my note', arrives: 'Arrives on Earth in', noLink: 'No link now: it will leave when the link is back.',
    save: 'Save', saveSend: 'Save and send to ground', saved: 'Saved on board', sent: 'Sent to ground',
    history: 'My last check-ins', none: 'No check-ins yet.', private: 'Private', shared: 'Shared with ground', sendNow: 'Send to ground',
    month: 'Mood, last 30 days', metis: 'Metis',
    tipLow: 'Today looks heavy. A short call home or a few minutes at the window can help. If it keeps going, you can talk to the crew medical officer.',
    tipTired: 'Low energy after poor sleep. Try to protect tonight’s sleep window and keep the bunk dark and ventilated.',
    tipOk: 'Thanks for checking in. Keep the routines that are working for you.',
  },
  es: {
    title: 'Cómo me siento', sub: 'Un registro privado. Se queda a bordo salvo que decidas enviarlo a Tierra.',
    today: 'Registro de hoy', todaySub: 'Siete preguntas rápidas, un minuto. El mismo tipo de escalas que usaron las tripulaciones de NASA en la ISS.',
    q: { sleep_hours: 'Sueño', sleep_quality: 'Calidad del sueño', fatigue: 'Cansancio', stress: 'Estrés', workload: 'Carga de trabajo', crew: 'Relación con la tripulación', mood: 'Ánimo' } as Record<Question, string>,
    ask: { sleep_hours: '¿Cuántas horas dormiste anoche?', sleep_quality: '¿Qué tal dormiste?', fatigue: '¿Cuánto cansancio tienes ahora?',
      stress: '¿Cuánto estrés sientes hoy?', workload: '¿Cómo de pesada fue hoy tu carga de trabajo?', crew: '¿Qué tal te llevas hoy con la tripulación?', mood: 'En general, ¿qué tal tu ánimo hoy?' } as Record<Question, string>,
    ends: { sleep_quality: ['Muy mal', 'Muy bien'], stress: ['Nada', 'Muchísimo'], workload: ['Muy ligera', 'Muy pesada'], crew: ['Muy mal', 'Muy bien'], mood: ['Muy bajo', 'Muy bueno'] } as Record<string, [string, string]>,
    fatigue: ['Totalmente despierto y alerta', 'Muy activo, con reflejos', 'Bien, bastante fresco', 'Algo cansado, menos fresco', 'Bastante cansado, de bajón', 'Muy cansado, cuesta concentrarse', 'Totalmente agotado'],
    phqTitle: 'Chequeo de dos semanas', phqSub: 'Cada 14 días: cuatro preguntas sobre las dos últimas semanas (PHQ-4). Es un cribado, no un diagnóstico.',
    phqIntro: 'En las últimas 2 semanas, ¿con qué frecuencia te han molestado los siguientes problemas?',
    phq: { phq_nervous: 'Sentirte nervioso, ansioso o con los nervios de punta', phq_worry: 'No poder dejar de preocuparte o no poder controlar la preocupación', phq_interest: 'Poco interés o placer en hacer las cosas', phq_down: 'Sentirte decaído, deprimido o sin esperanza' } as Record<PhqQuestion, string>,
    phqOpts: ['Nunca', 'Varios días', 'Más de la mitad de los días', 'Casi todos los días'],
    phqSave: 'Guardar el chequeo de dos semanas', phqLater: 'Más tarde', phqDone: 'Chequeo de dos semanas guardado',
    adviceTitle: (n: string) => `${n}, esto es lo que te sugiero:`, openTriage: 'Revisarlo con Metis', source: 'Fuente',
    scale: ['Muy bajo', 'Bajo', 'Normal', 'Bien', 'Muy bien'],
    onMind: 'Lo que tengo en la cabeza', tag: { homesick: 'Echo de menos casa', workload: 'Carga de trabajo', crew: 'Relación con la tripulación', tired: 'Cansancio', calm: 'Tranquilidad', focused: 'Concentración', bored: 'Monotonía', worried: 'Preocupación' } as Record<string, string>,
    note: 'Nota privada', notePh: 'Lo que quieras apuntar. Solo lo ves tú.',
    share: 'Enviar también este registro al cirujano de vuelo', shareNote: 'Incluir mi nota', arrives: 'Llega a Tierra en', noLink: 'Ahora no hay enlace: saldrá cuando vuelva.',
    save: 'Guardar', saveSend: 'Guardar y enviar a Tierra', saved: 'Guardado a bordo', sent: 'Enviado a Tierra',
    history: 'Mis últimos registros', none: 'Todavía no hay registros.', private: 'Privado', shared: 'Compartido con Tierra', sendNow: 'Enviar a Tierra',
    month: 'Ánimo, últimos 30 días', metis: 'Metis',
    tipLow: 'Hoy parece un día pesado. Una llamada a casa o unos minutos en la ventana pueden ayudar. Si sigue así, puedes hablar con el oficial médico.',
    tipTired: 'Poca energía después de dormir mal. Intenta proteger tu horario de sueño esta noche, con la litera a oscuras y ventilada.',
    tipOk: 'Gracias por registrarlo. Mantén las rutinas que te están funcionando.',
  },
}

/** One-line text of a check-in for the Ground inbox. */
export function checkInText(c: CheckIn, lang: 'en' | 'es', name: string) {
  const s = WB_TXT[lang]
  const sc = c.instrument === PHQ4_ID ? (c.scores ?? phq4Scores(c.answers)) : null
  const parts = sc ? `PHQ-4 ${sc.total}/12 (${sc.band}), PHQ-2 ${sc.phq2}/6, GAD-2 ${sc.gad2}/6`
    : QUESTIONS.map(q => `${s.q[q].toLowerCase()} ${fmtAnswer(q, c.answers[q])}`).join(', ')
  const tags = c.tags.length ? `. ${s.onMind}: ${c.tags.map(t => s.tag[t].toLowerCase()).join(', ')}` : ''
  const note = c.noteShared && c.note.trim() ? `. ${s.note}: “${c.note.trim()}”` : ''
  return `${lang === 'es' ? 'Registro de bienestar de' : 'Wellbeing check-in from'} ${name}: ${parts}${tags}${note}`
}

/* ---------- What ground can see about how a crew member feels (each crew member chooses) ---------- */
export type ShareLevel = 'none' | 'summary' | 'signals'
const SHARE_KEY = 'metis.wellbeing.share'
/** Defaults differ per character, as each person would choose differently (same as backend/wellbeing.py). */
const SHARE_DEFAULT: Record<string, ShareLevel> = { lena: 'signals', marco: 'summary', noor: 'summary', kenji: 'none' }
const readShare = (): Record<string, ShareLevel> => { try { return JSON.parse(localStorage.getItem(SHARE_KEY) ?? '{}') } catch { return {} } }
// With the backend this is only a cache of what it says; without it (local file), localStorage as before.
let share: Record<string, ShareLevel> = NO_SERVER ? readShare() : {}
const shareSubs = new Set<() => void>()
const shareEmit = () => shareSubs.forEach(f => f())
const isLevel = (l: string): l is ShareLevel => l === 'none' || l === 'summary' || l === 'signals'
export function setShareLevel(crewId: string, level: ShareLevel) {
  share = { ...share, [crewId]: level }; shareEmit()
  if (NO_SERVER) { try { localStorage.setItem(SHARE_KEY, JSON.stringify(share)) } catch { /* private mode */ } return }
  api.wbSetShareLevel(crewId, level).catch(e => console.warn('[metis] share level not saved:', e))
}
if (NO_SERVER && typeof window !== 'undefined') window.addEventListener('storage', e => { if (e.key === SHARE_KEY) { share = readShare(); shareEmit() } })
export function useShareLevel(crewId: string): ShareLevel {
  useEffect(() => {
    if (NO_SERVER) return
    let alive = true
    const load = () => api.wbShareLevel(crewId).then(r => { if (alive && isLevel(r.level) && share[crewId] !== r.level) { share = { ...share, [crewId]: r.level }; shareEmit() } }).catch(() => {})
    load(); const id = setInterval(load, 10000)
    return () => { alive = false; clearInterval(id) }
  }, [crewId])
  const m = useSyncExternalStore(f => { shareSubs.add(f); return () => { shareSubs.delete(f) } }, () => share)
  return m[crewId] ?? SHARE_DEFAULT[crewId] ?? 'summary'
}
export const SHARE_TXT = {
  en: { title: 'What ground can see about how I feel', none: 'Nothing', summary: 'A summary', signals: 'Which areas need attention',
    hint: { none: 'Ground sees nothing. Only a severe risk is flagged, without details.', summary: 'Ground sees one overall state and the mood trend.', signals: 'Ground sees the overall state and which areas need attention. Never your answers, notes or the reasons.' } },
  es: { title: 'Lo que Tierra puede ver de cómo me siento', none: 'Nada', summary: 'Un resumen', signals: 'Qué áreas necesitan atención',
    hint: { none: 'Tierra no ve nada. Solo se avisa de un riesgo grave, sin detalles.', summary: 'Tierra ve un estado general y la tendencia del ánimo.', signals: 'Tierra ve el estado general y qué áreas necesitan atención. Nunca tus respuestas, notas ni los motivos.' } },
}
