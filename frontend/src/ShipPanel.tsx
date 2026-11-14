// Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
// The ship in 3D (modules coloured by their cabin air, crew where they are) next to the radiation dose and what is
// going on board. Self-contained (polls /api/station and /api/ship), used on Ground's Station control and in Trends.
import { useState } from 'react'
import { api } from './api'
import { usePoll } from './hooks'
import { useLang, pick } from './i18n'
import { Shape, fmt, type Level } from './ui'
import ShipModel3D, { moduleIdOf, type ShipModule, type ShipCrew } from './ShipModel3D'
import './ground.css'

const TXT = {
  en: { ship: 'Ship', now: 'On board now', in: 'in', radiation: 'Radiation', career: 'of the career limit', perDay: '/day', missionDay: 'Mission day', of: 'of' },
  es: { ship: 'Nave', now: 'A bordo ahora', in: 'en', radiation: 'Radiación', career: 'del límite de carrera', perDay: '/día', missionDay: 'Día de misión', of: 'de' },
}
const CAREER_MSV = 600
const lvl = (s?: string): Level => (s === 'alarm' || s === 'fault' || s === 'red' ? 'alarm' : s === 'watch' || s === 'warning' ? 'watch' : 'ok')
/** First sentence only, without the leading "System: " label repeated twice. */
const short = (t: string) => t.split(/(?<=\.)\s/)[0].replace(/^([^:]+): ([^:]+): /, '$2: ').replace(/^./, c => c.toUpperCase())

export default function ShipPanel() {
  const { lang } = useLang(); const x = TXT[lang]
  const st = usePoll(() => api.station(), 4000)
  const ship = usePoll(() => api.ship(), 5000)
  const [sel, setSel] = useState<string | null>(null)
  const env = st?.environment ?? []
  const modules: ShipModule[] = env.map(e => {
    const id = moduleIdOf(e.module_en ?? e.module), co2 = e.co2_mmhg
    return { id, label: pick(e as never, 'module', lang) || e.module, status: co2 > 4.5 ? 'alarm' : co2 > 3 ? 'watch' : 'ok', detail: `CO₂ ${fmt(co2, 2)} mmHg` }
  })
  const crew: ShipCrew[] = (st?.crew ?? []).map(c => ({ id: c.id, name: c.name, module: c.location ?? 'node', status: lvl(c.status) === 'alarm' ? 'alarm' : lvl(c.status) === 'watch' ? 'watch' : 'ok' }))
  const room = sel ? env.find(e => moduleIdOf(e.module_en ?? e.module) === sel) : null
  const rad = ship?.systems.find(s => s.group === 'radiation')
  const radPct = rad ? Math.min(100, (rad.value / CAREER_MSV) * 100) : 0
  const day = ship?.mission.day
  const happening = [
    ...(ship?.alerts ?? []).map(a => ({ k: a.id, level: lvl(a.level), text: short(pick(a as never, 'text', lang)) })),
    ...crew.map(c => ({ k: 'c' + c.id, level: c.status as Level, text: `${c.name} ${x.in} ${modules.find(m => m.id === moduleIdOf(c.module))?.label ?? c.module}` })),
  ]
  return (
    <section className="card ground-ship" aria-label={x.ship}>
      <div className="ground-ship-map">
        <ShipModel3D modules={modules} crew={crew} selected={sel} onSelect={id => setSel(v => (v === id ? null : id))} />
        {room && <div className="ground-ship-room">
          <strong>{pick(room as never, 'module', lang) || room.module}</strong>
          <span>CO₂ {fmt(room.co2_mmhg, 2)} mmHg</span>{room.temp_c != null && <span>{fmt(room.temp_c, 1)} °C</span>}{room.rh_pct != null && <span>{room.rh_pct} % RH</span>}
        </div>}
      </div>
      <div className="ground-ship-side">
        {rad && <div className="ground-radiation">
          <h3 className="ground-h">{x.radiation}</h3>
          <div className="ground-rad-value"><strong>{rad.value}</strong><span>mSv</span></div>
          <div className="ground-rad-bar" role="meter" aria-valuemin={0} aria-valuemax={CAREER_MSV} aria-valuenow={rad.value}><i style={{ width: `${radPct}%` }} /></div>
          <p className="small">{Math.round(radPct)} % {x.career}{day ? `, ${(rad.value / day).toFixed(1)} mSv${x.perDay}` : ''}</p>
          {ship && <p className="small muted">{x.missionDay} {ship.mission.day} {x.of} {ship.mission.planned_days}</p>}
        </div>}
        <div className="ground-happening">
          <h3 className="ground-h">{x.now}</h3>
          <ul>{happening.map(h => <li key={h.k} className={h.level}><Shape level={h.level} /><span>{h.text}</span></li>)}</ul>
        </div>
      </div>
    </section>
  )
}
