// Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
// Ground view (flight surgeon / mission control), after the final Metis concept (§13 privacy: the flight surgeon sees
// the detail; §12 warning levels; §14 delayed links). Backend: GET /api/ground, POST /api/ground/reply (API.md,
// «Vista de Tierra»). Layout: a central overview on top, the crew on the left, and for the chosen crew member their
// body, live vitals, daily data against their own baseline and a chat-style thread with the ship.
// Ground has no Metis voice (voice.tsx stays silent on /ground routes): the thread is text only.
import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Send, Radio, Sparkles, Clock } from 'lucide-react'
import { api, type GroundView, type Packet, type Fitness, type CrewDetail } from '../api'
import { usePoll, useLoad } from '../hooks'
import { useLang, useT, pick, unitL } from '../i18n'
import { Card, Shape, Spark, LevelTag, METRICS, DEC, UNIT, fmt, levelOf, type Level } from '../ui'
import MedicalReview from './MedicalReview'
import EarpiecePair from '../EarpiecePair'
import { useEmergencyAccess } from '../station/accessStore'
import { AccessLog } from '../station/EmergencyAccess'
import ShipPanel from '../ShipPanel'
import { REF } from './Trend'
import { matchN } from './Greeting'
import { findThr } from '../thresholds'
import { Lightbulb } from 'lucide-react'
import CrewAvatar from '../CrewAvatar'
import BodyModel3D from '../BodyModel3D'
import { useHotspots } from './Body'
import { LiveTile } from './Greeting'
import { BloodPanel } from './Trend'
import type { Threshold } from '../api'
import { useLiveVitals, LIVE_KEYS } from '../vitals'
import { useCrewSex } from '../settings'
import '../live.css'
import '../body-panel.css'
import '../ground.css'

const TXT = {
  en: {
    title: 'Ground', global: 'Global', globalSub: 'Ship and mission', overview: 'Mission overview', radiation: 'Radiation', career: 'of the career limit', perDay: '/day', lifeSupport: 'Life support', power: 'Power', medkit: 'Medical kit', low: 'Below minimum', expiring: 'Expire before the end of the mission', missionDay: 'Mission day', of: 'of', daysLeft: 'days left', nominal: 'Normal range', link: 'Link', delay: 'One-way', crewWatch: 'need attention', alerts: 'alerts', inbox: 'messages from the ship',
    ship: 'Ship systems', shipOk: 'All systems nominal', crew: 'Crew', body: 'Body', live: 'Live vitals', baseline: 'Against their own baseline',
    thread: 'Conversation with the ship', threadHint: 'What Metis sends from the ship and your replies. Messages travel with the link delay.',
    empty: 'No messages yet.', you: 'Flight surgeon', metis: 'Metis on board', toAll: 'to the whole crew', message: 'Write to', fitness: 'Duty status', none: 'No change',
    fit: 'Fit', limited: 'Limited duty', unfit: 'Unfit', send: 'Send', arrives: (m: string) => `Arrives in ${m}`, queued: 'Queued: no link right now',
    status: { queued_no_link: 'Queued, no link', in_transit: 'On its way', delivered: 'Delivered', delivered_awaiting_reply: 'Delivered, awaiting reply', reply_window_open: 'You can reply' },
    fitnessNow: 'Duty status', by: { default: 'default', cmo: 'set by the CMO', ground: 'set by Ground' }, role: { crew: 'Crew', commander: 'Commander', cmo: 'CMO' },
  },
  es: {
    title: 'Tierra', global: 'Global', globalSub: 'Nave y misión', overview: 'Resumen de la misión', radiation: 'Radiación', career: 'del límite de carrera', perDay: '/día', lifeSupport: 'Soporte vital', power: 'Energía', medkit: 'Botiquín', low: 'Por debajo del mínimo', expiring: 'Caducan antes del final de la misión', missionDay: 'Día de misión', of: 'de', daysLeft: 'días restantes', nominal: 'Rango normal', link: 'Enlace', delay: 'Ida', crewWatch: 'necesitan atención', alerts: 'avisos', inbox: 'mensajes de la nave',
    ship: 'Sistemas de la nave', shipOk: 'Todos los sistemas normales', crew: 'Tripulación', body: 'Cuerpo', live: 'Constantes en directo', baseline: 'Frente a su propia línea base',
    thread: 'Conversación con la nave', threadHint: 'Lo que Metis manda desde la nave y tus respuestas. Los mensajes viajan con el retraso del enlace.',
    empty: 'Todavía no hay mensajes.', you: 'Cirujano de vuelo', metis: 'Metis a bordo', toAll: 'a toda la tripulación', message: 'Escribe a', fitness: 'Aptitud', none: 'Sin cambios',
    fit: 'Apto', limited: 'Limitado', unfit: 'No apto', send: 'Enviar', arrives: (m: string) => `Llega en ${m}`, queued: 'En cola: ahora no hay enlace',
    status: { queued_no_link: 'En cola, sin enlace', in_transit: 'En camino', delivered: 'Entregado', delivered_awaiting_reply: 'Entregado, esperando respuesta', reply_window_open: 'Puedes responder' },
    fitnessNow: 'Aptitud', by: { default: 'por defecto', cmo: 'la marcó el CMO', ground: 'la marcó Tierra' }, role: { crew: 'Tripulante', commander: 'Comandante', cmo: 'CMO' },
  },
}
type S = typeof TXT['en']

export const GLOBAL = 'global'
/** The long "outside personal band: …" streak summary is not shown: the per-metric cards already say it. */
export const notBaseline = (a: { id?: string; text_en?: string }) => a.id !== 'lena_baseline' && !/outside personal band/i.test(a.text_en ?? '')
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, Math.round(s % 60))).padStart(2, '0')}`
const lvl = (s?: string): Level => (s === 'alarm' || s === 'fault' || s === 'red' ? 'alarm' : s === 'watch' || s === 'warning' ? 'watch' : 'ok')
const delayText = (d: number | null) => (d == null ? '—' : d < 60 ? `${d} s` : `${mmss(d)} min`)

export default function Ground() {
  const { lang } = useLang(); const s = TXT[lang]
  const raw = usePoll(() => api.ground(), 3000) as GroundView | null
  const g = useMemo(() => raw && { ...raw, alerts: raw.alerts.filter(notBaseline) }, [raw])
  const [params, setParams] = useSearchParams()
  const sel = params.get('crew')
  const setSel = (id: string) => setParams({ crew: id }, { replace: true })
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id) }, [])
  if (!g) return <div className="page ground-page" aria-label={s.title} />
  const isGlobal = !sel || sel === GLOBAL
  const crewId = isGlobal ? null : sel
  const crew = crewId ? g.crew.find(c => c.id === crewId) ?? null : null
  return (
    <div className="page ground-page" aria-label={s.title}>
      {isGlobal ? <GlobalView g={g} s={s} now={now} onPick={setSel}>
      {/* Central overview */}
        <section className="card feature feature-gradient ground-hero" aria-label={s.overview}>
          <div className="ground-hero-top">
            <div><h3>{s.overview}</h3>
              <p className="ground-hero-link"><Radio size={15} aria-hidden /><strong>{pick(g.mission as never, 'label', lang)}</strong> {s.delay} {delayText(g.mission.one_way_delay_s)}</p></div>
          </div>
          <div className="ground-hero-crew">
            {g.crew.map(c => {
              const l = lvl(c.status), v = g.vitals.find(x => x.id === c.id)?.now
              return <button key={c.id} type="button" className={`ground-hero-member ${l}`} data-crew={c.id} aria-pressed={c.id === crewId}>
                <CrewAvatar id={c.id} name={c.name} size={36} />
                <span><strong>{c.name}</strong><small>{v ? `${v.pulse ? Math.round(v.hr_bpm) : 0} bpm, SpO₂ ${v.spo2_pct != null ? Math.round(v.spo2_pct) : '–'}%` : ''}</small></span>
                <i className={`ground-dot ${l}`} aria-hidden />
              </button>
            })}
          </div>
        </section>
      </GlobalView>
        : crew && <CrewDetailView key={crew.id} g={g} crewId={crew.id} s={s} now={now} />}
    </div>
  )
}

const TABS = {
  en: { review: 'Medical review', overview: 'Overview and messages' },
  es: { review: 'Revisión médica', overview: 'Resumen y mensajes' },
}
type Tab = keyof typeof TABS['en']

function CrewDetailView({ g, crewId, s, now }: { g: GroundView; crewId: string; s: S; now: number }) {
  const { lang } = useLang(); const t = useT()
  const [params, setParams] = useSearchParams()
  const tab = ((params.get('tab') ?? 'review') in TABS.en ? params.get('tab') ?? 'review' : 'review') as Tab
  const setTab = (x: Tab) => setParams({ crew: crewId, tab: x }, { replace: true })
  const crew = g.crew.find(c => c.id === crewId)!
  const { data: detail } = useLoad(() => api.crewOne(crewId), [crewId]) as { data: CrewDetail | null }
  const { data: ths } = useLoad(api.thresholds)
  const live = useLiveVitals(crewId)
  const hotspots = useHotspots(detail, live).filter(h => h.id !== 'eyes' && h.id !== 'bones' && h.level !== 'nodata')
  const sex = useCrewSex(crewId)
  const fit = (crew as { fitness?: Fitness }).fitness
  const today = detail?.days[detail.days.length - 1]
  const alerts = g.alerts.filter(a => a.crew_id === crewId)
  return (
    <section className="ground-main" aria-label={crew.name}>
      <header className="ground-main-head">
        <CrewAvatar id={crew.id} name={crew.name} size={56} />
        <div><h2>{crew.name}</h2><p>{pick(crew as never, 'role', lang) || crew.role}</p></div>
        {fit && <span className={`ground-fitness ${fit.status}`}>{s.fitnessNow}: <strong>{s[fit.status]}</strong>{fit.by !== 'default' && <small> ({s.by[fit.by]})</small>}</span>}
      </header>
      {!!alerts.length && <div className="ground-crew-alerts">{alerts.map((a, i) => <p key={a.id ?? i} className={`tag ${lvl(a.level)}`}><Shape level={lvl(a.level)} />{pick(a as never, 'text', lang)}</p>)}</div>}

      <div className="ground-tabs" role="tablist" aria-label={crew.name}>
        {(Object.keys(TABS.en) as Tab[]).map(x => <button key={x} type="button" role="tab" aria-selected={tab === x} className={tab === x ? 'on' : ''} onClick={() => setTab(x)}>{TABS[lang][x]}</button>)}
      </div>

      {tab === 'review' && <MedicalReview g={g} crewId={crewId} detail={detail} live={live} />}

      {tab === 'overview' && <>
      <div className="ground-visual">
        <Card className="ground-body-card" title={s.body}>
          <div className="bodywrap figure ground-body"><BodyModel3D hotspots={hotspots} selected={null} onSelect={() => {}} sex={sex} /></div>
        </Card>
        <Card className="ground-live" title={s.live}>
          <div className="ground-live-grid">{LIVE_KEYS.map(k => <LiveTile key={k} live={live} signal={k} detailed />)}</div>
        </Card>
      </div>

      {detail && <SleepAirThird detail={detail} name={crew.name} />}
      <AskAI crewId={crewId} name={crew.name} />

      {detail && today && <Card title={s.baseline}>
        <div className="ground-metrics">
          {[...METRICS, 'mood_1_5' as const].map(m => {
            const b = detail.baseline[m]
            return <div key={m} className="ground-metric">
              <div className="ground-metric-top"><span>{t(`m_${m}`)}</span><LevelTag level={levelOf(m, today[m], b)} /></div>
              <strong>{fmt(today[m], DEC[m])}<small>{m === 'mood_1_5' ? '/5' : t(UNIT[m])}</small></strong>
              {b && <span className="ground-metric-band">{THIRD[lang].band(crew.name)} {fmt(b.band_low, DEC[m])}–{fmt(b.band_high, DEC[m])}</span>}
              <span className="ground-metric-band">{THIRD[lang].range} {fmt(Math.min(...detail.days.map(d => d[m])), DEC[m])}–{fmt(Math.max(...detail.days.map(d => d[m])), DEC[m])}</span>
              {REF[m].map(([id, kw]) => findThr(ths, id, kw)).filter(Boolean).map(th => <span key={(th as Threshold).id} className="ground-metric-ref">{pick(th as never, 'label', lang)}: <b>{String((th as Threshold).value)} {unitL((th as Threshold).unit, lang)}</b></span>)}
              <Spark days={detail.days} m={m} b={b} h={40} color="var(--info)" />
            </div>
          })}
        </div>
      </Card>}

      <Thread g={g} crewId={crewId} name={crew.name} s={s} now={now} />
      {/* Real NASA OSDR blood counts: too much detail for the ship, useful for the flight surgeon */}
      <BloodPanel />
      </>}
    </section>
  )
}

const THIRD = {
  en: {
    band: (n: string) => `${n}'s band`, range: '30 days', sleepAir: 'Sleep and cabin air', r: 'Sleep vs. CO₂ correlation, 30 nights',
    insight: (n: string, k: number) => k === 0 ? `${n}'s shortest nights this month do not line up with the bunk CO₂ peaks.` : k === 1 ? `${n}'s shortest night this month was also the highest bunk CO₂ peak.` : `${n}'s ${k} shortest nights this month were also the ${k} highest bunk CO₂ peaks.`,
    action: 'Suggested: ask the crew to check airflow in the crew quarters tonight and repeat the check-in tomorrow.',
  },
  es: {
    band: (n: string) => `Banda de ${n}`, range: '30 días', sleepAir: 'Sueño y aire de cabina', r: 'Correlación sueño y CO₂, 30 noches',
    insight: (n: string, k: number) => k === 0 ? `Las noches más cortas de ${n} este mes no coinciden con los picos de CO₂ de su litera.` : k === 1 ? `La noche más corta de ${n} este mes fue también el pico de CO₂ más alto de su litera.` : `Las ${k} noches más cortas de ${n} este mes fueron también los ${k} picos de CO₂ más altos de su litera.`,
    action: 'Sugerencia: pedir a la tripulación que revise la ventilación de los camarotes esta noche y repetir el chequeo mañana.',
  },
}

/** The Sleep × Air finding from Trends, written about the crew member (third person), with the correlation. */
function SleepAirThird({ detail, name }: { detail: CrewDetail; name: string }) {
  const { lang } = useLang(); const x = THIRD[lang]
  const k = matchN(detail.days)
  const d = detail.days, n = d.length
  const mx = d.reduce((a, q) => a + q.sleep_h, 0) / n, my = d.reduce((a, q) => a + q.co2_night_peak_mmhg, 0) / n
  const r = d.reduce((a, q) => a + (q.sleep_h - mx) * (q.co2_night_peak_mmhg - my), 0) / Math.sqrt(d.reduce((a, q) => a + (q.sleep_h - mx) ** 2, 0) * d.reduce((a, q) => a + (q.co2_night_peak_mmhg - my) ** 2, 0))
  return (
    <div className="sleepair-insight ground-sleepair" role="note" aria-label={x.sleepAir}>
      <span className="sleepair-insight-icon"><Lightbulb size={16} aria-hidden /></span>
      <p><b>{x.sleepAir}</b> {x.insight(name, k)}</p>
      <p className="sleepair-insight-action">{k > 0 ? `${x.action} ` : ''}{x.r}: {fmt(r, 2)}</p>
    </div>
  )
}

const ASK = {
  en: { title: 'Ask the AI', ph: (n?: string) => (n ? `Ask about ${n}'s data, e.g. why is the heart rate up?` : 'Ask about the crew or the ship, e.g. who needs attention today?'), ask: 'Ask', thinking: 'Thinking…', off: 'The AI is not available right now.' },
  es: { title: 'Preguntar a la IA', ph: (n?: string) => (n ? `Pregunta sobre los datos de ${n}, por ejemplo: ¿por qué tiene el pulso alto?` : 'Pregunta sobre la tripulación o la nave, por ejemplo: ¿quién necesita atención hoy?'), ask: 'Preguntar', thinking: 'Pensando…', off: 'La IA no está disponible ahora mismo.' },
}

/** Free question to the local AI from Ground. Uses the same chat endpoint as the ship; if it is not running, says so. */
function AskAI({ crewId, name }: { crewId: string | null; name?: string }) {
  const { lang } = useLang(); const x = ASK[lang]
  const [q, setQ] = useState(''); const [a, setA] = useState<string | null>(null); const [busy, setBusy] = useState(false)
  const ask = async () => {
    if (!q.trim() || busy) return
    setBusy(true); setA(null)
    try {
      const who = lang === 'es' ? 'El cirujano de vuelo en Tierra pregunta' : 'The flight surgeon on Earth asks'
      const r = await api.chat(crewId ?? 'lena', `${who}${name ? ` (${name})` : ''}: ${q.trim()}`, lang, [])
      setA(r.text || x.off)
    } catch { setA(x.off) } finally { setBusy(false) }
  }
  return (
    <section className="card ground-ask" aria-label={x.title}>
      <h3 className="ground-h"><Sparkles size={14} aria-hidden /> {x.title}</h3>
      <form className="ground-ask-row" onSubmit={e => { e.preventDefault(); void ask() }}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder={x.ph(name)} aria-label={x.title} maxLength={400} />
        <button type="submit" className="btn primary" disabled={!q.trim() || busy}><Sparkles size={15} />{busy ? x.thinking : x.ask}</button>
      </form>
      {a && <p className="ground-ask-answer" role="status">{a}</p>}
    </section>
  )
}

function Thread({ g, crewId, name, s, now }: { g: GroundView; crewId: string; name: string; s: S; now: number }) {
  const { lang } = useLang()
  const items = useMemo(() => [
    ...g.inbox.filter(p => p.crew_id === crewId).map(p => ({ p, mine: false })),
    ...g.outbox.filter(p => p.crew_id === crewId || p.crew_id == null).map(p => ({ p, mine: true })),
  ].sort((a, b) => new Date(a.p.ts ?? a.p.sent_ts ?? 0).getTime() - new Date(b.p.ts ?? b.p.sent_ts ?? 0).getTime()), [g, crewId])
  const [text, setText] = useState('')
  const [fitness, setFitness] = useState<Fitness['status'] | ''>('')
  const [busy, setBusy] = useState(false)
  const d = g.mission.one_way_delay_s
  const eta = g.mission.link === 'none' || d == null ? s.queued : s.arrives(delayText(d))
  const send = async () => {
    if (!text.trim()) return
    setBusy(true)
    try { await api.groundReply({ crew_id: crewId, text_en: text.trim(), text_es: text.trim(), fitness: fitness || null }); setText(''); setFitness('') } finally { setBusy(false) }
  }
  const body = (p: Packet) => {
    const raw = lang === 'es' ? (p as { summary_es?: string }).summary_es ?? p.text_es ?? p.summary_en ?? p.text_en : p.summary_en ?? p.text_en
    return (raw ?? '').replace(/^(Message from ground|Mensaje de Tierra|Flight surgeon[^:]*|Cirujano de vuelo[^:]*): /, '')
  }
  return (
    <Card className="ground-thread" title={s.thread}>
      <p className="small muted" style={{ marginTop: 0 }}>{s.threadHint}</p>
      <div className="ground-chat">
        {!items.length && <p className="small muted">{s.empty}</p>}
        {items.map(({ p, mine }, i) => {
          const left = p.arrives_ts ? Math.max(0, (new Date(p.arrives_ts).getTime() - now) / 1000) : p.arrives_in_s
          return <div key={`${p.id ?? i}-${mine}`} className={`ground-bubble ${mine ? 'mine' : 'theirs'}`}>
            <span className="ground-bubble-who">{mine ? s.you : `${s.metis}, ${name}`}{mine && p.crew_id == null ? ` (${s.toAll})` : ''}</span>
            <p>{p.name && !mine ? <strong>{p.name}. </strong> : null}{body(p)}</p>
            <span className={`ground-packet-status ${p.status}`}>{s.status[p.status] ?? p.status}{p.status === 'in_transit' && left != null ? ` ${mmss(left)}` : ''}</span>
          </div>
        })}
      </div>
      <div className="ground-compose">
        <textarea rows={2} value={text} maxLength={600} placeholder={`${s.message} ${name}`} aria-label={`${s.message} ${name}`} onChange={e => setText(e.target.value)} />
        <div className="ground-compose-foot">
          <label>{s.fitness}<select value={fitness} onChange={e => setFitness(e.target.value as Fitness['status'] | '')}>
            <option value="">{s.none}</option><option value="fit">{s.fit}</option><option value="limited">{s.limited}</option><option value="unfit">{s.unfit}</option>
          </select></label>
          <span className="small muted">{eta}</span>
          <button type="button" className="btn primary" disabled={!text.trim() || busy} onClick={send}><Send size={15} />{s.send}</button>
        </div>
      </div>
    </Card>
  )
}

/** The Ground crew list, shown in the left rail above the Ship / Ground switch (same look as before). */
export function GroundCrewRail() {
  const { lang } = useLang(); const s = TXT[lang]
  const g = usePoll(() => api.ground(), 5000) as GroundView | null
  const [params] = useSearchParams(); const nav = useNavigate(); const { pathname } = useLocation()
  if (!g) return null
  const crewId = pathname.startsWith('/ground') ? params.get('crew') : null
  return (
    <div className="ground-side ground-side-rail" aria-label={s.crew}>
      <h3 className="ground-h">{s.crew}</h3>
      {g.crew.map(c => {
        const l = lvl(c.status)
        return <button key={c.id} type="button" className={`ground-side-row ${c.id === crewId ? 'on' : ''}`} onClick={() => nav(`/ground?crew=${c.id}`)} aria-pressed={c.id === crewId}>
          <CrewAvatar id={c.id} name={c.name} size={44} />
          <span className="ground-side-name"><strong>{c.name}</strong><small>{s.role[(c as { crew_role?: 'crew' | 'commander' | 'cmo' }).crew_role ?? 'crew']}</small></span>
          {l !== 'ok' && <span className={`tag ${l}`}><Shape level={l} /></span>}
        </button>
      })}
    </div>
  )
}

const EQUIP_TXT = {
  en: { earpieces: 'Earpieces', equipment: 'Equipment', medicines: 'Medicines', qty: 'Qty / min', link: 'Link', weak: 'Weak link', expires: 'Expires before the mission ends', minimum: 'Minimum stock', below: 'below minimum' },
  es: { earpieces: 'Auriculares', equipment: 'Equipo', medicines: 'Medicamentos', qty: 'Cant. / mín.', link: 'Enlace', weak: 'Enlace débil', expires: 'Caduca antes del fin de la misión', minimum: 'Existencias mínimas', below: 'por debajo del mínimo' },
}

/** One medical kit line: name, a stock gauge with the minimum marked, quantity, and a clock if it expires in-mission. */
function Stock({ label, qty, min, flag }: { label: string; qty: number; min: number | null; flag: string | null }) {
  const top = Math.max(qty, (min ?? qty) * 2, 1)
  const low = min != null && qty < min
  return (
    <li className={`kit-item ${low ? 'low' : ''}`}>
      <span className="kit-name">{label}{flag && <Clock size={12} className="kit-exp" aria-label={flag}><title>{flag}</title></Clock>}</span>
      <span className="kit-gauge" aria-hidden><i style={{ width: `${(qty / top) * 100}%` }} />{min != null && <b style={{ left: `${(min / top) * 100}%` }} />}</span>
      <strong className="kit-qty">{qty}{min != null && <small>/{min}</small>}</strong>
    </li>
  )
}

/** Global: everything that belongs to the whole ship and mission, not to one crew member. */
function GlobalView({ g, s, now, onPick, children }: { g: GroundView; s: S; now: number; onPick: (id: string) => void; children: React.ReactNode }) {
  const { lang } = useLang()
  const st = usePoll(() => api.station(), 5000)
  const access = useEmergencyAccess(now)
  const eq = EQUIP_TXT[lang]
  const { data: meds } = useLoad(api.meds)
  const sys = g.ship.systems
  return (
    <div className="ground-global" onClickCapture={e => { const b = (e.target as Element).closest('.ground-hero-member') as HTMLElement | null; if (b?.dataset.crew) onPick(b.dataset.crew) }}>
      {children}
      <ShipPanel />
      <AskAI crewId={null} />
      <div className="ground-global-grid">
        <Card title={s.lifeSupport}>
          <div className="ground-systems">
            {sys.filter(x => x.group === 'life_support').map(x => <div key={x.id} className={`ground-system ${lvl(x.status)}`}>
              <span>{pick(x as never, 'label', lang)}</span><strong>{x.value} <small>{x.unit}</small></strong>
            </div>)}
          </div>
        </Card>
        <Card title={s.power}>
          <div className="ground-systems one">
            {sys.filter(x => x.group === 'power').map(x => <div key={x.id} className={`ground-system ${lvl(x.status)}`}>
              <span>{pick(x as never, 'label', lang)}</span><strong>{x.value} <small>{x.unit}</small></strong>
              {pick(x as never, 'note', lang) && <em>{pick(x as never, 'note', lang).replace(/\s*\((assumed|supuesto|supuesta)\)/gi, '')}</em>}
            </div>)}
          </div>
        </Card>
        {(meds || st) && <Card className="ground-medkit" title={s.medkit}>
          <div className="kit-cols">
            {meds && <div>
              <h4 className="kit-h">{eq.medicines}<small>{meds.mission_days_left} {s.daysLeft}</small></h4>
              <ul className="kit-list">{meds.inventory.map(m => <Stock key={m.id} label={lang === 'es' ? m.category_es : m.category_en} qty={m.qty} min={m.min} flag={m.expires_before_mission_end ? eq.expires : null} />)}</ul>
            </div>}
            {st && <div>
              <h4 className="kit-h">{eq.equipment}</h4>
              <ul className="kit-list">{st.medkit.map((m, i) => <Stock key={i} label={pick(m as never, 'item', lang) || m.item || ''} qty={m.qty} min={m.min ?? null} flag={null} />)}</ul>
            </div>}
          </div>
          <p className="kit-legend small muted"><i className="kit-min-key" /> {eq.minimum}</p>
        </Card>}
        {st && <Card className="ground-earpieces" title={eq.earpieces}>
          {g.crew.map(c => {
            const h = st.headsets.find(x => x.crew_id === c.id)
            return <div key={c.id} className="ground-ear-row">
              <span className="ground-ear-who"><CrewAvatar id={c.id} name={c.name} size={32} /><strong>{c.name}</strong>
                {h && <small className={h.link === 'ok' ? 'ok' : 'weak'}>{h.link === 'ok' ? eq.link : eq.weak}</small>}</span>
              <EarpiecePair battery={h?.battery_pct} crewId={c.id} compact />
            </div>
          })}
        </Card>}
        <div className="ground-access"><AccessLog access={access} /></div>
      </div>
    </div>
  )
}
