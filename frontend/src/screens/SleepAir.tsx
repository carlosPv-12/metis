// Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
// "Sleep × Air": cross-check of nightly sleep and bunk CO₂ peak, with the cabin CO₂ limit.
import { Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from 'recharts'
import { Lightbulb } from 'lucide-react'
import { api } from '../api'
import { useLoad } from '../hooks'
import { useT } from '../i18n'
import { Card, Loading, MetisLine, fmt, useCrew } from '../ui'
import { findThr, numVal } from '../thresholds'
import { ThresholdLabel } from './Trend'
import { matchN, insightText } from './Greeting'

export default function SleepAir() {
  const t = useT(); const { crewId } = useCrew()
  const { data: c } = useLoad(() => api.crewOne(crewId), [crewId])
  const { data: ths } = useLoad(api.thresholds)
  if (!c) return <Loading />
  const co2 = findThr(ths, 'co2_1h', /co2.*1h|co2_limit|co2_1/), sleepRef = findThr(ths, 'sleep_inflight', /sleep_in|sleep_avg/)
  const data = c.days.map(d => ({ day: d.mission_day, sleep: d.sleep_h, co2: d.co2_night_peak_mmhg }))
  const nm = matchN(c.days)
  const worst = [...data].sort((a, b) => a.sleep - b.sleep).slice(0, nm).map(d => d.day)
  // Pearson correlation between sleep and CO₂ peak, computed on the shown data
  const n = data.length, mx = data.reduce((s, d) => s + d.sleep, 0) / n, my = data.reduce((s, d) => s + d.co2, 0) / n
  const r = data.reduce((s, d) => s + (d.sleep - mx) * (d.co2 - my), 0) / Math.sqrt(data.reduce((s, d) => s + (d.sleep - mx) ** 2, 0) * data.reduce((s, d) => s + (d.co2 - my) ** 2, 0))
  return (
    <section className="sleepair-section" aria-labelledby="sleepair-title">
      <h2 id="sleepair-title" className="h1 section-h">{t('sleepair_title')}</h2>
      <p className="sub">{t('sleepair_sub')}</p>
      <Card>
        <div style={{ height: 380 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: -6 }}>
              <CartesianGrid stroke="#E3E9F2" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: '#4A5468', fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#D7DFEC' }} />
              <YAxis yAxisId="s" domain={[0, 8]} tick={{ fill: '#0960E1', fontSize: 11 }} tickLine={false} axisLine={false} width={40} />
              <YAxis yAxisId="c" orientation="right" domain={[0, 4.5]} tick={{ fill: '#B45309', fontSize: 11 }} tickLine={false} axisLine={false} width={40} />
              <Tooltip contentStyle={{ background: '#07173F', border: '1px solid #D7DFEC', borderRadius: 10, fontSize: 12 }} labelFormatter={l => `${t('mission_day')} ${l}`} />
              <Bar yAxisId="s" dataKey="sleep" name={t('m_sleep_h')} radius={[4, 4, 0, 0]} isAnimationActive={false}>
                {data.map(d => <Cell key={d.day} fill={worst.includes(d.day) ? '#0960E1' : 'rgba(46,150,245,.24)'} />)}
              </Bar>
              {Number.isFinite(numVal(co2)) && <ReferenceLine yAxisId="c" y={numVal(co2)} stroke="#B45309" strokeDasharray="5 4" />}
              {Number.isFinite(numVal(sleepRef)) && <ReferenceLine yAxisId="s" y={numVal(sleepRef)} stroke="#0960E1" strokeDasharray="2 4" strokeOpacity={0.6} />}
              <Line yAxisId="c" dataKey="co2" name={t('m_co2_night_peak_mmhg')} stroke="#0960E1" strokeWidth={2.4} dot={{ r: 2.5, fill: '#0960E1' }} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="row wrap" style={{ gap: 18, marginTop: 10 }}>
          <span className="small" style={{ color: 'var(--info)' }}>■ {t('m_sleep_h')} ({t('u_h')})</span>
          <span className="small" style={{ color: 'var(--info)' }}>● {t('m_co2_night_peak_mmhg')}</span>
          {co2 && <ThresholdLabel th={co2} />}{sleepRef && <ThresholdLabel th={sleepRef} color="var(--info)" />}
        </div>
      </Card>
      <div className="grid g2" style={{ marginTop: 18 }}>
        <Card className="feature feature-gradient" title={<><Lightbulb size={14} />Metis</>}>
          <MetisLine><p className="quote" style={{ margin: 0 }}>{insightText(t, nm)}</p><p className="muted" style={{ marginBottom: 0 }}>{t('sleepair_action')}</p></MetisLine>
        </Card>
        <Card title={t('r_title')}>
          <div className="stat"><div className="val">{fmt(r, 2)}</div></div>
          <div className="small muted">{t('pearson_note').replace('{n}', String(n))}</div>
        </Card>
      </div>
    </section>
  )
}
