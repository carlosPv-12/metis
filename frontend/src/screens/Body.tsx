// Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
// "Body": translucent medical bust with hotspots linked to measurements and HRP risks.
import { useCallback, useEffect, useRef, useState } from 'react'
import { api, type CrewDetail, type Metric } from '../api'
import { useLoad } from '../hooks'
import { useLang, useT, type Key } from '../i18n'
import { Card, DEC, LevelTag, Loading, Page, Spark, UNIT, fmt, levelOf, useCrew, type Level } from '../ui'
import { type Hotspot } from '../Body3D'
import BodyModel3D from '../BodyModel3D'
import { useCrewSex } from '../settings'
import { IndicatorSheet } from '../IndicatorSheet'

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

const COPY = {
  en: { close: 'Close details' },
  es: { close: 'Cerrar detalles' },
}

export default function Body() {
  const { crewId } = useCrew()
  return <CrewBody crewId={crewId} />
}

function CrewBody({ crewId }: { crewId: string }) {
  const { data: c } = useLoad(() => api.crewOne(crewId), [crewId])
  return c ? <BodyView c={c} crewId={crewId} /> : <Loading />
}

function BodyView({ c, crewId }: { c: CrewDetail; crewId: string }) {
  const t = useT()
  const [sel, setSel] = useState<BP | null>(null)
  const [trigger, setTrigger] = useState<HTMLElement | null>(null)
  const sex = useCrewSex(crewId)
  const hs = useHotspots(c)
  useEffect(() => { setSel(null) }, [crewId, sex])
  const closeDetails = useCallback(() => setSel(null), [])
  return (
    <Page title={t('body_title')}>
      <div className="bodywrap figure">
        <BodyModel3D hotspots={hs} selected={sel} onSelect={id => { setTrigger(document.activeElement instanceof HTMLElement ? document.activeElement : null); setSel(id as BP) }} sex={sex} />
        {sel && <BodyDetails key={sel} c={c} sel={sel} trigger={trigger} onClose={closeDetails} />}
      </div>
    </Page>
  )
}

function BodyDetails({ c, sel, trigger, onClose }: { c: CrewDetail; sel: BP; trigger: HTMLElement | null; onClose: () => void }) {
  const t = useT()
  const { lang } = useLang()
  const panel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    panel.current?.focus()
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); onClose() } }
    const outside = (e: PointerEvent) => {
      if (e.target instanceof Element && !panel.current?.contains(e.target) && !e.target.closest('.figure-hotspot')) onClose()
    }
    document.addEventListener('keydown', key)
    document.addEventListener('pointerdown', outside)
    return () => {
      document.removeEventListener('keydown', key)
      document.removeEventListener('pointerdown', outside)
      if (trigger?.isConnected) trigger.focus({ preventScroll: true })
    }
  }, [onClose, trigger])
  const lv = bodyLevels(c)
  const today = c.days[c.days.length - 1]
  return (
    <div ref={panel} className="body-details" role="dialog" aria-label={t(BP_LABEL[sel])} tabIndex={-1}>
      <button type="button" className="body-details-close" aria-label={COPY[lang].close} onClick={onClose}>×</button>
      <Card title={t(BP_LABEL[sel])} right={<LevelTag level={lv[sel]} />}>
          {BP_METRICS[sel].map(m => (
            <div key={m} style={{ padding: '12px 0', borderTop: '1px solid var(--line)' }}>
              <div className="row between"><span className="muted small">{t(`m_${m}`)}</span><LevelTag level={levelOf(m, today[m], c.baseline[m])} /></div>
              <div className="row between" style={{ alignItems: 'baseline' }}>
                <div className="metric-value" style={{ fontSize: 28 }}>{fmt(today[m], DEC[m])} <span className="small muted">{t(UNIT[m])}</span></div>
                <div className="small dim">{t('your_band')} {fmt(c.baseline[m].band_low, DEC[m])}–{fmt(c.baseline[m].band_high, DEC[m])}</div>
              </div>
              <Spark days={c.days} m={m} b={c.baseline[m]} h={44} />
            </div>
          ))}
          {sel === 'ear' && <div className="small" style={{ padding: '12px 0', borderTop: '1px solid var(--line)' }}>{t('link_ok')}, {t('worn')}</div>}
          {!BP_METRICS[sel].length && sel !== 'ear' && <div className="small dim" style={{ padding: '12px 0', borderTop: '1px solid var(--line)' }}>{t('not_measured')}</div>}
          <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12, marginTop: 4 }}>
            <div className="small muted">{t('hrp_risk')}</div>
            <div>{t(`hrp_${sel}`)}</div>
          </div>
          <IndicatorSheet indicator={sel} collapsible />
      </Card>
    </div>
  )
}
