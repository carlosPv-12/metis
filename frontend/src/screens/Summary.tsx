// Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
// "Report to ground": what the flight surgeon receives, queued for the next link and delayed by light time.
import { useEffect, useState } from 'react'
import { Check, Orbit, Send } from 'lucide-react'
import { LIVE_KEYS, LIVE_LABEL, useLiveVitals, type Live } from '../vitals'
import { LIVE_COPY, liveStatus } from './Greeting'
import { api } from '../api'
import { useLoad } from '../hooks'
import { useLang, useT } from '../i18n'
import { Card, DEC, LevelTag, Loading, METRICS, Page, Spark, UNIT, fmt, levelOf, useCrew } from '../ui'
import { useLink, fmtLinkDelay } from '../link'
import { packetStatus } from '../station/packet'
import { queueReport, useReportQueue } from '../station/reportQueue'

export default function Summary() {
  const t = useT(); const { crewId } = useCrew()
  const { data: c } = useLoad(() => api.crewOne(crewId), [crewId])
  const live = useLiveVitals(crewId)
  const [snapshots, setSnapshots] = useState<Record<string, Live>>({})
  const link = useLink(); const { lang } = useLang()
  const sent = useReportQueue(link).find(p => p.crewId === crewId)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id) }, [])
  const queued = !!sent
  const sendText = { en: { queue: 'Queue for Earth', sent: 'Report saved', vitals: 'Vitals at the moment of sending' }, es: { queue: 'Poner en cola hacia Tierra', sent: 'Informe guardado', vitals: 'Constantes en el momento del envío' } }[lang]
  if (!c) return <Loading />
  const reportVitals = sent ? snapshots[crewId] ?? readVitals(crewId) : live
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
            <button className="btn primary big" style={{ width: '100%' }} disabled={queued} onClick={() => { setNow(Date.now()); queueReport(crewId, link);
              if (live.online && live.crew?.id === crewId) {
                const snapshot = { ...live, history: [], alerts: [] }
                setSnapshots(previous => ({ ...previous, [crewId]: snapshot }))
                try { sessionStorage.setItem(`metis-report-vitals:${crewId}`, JSON.stringify(snapshot)) } catch { /* The in-memory snapshot still works when storage is unavailable. */ }
              }
               void api.postEvent('send_flight_surgeon', crewId, { kind: 'daily_report', ...(live.online && live.crew?.id === crewId ? { vitals: live.crew.now } : {}) }).catch(() => {}) }}>
              {queued ? <Check size={18} /> : <Send size={18} />}{queued ? sendText.sent : link.mode === 'none' ? sendText.queue : t('send_surgeon')}
            </button>
          </div>
        </Card>
      </div>
      {live.online && reportVitals?.online && reportVitals.crew?.id === crewId && <Card className="live-report" title={sendText.vitals}>
        {LIVE_KEYS.map(k => { const label = LIVE_LABEL[k], status = liveStatus(reportVitals, k); return <div key={k} className="live-report-row"><span>{label[lang]}</span><span><strong className="live-report-number">{fmt(reportVitals.crew?.now[k] ?? undefined, label.dec)} {label.unit}</strong><span className={`live-chip ${status}`}>{LIVE_COPY[lang].status[status]}</span></span></div> })}
        <div className="live-report-row"><span>{LIVE_COPY[lang].activity}</span><span className={`live-chip ${reportVitals.exercising ? 'exercising' : 'ok'}`}>{reportVitals.exercising ? LIVE_COPY[lang].exercisingNow : LIVE_COPY[lang].resting}</span></div>
      </Card>}
    </Page>
  )
}

function readVitals(crewId: string): Live | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(`metis-report-vitals:${crewId}`) ?? 'null') as Live | null
    return value?.crew?.id === crewId && value.level && value.crew.now ? value : null
  } catch { return null }
}
