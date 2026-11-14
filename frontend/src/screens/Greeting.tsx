// Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
// "Today": Metis speaks first, status vs. personal baseline, key deviations, earpiece, Earth delay.
import { useNavigate } from 'react-router-dom'
import { Ear, Orbit, Play, Square, MessageCircle, Siren, BatteryMedium } from 'lucide-react'
import { api } from '../api'
import { useLoad, useSpeaker, fmtDelay } from '../hooks'
import { useLang, useT } from '../i18n'
import { DelayInfo, Card, DEC, LevelTag, Loading, METRICS, MetisLine, Page, Shape, Spark, UNIT, fmt, levelOf, useCrew } from '../ui'

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
  const { data: c } = useLoad(() => api.crewOne(crewId), [crewId])
  const { data: say } = useLoad(() => api.say(crewId, lang), [crewId, lang])
  const { data: st } = useLoad(api.station)
  const sp = useSpeaker()
  if (!c) return <Loading />
  const today = c.days[c.days.length - 1]
  const levels = METRICS.map(m => levelOf(m, today[m], c.baseline[m]))
  const nOut = levels.filter(l => l !== 'ok').length
  const overall = levels.includes('alarm') ? 'alarm' : nOut >= 2 ? 'watch' : 'ok'
  const hs = st?.headsets.find(h => h.crew_id === crewId) ?? st?.headsets[0]
  const delay = st?.comms.one_way_delay_s ?? 300
  return (
    <Page title={`${t('good_morning')}, ${c.name}`} sub={`${t('mission_day')} 112 · ${t('simulated_note')}`}>
      <div className="grid" style={{ gridTemplateColumns: '2fr 1fr' }}>
        <Card title={<>{t('metis_says')}{say && <span className="tag sim" style={{ marginLeft: 8 }}>{say.source === 'llm' ? t('src_llm') : t('src_fallback')}</span>}</>}>
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
        <Card title={t('overall_vs_baseline')}>
          <div className="row" style={{ gap: 14, marginBottom: 10 }}>
            <div className={`s-${overall}`} style={{ fontSize: 40, lineHeight: 1 }}><Shape level={overall} size={30} /></div>
            <div><div style={{ fontSize: 22, fontWeight: 600 }} className={`s-${overall}`}>{t(overall === 'ok' ? 'st_nominal' : overall === 'watch' ? 'st_watch' : 'st_alarm')}</div>
              <div className="muted">{nOut ? t('overall_watch').replace('{n}', String(nOut)) : t('overall_ok')}</div></div>
          </div>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginTop: 14 }}>
            {METRICS.map((m, i) => <div key={m} title={t(`m_${m}`)} style={{ height: 6, borderRadius: 9, background: levels[i] === 'ok' ? 'var(--ok)' : levels[i] === 'watch' ? 'var(--warn)' : 'var(--alarm)' }} />)}
          </div>
          <p className="small dim" style={{ marginBottom: 0 }}>{t('not_diagnosis')}</p>
        </Card>
      </div>

      <h3 className="muted" style={{ fontSize: 13, letterSpacing: '.1em', textTransform: 'uppercase', fontWeight: 500, margin: '26px 0 12px' }}>{t('key_deviations')}</h3>
      <div className="grid g4">
        {METRICS.map((m, i) => {
          const b = c.baseline[m]
          return (
            <Card key={m} className="stat" style={{ cursor: 'pointer' }}>
              <div onClick={() => nav('/trends')}>
                <div className="row between"><span className="lbl">{t(`m_${m}`)}</span><LevelTag level={levels[i]} /></div>
                <div className="val" style={{ margin: '8px 0 2px' }}>{fmt(today[m], DEC[m])}<small>{t(UNIT[m])}</small></div>
                <div className="small dim">{t('your_band')} {fmt(b.band_low, DEC[m])}–{fmt(b.band_high, DEC[m])}</div>
                <Spark days={c.days} m={m} b={b} color={levels[i] === 'ok' ? 'var(--metis)' : levels[i] === 'watch' ? 'var(--warn)' : 'var(--alarm)'} />
              </div>
            </Card>
          )
        })}
      </div>

      <div className="grid g3" style={{ marginTop: 18 }}>
        <Card title={<><Ear size={15} />{t('earpiece')}</>}>
          <div className="row between"><span className="muted">{t('battery')}</span><span className="mono"><BatteryMedium size={15} style={{ verticalAlign: -3 }} /> {hs?.battery_pct ?? '—'}%</span></div>
          <div className="bar" style={{ margin: '8px 0 14px' }}><i style={{ width: `${hs?.battery_pct ?? 0}%`, background: (hs?.battery_pct ?? 0) < 30 ? 'var(--warn)' : 'var(--ok)' }} /></div>
          <div className="row between"><span className="muted">{t('link')}</span><span className="s-ok small"><Shape level="ok" /> {t('link_ok')}</span></div>
        </Card>
        <Card title={<><Orbit size={15} />{t('earth_delay')}</>}>
          <div className="stat"><div className="val">{fmtDelay(delay)}<small>{t('min')} · {t('one_way')}</small></div></div>
          <DelayInfo comms={st?.comms} />
          {st?.comms.next_window_min != null && <div className="small muted" style={{ marginTop: 6 }}>{t('ground_window')}: <span className="mono">{st.comms.next_window_min} {t('min')}</span></div>}
        </Card>
        <Card title={t('sleepair_title')}>
          <p style={{ margin: '0 0 12px' }}>{insightText(t, matchN(c.days))}</p>
          <button className="btn" onClick={() => nav('/sleep-air')}>{t('nav_sleepair')} →</button>
        </Card>
      </div>
    </Page>
  )
}
