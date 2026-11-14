import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { Hotspot } from './Body3D'
import { useLang } from './i18n'
import { Shape } from './ui'
import maleImage from './assets/metis-body-male.webp'
import femaleImage from './assets/metis-body-female.webp'

type Point = { x: number; y: number; left?: boolean }
// Percentages refer to the complete 900 × 1200 image, before any camera transform.
const POINTS: Record<'female' | 'male', Record<string, Point>> = {
  male: {
    heart: { x: 62, y: 56 }, lungs: { x: 35, y: 52, left: true },
    brain: { x: 50, y: 6 }, eyes: { x: 47, y: 13, left: true },
    ear: { x: 64, y: 17 }, bones: { x: 31, y: 39, left: true },
    muscle: { x: 85, y: 47, left: true },
  },
  female: {
    heart: { x: 63, y: 57 }, lungs: { x: 35, y: 53, left: true },
    brain: { x: 50, y: 6 }, eyes: { x: 45, y: 13, left: true },
    ear: { x: 64, y: 17 }, bones: { x: 33, y: 39, left: true },
    muscle: { x: 84, y: 48, left: true },
  },
}
const COPY = {
  en: { zoomIn: 'Zoom in', zoomOut: 'Zoom out', reset: 'Reset zoom and position', controls: 'Figure zoom', figure: 'Interactive body map' },
  es: { zoomIn: 'Acercar', zoomOut: 'Alejar', reset: 'Restablecer zoom y posición', controls: 'Zoom de la figura', figure: 'Mapa corporal interactivo' },
}
type Camera = { zoom: number; x: number; y: number }
const clamp = (n: number, low: number, high: number) => Math.min(high, Math.max(low, n))

export default function BodyFigure({ hotspots, selected, onSelect, sex = 'female' }: {
  hotspots: Hotspot[]; selected?: string | null; onSelect?: (id: string) => void; sex?: 'female' | 'male'
}) {
  const { lang } = useLang()
  const copy = COPY[lang]
  const viewport = useRef<HTMLDivElement>(null)
  const [camera, setCamera] = useState<Camera>({ zoom: 1, x: 0, y: 0 })
  const current = useRef(camera)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const moved = useRef(false)
  const travel = useRef(0)
  const update = (next: Camera) => {
    const el = viewport.current
    const zoom = clamp(next.zoom, .8, 2.5)
    const limitX = (el?.clientWidth ?? 0) * Math.max(0, zoom - 1) / 2
    const limitY = (el?.clientHeight ?? 0) * Math.max(0, zoom - 1) / 2
    current.current = { zoom, x: clamp(next.x, -limitX, limitX), y: clamp(next.y, -limitY, limitY) }
    setCamera(current.current)
  }
  const zoomAt = (factor: number, clientX?: number, clientY?: number) => {
    const c = current.current
    const box = viewport.current?.getBoundingClientRect()
    const x = box && clientX != null ? clientX - box.left - box.width / 2 : 0
    const y = box && clientY != null ? clientY - box.top - box.height / 2 : 0
    const zoom = clamp(c.zoom * factor, .8, 2.5)
    const ratio = zoom / c.zoom
    update({ zoom, x: x - (x - c.x) * ratio, y: y - (y - c.y) * ratio })
  }
  useEffect(() => {
    const el = viewport.current
    if (!el) return
    const wheel = (e: WheelEvent) => {
      e.preventDefault()
      zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? .01 : .002)), e.clientX, e.clientY)
    }
    el.addEventListener('wheel', wheel, { passive: false })
    return () => el.removeEventListener('wheel', wheel)
  }, [])
  return (
    <>
      <div ref={viewport} className={`body-figure${camera.zoom > 1 ? ' pannable' : ''}`} aria-label={copy.figure}
        onPointerDown={e => {
          if (e.button !== 0) return
          pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
          moved.current = false
          travel.current = 0
          const target = e.target instanceof Element ? e.target.closest('button') : null
          const captureTarget = target ?? e.currentTarget
          captureTarget.setPointerCapture(e.pointerId)
        }}
        onPointerMove={e => {
          const old = pointers.current.get(e.pointerId)
          if (!old) return
          const before = [...pointers.current.values()]
          pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
          const after = [...pointers.current.values()]
          const dx = e.clientX - old.x, dy = e.clientY - old.y
          travel.current += Math.abs(dx) + Math.abs(dy)
          if (travel.current > 5) moved.current = true
          if (before.length === 2) {
            const distance = (p: typeof before) => Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y)
            zoomAt(distance(after) / Math.max(1, distance(before)), (after[0].x + after[1].x) / 2, (after[0].y + after[1].y) / 2)
          } else if (current.current.zoom > 1) update({ ...current.current, x: current.current.x + dx, y: current.current.y + dy })
        }}
        onPointerUp={e => pointers.current.delete(e.pointerId)}
        onPointerCancel={e => pointers.current.delete(e.pointerId)}
        onLostPointerCapture={e => pointers.current.delete(e.pointerId)}>
        <div className="body-figure-stage" style={{ transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`, '--figure-zoom': camera.zoom } as CSSProperties}>
          <img src={sex === 'female' ? femaleImage : maleImage} alt="" width={900} height={1200} draggable={false} />
          {hotspots.map(h => {
            const point = POINTS[sex][h.id]
            if (!point) return null
            return <button key={h.id} type="button" aria-label={h.label} aria-pressed={selected === h.id} aria-haspopup="dialog"
              className={`figure-hotspot${selected === h.id ? ' selected' : ''}${point.left ? ' label-left' : ''}`}
              style={{ left: `${point.x}%`, top: `${point.y}%` }}
              onClick={e => {
                if (!moved.current || e.detail === 0) {
                  e.currentTarget.focus({ preventScroll: true })
                  onSelect?.(h.id)
                }
              }}>
              <span className="figure-marker" aria-hidden="true">+</span>
              <span className="figure-label"><span className={`s-${h.level}`}><Shape level={h.level} /></span>{h.label}</span>
            </button>
          })}
        </div>
      </div>
      <div className="figure-zoom" role="group" aria-label={copy.controls}>
        <button type="button" aria-label={copy.zoomOut} title={copy.zoomOut} disabled={camera.zoom <= .8} onClick={() => zoomAt(1 / 1.2)}>−</button>
        <button type="button" aria-label={copy.reset} title={copy.reset} onClick={() => update({ zoom: 1, x: 0, y: 0 })}>↺</button>
        <button type="button" aria-label={copy.zoomIn} title={copy.zoomIn} disabled={camera.zoom >= 2.5} onClick={() => zoomAt(1.2)}>+</button>
      </div>
    </>
  )
}
