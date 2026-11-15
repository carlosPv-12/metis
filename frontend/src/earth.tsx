// Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
// Messages between the ship and Earth, made visible (Carlos, 15-nov: «no veo los mensajes que mando ni los que llegan
// a Tierra»). Two pieces, both fed by the backend station events (GET /api/station/events?viewer=…, filtered by role):
//  · EarthToasts: a pop-up when a message leaves for Earth, when it reaches Earth and when an answer from Earth arrives.
//    On Ground it pops up when a packet from the ship arrives and when a reply reaches the ship.
//  · EarthMessages: the /messages screen on the ship, with every message, its direction, status and live countdown.
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowDownLeft, ArrowUpRight, Radio, X } from 'lucide-react'
import { api, type Packet, type StationEvent, type Viewer } from './api'
import { useLang } from './i18n'
import { Page } from './ui'
import LinkChip from './LinkChip'
import './earth.css'

const TXT = {
  en: {
    title: 'Earth messages', sub: 'Everything Metis sends to the flight surgeon on Earth, and every answer from Earth. Messages travel with the link delay.',
    empty: 'No messages with Earth yet. In an emergency Metis sends one on its own.',
    toEarth: 'To Earth', fromEarth: 'From Earth', surgeon: 'Flight surgeon (Earth)', metis: 'Metis, from the ship', about: 'about',
    status: { queued_no_link: 'Queued: no link with Earth', in_transit: 'On its way to Earth', delivered: 'Delivered on board', delivered_awaiting_reply: 'Reached Earth', reply_window_open: 'Reached Earth' } as Record<string, string>,
    inTransitShip: 'On its way to the ship',
    sent: 'Message sent to Earth', sentQueued: 'Message to Earth queued: no link', arrives: (t: string) => `arrives in ${t}`,
    reached: 'Your message reached Earth', fromEarthToast: 'Message from Earth',
    gIn: 'New message from the ship', gOut: 'Your reply reached the ship', open: 'Open', close: 'Close',
  },
  es: {
    title: 'Mensajes con Tierra', sub: 'Todo lo que Metis envía al cirujano de vuelo, en Tierra, y cada respuesta de Tierra. Los mensajes viajan con el retraso del enlace.',
    empty: 'Todavía no hay mensajes con Tierra. En una emergencia, Metis envía uno por su cuenta.',
    toEarth: 'A Tierra', fromEarth: 'De Tierra', surgeon: 'Cirujano de vuelo (Tierra)', metis: 'Metis, desde la nave', about: 'sobre',
    status: { queued_no_link: 'En cola: sin enlace con Tierra', in_transit: 'En camino a Tierra', delivered: 'Entregado a bordo', delivered_awaiting_reply: 'Ha llegado a Tierra', reply_window_open: 'Ha llegado a Tierra' } as Record<string, string>,
    inTransitShip: 'En camino a la nave',
    sent: 'Mensaje enviado a Tierra', sentQueued: 'Mensaje a Tierra en cola: sin enlace', arrives: (t: string) => `llega en ${t}`,
    reached: 'Tu mensaje ha llegado a Tierra', fromEarthToast: 'Mensaje de Tierra',
    gIn: 'Mensaje nuevo de la nave', gOut: 'Tu respuesta ha llegado a la nave', open: 'Abrir', close: 'Cerrar',
  },
}

/** `eta`: when the packet arrives, on THIS device's clock (see publishEvents). */
export type EarthPacket = Packet & StationEvent & { eta?: number | null }
const TO_EARTH_TYPES = ['send_flight_surgeon', 'surgeon_notice', 'triage_summary', 'earth_message']
const arrived = (p: EarthPacket) => p.status !== 'queued_no_link' && p.status !== 'in_transit'
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, Math.floor(s % 60))).padStart(2, '0')}`
/** Seconds left until the packet arrives. Counts down between polls from the server's own «arrives in N s»,
 *  never from the server's clock time: a phone whose clock is off would show a wrong countdown. */
const leftS = (p: EarthPacket, now: number) => (p.eta != null ? Math.max(0, (p.eta - now) / 1000) : (p.arrives_in_s ?? null))

// One shared copy of the ship ↔ Earth messages per viewer. The always-on ear (voice.tsx) already fetches the
// station events every 2.5 s and publishes them here, so the pop-ups and the Messages screen add no requests
// of their own on the ship; they only fetch when nobody has published recently (Ground view, ear not polling).
interface Slot { list: EarthPacket[] | null; at: number; subs: Set<() => void> }
const slots = new Map<Viewer, Slot>()
const slot = (v: Viewer) => { let s = slots.get(v); if (!s) { s = { list: null, at: 0, subs: new Set() }; slots.set(v, s) } return s }

/** Feed the shared store with the events one viewer may see (backend-filtered), newest first. */
export function publishEvents(viewer: Viewer, evs: StationEvent[], local = false) {
  const now = Date.now(), s = slot(viewer)
  // the server sends whole seconds: keep the arrival time already worked out, so the countdown never jumps back up
  const prev = new Map((s.list ?? []).map(p => [String(p.id), p.eta]))
  const etaOf = (p: EarthPacket) => { if (p.arrives_in_s == null) return null; const e = now + p.arrives_in_s * 1000, o = prev.get(String(p.id)); return o != null && Math.abs(o - e) < 1500 ? o : e }
  s.list = (evs ?? []).flatMap((e): EarthPacket[] => {
    const d = (e as Partial<Packet>).direction
    if (d === 'to_earth' || d === 'to_ship') { const p = e as EarthPacket; return [{ ...p, eta: etaOf(p) }] }
    // No backend (single-file demo): what this browser stored when «Send to Earth» was pressed. There is no link to simulate.
    if (local && TO_EARTH_TYPES.includes(e.type)) return [{ ...e, id: e.id ?? e.ts ?? e.t, ts: e.ts ?? e.t, direction: 'to_earth', status: 'queued_no_link', arrives_in_s: null, eta: null } as EarthPacket]
    return []
  })
  if (local) s.list.reverse()
  s.at = now
  s.subs.forEach(f => f())
}

/** Ship ↔ Earth messages as one viewer sees them, newest first. null = not loaded yet. */
function useEarthPackets(viewer: Viewer, ms = 2500) {
  const [, bump] = useState(0)
  useEffect(() => {
    const s = slot(viewer), f = () => bump(n => n + 1)
    s.subs.add(f)
    const tick = () => {
      if (Date.now() - s.at < ms - 500) return                       // someone (the ear) has just published: reuse it
      api.eventsAs(viewer).then(evs => publishEvents(viewer, evs)).catch(() => publishEvents(viewer, api.localEvents(), true))
    }
    tick(); const id = setInterval(tick, ms)
    return () => { s.subs.delete(f); clearInterval(id) }
  }, [viewer, ms])
  return slot(viewer).list
}

function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(id) }, [ms])
  return now
}

const textOf = (p: EarthPacket, lang: 'en' | 'es') => {
  const t = lang === 'es' ? (p.text_es ?? p.text_en) : p.text_en
  return (t ?? '').replace(/^(Message from ground|Mensaje de Tierra|Flight surgeon[^:]*|Cirujano de vuelo[^:]*): /, '')
}

interface Toast { key: string; kind: 'up' | 'down'; title: string; body: string; go: string }

/** Pop-ups for messages with Earth. `viewer` = the crew member on this earpiece, or 'ground'. */
export function EarthToasts({ viewer }: { viewer: Viewer }) {
  const { lang } = useLang(); const s = TXT[lang]
  const nav = useNavigate()
  const list = useEarthPackets(viewer)
  const seen = useRef<Map<string, string> | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  useEffect(() => {
    if (!list) return
    const first = seen.current == null
    const prev = seen.current ?? new Map<string, string>()
    const next = new Map<string, string>()
    const add: Toast[] = []
    for (const p of list) {
      const id = String(p.id), st = p.status, was = prev.get(id)
      next.set(id, st)
      if (first || was === st) continue
      const who = (p as { name?: string }).name ?? (p.crew_id ? p.crew_id[0].toUpperCase() + p.crew_id.slice(1) : '')
      const body = textOf(p, lang)
      if (viewer === 'ground') {
        if (p.direction === 'to_earth' && arrived(p) && (was == null || !['delivered_awaiting_reply', 'reply_window_open'].includes(was)))
          add.push({ key: `${id}:in`, kind: 'down', title: s.gIn + (who ? `: ${who}` : ''), body, go: p.crew_id ? `/ground?crew=${p.crew_id}&tab=overview` : '/ground' })
        else if (p.direction === 'to_ship' && st === 'delivered')
          add.push({ key: `${id}:out`, kind: 'up', title: s.gOut, body, go: p.crew_id ? `/ground?crew=${p.crew_id}&tab=overview` : '/ground' })
        continue
      }
      if (p.direction === 'to_earth') {
        if (was == null) {
          const left = leftS(p, Date.now())
          add.push({ key: `${id}:sent`, kind: 'up', title: st === 'queued_no_link' ? s.sentQueued : s.sent + (left != null && left > 0 ? `, ${s.arrives(mmss(left))}` : ''), body, go: '/messages' })
        } else if (arrived(p) && (was === 'in_transit' || was === 'queued_no_link'))
          add.push({ key: `${id}:reached`, kind: 'up', title: s.reached, body, go: '/messages' })
      } else if (st === 'delivered')
        add.push({ key: `${id}:down`, kind: 'down', title: s.fromEarthToast, body, go: '/messages' })
    }
    seen.current = next
    if (add.length) setToasts(t => [...add, ...t].slice(0, 3))
  }, [list]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!toasts.length) return
    const id = setTimeout(() => setToasts(t => t.slice(0, -1)), 9000)
    return () => clearTimeout(id)
  }, [toasts])
  if (!toasts.length) return null
  return (
    <div className="earth-toasts" role="status" aria-live="polite">
      {toasts.map(t => (
        <div key={t.key} className={`earth-toast ${t.kind}`}>
          <span className="earth-toast-icon" aria-hidden>{t.kind === 'up' ? <ArrowUpRight size={18} /> : <ArrowDownLeft size={18} />}</span>
          <button type="button" className="earth-toast-main" onClick={() => { setToasts(x => x.filter(y => y.key !== t.key)); nav(t.go) }}>
            <strong>{t.title}</strong>{t.body && <span>{t.body}</span>}<em>{s.open}</em>
          </button>
          <button type="button" className="earth-toast-x" aria-label={s.close} onClick={() => setToasts(x => x.filter(y => y.key !== t.key))}><X size={16} /></button>
        </div>
      ))}
    </div>
  )
}

/** One message row: direction, who, text and status with a live countdown. Shared by the ship screen and Ground. */
export function EarthRow({ p, now, names, ground = false, action }: { p: EarthPacket; now: number; names?: Record<string, string>; ground?: boolean; action?: React.ReactNode }) {
  const { lang } = useLang(); const s = TXT[lang]
  const up = p.direction === 'to_earth'
  const left = leftS(p, now)
  const who = names?.[p.crew_id ?? ''] ?? (p as { name?: string }).name
  const st = up ? s.status[p.status] ?? p.status : p.status === 'delivered' ? s.status.delivered : p.status === 'queued_no_link' ? s.status.queued_no_link : s.inTransitShip
  const time = p.ts ? new Date(p.ts).toLocaleTimeString(lang === 'es' ? 'es-ES' : 'en-GB', { hour: '2-digit', minute: '2-digit' }) : ''
  return (
    <li className={`earth-row ${up ? 'up' : 'down'} ${p.status}`}>
      <span className="earth-row-icon" aria-hidden>{up ? <ArrowUpRight size={18} /> : <ArrowDownLeft size={18} />}</span>
      <div className="earth-row-main">
        <div className="earth-row-head">
          <strong>{up ? (ground ? s.metis : s.toEarth) : (ground ? s.surgeon : s.fromEarth)}</strong>
          {who && <span>{s.about} {who}</span>}
          <time>{time}</time>
        </div>
        <p>{textOf(p, lang)}</p>
        <span className={`earth-status ${p.status}`}>{st}{p.status === 'in_transit' && left != null ? `, ${mmss(left)}` : ''}</span>
      </div>
      {action}
    </li>
  )
}

/** /messages on the ship: every message with Earth that this crew member may see. */
export default function EarthMessages({ viewer }: { viewer: Viewer }) {
  const { lang } = useLang(); const s = TXT[lang]
  const list = useEarthPackets(viewer)
  const now = useNow()
  const [names, setNames] = useState<Record<string, string>>({})
  useEffect(() => { api.station().then(st => setNames(Object.fromEntries(st.crew.map(c => [c.id, c.name])))).catch(() => {}) }, [])
  return (
    <Page title={s.title} sub={s.sub} right={<LinkChip />}>
      <section className="card earth-card" aria-label={s.title}>
        {list && !list.length && <p className="muted"><Radio size={16} aria-hidden /> {s.empty}</p>}
        <ul className="earth-list">{(list ?? []).map(p => <EarthRow key={String(p.id)} p={p} now={now} names={names} />)}</ul>
      </section>
    </Page>
  )
}
