// Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
// Ground: the data a crew member's Metis has sent, laid out like a medical check-up form so the flight surgeon can
// read it top to bottom: findings, vital signs, daily measurements against the personal baseline, sleep and air,
// body systems, blood, mood, equipment, the reports received and the current duty decision.
import { ArrowDown, ArrowRight, ArrowUp, ClipboardList, Lock } from 'lucide-react'
import { api, type CrewDetail, type Fitness, type GroundView, type Metric } from '../api'
import { usePoll, useLoad } from '../hooks'
import { useLang, useT, pick } from '../i18n'
import { DEC, LevelTag, METRICS, Shape, UNIT, fmt, levelOf, type Level } from '../ui'
import { LIVE_KEYS, LIVE_LABEL, type Live } from '../vitals'
import { useHotspots } from './Body'
import { insightText, matchN } from './Greeting'
import CrewAvatar from '../CrewAvatar'
import EarpiecePair from '../EarpiecePair'
import { QUESTIONS, WB_TXT, useCheckIns, useShareLevel } from '../wellbeing'
import { computeRisks, WB_RISK_TXT } from './Wellbeing'

const TXT = {
  en: {
    title: 'Medical review', from: 'Long-term record, compiled automatically on ground every 24 h', last: 'Last update', next: 'next in', missionDay: 'Mission day', location: 'Location',
    s1: 'Findings', s2: 'Vital signs now', s3: 'Daily measurements against the personal baseline', s4: 'Sleep and cabin air',
    s5: 'Body systems', s6: 'Blood count (NASA OSDR)', s7: 'Emotional wellbeing (filtered)', s8: 'Equipment', s9: 'Wellbeing check-ins shared', s10: 'Duty status',
    noFindings: 'Everything is inside the personal baseline today.', nights: (n: number) => (n === 1 ? '1 night' : `${n} nights in a row`),
    above: 'above', below: 'below', band: 'personal band', measure: 'Measurement', today: 'Today', mean7: '7-day mean', status: 'Status', trend: 'Trend',
    noLive: 'No live signal from the earpiece right now.', night: 'Night', sleep: 'Sleep', co2: 'Bunk CO₂ peak', limit: 'limit',
    outBand: 'outside the personal band', outRef: 'outside the reference range', analytes: 'analytes measured', moodScale: '1 low, 5 high',
    noReports: 'Nothing shared. Check-ins stay private unless the crew member chooses to send them.', notSet: 'Not set yet', fit: 'Fit for duty', limited: 'Limited duty', unfit: 'Not fit for duty',
    by: { ground: 'flight surgeon', cmo: 'crew medical officer', commander: 'commander' } as Record<string, string>,
    ok: 'In range', watch: 'Attention', alarm: 'Urgent',
  },
  es: {
    title: 'Revisión médica', from: 'Ficha de larga duración, se genera sola en Tierra cada 24 h', last: 'Última actualización', next: 'próxima en', missionDay: 'Día de misión', location: 'Ubicación',
    s1: 'Hallazgos', s2: 'Constantes ahora', s3: 'Medidas diarias frente a su línea base', s4: 'Sueño y aire de cabina',
    s5: 'Sistemas del cuerpo', s6: 'Hemograma (NASA OSDR)', s7: 'Bienestar emocional (filtrado)', s8: 'Equipo', s9: 'Registros de bienestar compartidos', s10: 'Aptitud',
    noFindings: 'Hoy todo está dentro de su línea base personal.', nights: (n: number) => (n === 1 ? '1 noche' : `${n} noches seguidas`),
    above: 'por encima de', below: 'por debajo de', band: 'su banda personal', measure: 'Medida', today: 'Hoy', mean7: 'Media 7 días', status: 'Estado', trend: 'Tendencia',
    noLive: 'Ahora no llega señal en directo del auricular.', night: 'Noche', sleep: 'Sueño', co2: 'Pico de CO₂ en litera', limit: 'límite',
    outBand: 'fuera de su banda personal', outRef: 'fuera del rango de referencia', analytes: 'analitos medidos', moodScale: '1 bajo, 5 alto',
    noReports: 'Nada compartido. Los registros son privados salvo que el tripulante decida enviarlos.', notSet: 'Sin decidir', fit: 'Apto', limited: 'Apto con limitaciones', unfit: 'No apto',
    by: { ground: 'cirujano de vuelo', cmo: 'oficial médico', commander: 'comandante' } as Record<string, string>,
    ok: 'En rango', watch: 'Atención', alarm: 'Urgente',
  },
}

/** "absolute_lymphocytes" -> "Absolute lymphocytes" */
const nice = (x: string) => x.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase())

const ALL: Metric[] = [...METRICS, 'mood_1_5']

/** Consecutive days, counting back from today, that metric m sits outside the personal band. */
function streak(c: CrewDetail, m: Metric) {
  const b = c.baseline[m]; if (!b) return 0
  let n = 0
  for (let i = c.days.length - 1; i >= 0; i--) { const v = c.days[i][m]; if (v < b.band_low || v > b.band_high) n++; else break }
  return n
}

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="mr-section">
      <h4><span className="mr-num">{n}</span>{title}</h4>
      <div className="mr-body">{children}</div>
    </section>
  )
}

/** Where today's value sits inside the personal band (shaded) on a min–max scale of the last 30 days. */
function BandBar({ c, m }: { c: CrewDetail; m: Metric }) {
  const b = c.baseline[m]; const v = c.days[c.days.length - 1][m]
  if (!b) return null
  const vals = c.days.map(d => d[m]).concat([b.band_low, b.band_high])
  const lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo || 1
  const x = (q: number) => `${((q - lo) / span) * 100}%`
  const l = levelOf(m, v, b)
  return (
    <div className="mr-bandbar" aria-hidden>
      <i className="mr-band" style={{ left: x(b.band_low), width: `calc(${x(b.band_high)} - ${x(b.band_low)})` }} />
      <b className={`mr-mark ${l}`} style={{ left: x(v) }} />
    </div>
  )
}

export default function MedicalReview({ g, crewId, detail, live }: { g: GroundView; crewId: string; detail: CrewDetail | null; live: Live }) {
  const { lang } = useLang(); const t = useT(); const s = TXT[lang]
  const crew = g.crew.find(c => c.id === crewId)!
  const { data: blood } = useLoad(api.blood)
  const st = usePoll(() => api.station(), 5000)
  const shared = useCheckIns(crewId, true)
  const allCheckIns = useCheckIns(crewId)
  const shareLvl = useShareLevel(crewId)
  const hotspots = useHotspots(detail, live).filter(h => h.id !== 'eyes' && h.id !== 'bones' && h.level !== 'nodata')
  if (!detail) return null
  const days = detail.days, today = days[days.length - 1], last7 = days.slice(-7)
  const fit = (crew as { fitness?: Fitness }).fitness
  const findings = ALL.map(m => ({ m, k: streak(detail, m), b: detail.baseline[m], v: today[m] })).filter(f => f.k > 0)
  const extra = g.alerts.filter(a => a.crew_id === crewId)
  const headset = st?.headsets?.find(h => h.crew_id === crewId)
  const room = st?.environment?.find(e => (crew.location ?? '').toLowerCase().startsWith((e.module_en ?? e.module).split(' ')[0].toLowerCase()))
  const bl = blood?.crew[crewId] ?? (blood ? Object.values(blood.crew)[0] : undefined)
  const wb = WB_TXT[lang]
  // The record is compiled on ground every 24 h at 06:00 (local clock), with no action from the crew.
  const nowD = new Date(), last = new Date(nowD); last.setHours(6, 0, 0, 0); if (last > nowD) last.setDate(last.getDate() - 1)
  const left = Math.max(0, last.getTime() + 864e5 - nowD.getTime()), lh = Math.floor(left / 36e5), lm = Math.floor((left % 36e5) / 6e4)
  const co2Limit = detail.co2_limit_mmhg?.value ?? 3
  const maxSleep = Math.max(8, ...last7.map(d => d.sleep_h)), maxCo2 = Math.max(co2Limit * 1.3, ...last7.map(d => d.co2_night_peak_mmhg))
  const lvlText = (l: Level) => (l === 'nodata' ? '' : s[l])
  const trend = (m: Metric) => {
    const a = last7.slice(0, 3).reduce((x, d) => x + d[m], 0) / 3, b = last7.slice(-3).reduce((x, d) => x + d[m], 0) / 3
    const rel = (b - a) / (Math.abs(a) || 1)
    return rel > .04 ? <ArrowUp size={15} aria-label="up" /> : rel < -.04 ? <ArrowDown size={15} aria-label="down" /> : <ArrowRight size={15} aria-label="steady" />
  }

  return (
    <article className="card mr" aria-label={`${s.title}, ${crew.name}`}>
      <header className="mr-head">
        <ClipboardList size={22} aria-hidden />
        <div className="mr-title"><h3>{s.title}</h3><p>{s.from}</p><p className="mr-auto">{s.last} {last.toLocaleTimeString(lang === 'es' ? 'es-ES' : 'en-GB', { hour: '2-digit', minute: '2-digit' })}, {s.next} {lh} h {lm} min</p></div>
        <dl className="mr-patient">
          <div><CrewAvatar id={crew.id} name={crew.name} size={40} /><span><strong>{crew.name}</strong><small>{pick(crew as never, 'role', lang) || crew.role}</small></span></div>
          <div><dt>{s.missionDay}</dt><dd>{today.mission_day}</dd></div>
          <div><dt>{s.location}</dt><dd>{room ? pick(room as never, 'module', lang) || room.module : crew.location ?? '–'}</dd></div>
        </dl>
      </header>

      <Section n={1} title={s.s1}>
        {!findings.length && !extra.length && <p className="mr-ok"><Shape level="ok" /> {s.noFindings}</p>}
        <ul className="mr-findings">
          {findings.map(f => {
            const l = levelOf(f.m, f.v, f.b)
            return <li key={f.m} className={l === 'ok' ? 'watch' : l}>
              <Shape level={l === 'ok' ? 'watch' : l} />
              <span><strong>{t(`m_${f.m}`)}</strong> {fmt(f.v, DEC[f.m])} {f.m === 'mood_1_5' ? '/5' : t(UNIT[f.m])}, {f.v > f.b.band_high ? s.above : s.below} {s.band} {fmt(f.b.band_low, DEC[f.m])}–{fmt(f.b.band_high, DEC[f.m])}</span>
              <em>{s.nights(f.k)}</em>
            </li>
          })}
          {extra.map((a, i) => <li key={a.id ?? i} className={a.level === 'alarm' ? 'alarm' : 'watch'}><Shape level={a.level === 'alarm' ? 'alarm' : 'watch'} /><span>{pick(a as never, 'text', lang)}</span></li>)}
        </ul>
      </Section>

      <Section n={2} title={s.s2}>
        {live.online && live.crew ? <div className="mr-vitals">
          {LIVE_KEYS.map(k => {
            const v = live.crew!.now[k] as number | null, l = live.level[k]
            return <div key={k} className={`mr-vital ${l}`}><span>{LIVE_LABEL[k][lang]}</span>
              <strong>{v == null ? '–' : fmt(v, LIVE_LABEL[k].dec)}<small>{LIVE_LABEL[k].unit}</small></strong>
              {l !== 'nodata' && <em><Shape level={l} /> {lvlText(l)}</em>}</div>
          })}
        </div> : <p className="small muted">{s.noLive}</p>}
      </Section>

      <Section n={3} title={s.s3}>
        <table className="mr-table">
          <thead><tr><th>{s.measure}</th><th className="n">{s.today}</th><th className="n">{s.mean7}</th><th>{s.band}</th><th>{s.trend}</th><th>{s.status}</th></tr></thead>
          <tbody>{ALL.map(m => {
            const b = detail.baseline[m], u = m === 'mood_1_5' ? '/5' : t(UNIT[m])
            return <tr key={m}>
              <td>{t(`m_${m}`)}</td>
              <td className="n"><strong>{fmt(today[m], DEC[m])}</strong> <small>{u}</small></td>
              <td className="n">{fmt(last7.reduce((x, d) => x + d[m], 0) / last7.length, DEC[m])}</td>
              <td className="mr-bandcell">{b && <><BandBar c={detail} m={m} /><small>{fmt(b.band_low, DEC[m])}–{fmt(b.band_high, DEC[m])}</small></>}</td>
              <td className="mr-trend">{trend(m)}</td>
              <td><LevelTag level={levelOf(m, today[m], b)} /></td>
            </tr>
          })}</tbody>
        </table>
      </Section>

      <Section n={4} title={s.s4}>
        <p className="mr-quote">{insightText(t, matchN(days))}</p>
        <div className="mr-nights" role="img" aria-label={`${s.sleep}, ${s.co2}`}>
          {last7.map(d => <div key={d.mission_day} className="mr-night">
            <div className="mr-night-bars">
              <i className="mr-sleep" style={{ height: `${(d.sleep_h / maxSleep) * 100}%` }} title={`${s.sleep} ${fmt(d.sleep_h, 1)} h`} />
              <i className={`mr-co2 ${d.co2_night_peak_mmhg > co2Limit ? 'over' : ''}`} style={{ height: `${(d.co2_night_peak_mmhg / maxCo2) * 100}%` }} title={`${s.co2} ${fmt(d.co2_night_peak_mmhg, 2)} mmHg`} />
              <b className="mr-limit" style={{ bottom: `${(co2Limit / maxCo2) * 100}%` }} />
            </div>
            <span>{d.mission_day}</span>
          </div>)}
        </div>
        <p className="mr-legend small"><i className="mr-sleep" /> {s.sleep} (h) <i className="mr-co2" /> {s.co2} (mmHg) <i className="mr-limit-key" /> {co2Limit} mmHg {s.limit}</p>
        {room && <p className="small muted">{pick(room as never, 'module', lang) || room.module}: CO₂ {fmt(room.co2_mmhg, 2)} mmHg{room.temp_c != null ? `, ${fmt(room.temp_c, 1)} °C` : ''}{room.rh_pct != null ? `, ${room.rh_pct} % RH` : ''}</p>}
      </Section>

      <Section n={5} title={s.s5}>
        <div className="mr-systems">{hotspots.map(h => <div key={h.id} className={`mr-system ${h.level}`}><Shape level={h.level} /><span>{h.label}</span><em>{lvlText(h.level)}</em></div>)}</div>
      </Section>

      {bl && <Section n={6} title={s.s6}>
        <div className="mr-blood-sum">
          <div><strong>{bl.analytes.length}</strong><span>{s.analytes}</span></div>
          <div className={bl.n_outside_personal_band ? 'watch' : ''}><strong>{bl.n_outside_personal_band}</strong><span>{s.outBand}</span></div>
          <div className={bl.n_outside_reference ? 'alarm' : ''}><strong>{bl.n_outside_reference}</strong><span>{s.outRef}</span></div>
        </div>
        {!!bl.analytes.filter(a => a.outside_personal_band || a.outside_reference_range).length && <ul className="mr-blood">
          {bl.analytes.filter(a => a.outside_personal_band || a.outside_reference_range).slice(0, 8).map(a => <li key={a.analyte} className={a.outside_reference_range ? 'alarm' : 'watch'}>
            <span>{nice(a.analyte)}</span><strong>{fmt(a.r_plus_1, 2)} <small>{a.unit.replace(/_/g, ' ').replace(/per /g, '/ ').replace(/microliter/g, 'µL')}</small></strong>
          </li>)}
        </ul>}
      </Section>}

      <Section n={7} title={s.s7}>
        <Emotional detail={detail} last={allCheckIns[0]} level={shareLvl} name={crew.name} />
      </Section>

      <Section n={8} title={s.s8}>
        <EarpiecePair battery={headset?.battery_pct} crewId={crewId} compact />
      </Section>

      <Section n={9} title={s.s9}>
        {!shared.length && <p className="small muted" style={{ margin: 0 }}>{s.noReports}</p>}
        <ul className="mr-reports">{shared.slice(0, 5).map(c => <li key={c.id}>
          <time>{new Date(c.ts).toLocaleString(lang === 'es' ? 'es-ES' : 'en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</time>
          <div className="mr-wb">{QUESTIONS.map(q => <span key={q} className={c.answers[q] <= 2 ? 'low' : ''}><small>{wb.q[q]}</small><b>{c.answers[q]}/5</b></span>)}</div>
          {!!c.tags.length && <p>{c.tags.map(t => wb.tag[t]).join(', ')}</p>}
          {c.noteShared && c.note.trim() && <p>“{c.note.trim()}”</p>}
        </li>)}</ul>
      </Section>

      <Section n={10} title={s.s10}>
        <p className={`mr-fitness ${fit?.status ?? ''}`}>{fit ? <><strong>{s[fit.status]}</strong>{s.by[fit.by] && <small>({s.by[fit.by]})</small>}</> : s.notSet}</p>
      </Section>
    </article>
  )
}

const EMO = {
  en: { state: { ok: 'Stable', watch: 'Watch', high: 'Needs support' }, trend: 'Mood trend, last 7 days', up: 'improving', down: 'going down', flat: 'steady',
    none: (n: string) => `${n} keeps how they feel private. Ground only receives a flag if Metis sees a severe risk.`, flagged: 'Metis flagged a severe risk. The details stay on board.',
    areas: 'Areas that need attention', noAreas: 'No area needs attention.', chose: (n: string, w: string) => `${n} shares: ${w}`, what: { none: 'nothing', summary: 'a summary', signals: 'which areas need attention' } },
  es: { state: { ok: 'Estable', watch: 'Vigilar', high: 'Necesita apoyo' }, trend: 'Tendencia del ánimo, últimos 7 días', up: 'mejorando', down: 'bajando', flat: 'estable',
    none: (n: string) => `${n} mantiene en privado cómo se siente. Tierra solo recibe un aviso si Metis ve un riesgo grave.`, flagged: 'Metis ha marcado un riesgo grave. Los detalles se quedan a bordo.',
    areas: 'Áreas que necesitan atención', noAreas: 'Ningún área necesita atención.', chose: (n: string, w: string) => `${n} comparte: ${w}`, what: { none: 'nada', summary: 'un resumen', signals: 'qué áreas necesitan atención' } },
}

/** What ground sees of a crew member's emotional state: only what that person chose to share, never answers or notes. */
function Emotional({ detail, last, level, name }: { detail: CrewDetail; last: ReturnType<typeof useCheckIns>[number] | undefined; level: 'none' | 'summary' | 'signals'; name: string }) {
  const { lang } = useLang(); const e = EMO[lang]; const rt = WB_RISK_TXT[lang]
  const risks = computeRisks(detail, last, lang)
  const overall = risks.some(r => r.level === 'high') ? 'high' : risks.some(r => r.level === 'watch') ? 'watch' : 'ok'
  const m = detail.days.slice(-7).map(d => d.mood_1_5), d = (m[m.length - 1] + m[m.length - 2]) / 2 - (m[0] + m[1]) / 2
  const trend = d > .4 ? 'up' : d < -.4 ? 'down' : 'flat'
  const Arrow = trend === 'up' ? ArrowUp : trend === 'down' ? ArrowDown : ArrowRight
  return (
    <div className="mr-emo">
      <p className="mr-emo-who"><Lock size={13} aria-hidden /> {e.chose(name, e.what[level])}</p>
      {level === 'none' ? <>
        <p className="small muted" style={{ margin: 0 }}>{e.none(name)}</p>
        {overall === 'high' && <p className="mr-emo-flag">{e.flagged}</p>}
      </> : <>
        <div className="mr-emo-row">
          <span className={`mr-emo-state ${overall}`}>{e.state[overall]}</span>
          <span className="mr-emo-trend"><Arrow size={15} aria-hidden /> {e.trend}: <b>{e[trend]}</b></span>
        </div>
        {level === 'signals' && <div className="mr-emo-areas">
          <span className="small muted">{e.areas}</span>
          {risks.filter(r => r.level !== 'low').length
            ? <div>{risks.filter(r => r.level !== 'low').map(r => <span key={r.id} className={`mr-emo-area ${r.level}`}>{rt.risk[r.id].name}<em>{rt.level[r.level]}</em></span>)}</div>
            : <p className="small" style={{ margin: 0 }}>{e.noAreas}</p>}
        </div>}
      </>}
    </div>
  )
}
