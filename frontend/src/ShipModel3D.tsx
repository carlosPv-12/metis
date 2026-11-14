// Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
// 3D view of the Mars transit vehicle for the Ground "Global" section: a deep-space habitat built from procedural
// three.js geometry (no external model). Modules: lab, central node, crew quarters and galley, plus a docked capsule
// with its service module, a truss with radiators and two large solar array wings, and a high-gain antenna.
// Modules with a watch/alarm status glow orange/red and pulse; the selected one is outlined in Neon Blue.
// Labels and crew dots are an HTML overlay projected from 3D anchors every frame (like the body hotspots).
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import './ship3d.css'

export type ShipStatus = 'ok' | 'watch' | 'alarm'
export interface ShipModule { id: string; label: string; status: ShipStatus; detail?: string }
export interface ShipCrew { id: string; name: string; module: string; status: ShipStatus }
export interface ShipModel3DProps { modules: ShipModule[]; crew: ShipCrew[]; selected?: string | null; onSelect?: (id: string) => void }

/** Maps a free-text location ("Crew quarters", "Lab", "Galley", "Node", "Camarotes"…) to a module id. */
export function moduleIdOf(location: string | undefined | null): string {
  const s = (location ?? '').toLowerCase()
  if (/quarter|bunk|camarot|litera/.test(s)) return 'quarters'
  if (/galley|cocina|kitchen/.test(s)) return 'galley'
  if (/lab/.test(s)) return 'lab'
  if (/node|nodo/.test(s)) return 'node'
  return s
}

type Axis = 'x' | 'z'
interface Spec { pos: [number, number, number]; axis: Axis; r: number; len: number }
// Physical layout (ship axis along X). Node in the middle, lab and capsule toward -X, quarters and truss toward +X,
// galley on the node's radial port (+Z).
const SPEC: Record<string, Spec> = {
  lab: { pos: [-3.2, 0, 0], axis: 'x', r: 1.2, len: 4 },
  node: { pos: [0, 0, 0], axis: 'x', r: 1.05, len: 1.9 },
  quarters: { pos: [3.45, 0, 0], axis: 'x', r: 1.4, len: 4.4 },
  galley: { pos: [0, 0, 2.6], axis: 'z', r: .95, len: 3 },
}
const STATUS_HEX: Record<ShipStatus, number> = { ok: 0x0960e1, watch: 0xd9481c, alarm: 0xc42f00 }
const NEON = new THREE.Color(0x0960e1)
const CENTER_X = 1.4 // visual centre of the whole vehicle, so it rotates around its middle

function dispose(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>()
  root.traverse(o => {
    const m = o as THREE.Mesh
    if (m.geometry) geometries.add(m.geometry)
    const mat = m.material as THREE.Material | THREE.Material[] | undefined
    if (Array.isArray(mat)) mat.forEach(x => materials.add(x)); else if (mat) materials.add(mat)
  })
  geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose())
}

/** Quilted multi-layer insulation look: off-white blanket with seams, stitching and faint wrinkles. */
function mliTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 512
  const x = c.getContext('2d')!
  x.fillStyle = '#eef1f5'; x.fillRect(0, 0, 512, 512)
  for (let i = 0; i < 2600; i++) { x.fillStyle = `rgba(${Math.random() < .5 ? '90,104,130' : '255,255,255'},${Math.random() * .05})`; x.fillRect(Math.random() * 512, Math.random() * 512, 2 + Math.random() * 6, 1 + Math.random() * 2) }
  x.strokeStyle = 'rgba(70,86,115,.16)'; x.lineWidth = 2
  for (let y = 0; y <= 512; y += 128) { x.beginPath(); x.moveTo(0, y); x.lineTo(512, y); x.stroke() }
  for (let v = 0; v <= 512; v += 170) { x.beginPath(); x.moveTo(v, 0); x.lineTo(v, 512); x.stroke() }
  x.fillStyle = 'rgba(70,86,115,.18)'
  for (let y = 32; y < 512; y += 64) for (let v = 32; v < 512; v += 64) x.fillRect(v, y, 3, 3)
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4
  return t
}

/** Solar blanket: deep-blue cells in a grid with thin silver bus lines. */
function cellTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 1024
  const x = c.getContext('2d')!
  x.fillStyle = '#c9d2df'; x.fillRect(0, 0, 256, 1024)
  const cols = 8, rows = 40, gw = 256 / cols, gh = 1024 / rows
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const g = x.createLinearGradient(i * gw, j * gh, (i + 1) * gw, (j + 1) * gh)
    g.addColorStop(0, '#0b2a6b'); g.addColorStop(1, '#07173f')
    x.fillStyle = g; x.fillRect(i * gw + 1.5, j * gh + 1.5, gw - 3, gh - 3)
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4
  return t
}

/** Radiator panel: white with fine fluid-loop lines. */
function radiatorTexture() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 512
  const x = c.getContext('2d')!
  x.fillStyle = '#f4f6f9'; x.fillRect(0, 0, 128, 512)
  x.strokeStyle = 'rgba(80,96,125,.22)'; x.lineWidth = 1.5
  for (let v = 8; v < 128; v += 12) { x.beginPath(); x.moveTo(v, 0); x.lineTo(v, 512); x.stroke() }
  x.strokeStyle = 'rgba(80,96,125,.35)'; for (let y = 0; y <= 512; y += 128) { x.beginPath(); x.moveTo(0, y); x.lineTo(128, y); x.stroke() }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace
  return t
}

function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128
  const x = c.getContext('2d')!
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64)
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.4, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)')
  x.fillStyle = g; x.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(c)
}

/** Orients a Y-aligned primitive along the given axis. */
function along(o: THREE.Object3D, axis: Axis | 'y') { if (axis === 'x') o.rotation.z = Math.PI / 2; else if (axis === 'z') o.rotation.x = Math.PI / 2; return o }

function rod(a: THREE.Vector3, b: THREE.Vector3, r: number, mat: THREE.Material) {
  const d = new THREE.Vector3().subVectors(b, a), m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), 6), mat)
  m.position.copy(a).addScaledVector(d, .5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())
  return m
}

interface ModuleParts { hull: THREE.Mesh; mat: THREE.MeshStandardMaterial; outline: THREE.Mesh; glow: THREE.Sprite; anchor: THREE.Vector3; spec: Spec }

function buildShip(mli: THREE.Texture, cells: THREE.Texture, rad: THREE.Texture, glow: THREE.Texture) {
  const ship = new THREE.Group(); ship.position.x = -CENTER_X
  const hullBase = new THREE.MeshStandardMaterial({ color: 0xffffff, map: mli, metalness: .18, roughness: .62 })
  const metal = new THREE.MeshStandardMaterial({ color: 0xc3cad6, metalness: .75, roughness: .32 })
  const rib = new THREE.MeshStandardMaterial({ color: 0xd8dee7, metalness: .55, roughness: .4 })
  const accent = new THREE.MeshStandardMaterial({ color: 0x0960e1, metalness: .3, roughness: .45 })
  const dark = new THREE.MeshStandardMaterial({ color: 0x1b2333, metalness: .5, roughness: .5 })
  const solar = new THREE.MeshStandardMaterial({ map: cells, metalness: .55, roughness: .3, side: THREE.DoubleSide })
  const radMat = new THREE.MeshStandardMaterial({ map: rad, metalness: .1, roughness: .7, side: THREE.DoubleSide })
  const gold = new THREE.MeshStandardMaterial({ color: 0xc9a14a, metalness: .85, roughness: .35 })
  const modules: Record<string, ModuleParts> = {}

  // Pressurised modules: MLI hull, flattened end domes, structural ribs, blue accent rings and outline shell.
  for (const [id, spec] of Object.entries(SPEC)) {
    const mat = hullBase.clone(); mat.map = mli.clone(); mat.map.repeat.set(3, Math.max(1, spec.len / 1.6)); mat.map.needsUpdate = true
    const g = new THREE.Group(); g.position.set(...spec.pos)
    const hull = along(new THREE.Mesh(new THREE.CylinderGeometry(spec.r, spec.r, spec.len, 48, 1, true), mat), spec.axis) as THREE.Mesh
    hull.userData.moduleId = id; g.add(hull)
    for (const s of [-1, 1]) {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(spec.r, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2), mat)
      cap.scale.y = .32; cap.userData.moduleId = id
      const holder = new THREE.Group(); holder.add(cap)
      if (spec.axis === 'x') { holder.rotation.z = -s * Math.PI / 2; holder.position.x = s * spec.len / 2 } else { holder.rotation.x = s * Math.PI / 2; holder.position.z = s * spec.len / 2 }
      g.add(holder)
    }
    const n = Math.max(2, Math.round(spec.len / .75))
    for (let i = 0; i <= n; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(spec.r * 1.008, .028, 6, 56), i === 0 || i === n ? accent : rib)
      const t = -spec.len / 2 + (spec.len * i) / n
      if (spec.axis === 'x') { ring.rotation.y = Math.PI / 2; ring.position.x = t } else ring.position.z = t
      g.add(ring)
    }
    // Handrails along the top, like real EVA handholds.
    for (const a of [-.35, .35]) {
      const p0 = new THREE.Vector3(), p1 = new THREE.Vector3(), rr = spec.r + .07
      if (spec.axis === 'x') { p0.set(-spec.len / 2 + .2, Math.cos(a) * rr, Math.sin(a) * rr); p1.set(spec.len / 2 - .2, Math.cos(a) * rr, Math.sin(a) * rr) } else { p0.set(Math.sin(a) * rr, Math.cos(a) * rr, -spec.len / 2 + .2); p1.set(Math.sin(a) * rr, Math.cos(a) * rr, spec.len / 2 - .2) }
      g.add(rod(p0, p1, .018, gold))
    }
    const outline = along(new THREE.Mesh(new THREE.CylinderGeometry(spec.r * 1.07, spec.r * 1.07, spec.len * 1.1, 48), new THREE.MeshBasicMaterial({ color: NEON, transparent: true, opacity: .32, side: THREE.BackSide, depthWrite: false })), spec.axis) as THREE.Mesh
    outline.visible = false; g.add(outline)
    const glowSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: STATUS_HEX.watch, transparent: true, opacity: 0, depthWrite: false, depthTest: false }))
    glowSprite.scale.setScalar(spec.r * 3.4); g.add(glowSprite)
    ship.add(g)
    modules[id] = { hull, mat, outline, glow: glowSprite, spec, anchor: new THREE.Vector3(spec.pos[0], spec.pos[1] + spec.r + .45, spec.pos[2]) }
  }

  // Connectors between node, lab and quarters.
  for (const [a, b] of [[-1.25, -.9], [.9, 1.3]]) ship.add(rod(new THREE.Vector3(a, 0, 0), new THREE.Vector3(b, 0, 0), .72, metal))
  ship.add(rod(new THREE.Vector3(0, 0, .95), new THREE.Vector3(0, 0, 1.2), .66, metal))
  // Spare radial ports on the node.
  for (const [y, z] of [[1, 0], [-1, 0], [0, -1]]) {
    const p = rod(new THREE.Vector3(0, y * .95, z * .95), new THREE.Vector3(0, y * 1.35, z * 1.35), .5, metal); ship.add(p)
    const hatch = new THREE.Mesh(new THREE.CylinderGeometry(.42, .42, .04, 32), accent); hatch.position.set(0, y * 1.37, z * 1.37)
    if (z) hatch.rotation.x = Math.PI / 2; ship.add(hatch)
  }
  // Windows on the quarters and lab.
  for (const x of [2.2, 3.4, 4.6, -2.4, -4]) {
    const r = x > 0 ? SPEC.quarters.r : SPEC.lab.r
    const w = new THREE.Mesh(new THREE.CylinderGeometry(.13, .13, .05, 20), dark); w.position.set(x, r * Math.cos(.9), r * Math.sin(.9)); w.rotation.x = .9; ship.add(w)
  }

  // Docked capsule: docking adapter, crew module cone with heat shield, service module with four small wings.
  ship.add(rod(new THREE.Vector3(-5.55, 0, 0), new THREE.Vector3(-6.05, 0, 0), .52, metal))
  const capsule = along(new THREE.Mesh(new THREE.CylinderGeometry(.55, 1.12, 1.35, 40), new THREE.MeshStandardMaterial({ color: 0xe9ecf1, metalness: .45, roughness: .35 })), 'x'); capsule.position.x = -6.72; ship.add(capsule)
  const shield = along(new THREE.Mesh(new THREE.CylinderGeometry(1.14, 1.14, .1, 40), dark), 'x'); shield.position.x = -7.44; ship.add(shield)
  const service = along(new THREE.Mesh(new THREE.CylinderGeometry(1.02, 1.02, 1.7, 40), new THREE.MeshStandardMaterial({ color: 0xf2f4f7, map: mli, metalness: .2, roughness: .6 })), 'x'); service.position.x = -8.35; ship.add(service)
  const nozzle = along(new THREE.Mesh(new THREE.CylinderGeometry(.5, .25, .7, 24, 1, true), new THREE.MeshStandardMaterial({ color: 0x8a919c, metalness: .9, roughness: .3, side: THREE.DoubleSide })), 'x'); nozzle.position.x = -9.5; ship.add(nozzle)
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2, wing = new THREE.Group(); wing.position.x = -8.35; wing.rotation.x = a
    const p = new THREE.Mesh(new THREE.PlaneGeometry(.9, 2.7), solar); p.position.set(0, 0, 2.45); p.rotation.x = Math.PI / 2; wing.add(p)
    wing.add(rod(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, 1.1), .05, metal)); ship.add(wing)
  }

  // Truss from the quarters' far end, with longerons and diagonal struts.
  const t0 = 5.85, t1 = 11.8, h = .38
  ship.add(rod(new THREE.Vector3(5.6, 0, 0), new THREE.Vector3(t0 + .1, 0, 0), .5, metal))
  const corners = [[h, h], [h, -h], [-h, -h], [-h, h]]
  for (const [y, z] of corners) ship.add(rod(new THREE.Vector3(t0, y, z), new THREE.Vector3(t1, y, z), .035, metal))
  for (let x = t0; x < t1 - .01; x += .85) {
    for (let i = 0; i < 4; i++) {
      const [y0, z0] = corners[i], [y1, z1] = corners[(i + 1) % 4]
      ship.add(rod(new THREE.Vector3(x, y0, z0), new THREE.Vector3(x, y1, z1), .022, metal))
      ship.add(rod(new THREE.Vector3(x, y0, z0), new THREE.Vector3(Math.min(t1, x + .85), y1, z1), .016, metal))
    }
  }
  // Radiators: two white panels each side, edge-on, along ±Y.
  for (const s of [-1, 1]) for (const dx of [0, 1.35]) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(1.2, 3.4, .04), radMat); r.position.set(7.1 + dx, s * (h + 1.9), 0); ship.add(r)
    ship.add(rod(new THREE.Vector3(7.1 + dx, s * h, 0), new THREE.Vector3(7.1 + dx, s * (h + .2), 0), .04, metal))
  }
  // Two large solar array wings at the end of the truss, each with two blankets on a central mast.
  for (const s of [-1, 1]) {
    const wing = new THREE.Group(); wing.position.set(10.8, 0, 0); wing.rotation.x = .18 * s
    wing.add(rod(new THREE.Vector3(0, 0, s * .45), new THREE.Vector3(0, 0, s * 10), .045, metal))
    for (const dx of [-.78, .78]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 9), solar); p.rotation.x = -Math.PI / 2; p.position.set(dx, 0, s * 5.25); wing.add(p)
      const edge = new THREE.Mesh(new THREE.BoxGeometry(1.44, .05, .08), metal); edge.position.set(dx, 0, s * 9.75); wing.add(edge)
    }
    const gimbal = new THREE.Mesh(new THREE.CylinderGeometry(.22, .22, .5, 20), metal); gimbal.rotation.x = Math.PI / 2; gimbal.position.z = s * .55; wing.add(gimbal)
    ship.add(wing)
  }
  // High-gain antenna on a mast above the lab.
  const mastTop = new THREE.Vector3(-3.6, SPEC.lab.r + 1.7, -.4)
  ship.add(rod(new THREE.Vector3(-3.6, SPEC.lab.r, -.2), mastTop, .04, metal))
  const dish = new THREE.Mesh(new THREE.SphereGeometry(.85, 36, 10, 0, Math.PI * 2, 0, .62), new THREE.MeshStandardMaterial({ color: 0xf5f7fa, metalness: .3, roughness: .45, side: THREE.DoubleSide }))
  dish.position.copy(mastTop).add(new THREE.Vector3(0, .62, 0)); dish.rotation.set(Math.PI + .5, 0, .6); ship.add(dish)
  ship.add(rod(dish.position.clone(), dish.position.clone().add(new THREE.Vector3(.18, -.55, -.32)), .02, metal))
  return { ship, modules }
}

export default function ShipModel3D({ modules, crew, selected = null, onSelect }: ShipModel3DProps) {
  const host = useRef<HTMLDivElement>(null)
  const latest = useRef({ modules, crew, selected, onSelect })
  // Redraw on demand (see the render loop): new data -> one frame, and the labels are measured again.
  const wake = useRef<(remeasure?: boolean) => void>(() => {})
  useEffect(() => { latest.current = { modules, crew, selected, onSelect }; wake.current(true) }, [modules, crew, selected, onSelect])
  const labelEls = useRef(new Map<string, HTMLElement>()), crewEls = useRef(new Map<string, HTMLElement>())
  const [fallback, setFallback] = useState(false)

  useEffect(() => {
    const el = host.current
    if (!el || fallback) return
    let renderer: THREE.WebGLRenderer
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }) } catch { setFallback(true); return }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setClearColor(0xffffff, 0)
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05
    const canvas = renderer.domElement; el.prepend(canvas)
    canvas.className = 'ship3d-canvas'; canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', 'Ship, 3D view')
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(30, 1, .1, 300)
    const pmrem = new THREE.PMREMGenerator(renderer), envTex = pmrem.fromScene(new RoomEnvironment(), .04).texture
    scene.environment = envTex
    scene.add(new THREE.HemisphereLight(0xffffff, 0x9aa8c2, 1.1))
    const sun = new THREE.DirectionalLight(0xffffff, 2.4); sun.position.set(6, 10, 8); scene.add(sun)
    const fill = new THREE.DirectionalLight(0xbcd4ff, .8); fill.position.set(-8, -3, -6); scene.add(fill)
    const tex = { mli: mliTexture(), cells: cellTexture(), rad: radiatorTexture(), glow: glowTexture() }
    const { ship, modules: parts } = buildShip(tex.mli, tex.cells, tex.rad, tex.glow)
    const pivot = new THREE.Group(); pivot.add(ship); scene.add(pivot)
    const hulls = Object.values(parts).flatMap(p => { const list: THREE.Object3D[] = []; p.hull.parent!.traverse(o => { if (o.userData.moduleId) list.push(o) }); return list })

    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    let yaw = -.65, elev = .42, dist = 30, fit = 1, w = 1, h = 1, last = performance.now() - 3000, raf = 0, prev = performance.now(), t = 0
    // Render loop on demand: drawing 60 frames a second non-stop kept the main thread busy and the voice detector
    // (listenOnce, hooks.ts) heard late. Full rate only while the user drags or zooms; 15 fps while it only spins
    // or pulses; nothing at all when nothing moves (reduced motion, all OK), when hidden or scrolled off screen.
    const IDLE_MS = 1000 / 15, BUSY_MS = 2500
    let timer: ReturnType<typeof setTimeout> | undefined, pending = false, onScreen = true, measure = true, ready = false
    const cancel = () => { cancelAnimationFrame(raf); clearTimeout(timer); timer = undefined; pending = false }
    const schedule = (delay: number) => {
      if (!ready || pending || document.hidden || !onScreen) return   // ready: `frame` is defined further down
      pending = true
      const go = () => { timer = undefined; raf = requestAnimationFrame(frame) }
      if (delay > 0) timer = setTimeout(go, delay); else go()
    }
    const now0 = (remeasure = false) => { if (remeasure) measure = true; if (timer !== undefined) cancel(); schedule(0) }
    wake.current = now0
    const resize = () => {
      w = Math.max(1, el.clientWidth); h = Math.max(1, el.clientHeight)
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix()
      fit = camera.aspect < 1.5 ? 1.5 / camera.aspect : 1
      now0(true)
    }
    const observer = new ResizeObserver(resize); observer.observe(el); resize()
    const seen = new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; if (onScreen) { prev = performance.now(); now0() } else cancel() })
    seen.observe(el)
    // Label sizes, measured only when they change (reading offsetWidth every frame forced a page layout each time).
    const sizes = new WeakMap<HTMLElement, { w: number; h: number }>()
    const labelObs = new ResizeObserver(() => now0(true))
    const watched = new WeakSet<HTMLElement>()

    const pointers = new Map<number, { x: number; y: number }>()
    let moved = 0, pinch = 0
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2()
    const down = (e: PointerEvent) => { if (e.button !== 0 && e.pointerType === 'mouse') return; el.setPointerCapture(e.pointerId); pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); moved = 0; last = performance.now(); now0() }
    const move = (e: PointerEvent) => {
      const p = pointers.get(e.pointerId); if (!p) return
      const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY; moved += Math.abs(dx) + Math.abs(dy); last = performance.now(); now0()
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()], d = Math.hypot(a.x - b.x, a.y - b.y)
        if (pinch) dist = THREE.MathUtils.clamp(dist * (pinch / d), 12, 48); pinch = d; return
      }
      yaw -= dx * .007; elev = THREE.MathUtils.clamp(elev + dy * .005, -.35, 1.2)
    }
    const up = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return
      pointers.delete(e.pointerId); pinch = 0
      if (moved < 5 && e.type === 'pointerup') {
        const r = el.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
        ray.setFromCamera(ndc, camera)
        const hit = ray.intersectObjects(hulls, false)[0]
        if (hit) latest.current.onSelect?.(hit.object.userData.moduleId as string)
      }
    }
    const wheel = (e: WheelEvent) => { e.preventDefault(); dist = THREE.MathUtils.clamp(dist * Math.exp(e.deltaY * .0012), 12, 48); last = performance.now(); now0() }
    el.addEventListener('pointerdown', down); el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up)
    el.addEventListener('wheel', wheel, { passive: false })
    const lost = (e: Event) => { e.preventDefault(); setFallback(true) }
    canvas.addEventListener('webglcontextlost', lost)

    const v = new THREE.Vector3(), centre = new THREE.Vector3(), tmp = new THREE.Color()
    const place = (node: HTMLElement, world: THREE.Vector3, dy = 0) => {
      v.copy(world).project(camera)
      const behind = v.z > 1
      const x = (v.x * .5 + .5) * w, y = (-v.y * .5 + .5) * h + dy
      node.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`
      node.style.opacity = behind ? '0' : ''
    }
    const frame = (now: number) => {
      pending = false
      const dt = Math.min(.1, (now - prev) / 1000); prev = now; t += dt  // .1: at 15 fps a frame is ~67 ms
      if (!reduce && !pointers.size && now - last > 2500) yaw += dt * .08
      const d = dist * fit
      camera.position.set(d * Math.cos(elev) * Math.sin(yaw), d * Math.sin(elev), d * Math.cos(elev) * Math.cos(yaw)); camera.lookAt(0, 0, 0)
      const { modules: mods, crew: people, selected: sel } = latest.current
      const pulse = reduce ? .6 : .5 + .5 * Math.sin(t * 3.2)
      for (const [id, p] of Object.entries(parts)) {
        const m = mods.find(x => x.id === id), status = m?.status ?? 'ok', on = sel === id
        if (on) { p.mat.emissive.copy(NEON); p.mat.emissiveIntensity = .28 }
        else if (status !== 'ok') { p.mat.emissive.set(STATUS_HEX[status]); p.mat.emissiveIntensity = .16 + .2 * pulse }
        else { p.mat.emissive.set(0x000000); p.mat.emissiveIntensity = 0 }
        p.outline.visible = on
        const gm = p.glow.material as THREE.SpriteMaterial
        gm.color.copy(tmp.set(STATUS_HEX[status])); gm.opacity = status === 'ok' ? 0 : .22 + .25 * pulse
        p.glow.scale.setScalar(p.spec.r * (3 + .8 * pulse))
      }
      renderer.render(scene, camera)
      // HTML overlay: module labels and crew dots.
      pivot.updateMatrixWorld()
      // Module labels, pushed apart vertically when they would overlap on screen.
      const placed: { node: HTMLElement; x: number; y: number; w: number; hh: number }[] = []
      if (measure) { for (const node of labelEls.current.values()) sizes.set(node, { w: node.offsetWidth, h: node.offsetHeight }); measure = false }
      for (const [id, node] of labelEls.current) {
        if (!watched.has(node)) { watched.add(node); labelObs.observe(node) }
        const p = parts[id]; if (!p) { node.style.opacity = '0'; continue }
        v.copy(centre.copy(p.anchor).applyMatrix4(ship.matrixWorld)).project(camera)
        node.style.opacity = v.z > 1 ? '0' : ''
        const s = sizes.get(node) ?? { w: node.offsetWidth, h: node.offsetHeight }; sizes.set(node, s)
        placed.push({ node, x: (v.x * .5 + .5) * w, y: (-v.y * .5 + .5) * h, w: s.w, hh: s.h })
      }
      placed.sort((a, b) => b.y - a.y)  // bottom first; the ones above move up
      for (let i = 0; i < placed.length; i++) for (let j = 0; j < i; j++) {
        const a = placed[i], b = placed[j]
        if (Math.abs(a.x - b.x) < (a.w + b.w) / 2 + 4 && a.y > b.y - b.hh - 4) a.y = b.y - b.hh - 4
      }
      for (const l of placed) l.node.style.transform = `translate(${l.x.toFixed(1)}px, ${l.y.toFixed(1)}px) translate(-50%, -100%)`
      const byModule = new Map<string, ShipCrew[]>()
      for (const c of people) { const k = moduleIdOf(c.module); byModule.set(k, [...(byModule.get(k) ?? []), c]) }
      for (const [k, list] of byModule) {
        const p = parts[k] ?? parts.node
        list.forEach((c, i) => {
          const node = crewEls.current.get(c.id); if (!node) return
          const off = (i - (list.length - 1) / 2) * .9
          centre.set(...p.spec.pos); if (p.spec.axis === 'x') centre.x += off; else centre.z += off
          centre.y += .1; centre.applyMatrix4(ship.matrixWorld); place(node, centre, 10)
        })
      }
      // Next frame: full rate while dragging/zooming, 15 fps while it spins or pulses, otherwise wait for wake().
      const busy = pointers.size > 0 || performance.now() - last < BUSY_MS
      const pulsing = !reduce && mods.some(m => m.status !== 'ok')
      if (busy) schedule(0); else if (!reduce || pulsing) schedule(IDLE_MS)
    }
    const visibility = () => { cancel(); pointers.clear(); if (!document.hidden) { prev = performance.now(); now0() } }
    document.addEventListener('visibilitychange', visibility)
    ready = true; now0(true)
    return () => {
      wake.current = () => {}
      cancel(); observer.disconnect(); seen.disconnect(); labelObs.disconnect(); document.removeEventListener('visibilitychange', visibility)
      el.removeEventListener('pointerdown', down); el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up)
      el.removeEventListener('wheel', wheel); canvas.removeEventListener('webglcontextlost', lost)
      dispose(scene); Object.values(tex).forEach(x => x.dispose()); envTex.dispose(); pmrem.dispose()
      renderer.dispose(); renderer.forceContextLoss(); canvas.remove()
    }
  }, [fallback])

  const setLabel = (id: string) => (node: HTMLElement | null) => { if (node) labelEls.current.set(id, node); else labelEls.current.delete(id) }
  const setCrew = (id: string) => (node: HTMLElement | null) => { if (node) crewEls.current.set(id, node); else crewEls.current.delete(id) }

  if (fallback) return (
    <div className="ship3d ship3d-fallback">
      {modules.map(m => <button key={m.id} type="button" className={`ship3d-chip ${m.status} ${selected === m.id ? 'on' : ''}`} onClick={() => onSelect?.(m.id)}>{m.label}{m.detail && <small>{m.detail}</small>}</button>)}
    </div>
  )
  return (
    <div className="ship3d" ref={host}>
      <div className="ship3d-overlay">
        {crew.map(c => <span key={c.id} ref={setCrew(c.id)} className={`ship3d-crew ${c.status}`} title={c.name} aria-label={c.name}>{c.name.slice(0, 1)}</span>)}
        {modules.map(m => (
          <button key={m.id} ref={setLabel(m.id)} type="button" className={`ship3d-label ${m.status} ${selected === m.id ? 'on' : ''}`}
            aria-pressed={selected === m.id} onPointerDown={e => e.stopPropagation()} onClick={() => onSelect?.(m.id)}>
            <i aria-hidden /><span>{m.label}</span>{m.detail && <small>{m.detail}</small>}
          </button>
        ))}
      </div>
    </div>
  )
}
