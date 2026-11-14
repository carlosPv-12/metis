import { useEffect, useSyncExternalStore } from 'react'
import type { Link } from '../link'

interface ReportPacket { crewId: string; at: number; start: number | null; profile: string; delayS: number | null }
const KEY = 'metis.reportqueue'
function read(): ReportPacket[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(raw) ? raw.filter((p): p is ReportPacket => p && typeof p.crewId === 'string' && Number.isFinite(p.at) && (p.start === null || Number.isFinite(p.start)) && typeof p.profile === 'string' && (p.delayS === null || Number.isFinite(p.delayS))) : []
  } catch { return [] }
}
let packets = read()
const listeners = new Set<() => void>()
function save(next: ReportPacket[]) {
  packets = next
  try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* In-memory fallback. */ }
  listeners.forEach(l => l())
}
function subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } }
export function queueReport(crewId: string, link: Link) {
  const at = Date.now()
  save([{ crewId, at, start: link.mode === 'none' ? null : at, profile: link.id, delayS: link.delayS }, ...packets.filter(p => p.crewId !== crewId)])
}
export function useReportQueue(link: Link) {
  const current = useSyncExternalStore(subscribe, () => packets, () => packets)
  useEffect(() => {
    const now = Date.now()
    let changed = false
    const next = packets.map(p => {
      const delivered = p.start !== null && p.delayS !== null && now >= p.start + p.delayS * 1000
      if (delivered || (p.profile === link.id && p.delayS === link.delayS)) return p
      changed = true
      return { ...p, profile: link.id, delayS: link.delayS, start: link.mode === 'none' ? null : now }
    })
    if (changed) save(next)
  }, [link.id, link.delayS, link.mode])
  return current
}
