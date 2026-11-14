// Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
// "Body": translucent medical bust with hotspots linked to measurements and HRP risks.
import { useCallback, useEffect, useRef, useState } from 'react'
import { api, type CrewDetail, type Metric } from '../api'
import { useLoad } from '../hooks'
import { useLang, useT, type Key } from '../i18n'
import { DEC, Loading, Page, Spark, UNIT, fmt, levelOf, useCrew, type Level } from '../ui'
import { type Hotspot } from '../Body3D'
import BodyModel3D from '../BodyModel3D'
import { useCrewSex } from '../settings'
import { IndicatorSheet } from '../IndicatorSheet'
import { Activity, Heart, Moon, Wind } from 'lucide-react'
import { useLiveVitals, type Live } from '../vitals'
import { LIVE_COPY, LiveTile, liveStatus } from './Greeting'
import '../body-panel.css'

export type BP = 'heart' | 'ear' | 'lungs' | 'brain' | 'eyes' | 'bones' | 'muscle' | 'skin'
export const BP_POS: Record<BP, [number, number, number]> = {
  heart: [0.045, 1.31, 0.11], ear: [0.112, 1.655, 0.0], lungs: [-0.1, 1.37, 0.1], brain: [0, 1.77, 0.02],
  eyes: [-0.035, 1.68, 0.095], bones: [-0.09, 0.6, 0.07], muscle: [0.27, 1.05, 0.05], skin: [-0.3, 1.05, 0.05],
}
export const BP_METRICS: Record<BP, Metric[]> = { heart: ['resting_hr_bpm', 'hrv_ms'], ear: [], lungs: ['co2_night_peak_mmhg'], brain: ['sleep_h'], eyes: [], bones: [], muscle: [], skin: [] }
const BP_LABEL: Record<Exclude<BP, 'skin'>, Key> = { heart: 'bp_heart', ear: 'bp_ear', lungs: 'bp_lungs', brain: 'bp_brain', eyes: 'bp_eyes', bones: 'bp_bones', muscle: 'bp_muscle' }
export const HRP_URL = 'https://www.nasa.gov/hrp/risks/', HAZ_URL = 'https://www.nasa.gov/hrp/hazards/'

export function bodyLevels(c: CrewDetail, live?: Live): Record<BP, Level> {
  const today = c.days[c.days.length - 1]
  const worst = (ms: Metric[]): Level => {
    if (!ms.length) return 'nodata'
    const ls = ms.map(m => levelOf(m, today[m], c.baseline[m]))
    return ls.includes('alarm') ? 'alarm' : ls.includes('watch') ? 'watch' : 'ok'
  }
  const lv: Record<BP, Level> = { heart: worst(BP_METRICS.heart), ear: 'ok', lungs: worst(BP_METRICS.lungs), brain: worst(BP_METRICS.brain), eyes: 'nodata', bones: 'nodata', muscle: 'nodata', skin: 'nodata' }
  if (live?.online && live.crew?.id === c.id) {
    const signalLevel = (k: 'hr_bpm' | 'rr_brpm' | 'spo2_pct' | 'temp_c'): Level => liveStatus(live, k) === 'exercising' ? 'ok' : live.level[k]
    const worstLevel = (...ls: Level[]): Level => ls.includes('alarm') ? 'alarm' : ls.includes('watch') ? 'watch' : ls.includes('ok') ? 'ok' : 'nodata'
    lv.heart = worstLevel(lv.heart, signalLevel('hr_bpm'))
    lv.lungs = worstLevel(lv.lungs, signalLevel('rr_brpm'), signalLevel('spo2_pct'))
    lv.muscle = Number.isFinite(live.crew.now.activity) ? 'ok' : 'nodata'
    lv.skin = live.level.temp_c
  }
  return lv
}

export function useHotspots(c: CrewDetail | null, live?: Live): Hotspot[] {
  const t = useT(); const { lang } = useLang()
  if (!c) return []
  const lv = bodyLevels(c, live)
  return (Object.keys(BP_POS) as BP[]).map(id => ({ id, pos: BP_POS[id], level: lv[id], label: id === 'skin' ? SKIN_LABEL[lang] : t(BP_LABEL[id]), left: ['lungs', 'eyes', 'bones'].includes(id) }))
}

const SKIN_LABEL = { en: 'Skin temperature', es: 'Temperatura de la piel' }
const COPY = {
  en: { close: 'Close details', measurements: 'Your measurements', trend: 'Recent trend', latest: 'Latest', days: 'days', measured: 'Measured by', risk: 'Related NASA HRP risk', status: { ok: 'In range', watch: 'Attention', alarm: 'Urgent', nodata: 'Not measured' }, source: { heart: 'Onboard ECG sensor shirt', lungs: 'Onboard breathing and oxygen sensors, cabin CO₂ monitor', brain: 'Wrist actigraphy and sleep diary', ear: 'No vital-sign sensor', eyes: 'Scheduled eye examinations', bones: 'Exercise log and bone scans', muscle: 'Shirt or earpiece activity sensor', skin: 'Onboard skin temperature sensor' } },
  es: { close: 'Cerrar detalles', measurements: 'Tus medidas', trend: 'Tendencia reciente', latest: 'Actual', days: 'días', measured: 'Medido con', risk: 'Riesgo NASA HRP relacionado', status: { ok: 'En tu banda', watch: 'Atención', alarm: 'Urgente', nodata: 'Sin medir' }, source: { heart: 'Camiseta con sensor ECG de a bordo', lungs: 'Sensores de respiración y oxígeno de a bordo, monitor de CO₂ de cabina', brain: 'Actigrafía de muñeca y diario de sueño', ear: 'Sin sensor de constantes', eyes: 'Revisiones oculares programadas', bones: 'Registro de ejercicio y escáneres óseos', muscle: 'Sensor de actividad de la camiseta o del módulo de oído', skin: 'Sensor de temperatura cutánea de a bordo' } },
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
  const live = useLiveVitals(crewId)
  // Eyes and bones are not measured on board day to day (only occasional ultrasound / pre- and post-flight scans): no hotspot.
  const hs = useHotspots(c, live).filter(h => h.id !== 'eyes' && h.id !== 'bones' && h.level !== 'nodata')
  useEffect(() => { setSel(null) }, [crewId, sex])
  const closeDetails = useCallback(() => setSel(null), [])
  return (
    <Page title={t('body_title')}>
      <div className={`bodywrap figure${sel ? ' body-panel-open' : ''}`}>
        <BodyModel3D hotspots={hs} selected={sel} onSelect={id => { setTrigger(document.activeElement instanceof HTMLElement ? document.activeElement : null); setSel(id as BP) }} sex={sex} />
        {sel && <BodyDetails key={sel} live={live} c={c} sel={sel} trigger={trigger} onClose={closeDetails} />}
      </div>
    </Page>
  )
}

function BodyDetails({ c, live, sel, trigger, onClose }: { c: CrewDetail; live: Live; sel: BP; trigger: HTMLElement | null; onClose: () => void }) {
  const t = useT()
  const { lang } = useLang()
  const panel = useRef<HTMLDivElement>(null)
  const connector = useRef<SVGSVGElement>(null)
  const curve = useRef<SVGPathElement>(null)
  const endpoint = useRef<SVGCircleElement>(null)
  // Read the projected button each frame: CSS positions change without React renders.
  useEffect(() => {
    let frame = 0
    const track = () => {
      const el = panel.current, svg = connector.current
      const wrap = el?.parentElement
      const hotspot = wrap?.querySelector<HTMLElement>('.figure-hotspot[aria-pressed="true"]')
      if (el && svg && wrap && hotspot) {
        const bounds = wrap.getBoundingClientRect(), point = hotspot.getBoundingClientRect()
        const x = point.left + point.width / 2 - bounds.left
        const y = point.top + point.height / 2 - bounds.top
        const narrow = matchMedia('(max-width: 900px)').matches
        const gutter = 24
        if (!narrow) {
          // The side is decided once, when the hotspot is clicked (data-panel-side on the 3D host), and never flips while
          // the body rotates or zooms: the panel stays docked on that edge and the body slides to the other side.
          const side = wrap.querySelector<HTMLElement>('.body-model')?.dataset.panelSide === 'left' ? 'left' : 'right'
          const width = Math.min(384, bounds.width * .4)
          el.style.width = `${width}px`
          el.style.left = `${side === 'right' ? bounds.width - width - gutter : gutter}px`
          el.style.top = `${Math.max(96, (bounds.height - el.offsetHeight) / 2)}px`
        } else {
          el.style.removeProperty('width'); el.style.removeProperty('left'); el.style.removeProperty('top')
        }
        const box = el.getBoundingClientRect()
        const endX = narrow ? Math.max(box.left + 24, Math.min(point.left + point.width / 2, box.right - 24)) - bounds.left : (box.left + box.width / 2 > point.left + point.width / 2 ? box.left : box.right) - bounds.left
        const endY = narrow ? box.top - bounds.top : box.top - bounds.top + 40
        const bend = narrow ? Math.max(24, (endY - y) / 2) : (endX - x) / 2
        curve.current?.setAttribute('d', narrow ? `M ${x} ${y} C ${x} ${y + bend}, ${endX} ${endY - bend}, ${endX} ${endY}` : `M ${x} ${y} C ${x + bend} ${y}, ${endX - bend} ${endY}, ${endX} ${endY}`)
        endpoint.current?.setAttribute('cx', String(endX)); endpoint.current?.setAttribute('cy', String(endY))
        svg.style.visibility = getComputedStyle(hotspot).visibility === 'hidden' ? 'hidden' : 'visible'
        el.dataset.positioned = 'true'
      }
      frame = requestAnimationFrame(track)
    }
    frame = requestAnimationFrame(track)
    return () => cancelAnimationFrame(frame)
  }, [])
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
  const lv = bodyLevels(c, live)
  const today = c.days[c.days.length - 1]
  const copy = COPY[lang]
  const metrics = BP_METRICS[sel]
  const primary = metrics[0]
  const hasLive = live.online && live.crew?.id === c.id
  const liveKeys = sel === 'heart' ? ['hr_bpm'] as const : sel === 'lungs' ? ['rr_brpm', 'spo2_pct'] as const : sel === 'skin' ? ['temp_c'] as const : sel === 'muscle' && live.exercising ? ['hr_bpm'] as const : []
  const label = sel === 'skin' ? SKIN_LABEL[lang] : t(BP_LABEL[sel])
  const icons = { resting_hr_bpm: Heart, hrv_ms: Activity, sleep_h: Moon, co2_night_peak_mmhg: Wind }
  return <>
    <svg ref={connector} className="body-panel-connector" aria-hidden="true">
      <path ref={curve} fill="none" stroke="#07173F" strokeOpacity=".24" strokeWidth="1.5" />
      <circle ref={endpoint} r="4" fill="#07173F" fillOpacity=".5" />
    </svg>
    <div ref={panel} className="body-panel" role="dialog" aria-label={label} tabIndex={-1}>
      <header className="body-panel-header">
        <h2>{label}</h2>
        <span className={`body-panel-status status-${lv[sel]}`}>{copy.status[lv[sel]]}</span>
        <button type="button" className="body-panel-close" aria-label={copy.close} onClick={onClose}>×</button>
      </header>
      {metrics.length > 0 || hasLive && (liveKeys.length > 0 || sel === 'muscle') ? <>
        <h3 className="body-panel-section">{copy.measurements}</h3>
        <div className="body-panel-metrics">
          {hasLive && sel === 'muscle' && <article className="body-metric-tile body-activity"><h4>{LIVE_COPY[lang].activity}</h4><span className="live-chip exercising">{live.exercising ? LIVE_COPY[lang].exercisingNow : LIVE_COPY[lang].resting}</span></article>}
          {hasLive && liveKeys.map(k => <LiveTile key={k} live={live} signal={k} />)}
          {metrics.map((m, i) => {
            const Icon = icons[m as keyof typeof icons] ?? Activity
            return <article className={`body-metric-tile${i === 0 ? ' primary' : ''}`} key={m}>
              <div className="body-metric-top"><span className="body-metric-icon"><Icon size={20} strokeWidth={1.8} aria-hidden="true" /></span><span className={`body-panel-status status-${levelOf(m, today[m], c.baseline[m])}`}>{copy.status[levelOf(m, today[m], c.baseline[m])]}</span></div>
              <div className="body-metric-chart">
                <Spark days={c.days} m={m} b={c.baseline[m]} h={64} color="#0960E1" />
                <div className="body-metric-reading"><strong>{fmt(today[m], DEC[m])}</strong><span>{t(UNIT[m])}</span></div>
              </div>
              <h4>{t(`m_${m}`)}</h4>
              <p>{t('your_band')} {fmt(c.baseline[m].band_low, DEC[m])}–{fmt(c.baseline[m].band_high, DEC[m])} {t(UNIT[m])}</p>
            </article>
          })}
        </div>
        {primary && <article className="body-panel-trend">
          <div><h3>{copy.trend}</h3><span>{t(`m_${primary}`)}</span></div>
          <Spark days={c.days} m={primary} b={c.baseline[primary]} h={56} color="#EAFE07" />
          <div className="body-trend-caption"><span>{c.days.length} {copy.days}</span><span>{copy.latest} {fmt(today[primary], DEC[primary])} {t(UNIT[primary])}</span></div>
        </article>}
      </> : sel === 'ear' ? <p className="body-panel-pill">{t('link_ok')}, {t('worn')}</p> : null}
      {sel !== 'ear' && sel !== 'muscle' && sel !== 'skin' && sel !== 'brain' && <div className="body-panel-pill"><span className="body-panel-caption">{copy.measured}</span><p>{copy.source[sel]}</p></div>}
      {sel !== 'skin' && sel !== 'ear' && sel !== 'muscle' && sel !== 'brain' && <div className="body-panel-pill"><span className="body-panel-caption">{copy.risk}</span><p>{t(`hrp_${sel}`)}</p></div>}
      <IndicatorSheet indicator={sel} collapsible />
    </div>
  </>
}
