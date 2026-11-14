// Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
// The Metis earpiece is a swappable PAIR (final concept): one is worn while the other charges.
// For the demo every battery reads above 85 %: a random level between 85 and 99 % per crew member and unit,
// drawn once per page load. The spare in the dock keeps charging about 1 % per minute until full.
import { useEffect, useState } from 'react'

export interface Earpiece { id: 'A' | 'B'; worn: boolean; charging: boolean; battery: number }

const START = Date.now()
const levels = new Map<string, number>()

/** Random battery level in 85–99 %, fixed for this crew member and unit during the session. */
export function demoBattery(crewId: string, unit: 'A' | 'B' = 'A'): number {
  const k = `${crewId}:${unit}`
  if (!levels.has(k)) levels.set(k, crewId === 'lena' && unit === 'A' ? 89 : 85 + Math.floor(Math.random() * 15))  // Lena's worn unit: 89 %
  return levels.get(k)!
}

export function useEarpieces(wornBattery: number | null | undefined, crewId: string): Earpiece[] {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 15000); return () => clearInterval(id) }, [])
  if (wornBattery == null) return []  // no earpiece reported for this crew member
  const spare = Math.min(100, demoBattery(crewId, 'B') + Math.floor((now - START) / 60000))
  return [
    { id: 'A', worn: true, charging: false, battery: demoBattery(crewId, 'A') },
    { id: 'B', worn: false, charging: spare < 100, battery: spare },
  ]
}

export const EARPIECE_TXT = {
  en: { worn: 'In use', dock: 'Charging', full: 'Charged', battery: 'Battery', connected: 'Connected' },
  es: { worn: 'Puesto', dock: 'Cargando', full: 'Cargado', battery: 'Batería', connected: 'Conectado' },
}
