// Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
import { useEffect, useState } from 'react'
// "Today": Metis speaks first, status vs. personal baseline, key deviations, earpiece, Earth delay.
import { useNavigate } from 'react-router-dom'
import { Ear, Orbit, Play, Square, MessageCircle, Siren, BatteryMedium } from 'lucide-react'
import { api, type Metric } from '../api'
import { LIVE_KEYS, LIVE_LABEL, useLiveVitals, type Live, type LiveKey } from '../vitals'
import '../live.css'
import { IndicatorButton } from '../IndicatorSheet'
import { fmtLinkDelay, useLink } from '../link'
import { useLoad, useSpeaker } from '../hooks'
import { habitatTime, useLang, useT } from '../i18n'
import { Card, DEC, LevelTag, Loading, METRICS, MetisLine, Page, Shape, Spark, UNIT, fmt, levelOf, useCrew } from '../ui'

/** Sentence for the sleep × CO₂ match: n = 0 (no match), 1 or 2–3 (plural). */
export function insightText(t: ReturnType<typeof useT>, n: number) {
  return n === 0 ? t('sleepair_insight_none') : n === 1 ? t('sleepair_insight_one') : t('sleepair_insight').replace(/\{n\}/g, String(n))
}

/** Largest n ≤ 3 such that the n shortest nights are exactly the n highest CO₂ peaks (0 if none). */
export function matchN(days: { mission_day: number; sleep_h: number; co2_night_peak_mmhg: number }[]) {
  let best = 0
  for (let n = 1; n <= 3; n++) {
    const a = [...days].sort((x, y) => x.sleep_h - y.sleep_h).slice(0, n).map(d => d.mission_day).sort().join()
    const b = [...days].sort((x, y) => y.co2_night_peak_mmhg - x.co2_night_peak_mmhg).slice(0, n).map(d => d.mission_day).sort().join()
    if (a === b) best = n
  }
  return best
}

export default function Greeting() {
  const t = useT(); const { lang } = useLang(); const { crewId } = useCrew(); const nav = useNavigate()
  const [clock, setClock] = useState(() => Date.now())
  useEffect(() => { const id = setInterval(() => setClock(Date.now()), 30000); return () => clearInterval(id) }, [])
  const { data: c } = useLoad(() => api.crewOne(crewId), [crewId])
  const { data: say } = useLoad(() => api.say(crewId, lang), [crewId, lang])
  const { data: st } = useLoad(api.station)
  const sp = useSpeaker()
  const link = useLink()
  const live = useLiveVitals(crewId)
  if (!c) return <Loading />
  const today = c.days[c.days.length - 1]
  const levels = METRICS.map(m => levelOf(m, today[m], c.baseline[m]))
  const nOut = levels.filter(l => l !== 'ok').length
  const overall = levels.includes('alarm') ? 'alarm' : nOut >= 2 ? 'watch' : 'ok'
  const hs = st?.headsets.find(h => h.crew_id === crewId) ?? st?.headsets[0]
  // Normalise each axis to its own baseline mean; the blue annulus is the actual personal band.
  const radarPoint = (value: number, mean: number, i: number) => {
    const radius = Math.max(4, Math.min(68, 45 * value / (mean || 1)))
    const angle = i * Math.PI / 2 - Math.PI / 2
    return `${220 + Math.cos(angle) * radius},${80 + Math.sin(angle) * radius}`
  }
  return (
    <Page title={`${t('good_morning')}, ${c.name}`} sub={`${t('mission_day')} 112, ${t('habitat_time')} ${habitatTime(clock)}`}>
      <div className="grid today-hero">
        <Card className="today-intro" title={t('metis_says')}>
          <MetisLine speaking={sp.speaking}>
            <p className="quote" style={{ margin: '2px 0 18px', minHeight: 62 }}>{say?.text ?? '…'}</p>
            <div className="row wrap">
              <button className="btn primary" onClick={() => (sp.speaking ? sp.stop() : say && sp.speak(say.text, lang))} disabled={!say}>
                {sp.speaking ? <Square size={16} /> : <Play size={16} />}{sp.speaking ? t('stop') : t('listen')}
              </button>
              <button className="btn" onClick={() => nav('/talk')}><MessageCircle size={16} />{t('talk_to_metis')}</button>
              <button className="btn" onClick={() => nav('/triage')}><Siren size={16} />{t('nav_triage')}</button>
            </div>
          </MetisLine>
        </Card>
        <div className="today-side">
          <Card title={<><Ear size={15} />{t('earpiece')}</>}>
            <div className="row between earpiece-row"><span className="muted">{t('battery')}</span>{hs?.battery_pct != null && <span className="mono"><BatteryMedium size={15} style={{ verticalAlign: -3 }} /> {hs.battery_pct}%</span>}</div>
            <div className="bar" style={{ margin: '8px 0 14px' }}><i style={{ width: `${hs?.battery_pct ?? 0}%`, background: (hs?.battery_pct ?? 0) < 30 ? 'var(--warn)' : 'var(--ok)' }} /></div>
            <div className="row between earpiece-row"><span className="muted">{t('link')}</span><span className="tag ok" title={t('link_ok')}><Shape level="ok" />{lang === 'es' ? 'Conectado' : 'Connected'}</span></div>
          </Card>
          <Card title={<><Orbit size={15} />{t('earth_delay')}</>}>
            <div className="stat"><div className="val">{fmtLinkDelay(link.delayS, lang)}</div></div>
            <span className="pill">{link.short[lang]}</span>
          </Card>
        </div>
        <Card className="feature feature-gradient" title={t('overall_vs_baseline')}>
          <svg className="baseline-visual" viewBox="0 0 440 160" aria-hidden>
            {[25, 45, 65].map(r => <path key={r} d={`M220 ${80-r} L${220+r} 80 L220 ${80+r} L${220-r} 80Z`} fill="none" stroke="#FFFFFF" strokeOpacity=".22" />)}
            <path d="M220 15V145M155 80H285" stroke="#FFFFFF" strokeOpacity=".2" />
            <path d={['band_high', 'band_low'].map(edge => `M${METRICS.map((m,i) => radarPoint(c.baseline[m][edge as 'band_high' | 'band_low'], c.baseline[m].mean, i)).join(' L')}Z`).join(' ')} fill="#2E96F5" fillOpacity=".35" fillRule="evenodd" stroke="#2E96F5" />
            <polygon points={METRICS.map((m,i) => radarPoint(today[m], c.baseline[m].mean, i)).join(' ')} fill="#EAFE07" fillOpacity=".14" stroke="#EAFE07" strokeWidth="2" />
            {METRICS.map((m,i) => <text key={m} x={[220,296,220,144][i]} y={[10,84,157,84][i]} textAnchor={i===1?'start':i===3?'end':'middle'} fill="white" fontSize="10" fontFamily="var(--sans)">{t(`m_${m}`)}</text>)}
          </svg>
          <div className="row" style={{ gap: 14, marginBottom: 10 }}>
            <div className={`overall-mark s-${overall}`} style={{ fontSize: 40, lineHeight: 1 }}><Shape level={overall} size={30} /></div>
            <div><div style={{ fontSize: 22, fontWeight: 600 }} className={`overall-mark s-${overall}`}>{t(overall === 'ok' ? 'st_nominal' : overall === 'watch' ? 'st_watch' : 'st_alarm')}</div>
              <div className="muted">{nOut ? t('overall_watch').replace('{n}', String(nOut)) : t('overall_ok')}</div></div>
          </div>
        </Card>
      </div>

      {live.online && live.crew?.id === crewId && <section className="live-section" aria-labelledby="right-now">
        <div className="live-heading-row"><h3 id="right-now" className="live-heading"><span className="live-dot" />{LIVE_COPY[lang].now}</h3>{live.exercising && <span className="live-chip exercising">{LIVE_COPY[lang].exercising}</span>}</div>
        <div className="live-grid">{LIVE_KEYS.map(k => <LiveTile key={k} live={live} signal={k} />)}</div>
      </section>}

      <h3 className="muted" style={{ fontSize: 13, letterSpacing: '.1em', textTransform: 'uppercase', fontWeight: 500, margin: '26px 0 12px' }}>{t('key_deviations')}</h3>
      <div className="grid metrics-row">
        {([...METRICS, 'mood_1_5'] as Metric[]).map(m => {
          const b = c.baseline[m]
          return (
            <Card key={m} className="stat" style={{ cursor: 'pointer' }}>
              <button className="metric-action" onClick={() => nav('/trends')}>
                <div className="row between"><span className="lbl">{t(`m_${m}`)}</span><LevelTag level={levelOf(m, today[m], b)} /></div>
                <div className="val" style={{ margin: '8px 0 2px' }}>{fmt(today[m], DEC[m])}<small>{m === 'mood_1_5' ? '/5' : t(UNIT[m])}</small></div>
                <div className="small dim">{t('your_band')} {fmt(b.band_low, DEC[m])}–{fmt(b.band_high, DEC[m])}</div>
                <Spark days={c.days} m={m} b={b} color="var(--info)" />
              </button>
              <IndicatorButton indicator={m} />
            </Card>
          )
        })}
        <Card className="stat sleepair-mini" title={t('sleepair_title')}>
          <SleepAirMini days={c.days} />
          <button className="btn" onClick={() => nav('/sleep-air')}>{t('nav_sleepair')} →</button>
        </Card>
      </div>

    </Page>
  )
}

/** Tiny, readable sketch for the Today card: sleep (bars) against bunk CO₂ (line), last 30 nights.
 *  The nights where the shortest sleep matches the highest CO₂ are highlighted and joined. */
function SleepAirMini({ days }: { days: { mission_day: number; sleep_h: number; co2_night_peak_mmhg: number }[] }) {
  const { lang } = useLang()
  const W = 220, H = 92, top = 6, mid = 46, bottom = 88
  const n = days.length, step = W / n, bw = Math.max(2, step * .62)
  const sl = days.map(d => d.sleep_h), co = days.map(d => d.co2_night_peak_mmhg)
  const sMax = Math.max(...sl), cMin = Math.min(...co), cMax = Math.max(...co)
  const nm = matchN(days)
  const hot = new Set([...days].sort((a, b) => a.sleep_h - b.sleep_h).slice(0, nm).map(d => d.mission_day))
  const x = (i: number) => i * step + step / 2
  const cy = (v: number) => top + (1 - (v - cMin) / ((cMax - cMin) || 1)) * (mid - top - 6)
  const line = co.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${cy(v).toFixed(1)}`).join(' ')
  const L = lang === 'es' ? { co2: 'CO₂ de la litera', sleep: 'Horas de sueño', match: 'coinciden' } : { co2: 'Bunk CO₂', sleep: 'Hours of sleep', match: 'match' }
  return (
    <figure className="sleepair-sketch" aria-label={`${L.sleep} / ${L.co2}`}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-hidden>
        {days.map((d, i) => hot.has(d.mission_day) && <rect key={'h' + i} x={x(i) - step / 2} y={top - 2} width={step} height={bottom - top + 4} rx={3} className="sa-band" />)}
        {days.map((d, i) => { const h = (d.sleep_h / sMax) * (bottom - mid - 4); return <rect key={'s' + i} x={x(i) - bw / 2} y={bottom - h} width={bw} height={h} rx={1.5} className={hot.has(d.mission_day) ? 'sa-sleep sa-hot' : 'sa-sleep'} /> })}
        <path d={line} className="sa-co2" />
        {days.map((d, i) => hot.has(d.mission_day) && <circle key={'c' + i} cx={x(i)} cy={cy(d.co2_night_peak_mmhg)} r={3.2} className="sa-dot" />)}
      </svg>
      <figcaption><span><i className="sa-k sa-k-co2" />{L.co2}</span><span><i className="sa-k sa-k-sleep" />{L.sleep}</span>{nm > 0 && <span><i className="sa-k sa-k-hot" />{L.match}</span>}</figcaption>
    </figure>
  )
}

// Shared live presentation stays in the Today module so the allowed screens use one visual language.
export const LIVE_COPY = {
  en: { now: 'Right now', exercising: 'Exercising', exercisingNow: 'Exercising now', resting: 'Resting', activity: 'Activity', session: 'Live this session', baseline: 'Personal baseline band', start: 'Session start', latest: 'Latest', status: { ok: 'In range', watch: 'Attention', alarm: 'Urgent', nodata: 'No reading', exercising: 'Exercising' } },
  es: { now: 'Ahora mismo', exercising: 'En ejercicio', exercisingNow: 'Haciendo ejercicio ahora', resting: 'En reposo', activity: 'Actividad', session: 'En directo en esta sesión', baseline: 'Banda personal de referencia', start: 'Inicio de sesión', latest: 'Actual', status: { ok: 'En tu banda', watch: 'Atención', alarm: 'Urgente', nodata: 'Sin lectura', exercising: 'En ejercicio' } },
}

export function liveStatus(live: Live, signal: LiveKey) {
  const v = live.crew?.now[signal], mean = live.crew?.baseline?.[signal]?.mean
  return live.exercising && live.crew?.now.pulse && (signal === 'hr_bpm' || signal === 'rr_brpm') && v != null && (mean == null || v >= mean)
    ? 'exercising' : live.level[signal]
}

export function LiveChart({ live, signal, detailed = false }: { live: Live; signal: LiveKey; detailed?: boolean }) {
  const { lang } = useLang()
  const label = LIVE_LABEL[signal], copy = LIVE_COPY[lang]
  const baseline = live.crew?.baseline?.[signal]
  const band = baseline && Number.isFinite(baseline.mean) && Number.isFinite(baseline.sd) && baseline.sd > 0 ? [baseline.mean - 2 * baseline.sd, baseline.mean + 2 * baseline.sd] : null
  const values = live.history.map(sample => sample[signal])
  const valid = values.filter((v): v is number => v != null && Number.isFinite(v))
  if (!valid.length) return null
  const low = Math.min(...valid, ...(band ?? [])), high = Math.max(...valid, ...(band ?? []))
  const pad = Math.max((high - low) * .15, signal === 'temp_c' ? .1 : 1)
  const min = low - pad, max = high + pad, height = detailed ? 104 : 40
  const y = (v: number) => 4 + (max - v) / (max - min) * (height - 8)
  const first = live.history[0]?.t ?? 0, last = live.history.at(-1)?.t ?? first
  const x = (i: number) => last > first ? 4 + (live.history[i].t - first) / (last - first) * 232 : 120
  const path = values.map((v, i) => {
    if (v == null || !Number.isFinite(v)) return ''
    const previous = values[i - 1]
    return `${previous != null && Number.isFinite(previous) ? 'L' : 'M'}${x(i)},${y(v)}`
  }).join(' ')
  const status = liveStatus(live, signal)
  return <figure className={`live-chart${detailed ? ' detailed' : ''}`}>
    <svg viewBox={`0 0 240 ${height}`} role="img" aria-label={`${label[lang]}: ${valid.map(v => fmt(v, label.dec)).join(', ')} ${label.unit}`}>
      {band && <rect x="0" y={y(band[1])} width="240" height={y(band[0]) - y(band[1])} rx="3" fill="#2E96F5" fillOpacity=".14" />}
      <path d={path} fill="none" stroke={status === 'alarm' ? '#C42F00' : status === 'watch' ? '#B45309' : '#0960E1'} strokeWidth="2" strokeLinejoin="round" />
      {values.map((v, i) => v != null && Number.isFinite(v) && <circle key={i} cx={x(i)} cy={y(v)} r={values.length === 1 ? 2.5 : 1} fill="currentColor" />)}
    </svg>
    {detailed && <figcaption><span>{fmt(min, label.dec)}–{fmt(max, label.dec)} {label.unit}</span>{band && <span className="live-band-key">{copy.baseline} {fmt(band[0], label.dec)}–{fmt(band[1], label.dec)}</span>}<span>{copy.start} → {copy.latest}</span></figcaption>}
  </figure>
}

export function LiveTile({ live, signal, detailed = false }: { live: Live; signal: LiveKey; detailed?: boolean }) {
  const { lang } = useLang()
  const label = LIVE_LABEL[signal], status = liveStatus(live, signal)
  return <article className={`live-tile live-${status}`}>
    <div className="live-tile-top"><h4>{label[lang]}</h4><span className="live-dot live-pulse" aria-hidden="true" /></div>
    <div className="live-reading">{fmt(live.crew?.now[signal] ?? undefined, label.dec)}<small>{label.unit}</small></div>
    <span className={`live-chip ${status}`}>{LIVE_COPY[lang].status[status]}</span>
    <LiveChart live={live} signal={signal} detailed={detailed} />
  </article>
}
