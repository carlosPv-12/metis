import { useEffect, useState } from 'react'
import type { StationCrew } from '../api'

export const REASONS = {
  emergency: { en: 'Medical emergency in progress', es: 'Urgencia médica en curso' },
  unresponsive: { en: 'Crewmember unresponsive', es: 'El tripulante no responde' },
  unavailable: { en: 'CMO unavailable', es: 'Oficial médico no disponible' },
}
export type Reason = keyof typeof REASONS
/** Only a serious emergency opens private data. */
export const SEVERE: Reason[] = ['emergency', 'unresponsive']
/** Who may open private data: the commander and the crew medical officer. */
export const AUTHORIZED = ['kenji', 'noor']
export const COMMANDER_ID = 'kenji'

export interface AccessRequest { id: string; fromId: string; fromName: string; crewId: string; whom: string; reason: Reason; when: number; status: 'pending' | 'approved' | 'declined' }
const REQ_KEY = 'metis.accessrequests'
function readRequests(): AccessRequest[] {
  try { const v: unknown = JSON.parse(localStorage.getItem(REQ_KEY) ?? '[]'); return Array.isArray(v) ? v.filter((r): r is AccessRequest => !!r && typeof r.id === 'string' && typeof r.crewId === 'string') : [] } catch { return [] }
}
/** Requests sent to the commander by crewmembers who are not allowed to open private data themselves. */
export function useAccessRequests() {
  const [requests, setRequests] = useState(readRequests)
  function save(next: AccessRequest[]) { setRequests(next); try { localStorage.setItem(REQ_KEY, JSON.stringify(next)) } catch { /* in-memory only */ } }
  useEffect(() => {
    const sync = (e: StorageEvent) => { if (e.key === REQ_KEY) setRequests(readRequests()) }
    window.addEventListener('storage', sync); return () => window.removeEventListener('storage', sync)
  }, [])
  return { requests,
    send: (from: StationCrew, whom: StationCrew, reason: Reason) => save([{ id: crypto.randomUUID(), fromId: from.id, fromName: from.name, crewId: whom.id, whom: whom.name, reason, when: Date.now(), status: 'pending' }, ...requests]),
    resolve: (id: string, status: 'approved' | 'declined') => save(requests.map(r => r.id === id ? { ...r, status } : r)),
  }
}
export type Requests = ReturnType<typeof useAccessRequests>
export interface AccessEntry { id: string; who: string; actorId: string; whom: string; crewId: string; when: number; reason: Reason; dismissed: boolean; closed?: boolean }
const KEY = 'metis.accesslog'
export const DURATION = 15 * 60 * 1000
function readLog(): AccessEntry[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    if (!Array.isArray(value)) return []
    return value.filter((e): e is AccessEntry => !!e && typeof e.id === 'string' && typeof e.who === 'string' && typeof e.actorId === 'string' && typeof e.whom === 'string' && typeof e.crewId === 'string' && typeof e.when === 'number' && Number.isFinite(e.when) && Object.hasOwn(REASONS, e.reason))
  } catch { return [] }
}
export function findActiveAccess(entries: AccessEntry[], id: string, actorId: string, now: number) {
  return entries.find(e => e.crewId === id && e.actorId === actorId && !e.closed && e.when <= now && e.when + DURATION > now)
}
export function useEmergencyAccess(now: number) {
  const [entries, setEntries] = useState(readLog)
  function save(next: AccessEntry[]) {
    setEntries(next)
    try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* Keep this session usable when storage is unavailable. */ }
  }
  useEffect(() => {
    const sync = (e: StorageEvent) => { if (e.key === KEY) setEntries(readLog()) }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])
  const active = (id: string, actorId: string) => findActiveAccess(entries, id, actorId, now)
  return { entries, active,
    grant: (who: StationCrew, whom: StationCrew, reason: Reason) => save([{ id: crypto.randomUUID(), who: who.name, actorId: who.id, whom: whom.name, crewId: whom.id, when: Date.now(), reason, dismissed: false }, ...entries]),
    dismiss: (id: string) => save(entries.map(e => e.id === id ? { ...e, dismissed: true } : e)),
    close: (id: string) => save(entries.map(e => e.id === id ? { ...e, closed: true } : e)),
  }
}
export type Access = ReturnType<typeof useEmergencyAccess>
