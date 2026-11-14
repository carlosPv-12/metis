// Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
// Wellbeing check-ins ("How I feel"): private by default and kept on board by the backend (backend/wellbeing.py), so
// they survive a reload or another browser. The crew member can choose to send one to the flight surgeon; ground only
// ever receives what was sent (the backend filters it). Opened as a local file (no backend): localStorage, as before.
import { useEffect, useSyncExternalStore } from 'react'
import { api, NO_SERVER, type ApiCheckIn } from './api'

export type Score = 1 | 2 | 3 | 4 | 5
export const QUESTIONS = ['mood', 'energy', 'stress', 'sleep', 'connected'] as const
export type Question = typeof QUESTIONS[number]
export interface CheckIn { id: string; ts: number; crewId: string; answers: Record<Question, Score>; tags: string[]; note: string; shared: boolean; noteShared: boolean }

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
const fromApi = (x: ApiCheckIn): CheckIn => ({ id: x.id, ts: x.ts, crewId: x.crew_id, answers: x.answers as Record<Question, Score>, tags: x.tags,
  note: x.note ?? '', shared: x.shared, noteShared: x.note_shared })
const cache = new Map<string, CheckIn[]>()
const EMPTY: CheckIn[] = []
const key = (crewId: string, viewer: string) => `${crewId}|${viewer}`
async function refresh(crewId: string, viewer: string) {
  try { cache.set(key(crewId, viewer), (await api.wbList(crewId, viewer)).map(fromApi)); emit() } catch { /* backend down: keep what we had */ }
}
const refreshAll = (crewId: string) => { for (const k of cache.keys()) if (k.startsWith(crewId + '|')) void refresh(crewId, k.slice(crewId.length + 1)) }

/** Saves a check-in on board. shared = also send it to the flight surgeon (the backend creates the packet). */
export async function addCheckIn(c: CheckIn) {
  if (NO_SERVER) { writeLocal([...local, c]); return }
  const k = key(c.crewId, c.crewId)
  cache.set(k, [c, ...(cache.get(k) ?? [])]); emit()            // shown at once, replaced by the saved copy
  try {
    const saved = fromApi(await api.wbAdd({ crew_id: c.crewId, answers: c.answers, tags: c.tags, note: c.note, share: c.shared, share_note: c.noteShared }))
    cache.set(k, [saved, ...(cache.get(k) ?? []).filter(x => x.id !== c.id && x.id !== saved.id)]); emit()
    refreshAll(c.crewId)
  } catch (e) { console.warn('[metis] check-in not saved on board:', e) }
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
    today: 'Today’s check-in',
    q: { mood: 'Mood', energy: 'Energy', stress: 'Calm (no stress)', sleep: 'Sleep quality', connected: 'Feeling connected' } as Record<Question, string>,
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
    today: 'Registro de hoy',
    q: { mood: 'Ánimo', energy: 'Energía', stress: 'Calma (sin estrés)', sleep: 'Calidad del sueño', connected: 'Conexión con los demás' } as Record<Question, string>,
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
  const parts = QUESTIONS.map(q => `${s.q[q].toLowerCase()} ${c.answers[q]}/5`).join(', ')
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
