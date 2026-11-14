// Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
// Ship / Ground switch: who is looking at Metis. Ship = a crew member on board; Ground = the flight surgeon on Earth
// (backend Ground view, API.md «Vista de Tierra»). Shown at the top of Simulator settings.
// The chosen view is remembered, so opening Simulator settings from Ground keeps the Ground menu.
import { useEffect, useSyncExternalStore } from 'react'
import { Orbit, Rocket } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useLang } from './i18n'

export const VIEW_TXT = {
  en: { ship: 'Ship', ground: 'Ground', label: 'View' },
  es: { ship: 'Nave', ground: 'Tierra', label: 'Vista' },
}

export const isGroundPath = (path: string) => path.startsWith('/ground')

type View = 'ship' | 'ground'
const KEY = 'metis.view'
const read = (): View => { try { return localStorage.getItem(KEY) === 'ground' ? 'ground' : 'ship' } catch { return 'ship' } }
let view: View = read()
const subs = new Set<() => void>()
function setView(v: View) {
  if (v === view) return
  view = v
  try { localStorage.setItem(KEY, v) } catch { /* private mode */ }
  subs.forEach(f => f())
}
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f) } }

/** True while the user is in the Ground view: on /ground, and on Simulator settings opened from Ground. */
export function useGroundView(): boolean {
  const { pathname } = useLocation()
  const v = useSyncExternalStore(subscribe, () => view)
  useEffect(() => {
    if (isGroundPath(pathname)) setView('ground')
    else if (pathname !== '/settings') setView('ship')
  }, [pathname])
  return isGroundPath(pathname) || (pathname === '/settings' && v === 'ground')
}

export default function ViewSwitch({ large = false }: { large?: boolean }) {
  const { lang } = useLang(); const s = VIEW_TXT[lang]
  const nav = useNavigate()
  const ground = useGroundView()
  return (
    <div className={`seg view-switch ${large ? 'large' : ''}`} role="group" aria-label={s.label}>
      <button type="button" className={!ground ? 'on' : ''} aria-pressed={!ground} onClick={() => { if (ground) { setView('ship'); nav('/today') } }}><Rocket size={14} aria-hidden />{s.ship}</button>
      <button type="button" className={ground ? 'on' : ''} aria-pressed={ground} onClick={() => { if (!ground) { setView('ground'); nav('/ground') } }}><Orbit size={14} aria-hidden />{s.ground}</button>
    </div>
  )
}
