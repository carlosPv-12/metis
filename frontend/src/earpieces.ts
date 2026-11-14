// Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
// The Metis earpiece is a swappable PAIR (final concept): one is worn while the other charges.
// The worn one's battery comes from the backend (/api/station headsets); the spare one in the dock is simulated
// here, charging about 1 % per minute until full.
import { useEffect, useState } from 'react'

export interface Earpiece { id: 'A' | 'B'; worn: boolean; charging: boolean; battery: number }

const START = Date.now()

export function useEarpieces(wornBattery: number | null | undefined, crewId: string): Earpiece[] {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 15000); return () => clearInterval(id) }, [])
  if (wornBattery == null) return []
  // Spare starts lower for crew with a fuller worn unit, so the pair looks like a real swap cycle.
  const seed = [...crewId].reduce((a, c) => a + c.charCodeAt(0), 0) % 20
  const spare = Math.min(100, Math.round(100 - wornBattery * .6 + seed + (now - START) / 60000))
  return [
    { id: 'A', worn: true, charging: false, battery: Math.round(wornBattery) },
    { id: 'B', worn: false, charging: spare < 100, battery: Math.max(5, spare) },
  ]
}

export const EARPIECE_TXT = {
  en: { worn: 'In use', dock: 'Charging', full: 'Charged', battery: 'Battery', connected: 'Connected' },
  es: { worn: 'Puesto', dock: 'Cargando', full: 'Cargado', battery: 'Batería', connected: 'Conectado' },
}
