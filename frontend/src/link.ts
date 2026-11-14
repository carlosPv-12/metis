// Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
// Mission environment & Earth-link profiles (challenge 04: "adapt it to different environments").
// Chosen in Settings and sent to the backend (PUT /api/mission), which uses the same profiles (backend/mission.py)
// for packets to Earth, the queue when there is no link and what Metis says. Delays are approximate one-way light/relay
// times for illustration, not mission specifications.
import { useSettings, type EnvId } from './settings'

export type LinkMode = 'realtime' | 'delayed' | 'none'

export interface EnvProfile {
  id: EnvId
  label: { en: string; es: string }
  short: { en: string; es: string }
  /** One-way delay to Earth in seconds, or null when there is no link. */
  oneWayS: number | null
  mode: LinkMode
  /** What the link means for the crew (shown next to the delay). */
  note: { en: string; es: string }
}

export const ENV_PROFILES: Record<EnvId, EnvProfile> = {
  iss: {
    id: 'iss', oneWayS: 0.6, mode: 'realtime',
    label: { en: 'ISS', es: 'ISS' }, short: { en: 'ISS', es: 'ISS' },
    note: { en: 'Near-continuous link: the flight surgeon can join almost live.', es: 'Enlace casi continuo: el cirujano de vuelo puede entrar casi en directo.' },
  },
  eva: {
    id: 'eva', oneWayS: 0.6, mode: 'realtime',
    label: { en: 'Spacewalk (EVA)', es: 'Paseo espacial (EVA)' }, short: { en: 'EVA', es: 'EVA' },
    note: { en: 'Crewmember outside: alerts go first to the crew inside and to ground.', es: 'Tripulante fuera: los avisos van primero a la tripulación de dentro y a Tierra.' },
  },
  moon: {
    id: 'moon', oneWayS: 1.3, mode: 'realtime',
    label: { en: 'Moon', es: 'Luna' }, short: { en: 'Moon', es: 'Luna' },
    note: { en: 'About 1.3 s each way: conversation is possible but with pauses.', es: 'Unos 1,3 s de ida: se puede hablar, pero con pausas.' },
  },
  mars: {
    id: 'mars', oneWayS: 300, mode: 'delayed',
    label: { en: 'Mars', es: 'Marte' }, short: { en: 'Mars', es: 'Marte' },
    note: { en: 'Minutes each way: Metis guides the crew; ground gets a store-and-forward packet.', es: 'Minutos de ida: Metis guía a la tripulación; Tierra recibe un paquete que se guarda y reenvía.' },
  },
  blackout: {
    id: 'blackout', oneWayS: null, mode: 'none',
    label: { en: 'No link', es: 'Sin enlace' }, short: { en: 'No link', es: 'Sin enlace' },
    note: { en: 'No contact with Earth: packets wait in the queue; the crew relies on Metis and the CMO.', es: 'Sin contacto con Tierra: los paquetes esperan en cola; la tripulación cuenta con Metis y el oficial médico.' },
  },
}

export interface Link extends EnvProfile { /** Effective one-way delay (Mars uses the slider in Settings). */ delayS: number | null }

/** The active environment/link profile. Use this instead of `station.comms.one_way_delay_s` in the screens. */
export function useLink(): Link {
  const s = useSettings()
  const p = ENV_PROFILES[s.env]
  return { ...p, delayS: p.id === 'mars' ? s.marsDelayMin * 60 : p.oneWayS }
}

/** "0.6 s", "1.3 s", "5:00 min", "—" */
export function fmtLinkDelay(delayS: number | null, lang: 'en' | 'es'): string {
  if (delayS == null) return '—'
  if (delayS < 60) return `${delayS.toLocaleString(lang === 'es' ? 'es-ES' : 'en-US', { maximumFractionDigits: 1 })} s`
  const m = Math.floor(delayS / 60), s = Math.round(delayS % 60)
  return `${m}:${String(s).padStart(2, '0')} min`
}
