// Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
// "Body": rotating holographic 3D body per crew member, with hotspots linked to measurements and HRP risks.
import { useState } from 'react'
import { api, type CrewDetail, type Metric } from '../api'
import { useLoad } from '../hooks'
import { useT, type Key } from '../i18n'
import { Card, DEC, LevelTag, Loading, Page, Spark, UNIT, fmt, levelOf, useCrew, type Level } from '../ui'
import Body3D, { type Hotspot } from '../Body3D'

export type BP = 'heart' | 'ear' | 'lungs' | 'brain' | 'eyes' | 'bones' | 'muscle'
export const BP_POS: Record<BP, [number, number, number]> = {
  heart: [0.045, 1.31, 0.11], ear: [0.112, 1.655, 0.0], lungs: [-0.1, 1.37, 0.1], brain: [0, 1.77, 0.02],
  eyes: [-0.035, 1.68, 0.095], bones: [-0.09, 0.6, 0.07], muscle: [0.27, 1.05, 0.05],
}
export const BP_METRICS: Record<BP, Metric[]> = { heart: ['resting_hr_bpm', 'hrv_ms'], ear: [], lungs: ['co2_night_peak_mmhg'], brain: ['sleep_h'], eyes: [], bones: [], muscle: [] }
const BP_LABEL: Record<BP, Key> = { heart: 'bp_heart', ear: 'bp_ear', lungs: 'bp_lungs', brain: 'bp_brain', eyes: 'bp_eyes', bones: 'bp_bones', muscle: 'bp_muscle' }
export const HRP_URL = 'https://www.nasa.gov/hrp/risks/', HAZ_URL = 'https://www.nasa.gov/hrp/hazards/'

export function bodyLevels(c: CrewDetail): Record<BP, Level> {
  const today = c.days[c.days.length - 1]
  const worst = (ms: Metric[]): Level => {
    if (!ms.length) return 'nodata'
    const ls = ms.map(m => levelOf(m, today[m], c.baseline[m]))
    return ls.includes('alarm') ? 'alarm' : ls.includes('watch') ? 'watch' : 'ok'
  }
  return { heart: worst(BP_METRICS.heart), ear: 'ok', lungs: worst(BP_METRICS.lungs), brain: worst(BP_METRICS.brain), eyes: 'nodata', bones: 'nodata', muscle: 'nodata' }
}

export function useHotspots(c: CrewDetail | null): Hotspot[] {
  const t = useT()
  if (!c) return []
  const lv = bodyLevels(c)
  return (Object.keys(BP_POS) as BP[]).map(id => ({ id, pos: BP_POS[id], level: lv[id], label: t(BP_LABEL[id]), left: ['lungs', 'eyes', 'bones'].includes(id) }))
}

export default function Body() {
  const t = useT(); const { crewId } = useCrew()
  const { data: c } = useLoad(() => api.crewOne(crewId), [crewId])
  const [sel, setSel] = useState<BP>('heart')
  const hs = useHotspots(c)
  if (!c) return <Loading />
  const lv = bodyLevels(c)
  const today = c.days[c.days.length - 1]
  const isHazard = ['ear', 'lungs', 'muscle'].includes(sel)
  return (
    <Page title={`${t('body_title')} · ${c.name}`} sub={t('body_sub')}>
      <div className="grid" style={{ gridTemplateColumns: 'minmax(180px,240px) 1fr minmax(300px,400px)', alignItems: 'start' }}>
        <Card className="hotlist" style={{ padding: 10 }}>
          {(Object.keys(BP_POS) as BP[]).map(id => (
            <button key={id} className={sel === id ? 'on' : ''} onClick={() => setSel(id)}>
              <span className={`s-${lv[id]}`} style={{ width: 8, height: 8, borderRadius: 9, background: 'currentColor' }} />{t(BP_LABEL[id])}
            </button>
          ))}
        </Card>
        <div className="bodywrap"><Body3D key={crewId} hotspots={hs} selected={sel} onSelect={id => setSel(id as BP)} /></div>
        <Card title={t(BP_LABEL[sel])} right={<LevelTag level={lv[sel]} />}>
          <p style={{ marginTop: 0 }}>{t(`bpd_${sel}`)}</p>
          {BP_METRICS[sel].map(m => (
            <div key={m} style={{ padding: '12px 0', borderTop: '1px solid var(--line)' }}>
              <div className="row between"><span className="muted small">{t(`m_${m}`)}</span><LevelTag level={levelOf(m, today[m], c.baseline[m])} /></div>
              <div className="row between" style={{ alignItems: 'baseline' }}>
                <div className="mono" style={{ fontSize: 28 }}>{fmt(today[m], DEC[m])} <span className="small muted">{t(UNIT[m])}</span></div>
                <div className="small dim">{t('your_band')} {fmt(c.baseline[m].band_low, DEC[m])}–{fmt(c.baseline[m].band_high, DEC[m])}</div>
              </div>
              <Spark days={c.days} m={m} b={c.baseline[m]} h={44} />
            </div>
          ))}
          {sel === 'ear' && <div className="small" style={{ padding: '12px 0', borderTop: '1px solid var(--line)' }}>{t('link_ok')} · {t('worn')}</div>}
          {!BP_METRICS[sel].length && sel !== 'ear' && <div className="small dim" style={{ padding: '12px 0', borderTop: '1px solid var(--line)' }}>{t('not_measured')}</div>}
          <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12, marginTop: 4 }}>
            <div className="small muted">{t('measured_by')}</div><div style={{ marginBottom: 10 }}>{t(`mb_${sel}`)}</div>
            <div className="small muted">{t('hrp_risk')}</div>
            <div><a href={isHazard ? HAZ_URL : HRP_URL} target="_blank" rel="noreferrer">{t(`hrp_${sel}`)}</a></div>
            <div className="small dim">NASA Human Research Program</div>
          </div>
        </Card>
      </div>
    </Page>
  )
}
