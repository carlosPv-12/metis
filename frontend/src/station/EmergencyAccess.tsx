// Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
// Emergency access (mockup). Only the commander and the crew medical officer can open a crewmember's private
// record, and only for a serious emergency. Anyone else sends a request to the commander. When access opens,
// Metis says how to act, following the deterministic, sourced triage tree (the AI only voices it).
import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Siren, Volume2 } from 'lucide-react'
import { api, type StationCrew } from '../api'
import { useLoad, useSpeaker } from '../hooks'
import { useLang, pick } from '../i18n'
import { useT } from '../i18n'
import { Card, DEC, METRICS, MetisLine, Spark, UNIT, fmt, useCrew } from '../ui'
import tree from '../../../backend/triage_tree.json'
import { AUTHORIZED, COMMANDER_ID, DURATION, REASONS, SEVERE, type Access, type AccessEntry, type Reason, type Requests } from './accessStore'
import '../link.css'

const TXT = {
  en: {
    access: 'Emergency access', reason: 'What is happening?', severe: 'I confirm this is a serious emergency.', confirm: 'Type your name to confirm:',
    open: 'Open private record for 15 minutes', cancel: 'Cancel', close: 'Close access', log: 'Emergency access log', empty: 'No emergency access yet.',
    dismiss: 'OK', opened: 'opened your data at', because: 'Reason:', until: 'Access remaining',
    send: 'Send to the commander', sentTo: 'Request sent to', onlyAuth: 'Only the commander and the medical officer can open private data, and only in a serious emergency. Your request goes to the commander.',
    requests: 'Emergency access requests', from: 'from', about: 'about', approve: 'Open data', decline: 'Dismiss', noRequests: 'No pending requests.',
  },
  es: {
    access: 'Acceso de emergencia', reason: '¿Qué está pasando?', severe: 'Confirmo que es una urgencia grave.', confirm: 'Escribe tu nombre para confirmar:',
    open: 'Abrir historial privado 15 minutos', cancel: 'Cancelar', close: 'Cerrar acceso', log: 'Registro de accesos de emergencia', empty: 'Todavía no hay accesos de emergencia.',
    dismiss: 'Entendido', opened: 'abrió tus datos a las', because: 'Motivo:', until: 'Tiempo de acceso restante',
    send: 'Enviar al comandante', sentTo: 'Petición enviada a', onlyAuth: 'Solo el comandante y la oficial médica pueden abrir los datos privados, y solo en una urgencia grave. Tu petición le llegará al comandante.',
    requests: 'Peticiones de acceso de emergencia', from: 'de', about: 'sobre', approve: 'Abrir datos', decline: 'Descartar', noRequests: 'No hay peticiones pendientes.',
  },
}
function time(when: number, lang: 'en' | 'es', date = false) {
  return new Date(when).toLocaleString(lang === 'es' ? 'es-ES' : 'en-GB', date ? { dateStyle: 'short', timeStyle: 'short' } : { hour: '2-digit', minute: '2-digit' })
}
export const canOpenPrivate = (crewId: string) => AUTHORIZED.includes(crewId)

export function AccessNotices({ access }: { access: Access }) {
  const { crewId } = useCrew(); const { lang } = useLang(); const s = TXT[lang]
  return <>{access.entries.filter(e => e.crewId === crewId && !e.dismissed).map(e => <div className="station-access-note" role="status" key={e.id}>{e.who} {s.opened} {time(e.when, lang, true)}. {s.because} {REASONS[e.reason][lang]}.<button type="button" className="btn" onClick={() => access.dismiss(e.id)}>{s.dismiss}</button></div>)}</>
}

export function AccessLog({ access }: { access: Access }) {
  const { lang } = useLang(); const s = TXT[lang]
  return <Card title={s.log} className="station-access-log">{access.entries.length ? <ul>{access.entries.map(e => <li key={e.id}><strong>{e.who} → {e.whom}</strong><br /><time dateTime={new Date(e.when).toISOString()}>{time(e.when, lang, true)}</time><br />{REASONS[e.reason][lang]}</li>)}</ul> : <p>{s.empty}</p>}</Card>
}

/** Pending requests, shown to the commander and the medical officer. */
export function AccessRequests({ actor, crew, access, requests }: { actor: StationCrew; crew: StationCrew[]; access: Access; requests: Requests }) {
  const { lang } = useLang(); const s = TXT[lang]
  const pending = requests.requests.filter(r => r.status === 'pending')
  if (!canOpenPrivate(actor.id) || !pending.length) return null
  return <Card className="station-requests" title={<><Siren size={14} />{s.requests}</>}>
    <ul>{pending.map(r => {
      const whom = crew.find(c => c.id === r.crewId)
      return <li key={r.id}>
        <div><strong>{REASONS[r.reason][lang]}</strong><br /><span className="small muted">{s.from} {r.fromName}, {s.about} {r.whom}, {time(r.when, lang)}</span></div>
        <div className="row wrap">
          <button type="button" className="btn danger" disabled={!whom} onClick={() => { if (whom) { access.grant(actor, whom, r.reason); requests.resolve(r.id, 'approved') } }}>{s.approve}</button>
          <button type="button" className="btn" onClick={() => requests.resolve(r.id, 'declined')}>{s.decline}</button>
        </div>
      </li>
    })}</ul>
  </Card>
}

export function EmergencyButton({ crew, actor, access, requests }: { crew: StationCrew; actor: StationCrew; access: Access; requests: Requests }) {
  const { lang } = useLang(); const s = TXT[lang]
  const dialog = useRef<HTMLDialogElement>(null)
  const [reason, setReason] = useState<Reason | ''>('')
  const [name, setName] = useState('')
  const [severe, setSevere] = useState(false)
  const authorized = canOpenPrivate(actor.id)
  const sent = requests.requests.some(r => r.status === 'pending' && r.fromId === actor.id && r.crewId === crew.id)
  const ready = !!reason && (!authorized || (severe && name.trim() === actor.name))
  return <>
    {sent ? <p className="small station-request-sent" role="status">{s.sentTo} {COMMANDER_ID[0].toUpperCase() + COMMANDER_ID.slice(1)}</p>
      : <button className="btn" type="button" onClick={() => { setName(''); setReason(''); setSevere(false); dialog.current?.showModal() }}>{s.access}</button>}
    <dialog ref={dialog} className="station-access-dialog" aria-labelledby={`access-title-${crew.id}`}>
      <form onSubmit={e => {
        e.preventDefault(); if (!ready || !reason) return
        if (authorized) access.grant(actor, crew, reason); else requests.send(actor, crew, reason)
        dialog.current?.close()
      }}>
        <h2 id={`access-title-${crew.id}`}>{s.access}: {crew.name}</h2>
        {!authorized && <p>{s.onlyAuth}</p>}
        <label>{s.reason}<select required autoFocus value={reason} onChange={e => setReason(e.target.value as Reason | '')}><option value="" disabled>—</option>{SEVERE.map(id => <option key={id} value={id}>{REASONS[id][lang]}</option>)}</select></label>
        {authorized && <>
          <label className="row" style={{ gap: 10 }}><input type="checkbox" checked={severe} onChange={e => setSevere(e.target.checked)} />{s.severe}</label>
          <label>{s.confirm} <strong>{actor.name}</strong><input required value={name} autoComplete="off" onChange={e => setName(e.target.value)} /></label>
        </>}
        <div className="row wrap"><button type="button" className="btn" onClick={() => dialog.current?.close()}>{s.cancel}</button><button type="submit" className="btn primary" disabled={!ready}>{authorized ? s.open : s.send}</button></div>
      </form>
    </dialog>
  </>
}

export function AccessCountdown({ entry, now, access }: { entry: AccessEntry; now: number; access: Access }) {
  const { lang } = useLang(); const s = TXT[lang]
  const left = Math.max(0, Math.ceil((entry.when + DURATION - now) / 1000))
  return <div className="station-access-countdown small"><p>{s.until}: <strong>{Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</strong></p><button className="btn" type="button" onClick={() => access.close(entry.id)}>{s.close}</button></div>
}

export function EmergencyDetails({ crew }: { crew: StationCrew }) {
  const { lang } = useLang(); const t = useT()
  const { data } = useLoad(() => api.crewOne(crew.id), [crew.id])
  const today = data?.days.at(-1)
  return <div className="station-access-detail">{pick(crew as never, 'note', lang) && <p>{pick(crew as never, 'note', lang)}</p>}{today && [...METRICS, 'mood_1_5' as const].map(m => <p key={m} className="small">{t(`m_${m}`)}: <strong>{fmt(today[m], DEC[m] ?? 0)} {m === 'mood_1_5' ? '/ 5' : t(UNIT[m])}</strong></p>)}</div>
}

const PRIV = {
  en: { trends: 'Last 14 days', hr: 'Resting heart rate', hrv: 'Heart rate variability', sleep: 'Sleep', co2: 'Bunk CO₂', guide: 'Metis: how to act now', listen: 'Listen', start: 'Follow the triage step by step', based: 'Based on', refs: 'references' },
  es: { trends: 'Últimos 14 días', hr: 'Pulso en reposo', hrv: 'Variabilidad cardiaca', sleep: 'Sueño', co2: 'CO₂ de la litera', guide: 'Metis: cómo actuar ahora', listen: 'Escuchar', start: 'Seguir el triaje paso a paso', based: 'Basado en', refs: 'referencias' },
}

type TreeNode = { say_en?: string; say_es?: string; why_en?: string; why_es?: string; text_en?: string; text_es?: string; sources?: string[] }
type Tree = { flows: Record<string, { start: string; nodes: Record<string, TreeNode> }> }

/** What emergency access opens: the 14-day private record plus Metis' guidance from the triage tree. */
export function PrivateDetails({ crew }: { crew: StationCrew }) {
  const { lang } = useLang(); const s = PRIV[lang]
  const { data } = useLoad(() => api.crewOne(crew.id), [crew.id])
  const sp = useSpeaker()
  // Both serious reasons start the "crewmate collapsed" protocol: responsiveness first, then the sourced steps.
  const flow = 'companion_collapse'
  const f = (tree as unknown as Tree).flows[flow]
  const node = f?.nodes[f.start]
  const say = node ? (lang === 'es' ? node.say_es ?? node.text_es : node.say_en ?? node.text_en) ?? '' : ''
  const why = node ? (lang === 'es' ? node.why_es : node.why_en) ?? '' : ''
  const nRefs = new Set(Object.values(f?.nodes ?? {}).flatMap(n => n.sources ?? [])).size
  return <div className="station-private">
    <div className="station-guidance">
      <span className="small muted">{s.guide}</span>
      <MetisLine small speaking={sp.speaking}><p style={{ margin: 0 }}><strong>{say}</strong></p>{why && <p className="small" style={{ margin: '4px 0 0' }}>{why}</p>}</MetisLine>
      <div className="row wrap" style={{ gap: 8 }}>
        <Link className="btn danger" to={`/triage?flow=${flow}`}><Siren size={15} />{s.start}</Link>
        <button type="button" className="btn" onClick={() => (sp.speaking ? sp.stop() : sp.speak(say, lang))}><Volume2 size={15} />{s.listen}</button>
      </div>
      <Link className="small" to="/settings?section=references">{s.based} {nRefs} {s.refs}</Link>
    </div>
    {data && <div className="station-private-trends"><span className="small muted">{s.trends}</span>
      {([['resting_hr_bpm', s.hr], ['hrv_ms', s.hrv], ['sleep_h', s.sleep], ['co2_night_peak_mmhg', s.co2]] as const).map(([m, label]) =>
        <div key={m}><span className="small">{label}</span><Spark days={data.days.slice(-14)} m={m} b={data.baseline[m]} h={32} /></div>)}
    </div>}
  </div>
}
