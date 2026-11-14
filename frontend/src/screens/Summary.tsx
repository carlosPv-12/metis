// Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
// "Report to ground": what the flight surgeon receives, queued for the next link and delayed by light time.
import { useEffect, useState } from 'react'
import { Check, Orbit, Send } from 'lucide-react'
import { api } from '../api'
import { useLoad } from '../hooks'
import { useLang, useT } from '../i18n'
import { Card, DEC, LevelTag, Loading, METRICS, Page, Spark, UNIT, fmt, levelOf, useCrew } from '../ui'
import { useLink, fmtLinkDelay } from '../link'
import { packetStatus } from '../station/packet'
import { queueReport, useReportQueue } from '../station/reportQueue'
import { BloodPanel } from './Trend'

export default function Summary() {
  const t = useT(); const { crewId } = useCrew()
  const { data: c } = useLoad(() => api.crewOne(crewId), [crewId])
  const link = useLink(); const { lang } = useLang()
  const sent = useReportQueue(link).find(p => p.crewId === crewId)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id) }, [])
  const queued = !!sent
  const sendText = { en: { queue: 'Queue for Earth', sent: 'Report saved', simulation: 'Simulated delivery status.' }, es: { queue: 'Poner en cola hacia Tierra', sent: 'Informe guardado', simulation: 'Estado de envío simulado.' } }[lang]
  if (!c) return <Loading />
  const today = c.days[c.days.length - 1]
  return (
    <Page title={t('report_title')}>
      <div className="grid report-grid" style={{ gridTemplateColumns: '1.5fr 1fr', alignItems: 'start' }}>
        <Card title={t('report_contents')}>
          {METRICS.map(m => (
            <div key={m} className="grid report-metric">
              <span>{t(`m_${m}`)}</span>
              <span className="mono">{fmt(today[m], DEC[m])} {t(UNIT[m])}</span>
              <Spark days={c.days} m={m} b={c.baseline[m]} h={36} />
              <LevelTag level={levelOf(m, today[m], c.baseline[m])} />
            </div>
          ))}
        </Card>
        <Card className="feature feature-gradient" title={<><Orbit size={14} />{t('report_status')}</>}>
          <p>{link.label[lang]}</p>
          <div className="row between"><span className="muted">{t('earth_delay')}</span><span className="mono">{fmtLinkDelay(link.delayS, lang)}</span></div>
          {queued && <p role="status">{packetStatus(link, sent.start ?? sent.at, now, lang)}</p>}
          <div style={{ marginTop: 18 }}>
            <button className="btn primary big" style={{ width: '100%' }} disabled={queued} onClick={() => { setNow(Date.now()); queueReport(crewId, link); void api.postEvent('send_flight_surgeon', crewId, { kind: 'daily_report' }).catch(() => {}) }}>
              {queued ? <Check size={18} /> : <Send size={18} />}{queued ? sendText.sent : link.mode === 'none' ? sendText.queue : t('send_surgeon')}
            </button>
          </div>
        </Card>
      </div>
      <BloodPanel compact refNote />
    </Page>
  )
}
