// Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
// Procedural holographic human built from primitives with three.js (MIT). No downloaded model.
// Controlled mode (`time` prop set): renders only when props change, so a frame-by-frame capture is exact.
import { useLayoutEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import type { Level } from './ui'

export interface Hotspot { id: string; pos: [number, number, number]; level: Level; label: string; left?: boolean }

const COL: Record<Level, string> = { ok: '#3ad1ae', watch: '#f3b443', alarm: '#ff5a5f', nodata: '#7d8ba0' }

const vert = `varying vec3 vN; varying vec3 vV; varying vec3 vW;
void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz);
vW = (modelMatrix*vec4(position,1.0)).xyz; gl_Position = projectionMatrix*mv; }`
const frag = `uniform vec3 uCol; uniform float uScan; uniform float uAlpha; varying vec3 vN; varying vec3 vV; varying vec3 vW;
void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 2.0);
float scan = smoothstep(0.035, 0.0, abs(vW.y - uScan)) * 0.6;
float lines = step(0.5, fract(vW.y * 90.0)) * 0.05;
vec3 c = uCol * (0.10 + f * 1.25 + scan + lines);
gl_FragColor = vec4(c, (0.10 + f * 0.9 + scan) * uAlpha); }`

function holo(color: string, alpha = 1) {
  return new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uCol: { value: new THREE.Color(color) }, uScan: { value: 0 }, uAlpha: { value: alpha } } })
}

function buildBody(mat: THREE.Material, wire: THREE.Material) {
  const g = new THREE.Group()
  const add = (geo: THREE.BufferGeometry, x: number, y: number, z = 0, s: [number, number, number] = [1, 1, 1], rz = 0, rx = 0) => {
    for (const m of [mat, wire]) {
      const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z); mesh.scale.set(...s); mesh.rotation.z = rz; mesh.rotation.x = rx; g.add(mesh)
    }
  }
  const cap = (r: number, l: number) => new THREE.CapsuleGeometry(r, l, 8, 20)
  add(new THREE.SphereGeometry(0.105, 32, 24), 0, 1.665, 0, [0.92, 1.12, 1])          // head
  add(new THREE.CylinderGeometry(0.045, 0.052, 0.1, 20), 0, 1.53)                     // neck
  add(cap(0.165, 0.30), 0, 1.29, 0, [1.18, 1, 0.68])                                    // chest
  add(cap(0.14, 0.14), 0, 1.02, 0, [1.05, 1, 0.7])                                      // abdomen
  add(cap(0.15, 0.06), 0, 0.88, 0, [1.12, 1, 0.75])                                     // pelvis
  for (const s of [-1, 1]) {
    add(new THREE.SphereGeometry(0.062, 20, 16), s * 0.215, 1.43, 0)                   // shoulder
    add(cap(0.047, 0.24), s * 0.245, 1.27, 0, [1, 1, 1], s * 0.1)                       // upper arm
    add(cap(0.039, 0.23), s * 0.275, 1.01, 0.02, [1, 1, 1], s * 0.05, -0.08)            // forearm
    add(new THREE.SphereGeometry(0.045, 16, 12), s * 0.29, 0.83, 0.03, [0.8, 1.3, 0.5]) // hand
    add(cap(0.072, 0.34), s * 0.09, 0.62, 0, [1, 1, 1], -s * 0.02)                      // thigh
    add(cap(0.052, 0.34), s * 0.097, 0.25, -0.005)                                      // shin
    add(new THREE.BoxGeometry(0.075, 0.04, 0.2), s * 0.1, 0.03, 0.04)                   // foot
  }
  return g
}

export default function Body3D({ hotspots, selected, onSelect, time, rotation, height = '100%', scanOn = true, pulseId }: {
  hotspots: Hotspot[]; selected?: string | null; onSelect?: (id: string) => void
  /** Controlled time in ms (demo/capture). If undefined, the component animates itself. */
  time?: number; rotation?: number; height?: number | string; scanOn?: boolean; pulseId?: string
}) {
  const wrap = useRef<HTMLDivElement>(null)
  const labels = useRef<Record<string, HTMLButtonElement | null>>({})
  const api = useRef<{ render: (t: number, rot?: number) => void } | null>(null)
  const [noGL, setNoGL] = useState(false)
  const controlled = time !== undefined
  const hsRef = useRef(hotspots); hsRef.current = hotspots
  const selRef = useRef(selected); selRef.current = selected

  useLayoutEffect(() => {
    const el = wrap.current!
    let renderer: THREE.WebGLRenderer
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }) } catch { setNoGL(true); return }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    el.prepend(renderer.domElement)
    const scene = new THREE.Scene()
    const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50)
    cam.position.set(0, 1.0, 4.1); cam.lookAt(0, 0.92, 0)
    const root = new THREE.Group(); scene.add(root)
    const skin = holo('#5fe1ff', 0.9)
    const wire = new THREE.MeshBasicMaterial({ color: '#5fe1ff', wireframe: true, transparent: true, opacity: 0.035, depthWrite: false, blending: THREE.AdditiveBlending })
    root.add(buildBody(skin, wire))
    // organs
    const heartMat = holo('#ff5a5f', 1)
    const heart = new THREE.Mesh(new THREE.SphereGeometry(0.05, 24, 16), heartMat); heart.position.set(0.035, 1.3, 0.04); heart.scale.set(1, 1.15, 0.9); root.add(heart)
    const lungMat = holo('#9ee9dc', 0.55)
    for (const s of [-1, 1]) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.075, 20, 16), lungMat); l.position.set(s * 0.085, 1.33, 0); l.scale.set(0.85, 1.55, 0.8); root.add(l) }
    const brain = new THREE.Mesh(new THREE.SphereGeometry(0.075, 20, 16), holo('#c3a6ff', 0.6)); brain.position.set(0, 1.70, -0.005); brain.scale.set(1, 0.8, 1.1); root.add(brain)
    // earpiece (right ear)
    const ear = new THREE.Mesh(new THREE.CapsuleGeometry(0.014, 0.03, 6, 12), new THREE.MeshBasicMaterial({ color: '#9ee9dc' })); ear.position.set(0.1, 1.655, 0.0); root.add(ear)
    // floor rings
    const ringMat = new THREE.MeshBasicMaterial({ color: '#5fe1ff', transparent: true, opacity: 0.25, side: THREE.DoubleSide })
    for (const [r, o] of [[0.42, 0.25], [0.55, 0.12], [0.7, 0.06]] as const) { const m = ringMat.clone(); m.opacity = o; const ring = new THREE.Mesh(new THREE.RingGeometry(r, r + 0.006, 96), m); ring.rotation.x = -Math.PI / 2; scene.add(ring) }
    // hotspot markers
    const markers: Record<string, THREE.Mesh> = {}
    for (const h of hsRef.current) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.018, 16, 12), new THREE.MeshBasicMaterial({ color: COL[h.level] })); m.position.set(...h.pos); root.add(m); markers[h.id] = m }

    let rot = 0.35, drag: { x: number; r: number } | null = null, lastInteract = 0
    const resize = () => { const w = el.clientWidth, h = el.clientHeight; renderer.setSize(w, h, false); renderer.domElement.style.width = w + 'px'; renderer.domElement.style.height = h + 'px'; cam.aspect = w / h; cam.updateProjectionMatrix() }
    const v = new THREE.Vector3()
    const render = (t: number, r?: number) => {
      if (r !== undefined) rot = r
      root.rotation.y = rot
      const scanY = 0.1 + ((t / 3200) % 1) * 1.75
      for (const m of [skin, heartMat, lungMat]) m.uniforms.uScan.value = scanOn ? scanY : -5
      const beat = 1 + 0.12 * Math.pow(Math.max(0, Math.sin((t / 1000) * Math.PI * 2 * 1.1)), 8)
      heart.scale.set(beat, 1.15 * beat, 0.9 * beat)
      for (const h of hsRef.current) {
        const mk = markers[h.id]; if (!mk) continue
        const pul = h.id === pulseId || h.id === selRef.current ? 1 + 0.5 * (0.5 + 0.5 * Math.sin(t / 180)) : 1
        mk.scale.setScalar(pul); (mk.material as THREE.MeshBasicMaterial).color.set(COL[h.level])
        mk.getWorldPosition(v); const facing = v.z > -0.02
        v.project(cam)
        const lab = labels.current[h.id]
        if (lab) { const px = (v.x + 1) / 2 * el.clientWidth; const flip = h.left || px + 14 + lab.offsetWidth > el.clientWidth - 6; lab.style.transform = flip ? 'translate(calc(-100% - 14px),-50%)' : 'translate(14px,-50%)'; lab.style.left = px + 'px'; lab.style.top = ((1 - v.y) / 2 * el.clientHeight) + 'px'; lab.style.opacity = facing ? '1' : '0.28' }
      }
      renderer.render(scene, cam)
    }
    api.current = { render }
    resize()
    const ro = new ResizeObserver(() => { resize(); if (controlled) render(time ?? 0, rotation) }); ro.observe(el)
    let raf = 0
    if (!controlled) {
      const t0 = performance.now()
      const loop = () => { const t = performance.now() - t0; if (!drag && t - lastInteract > 2500) rot += 0.0035; render(t); raf = requestAnimationFrame(loop) }
      raf = requestAnimationFrame(loop)
    } else render(time ?? 0, rotation)
    const cv = renderer.domElement
    const down = (e: PointerEvent) => { drag = { x: e.clientX, r: rot }; cv.setPointerCapture(e.pointerId) }
    const move = (e: PointerEvent) => { if (drag) { rot = drag.r + (e.clientX - drag.x) * 0.01; lastInteract = performance.now() } }
    const up = () => { drag = null; lastInteract = performance.now() }
    if (!controlled) { cv.addEventListener('pointerdown', down); cv.addEventListener('pointermove', move); cv.addEventListener('pointerup', up) }
    return () => { cancelAnimationFrame(raf); ro.disconnect(); renderer.dispose(); cv.remove(); api.current = null }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => { if (controlled) api.current?.render(time ?? 0, rotation) }, [time, rotation, controlled, hotspots, selected])

  if (noGL) return <Body2D hotspots={hotspots} selected={selected} onSelect={onSelect} />
  return (
    <div ref={wrap} style={{ position: 'relative', width: '100%', height, overflow: 'hidden' }}>
      {hotspots.map(h => (
        <button key={h.id} ref={el => { labels.current[h.id] = el }} onClick={() => onSelect?.(h.id)} aria-label={h.label}
          style={{ position: 'absolute', transform: h.left ? 'translate(calc(-100% - 14px),-50%)' : 'translate(14px,-50%)', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, padding: '3px 9px', borderRadius: 999,
            background: selected === h.id ? 'rgba(95,225,255,.18)' : 'rgba(5,9,15,.72)', border: `1px solid ${selected === h.id ? '#5fe1ff' : 'rgba(95,225,255,.25)'}`, color: '#dff7ff', whiteSpace: 'nowrap', pointerEvents: onSelect ? 'auto' : 'none' }}>
          <span style={{ width: 7, height: 7, borderRadius: 9, background: COL[h.level] }} />{h.label}
        </button>
      ))}
    </div>
  )
}

/** 2D fallback when WebGL is not available. */
export function Body2D({ hotspots, selected, onSelect }: { hotspots: Hotspot[]; selected?: string | null; onSelect?: (id: string) => void }) {
  const X = (x: number) => 200 + x * 330, Y = (y: number) => 600 - y * 320
  return (
    <svg viewBox="0 0 400 620" style={{ width: '100%', height: '100%' }} role="img">
      <g fill="rgba(95,225,255,.07)" stroke="#5fe1ff" strokeOpacity=".6" strokeWidth="1.4">
        <ellipse cx={X(0)} cy={Y(1.665)} rx="32" ry="38" /><rect x={X(-0.2)} y={Y(1.47)} width="132" height="175" rx="50" />
        <rect x={X(-0.16)} y={Y(0.98)} width="106" height="60" rx="28" />
        {[-1, 1].map(s => <g key={s}><rect x={X(s * 0.25) - 14} y={Y(1.42)} width="28" height="190" rx="14" /><rect x={X(s * 0.095) - 21} y={Y(0.84)} width="42" height="260" rx="20" /></g>)}
      </g>
      {hotspots.map(h => (
        <g key={h.id} onClick={() => onSelect?.(h.id)} style={{ cursor: 'pointer' }}>
          <circle cx={X(h.pos[0])} cy={Y(h.pos[1])} r={selected === h.id ? 9 : 6} fill={COL[h.level]} />
          <text x={X(h.pos[0]) + 12} y={Y(h.pos[1]) + 4} fill="#dff7ff" fontSize="12">{h.label}</text>
        </g>
      ))}
    </svg>
  )
}
