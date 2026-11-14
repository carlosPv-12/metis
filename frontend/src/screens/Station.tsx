// Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
// "Station console": dashboard for the commander and CMOs. Polls /api/station and /api/station/events.
import { useEffect, useState } from 'react'
import { Activity, Battery, Dumbbell, Ear, Orbit, Package, Radio, Thermometer, Wind } from 'lucide-react'
import { api, type Station as S, type StationEvent } from '../api'
import { usePoll } from '../hooks'
import { useLang, useT, pick, placeL, habitatTime, type Lang } from '../i18n'
import { Card, Page, Shape, useCrew, type Level } from '../ui'
import CrewAvatar from '../CrewAvatar'
import { fmtLinkDelay, useLink } from '../link'
import { packetStatus } from '../station/packet'
import { useReportQueue } from '../station/reportQueue'
import { AccessCountdown, AccessLog, AccessNotices, AccessRequests, EmergencyButton, EmergencyDetails, PrivateDetails } from '../station/EmergencyAccess'
import { useAccessRequests, useEmergencyAccess } from '../station/accessStore'
import '../link.css'
import { FALLBACK_STATION } from '../fallback'

export const lvl = (s?: string): Level => (s === 'alarm' || s === 'red' || s === 'critical' ? 'alarm' : s === 'watch' || s === 'warn' || s === 'amber' || s === 'warning' ? 'watch' : s === 'nodata' ? 'nodata' : 'ok')

/** Normalise the station payload so small schema differences from the backend never break the screen. */
export function normStation(raw: Partial<S> | null): S {
  const r = (raw ?? {}) as Partial<S> & Record<string, unknown>
  const F = FALLBACK_STATION
  return {
    mission_day: r.mission_day ?? F.mission_day,
    crew: Array.isArray(r.crew) && r.crew.length ? r.crew : F.crew,
    alerts: Array.isArray(r.alerts) ? r.alerts : F.alerts,
    environment: Array.isArray(r.environment) && r.environment.length ? r.environment : F.environment,
    comms: (r.comms ?? (r as Record<string, unknown>).comms_delay ?? F.comms) as S['comms'],
    headsets: Array.isArray(r.headsets) && r.headsets.length ? r.headsets : F.headsets,
    medkit: Array.isArray(r.medkit) && r.medkit.length ? r.medkit : F.medkit,
    packet: r.packet ?? null,
  }
}
export function evText(e: StationEvent, lang: Lang, names: Record<string, string>) {
  const own = pick(e as never, 'text', lang); if (own) return own
  const who = names[e.crew_id ?? ''] ?? e.crew_id ?? ''
  const map: Record<string, [string, string]> = {
    alert_crew: [`Crew alert — ${who} needs help`, `Aviso a la tripulación: ${who} necesita ayuda`],
    alert_commander: [`Commander and CMO notified — ${who}`, `Comandante y CMO avisados: ${who}`],
    send_flight_surgeon: [`Medical packet for ${who} queued to Earth`, `Paquete médico de ${who} en cola hacia Tierra`],
    collapse: [`${who} collapsed — earpiece fall detected, no voice response`, `${who} se ha desplomado: caída detectada, no responde`],
    checkin: [`${who} completed morning check-in`, `${who} hizo el chequeo de la mañana`],
  }
  const m = map[e.type]; return m ? m[lang === 'es' ? 1 : 0] : `${e.type}, ${who}`
}
// shown in simulated habitat time, like the header clock
const evTime = (e: StationEvent) => { const v = e.ts ?? e.t; if (!v) return ''; const d = new Date(v); return Number.isNaN(d.getTime()) ? '' : habitatTime(d.getTime()) }

const TXT = {
  en: { sub: 'Crew readiness and cabin conditions. Medical details stay private.', fit: 'Fit', limited: 'Limited', unfit: 'Unfit', unknown: 'No data', direct: 'Live', delayed: 'Messages arrive after the one-way delay.', offline: 'No link: queued', routing: 'Alert routing', simulated: 'Simulated crew and link', mode: 'Mode', realtime: 'Near real time', delay: 'Delayed', none: 'No link', privateEvent: 'Crew health alert. Details are private.', privateLog: 'Medical event. Details are private.' },
  es: { sub: 'Estado de la tripulación y del hábitat. Los detalles médicos son privados.', fit: 'Apto', limited: 'Limitado', unfit: 'No apto', unknown: 'Sin datos', direct: 'En directo', delayed: 'Los mensajes llegan tras el retraso de ida.', offline: 'Sin enlace: en cola', routing: 'Destino de los avisos', simulated: 'Tripulación y enlace simulados', mode: 'Modo', realtime: 'Casi en directo', delay: 'Con retraso', none: 'Sin enlace', privateEvent: 'Aviso de salud de la tripulación. Los detalles son privados.', privateLog: 'Evento médico. Los detalles son privados.' },
}

export default function Station() {
  const t = useT(); const { lang } = useLang(); const s = TXT[lang]
  const link = useLink(); const { crewId } = useCrew()
  const raw = usePoll(api.station, 2000)
  const evs = usePoll(() => api.events().catch(() => [] as StationEvent[]), 2500)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id) }, [])
  const access = useEmergencyAccess(now)
  const requests = useAccessRequests()
  const st = normStation(raw)
  const actor = st.crew.find(c => c.id === crewId)
  const canRead = (id?: string) => !!id
  const names = Object.fromEntries(st.crew.map(c => [c.id, c.name]))
  const ts = (e: StationEvent) => new Date(e.ts ?? e.t ?? 0).getTime() || Number(e.id) || 0
  const events = [...(evs ?? [])].sort((a, b) => ts(b) - ts(a))
  const hasExp = st.medkit.some(m => m.expires)
  const lastPkt = events.find(e => e.type === 'send_flight_surgeon')
  const [initialPacketTime] = useState(() => Date.now())
  const eventStart = lastPkt ? new Date(lastPkt.ts ?? lastPkt.t ?? '').getTime() : NaN
  const pktStart = Number.isFinite(eventStart) ? eventStart : st.packet ? initialPacketTime : null
  const report = useReportQueue(link)[0]
  const packetText = packetStatus(link, report && report.at >= (pktStart ?? 0) ? report.start ?? report.at : pktStart, now, lang)
  return (
    <Page title={t('station_title')}>
      <AccessNotices access={access} />
      {actor && <AccessRequests actor={actor} crew={st.crew} access={access} requests={requests} />}
      <div className="grid g4">
        {st.crew.map(c => {
          const l = lvl(c.status)
          const hs = st.headsets.find(h => h.crew_id === c.id)
          const entry = c.id !== crewId ? access.active(c.id, crewId) : undefined
          return (
            <div key={c.id} className={`crewcard ${l}`}>
              <div className="row between"><div className="row"><CrewAvatar id={c.id} name={c.name} size={44} /><div style={{ fontSize: 20, fontWeight: 600 }}>{c.name}</div></div>
                <span className={`tag ${l}`}><Shape level={l} />{l === 'ok' ? s.fit : l === 'watch' ? s.limited : l === 'nodata' ? s.unknown : s.unfit}</span></div>
              <div className="small muted">{pick(c as never, 'role', lang) || c.role}</div>
              <div className="row between" style={{ marginTop: 14, alignItems: 'baseline' }}>
                <span className={`mono ${c.vitals && !c.vitals.pulse ? 's-alarm' : ''}`} style={{ fontSize: 26 }}><Activity size={16} style={{ verticalAlign: -1, marginRight: 6, opacity: .7 }} />
                  {c.vitals ? (c.vitals.pulse ? Math.round(c.vitals.hr_bpm) : t('no_pulse')) : c.hr ?? '—'} {(!c.vitals || c.vitals.pulse) && <span className="small muted">{t('u_bpm')}</span>}</span>
                {hs && <span className="small muted"><Ear size={13} style={{ verticalAlign: -2 }} /> {hs.battery_pct}%</span>}
              </div>
              {c.vitals?.pulse && (
                <div className="row small mono muted" style={{ gap: 12, marginTop: 6 }}>
                  <span><Wind size={12} style={{ verticalAlign: -1 }} /> {Math.round(c.vitals.rr_brpm)} {t('u_brpm')}</span>
                  <span>SpO₂ {c.vitals.spo2_pct != null ? Math.round(c.vitals.spo2_pct) : '—'}%</span>
                  <span><Thermometer size={12} style={{ verticalAlign: -1 }} />{c.vitals.temp_c.toFixed(1)}°</span>
                  {c.vitals.activity > 0 && <span className="s-ok"><Dumbbell size={12} style={{ verticalAlign: -1 }} /> {t('exercising')}</span>}
                </div>
              )}
              <div className="small muted">{placeL(c.location, lang)}</div><EmergencyDetails key={c.id} crew={c} />
              {entry && <><PrivateDetails crew={c} /><AccessCountdown entry={entry} now={now} access={access} /></>}
              {!entry && actor && c.id !== crewId && <EmergencyButton crew={c} actor={actor} access={access} requests={requests} />}
            </div>
          )
        })}
      </div>
      <div className="grid station-modules" style={{ gridTemplateColumns: '1.3fr 1fr 1fr', marginTop: 18 }}>
        <Card title={<><Wind size={14} />{t('environment')}</>} right={<span className="small dim">CO₂ en {t('u_mmhg')}, {t('limit')} 3.0</span>}>
          {st.environment.map(e => {
            const l: Level = e.co2_mmhg > 4.5 ? 'alarm' : e.co2_mmhg > 3 ? 'watch' : 'ok'
            return (
              <div key={e.module} style={{ marginBottom: 12 }}>
                <div className="row between small"><span>{pick(e as never, 'module', lang) || e.module}</span><span className={`mono s-${l}`}>{e.co2_mmhg.toFixed(1)}{e.temp_c != null && <span className="dim">, {e.temp_c.toFixed(1)} °C</span>}</span></div>
                <div className="bar" style={{ position: 'relative', marginTop: 5 }}>
                  <i style={{ width: `${Math.min(100, (e.co2_mmhg / 6) * 100)}%`, background: `var(--${l === 'ok' ? 'ok' : l === 'watch' ? 'warn' : 'alarm'})` }} />
                  <span style={{ position: 'absolute', left: '50%', top: -3, bottom: -3, width: 2, background: 'var(--warn)' }} />
                </div>
              </div>
            )
          })}
        </Card>
        <Card title={<><Orbit size={14} />{t('comms')}</>}>
          <div className="stat"><div className="lbl">{link.label[lang]}</div><div className="val">{fmtLinkDelay(link.delayS, lang)}</div></div>
          <p className="small">{s.mode}: {link.mode === 'realtime' ? s.realtime : link.mode === 'delayed' ? s.delay : s.none}</p>
          <p className="small">{link.mode === 'realtime' ? s.direct : link.mode === 'none' ? s.offline : pktStart ? packetText : s.delayed}</p>
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
            <div className="small"><Package size={14} aria-hidden /> {t('queued_packet')}</div>
            <p className="small" role="status">{packetText}</p>
          </div>
        </Card>
        <Card title={<><Radio size={14} />{t('headsets')}</>}>
          {st.headsets.map(h => (
            <div key={h.crew_id} className="row between small" style={{ marginBottom: 10 }}>
              <span style={{ width: 70 }}>{names[h.crew_id] ?? h.crew_id}</span>
              <div className="bar" style={{ flex: 1 }}><i style={{ width: `${h.battery_pct}%`, background: h.battery_pct < 30 ? 'var(--warn)' : 'var(--ok)' }} /></div>
              <span className="mono" style={{ width: 44, textAlign: 'right' }}><Battery size={12} /> {h.battery_pct}</span>
              <span className={h.link === 'ok' ? 's-ok' : 's-watch'} style={{ width: 54, textAlign: 'right' }}>{h.link === 'ok' ? '● ' + t('link_ok_short') : h.link === 'weak' ? t('link_weak') : h.link}</span>
            </div>
          ))}
        </Card>
      </div>
      <div className="grid" style={{ gridTemplateColumns: '1.6fr 1fr', marginTop: 18 }}>
        <Card title={t('event_log')} right={<span className="small dim">{events.length}</span>}>
          <div className="log">
            {st.alerts.map((a, i) => <div key={'a' + i} className="e"><span className={`s-${lvl(a.level)}`}>{t('alerts')}</span><span>{canRead(a.crew_id) ? pick(a as never, 'text', lang) || a.text : s.privateEvent}</span></div>)}
            {events.map((e, i) => <div key={i} className="e"><span className="dim">{evTime(e)}</span><span className={e.type === 'alert_crew' || e.type === 'collapse' ? 's-alarm' : ''}>{canRead(e.crew_id) ? evText(e, lang, names) : s.privateLog}</span></div>)}
            {!events.length && <div className="dim">{t('no_events')}</div>}
          </div>
        </Card>
        <div className="grid" style={{ gap: 18, alignContent: 'start' }}>
        <Card title={t('med_kit')}>
          <table className="t"><thead><tr><th></th><th className="n">{t('qty_min')}</th>{hasExp && <th className="n">{t('expires')}</th>}</tr></thead>
            <tbody>{st.medkit.map((m, i) => <tr key={i}><td>{pick(m as never, 'item', lang) || m.item}</td><td className={`n ${m.min != null && m.qty < m.min ? 's-watch' : ''}`}>{m.qty}{m.min != null && <span className="dim">/{m.min}</span>}</td>{hasExp && <td className="n dim">{m.expires ?? ''}</td>}</tr>)}</tbody></table>
        </Card>
        </div>
      </div>
      <AccessLog access={access} />
    </Page>
  )
}
