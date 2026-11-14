// Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
// "Trends": 30 days vs. personal band + reference lines; real OSDR blood panel.
import { LIVE_KEYS, useLiveVitals } from '../vitals'
import { LIVE_COPY, LiveTile } from './Greeting'
import { useState } from 'react'
import { Area, CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api, type Metric, type Threshold } from '../api'
import SleepAir, { SleepAirInsight } from './SleepAir'
import { useLoad } from '../hooks'
import { useLang, useT, pick, unitL } from '../i18n'
import { Card, DEC, LevelTag, Loading, METRICS, Page, UNIT, fmt, levelOf, useCrew } from '../ui'
import { findThr, numVal } from '../thresholds'
import { IndicatorButton } from '../IndicatorSheet'

export const REF: Record<Metric, [string, RegExp][]> = {
  resting_hr_bpm: [['hr_inflight', /^hr|heart/]],
  hrv_ms: [],
  sleep_h: [['sleep_inflight', /sleep_in|sleep_avg|sleep_mean/], ['sleep_recommended', /sleep_rec/]],
  co2_night_peak_mmhg: [['co2_1h', /co2.*1h|co2_limit|co2_1/]],
  mood_1_5: [],
}

export function ThresholdLabel({ th, color = 'var(--warn)' }: { th: Threshold; color?: string }) {
  const { lang } = useLang()
  return (
    <span className="small" style={{ color }}>
      <svg width="18" height="6" style={{ marginRight: 6 }}><line x1="0" y1="3" x2="18" y2="3" stroke={color} strokeWidth="2" strokeDasharray="4 3" /></svg>
      {pick(th as never, 'label', lang)}: <b style={{ fontWeight: 600 }}>{String(th.value)} {unitL(th.unit, lang)}</b>
    </span>
  )
}

export default function Trend() {
  const t = useT(); const { crewId } = useCrew(); const { lang } = useLang()
  const live = useLiveVitals(crewId)
  const { data: c } = useLoad(() => api.crewOne(crewId), [crewId])
  const { data: ths } = useLoad(api.thresholds)
  if (!c) return <Loading />
  const today = c.days[c.days.length - 1]
  return (
    <Page title={t('trends_title')}>
      <SleepAirInsight />
      {live.online && live.crew?.id === crewId && <Card className="live-session" title={<span className="live-heading"><span className="live-dot" />{LIVE_COPY[lang].session}</span>} right={live.exercising ? <span className="live-chip exercising">{LIVE_COPY[lang].exercising}</span> : undefined}>
        <div className="live-grid">{LIVE_KEYS.map(k => <LiveTile key={k} live={live} signal={k} detailed />)}</div>
      </Card>}
      <div className="grid g2">
        {([...METRICS, 'mood_1_5'] as Metric[]).map(m => {
          const b = c.baseline[m]
          const refs = REF[m].map(([id, kw]) => findThr(ths, id, kw)).filter(Boolean) as Threshold[]
          const data = c.days.map(d => ({ day: d.mission_day, v: d[m] }))
          const vals = data.map(d => d.v as number).concat(refs.map(numVal).filter(n => !Number.isNaN(n)), [b.band_low, b.band_high])
          const lo = Math.min(...vals), hi = Math.max(...vals), pad = (hi - lo) * 0.12
          const lvl = levelOf(m, today[m], b)
          const col = '#0960E1'
          return (
            <Card key={m} title={t(`m_${m}`)} right={<span className="row"><span className="trend-now">{fmt(today[m], DEC[m])} <small>{m === 'mood_1_5' ? '/5' : t(UNIT[m])}</small></span><LevelTag level={lvl} /></span>}>
              <div style={{ height: 230 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
                    <CartesianGrid stroke="#E3E9F2" vertical={false} />
                    <XAxis dataKey="day" tick={{ fill: '#4A5468', fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#D7DFEC' }} interval={4} />
                    <YAxis domain={[+(lo - pad).toFixed(2), +(hi + pad).toFixed(2)]} tick={{ fill: '#4A5468', fontSize: 11 }} tickLine={false} axisLine={false} width={44} tickFormatter={(v: number) => v.toFixed(DEC[m] ? 1 : 0)} />
                    <ReferenceArea y1={b.band_low} y2={b.band_high} fill="#2E96F5" fillOpacity={0.08} stroke="none" ifOverflow="extendDomain" />
                    {refs.map((r, i) => !Number.isNaN(numVal(r)) && <ReferenceLine key={r.id} y={numVal(r)} stroke={i ? '#0960E1' : '#B45309'} strokeDasharray="5 4" strokeWidth={1.5} />)}
                    <Tooltip contentStyle={{ background: '#07173F', border: '1px solid #D7DFEC', borderRadius: 10, fontSize: 12 }} labelFormatter={(l) => `${t('mission_day')} ${l}`} formatter={(v) => [fmt(Number(v), DEC[m]) + ' ' + t(UNIT[m]), t(`m_${m}`)]} />
                    <Area type="monotone" dataKey="v" stroke="none" fill={col} fillOpacity={0.06} isAnimationActive={false} />
                    <Line type="monotone" dataKey="v" stroke={col} strokeWidth={2.2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="row wrap" style={{ gap: 16, marginTop: 8 }}>
                <span className="small muted"><span style={{ display: 'inline-block', width: 14, height: 8, background: 'rgba(46,150,245,.18)', marginRight: 6, borderRadius: 2 }} />{t('your_band')} {fmt(b.band_low, DEC[m])}–{fmt(b.band_high, DEC[m])}</span>
                {refs.map((r, i) => <ThresholdLabel key={r.id} th={r} color={i ? 'var(--info)' : 'var(--warn)'} />)}
              </div>
              <IndicatorButton indicator={m} />
            </Card>
          )
        })}
      </div>
      <SleepAir />
    </Page>
  )
}

const ANALYTE_LABEL: Record<string, string> = {
  white_blood_cell_count: 'White blood cells', red_blood_cell_count: 'Red blood cells', hemoglobin: 'Hemoglobin', hematocrit: 'Hematocrit',
  platelet_count: 'Platelets', absolute_neutrophils: 'Neutrophils (abs.)', absolute_lymphocytes: 'Lymphocytes (abs.)', absolute_monocytes: 'Monocytes (abs.)',
  absolute_eosinophils: 'Eosinophils (abs.)', absolute_basophils: 'Basophils (abs.)', mcv: 'MCV', mch: 'MCH', mchc: 'MCHC', rdw: 'RDW', mpv: 'MPV', basophils: 'Basophils (%)', eosinophils: 'Eosinophils (%)',
  lymphocytes: 'Lymphocytes (%)', monocytes: 'Monocytes (%)', neutrophils: 'Neutrophils (%)',
}
const ANALYTE_ES: Record<string, string> = {
  white_blood_cell_count: 'Leucocitos', red_blood_cell_count: 'Hematíes', hemoglobin: 'Hemoglobina', hematocrit: 'Hematocrito', platelet_count: 'Plaquetas',
  absolute_neutrophils: 'Neutrófilos (abs.)', absolute_lymphocytes: 'Linfocitos (abs.)', absolute_monocytes: 'Monocitos (abs.)', absolute_eosinophils: 'Eosinófilos (abs.)', absolute_basophils: 'Basófilos (abs.)',
  mcv: 'VCM', mch: 'HCM', mchc: 'CHCM', rdw: 'ADE', mpv: 'VPM', basophils: 'Basófilos (%)', eosinophils: 'Eosinófilos (%)', lymphocytes: 'Linfocitos (%)', monocytes: 'Monocitos (%)', neutrophils: 'Neutrófilos (%)',
}
const UNIT_ES: Record<string, string> = { 'cells/microliter': 'células/µL', percent: '%', 'grams/deciliter': 'g/dL', femtoliter: 'fL', picogram: 'pg', 'thousand/microliter': 'miles/µL', 'million/microliter': 'millones/µL' }
const nice = (a: string, lang: 'en' | 'es' = 'en') => (lang === 'es' ? ANALYTE_ES[a] : undefined) ?? ANALYTE_LABEL[a] ?? a.replace(/_/g, ' ').replace(/^\w/, s => s.toUpperCase())
const niceUnit = (u: string, lang: 'en' | 'es') => { const x = u.replace(/_per_/g, '/').replace(/_/g, ' '); return lang === 'es' ? UNIT_ES[x] ?? x : x }

export function BloodPanel({ compact }: { compact?: boolean; refNote?: boolean }) {
  const t = useT(); const { lang } = useLang()
  const { data: b } = useLoad(api.blood)
  const ids = b ? Object.keys(b.crew) : []
  const [sel, setSel] = useState<string | null>(null)
  if (!b) return null
  const id = sel ?? ids[0]
  const rows = b.crew[id]?.analytes ?? []
  const shown = compact ? rows.filter(r => r.outside_personal_band || r.outside_reference_range).slice(0, 6) : rows
  return (
    <Card style={{ marginTop: 18 }} title={({ en: 'Complete blood count', es: 'Hemograma completo' })[lang]}>
      <div className="row between wrap" style={{ marginBottom: 10 }}>
        <span />
        <div className="seg">{ids.map(i => <button key={i} className={i === id ? 'on' : ''} onClick={() => setSel(i)}>{t('crew_member')} {i}</button>)}</div>
      </div>
      <div>
        <table className="t">
          <thead><tr><th>{t('analyte')}</th><th className="n">{t('baseline')}</th><th className="n">{t('rplus1')}</th><th className="n">{t('ref_range')}</th><th></th></tr></thead>
          <tbody>
            {shown.map(r => (
              <tr key={r.analyte}>
                <td>{nice(r.analyte, lang)} <span className="dim small">{niceUnit(r.unit, lang)}</span></td>
                <td className="n">{fmt(r.baseline_mean, 1)}</td>
                <td className={`n ${r.outside_reference_range ? 's-alarm' : r.outside_personal_band ? 's-watch' : ''}`}>{fmt(r.r_plus_1, 1)}</td>
                <td className="n dim">{r.ref_min != null && r.ref_max != null ? `${r.ref_min}–${r.ref_max}` : ''}</td>
                <td>{r.outside_reference_range ? <span className="tag alarm" title={t('outside_ref')}>{t('outside_ref')}</span> : r.outside_personal_band ? <span className="tag watch" title={t('outside_band')}>{t('outside_band')}</span> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

/** Text for the personal-baseline period: API `baseline_window` first, else the prototype thresholds. Never hard-coded. */
export function baselineWindow(c: Record<string, unknown> | null, ths: Threshold[] | null | undefined, lang: 'en' | 'es', t: (k: 'baseline_fallback') => string): string {
  const w = c?.baseline_window as unknown
  if (typeof w === 'string') return w
  if (w && typeof w === 'object') {
    const o = w as Record<string, unknown>
    const txt = o[`label_${lang}`] ?? o[`text_${lang}`] ?? o.label_en ?? o.text_en
    if (typeof txt === 'string') return txt
    const a = o.from_mission_day ?? o.start_mission_day ?? o.start ?? o.from, b = o.to_mission_day ?? o.end_mission_day ?? o.end ?? o.to
    if (a != null && b != null) return (lang === 'es' ? `días ${a}–${b} de misión` : `mission days ${a}–${b}`)
    if (o.days != null) return t('baseline_fallback').replace('{sd}', String(o.sd ?? 2)).replace('{n}', String(o.days))
  }
  const n = (ths ?? []).find(x => x.id === 'baseline_days')?.value, sd = (ths ?? []).find(x => x.id === 'baseline_band_sd')?.value
  return t('baseline_fallback').replace('{sd}', String(sd ?? 2)).replace('{n}', String(n ?? 21))
}
