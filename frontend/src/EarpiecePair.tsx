// Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
// Both earpieces of the pair: the connected one first, then the one charging in its dock.
import { BatteryCharging, BatteryFull, BatteryMedium, BatteryLow } from 'lucide-react'
import { useLang } from './i18n'
import { EARPIECE_TXT, useEarpieces } from './earpieces'
import './earpieces.css'

export default function EarpiecePair({ battery, crewId, compact = false }: { battery: number | null | undefined; crewId: string; compact?: boolean }) {
  const { lang } = useLang(); const s = EARPIECE_TXT[lang]
  const pair = useEarpieces(battery, crewId)
  if (!pair.length) return null
  return (
    <div className={`earpiece-pair ${compact ? 'compact' : ''}`}>
      {pair.map(e => {
        const Icon = e.charging ? BatteryCharging : e.battery >= 90 ? BatteryFull : e.battery < 30 ? BatteryLow : BatteryMedium
        const label = e.worn ? s.worn : e.charging ? s.dock : s.full
        return (
          <div key={e.id} className={`earpiece-unit ${e.worn ? 'worn' : 'dock'} ${e.charging ? 'charging' : ''}`}>
            <div className="earpiece-top">
              <span className="earpiece-name">{label}</span>
              <span className="earpiece-value"><Icon size={15} aria-hidden /> {e.battery}%</span>
            </div>
            <div className="earpiece-bar" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={e.battery} aria-label={`${label}, ${s.battery} ${e.battery}%`}>
              <i style={{ width: `${e.battery}%` }} />
            </div>
            {e.worn && <span className="earpiece-link">{s.connected}</span>}
          </div>
        )
      })}
    </div>
  )
}
