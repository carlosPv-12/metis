// Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
// "Sleep × Air": cross-check of nightly sleep and bunk CO₂ peak, with the NASA CO₂ limit and its source.
import { Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from 'recharts'
import { Lightbulb } from 'lucide-react'
import { api } from '../api'
import { useLoad } from '../hooks'
import { useT } from '../i18n'
import { Card, Loading, MetisLine, Page, fmt, useCrew } from '../ui'
import { findThr } from '../thresholds'
import { SourceTip } from './Trend'
import { matchN, insightText } from './Greeting'

export default function SleepAir() {
  const t = useT(); const { crewId } = useCrew()
  const { data: c } = useLoad(() => api.crewOne(crewId), [crewId])
  const { data: ths } = useLoad(api.thresholds)
  if (!c) return <Loading />
  const co2 = findThr(ths, 'co2_1h', /co2.*1h|co2_limit|co2_1/)!, sleepRef = findThr(ths, 'sleep_inflight', /sleep_in|sleep_avg/)!
  const data = c.days.map(d => ({ day: d.mission_day, sleep: d.sleep_h, co2: d.co2_night_peak_mmhg }))
  const nm = matchN(c.days)
  const worst = [...data].sort((a, b) => a.sleep - b.sleep).slice(0, nm).map(d => d.day)
  // Pearson correlation between sleep and CO₂ peak, computed on the shown data
  const n = data.length, mx = data.reduce((s, d) => s + d.sleep, 0) / n, my = data.reduce((s, d) => s + d.co2, 0) / n
  const r = data.reduce((s, d) => s + (d.sleep - mx) * (d.co2 - my), 0) / Math.sqrt(data.reduce((s, d) => s + (d.sleep - mx) ** 2, 0) * data.reduce((s, d) => s + (d.co2 - my) ** 2, 0))
  return (
    <Page title={t('sleepair_title')} sub={t('sleepair_sub')} right={<span className="tag sim">{t('sim_badge')} · {c.name}</span>}>
      <Card>
        <div style={{ height: 380 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: -6 }}>
              <CartesianGrid stroke="#1a2534" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: '#5d6c80', fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#253246' }} />
              <YAxis yAxisId="s" domain={[0, 8]} tick={{ fill: '#6fb6ff', fontSize: 11 }} tickLine={false} axisLine={false} width={40} />
              <YAxis yAxisId="c" orientation="right" domain={[0, 4.5]} tick={{ fill: '#f3b443', fontSize: 11 }} tickLine={false} axisLine={false} width={40} />
              <Tooltip contentStyle={{ background: '#0f1926', border: '1px solid #253246', borderRadius: 10, fontSize: 12 }} labelFormatter={l => `${t('mission_day')} ${l}`} />
              <Bar yAxisId="s" dataKey="sleep" name={t('m_sleep_h')} radius={[4, 4, 0, 0]} isAnimationActive={false}>
                {data.map(d => <Cell key={d.day} fill={worst.includes(d.day) ? '#6fb6ff' : 'rgba(111,182,255,.32)'} />)}
              </Bar>
              <ReferenceLine yAxisId="c" y={+co2.value} stroke="#f3b443" strokeDasharray="5 4" />
              <ReferenceLine yAxisId="s" y={6.09} stroke="#6fb6ff" strokeDasharray="2 4" strokeOpacity={0.6} />
              <Line yAxisId="c" dataKey="co2" name={t('m_co2_night_peak_mmhg')} stroke="#f3b443" strokeWidth={2.4} dot={{ r: 2.5, fill: '#f3b443' }} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="row wrap" style={{ gap: 18, marginTop: 10 }}>
          <span className="small" style={{ color: 'var(--info)' }}>■ {t('m_sleep_h')} ({t('u_h')})</span>
          <span className="small s-watch">● {t('m_co2_night_peak_mmhg')}</span>
          <SourceTip th={co2} /><SourceTip th={sleepRef} color="var(--info)" />
        </div>
      </Card>
      <div className="grid g2" style={{ marginTop: 18 }}>
        <Card title={<><Lightbulb size={14} />Metis</>}>
          <MetisLine><p className="quote" style={{ margin: 0 }}>{insightText(t, nm)}</p><p className="muted" style={{ marginBottom: 0 }}>{t('sleepair_action')}</p></MetisLine>
        </Card>
        <Card title={t('r_title')}>
          <div className="stat"><div className="val">{fmt(r, 2)}</div></div>
          <div className="small muted">{t('pearson_note').replace('{n}', String(n))}<br />{t('r_src')}</div>
        </Card>
      </div>
    </Page>
  )
}
