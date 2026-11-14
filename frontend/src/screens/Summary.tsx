// Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
// "Report to ground": what the flight surgeon receives, queued for the next link and delayed by light time.
import { useState } from 'react'
import { Check, Orbit, Send } from 'lucide-react'
import { api } from '../api'
import { useLoad, fmtDelay } from '../hooks'
import { useT, type Key } from '../i18n'
import { DelayInfo, Card, DEC, LevelTag, Loading, METRICS, Page, Spark, UNIT, fmt, levelOf, useCrew } from '../ui'
import { BloodPanel } from './Trend'

export default function Summary() {
  const t = useT(); const { crewId } = useCrew()
  const { data: c } = useLoad(() => api.crewOne(crewId), [crewId])
  const { data: st } = useLoad(api.station)
  const [queued, setQueued] = useState(false)
  if (!c) return <Loading />
  const today = c.days[c.days.length - 1]
  const delay = st?.comms.one_way_delay_s ?? 300
  const items: Key[] = ['r_trends', 'r_answers', 'r_blood', 'r_note']
  return (
    <Page title={`${t('report_title')} · ${c.name}`} sub={t('report_sub')}>
      <div className="grid" style={{ gridTemplateColumns: '1.5fr 1fr', alignItems: 'start' }}>
        <Card title={t('report_contents')}>
          {METRICS.map(m => (
            <div key={m} className="grid" style={{ gridTemplateColumns: '220px 120px 1fr 110px', alignItems: 'center', gap: 14, padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
              <span>{t(`m_${m}`)}</span>
              <span className="mono">{fmt(today[m], DEC[m])} {t(UNIT[m])}</span>
              <Spark days={c.days} m={m} b={c.baseline[m]} h={36} />
              <LevelTag level={levelOf(m, today[m], c.baseline[m])} />
            </div>
          ))}
          <ul style={{ marginBottom: 0, paddingLeft: 18 }}>{items.map(k => <li key={k} className="small" style={{ marginTop: 8 }}>{t(k)}</li>)}</ul>
        </Card>
        <Card title={<><Orbit size={14} />{t('report_status')}</>}>
          <div className="row between"><span className="muted">{t('earth_delay')}</span><span className="mono">{fmtDelay(delay)} {t('min')}</span></div>
          <DelayInfo comms={st?.comms} />
          {st?.comms.next_window_min != null && <div className="row between" style={{ marginTop: 8 }}><span className="muted">{t('ground_window')}</span><span className="mono">{st.comms.next_window_min} {t('min')}</span></div>}
          <div style={{ marginTop: 18 }}>
            <button className="btn primary big" style={{ width: '100%' }} disabled={queued} onClick={async () => { try { await api.postEvent('send_flight_surgeon', crewId, { kind: 'daily_report' }) } catch { /* local */ } setQueued(true) }}>
              {queued ? <Check size={18} /> : <Send size={18} />}{queued ? t('queued') : t('send_surgeon')}
            </button>
          </div>
          <p className="small dim">{t('not_diagnosis')}</p>
        </Card>
      </div>
      <BloodPanel compact refNote />
    </Page>
  )
}
