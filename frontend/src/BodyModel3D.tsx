import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { HeartPulse, Wind, Brain, Ear, Dumbbell, Thermometer, Eye, Bone } from 'lucide-react'
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { Hotspot } from './Body3D'
import BodyFigure from './BodyFigure'
import { useLang } from './i18n'
import type { Sex } from './settings'
import femaleUrl from './assets/metis-body-female.glb?url'
import maleUrl from './assets/metis-body-male.glb?url'

// Human base meshes: Blender Studio, CC0. Cache source GLTFs; each view owns disposable copies.
const models = new Map<Sex, Promise<GLTF>>()
function load(sex: Sex) {
  let pending = models.get(sex)
  if (!pending) {
    pending = new GLTFLoader().loadAsync(sex === 'female' ? femaleUrl : maleUrl)
    models.set(sex, pending)
    pending.catch(() => models.delete(sex))
  }
  return pending
}
const COPY = {
  en: { figure: 'Interactive full body. Drag to rotate; scroll or pinch to zoom.', zoomIn: 'Zoom in', zoomOut: 'Zoom out', reset: 'Reset view', controls: 'Body view controls', loading: 'Loading body…', level: { ok: 'normal', watch: 'needs attention', alarm: 'urgent', nodata: 'not measured' } },
  es: { figure: 'Cuerpo completo interactivo. Arrastra para girar; usa la rueda o pellizca para ampliar.', zoomIn: 'Acercar', zoomOut: 'Alejar', reset: 'Restablecer vista', controls: 'Controles del cuerpo', loading: 'Cargando cuerpo…', level: { ok: 'normal', watch: 'atención', alarm: 'urgente', nodata: 'sin medir' } },
}
const clamp = THREE.MathUtils.clamp
type StatusMaterial = { material: THREE.MeshStandardMaterial; color: THREE.Color; opacity: number }
type Model = { group: THREE.Group; heart: THREE.Group; height: number; points: Record<string, THREE.Vector3>; opacity: number; target: number; materials: Map<THREE.Material, number>; glows: Map<string, THREE.Sprite>; statusMaterials: Map<string, StatusMaterial[]> }
function dispose(group: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>()
  group.traverse(o => { if (o instanceof THREE.Mesh || o instanceof THREE.Sprite) { if (o instanceof THREE.Mesh) geometries.add(o.geometry); for (const m of Array.isArray(o.material) ? o.material : [o.material]) materials.add(m) } })
  geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose())
}
function build(source: GLTF, sex: Sex): Model {
  const shell = source.scene.clone(true)
  shell.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(shell), size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3())
  shell.position.add(new THREE.Vector3(-center.x, -box.min.y, -center.z))
  const group = new THREE.Group(), anatomy = new THREE.Group()
  const h = size.y, w = size.x, d = size.z
  const male = sex === 'male'
  // Vertex-band calibration: wrists at 47%, fingers at 43%, shins angle outward.
  const legX = male ? .18 : .137, footX = male ? .21 : .15
  // Coordinates are fractions of the normalized bounds: X/Z around centre, Y above feet.
  const p = (x: number, y: number, z = .05) => new THREE.Vector3(x * w, y * h, z * d)
  const skin = new THREE.MeshPhysicalMaterial({ color: '#EEF1F6', metalness: .18, roughness: .27, clearcoat: 1, clearcoatRoughness: .2, transparent: true, opacity: .28, depthWrite: false, side: THREE.FrontSide })
  const back = skin.clone(); back.side = THREE.BackSide; back.opacity = .12
  const rim = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.FrontSide, uniforms: { opacity: { value: 1 } },
    vertexShader: 'varying vec3 n; varying vec3 v; void main(){vec4 mv=modelViewMatrix*vec4(position,1.);n=normalize(normalMatrix*normal);v=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}',
    fragmentShader: 'uniform float opacity; varying vec3 n; varying vec3 v; void main(){float f=pow(1.-abs(dot(normalize(n),normalize(v))),2.5);gl_FragColor=vec4(.84,.88,.94,f*.36*opacity);}' })
  const meshes: THREE.Mesh[] = []
  shell.traverse(o => { if (o instanceof THREE.Mesh) meshes.push(o) })
  for (const mesh of meshes) {
    mesh.geometry = mesh.geometry.clone(); mesh.material = back; mesh.renderOrder = 0
    const front = new THREE.Mesh(mesh.geometry, skin), edge = new THREE.Mesh(mesh.geometry, rim)
    front.renderOrder = 3; edge.renderOrder = 4; mesh.add(front, edge)
  }
  group.add(shell, anatomy)
  const pink = new THREE.MeshPhysicalMaterial({ color: '#C94B5A', roughness: .38, metalness: .02, clearcoat: .6, clearcoatRoughness: .3, sheen: .4, sheenColor: '#FFB3C0', emissive: '#3A0A12', emissiveIntensity: .08, transparent: true, opacity: .92 })
  const vessel = new THREE.MeshStandardMaterial({ color: '#E0899E', roughness: .6, transparent: true, opacity: .5, depthWrite: false })
  const pale = new THREE.MeshStandardMaterial({ color: '#DEE4EB', transparent: true, opacity: .14, depthWrite: false, roughness: .65 })
  const tube = (coords: number[][], radius = .0014, material: THREE.Material = vessel) => {
    const curve = new THREE.CatmullRomCurve3(coords.map(([x, y, z]) => p(x, y, z)))
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(16, coords.length * 9), radius * h, 6, false), material)
    mesh.renderOrder = 1; anatomy.add(mesh)
  }
  const heart = new THREE.Group(); heart.position.copy(p(.042, sex === 'female' ? .724 : .73, .18)); heart.rotation.z = -.3
  const softPink = pink.clone(); softPink.color.set('#D86C7A')
  const coronary = pink.clone(); coronary.color.set('#A93749'); coronary.roughness = .45
  // All coordinates below are local fractions of body height, keeping both models' chest fit.
  const heartPoint = ([x, y, z]: number[]) => new THREE.Vector3(x * h, y * h, z * h)
  const heartLobe = (position: number[], scale: number[], material = pink) => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), material)
    mesh.position.copy(heartPoint(position)); mesh.scale.copy(heartPoint(scale)); heart.add(mesh)
    return mesh
  }
  // A broad basal shoulder tapers into the left ventricle's rounded, off-centre apex.
  const ventricleGeometry = new THREE.SphereGeometry(1, 64, 48)
  const vertices = ventricleGeometry.getAttribute('position')
  for (let i = 0; i < vertices.count; i++) {
    const x = vertices.getX(i), y = vertices.getY(i), z = vertices.getZ(i)
    const lower = Math.max(0, -y)
    const shoulder = 1 + .12 * y - .3 * lower * lower
    vertices.setXYZ(i,
      h * (x * .034 * shoulder - .012 * lower * lower + .003 * y),
      h * (y * .044 - .015),
      h * (z * .025 * shoulder - .003 * lower))
  }
  ventricleGeometry.computeVertexNormals()
  heart.add(new THREE.Mesh(ventricleGeometry, pink))
  // The right ventricle wraps across the anterior surface, ending above the main apex.
  const rightVentricle = heartLobe([-.013, -.012, .014], [.023, .033, .016])
  rightVentricle.rotation.z = -.22
  heartLobe([-.023, .023, -.008], [.019, .017, .016], softPink)
  heartLobe([.017, .026, -.012], [.018, .015, .015], softPink)
  const auricle = heartLobe([.028, .021, .007], [.012, .008, .008], softPink)
  auricle.rotation.z = -.55
  const heartTube = (coords: number[][], radius: number, material = softPink) => {
    const curve = new THREE.CatmullRomCurve3(coords.map(heartPoint), false, 'centripetal')
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(48, coords.length * 12), radius * h, 32, false), material)
    heart.add(mesh)
    return curve
  }
  // Ascending aorta, arch and descending root, with three distinct superior branches.
  heartTube([[.005,.014,-.001],[.009,.035,-.002],[.007,.054,-.005],[-.004,.062,-.009],[-.019,.057,-.015],[-.026,.043,-.02],[-.025,.022,-.022]], .007)
  heartTube([[.003,.055,-.005],[.002,.066,-.004],[-.003,.074,-.004]], .0035)
  heartTube([[-.007,.06,-.009],[-.009,.069,-.009],[-.008,.078,-.01]], .0027)
  heartTube([[-.017,.056,-.014],[-.023,.065,-.014],[-.028,.071,-.017]], .003)
  // Pulmonary trunk sits in front of the aortic root and divides toward both lungs.
  heartTube([[-.009,.002,.022],[-.012,.022,.023],[-.009,.039,.016],[-.003,.044,.007]], .0065)
  heartTube([[-.006,.042,.011],[-.019,.045,.001],[-.035,.042,-.008]], .0045)
  heartTube([[-.003,.044,.007],[.014,.046,-.001],[.031,.038,-.01]], .0045)
  // Short caval stubs enter the posterior right atrium from above and below.
  heartTube([[-.026,.023,-.015],[-.03,.04,-.016],[-.029,.054,-.018]], .0055)
  heartTube([[-.023,.02,-.019],[-.028,.003,-.021],[-.025,-.014,-.022]], .006)
  // Fine coronary arteries follow the anterior groove and curve around the basal shoulder.
  heartTube([[.006,.022,.023],[.008,.006,.027],[.004,-.014,.03],[-.002,-.035,.022],[-.01,-.05,.012]], .0011, coronary)
  heartTube([[.006,.018,.024],[-.01,.016,.029],[-.026,.007,.025],[-.031,-.007,.015]], .0012, coronary)
  heartTube([[.004,-.013,.03],[.018,-.02,.024],[.025,-.031,.014]], .00065, coronary)
  heartTube([[0,-.029,.025],[-.013,-.028,.029],[-.024,-.035,.018]], .00065, coronary)
  anatomy.add(heart)
  const lungMaterial = pale.clone()
  const statusMaterials = new Map<string, StatusMaterial[]>()
  const trackStatus = (id: string, ...materials: THREE.MeshStandardMaterial[]) => {
    statusMaterials.set(id, materials.map(material => ({ material, color: material.color.clone(), opacity: material.opacity })))
  }
  trackStatus('heart', pink, softPink, coronary)
  trackStatus('lungs', lungMaterial)
  for (const s of [-1, 1]) {
    const lung = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 20), lungMaterial)
    lung.position.copy(p(s * .095, .745, .01)); lung.scale.set(w * .068, h * .075, d * .22); lung.rotation.z = s * -.13; anatomy.add(lung)
    // Major arteries follow the A-pose, then split into smaller branches and fingers/toes.
    tube([[.04,.73,.12],[0,.77,.1],[s*.027,.85,.04],[s*.035,.91,.02],[s*.04,.97,.02]])
    tube([[0,.78,.1],[s*.16,.79,-.04],[s*(male?.28:.25),.73,-.12],[s*(male?.34:.29),.64,-.12],[s*(male?.4:.37),.56,0],[s*.425,.51,.12],[s*.465,.47,.18]])
    tube([[.03,.73,.08],[0,.64,0],[0,.55,0],[s*(male?.12:.1),.47,.03],[s*(male?.14:.124),.31,-.05],[s*legX,.15,-.24],[s*footX,.035,-.1]], .0022)
    for (let i = 0; i < 5; i++) {
      const y = .88 + i * .017
      tube([[s*.032,y,.03],[s*(.045+i*.003),y+.012,.1],[s*(.064-i*.006),y+.025,.12]], .0005)
      tube([[s*.46,.48,.18],[s*(.455+i*.009),.455,.18],[s*(.455+i*.01),.425+i*.003,.17]], .00045)
      tube([[s*footX,.04,-.1],[s*(footX-.025+i*.012),.017,.27]], .0005)
    }
    for (let i = 0; i < 8; i++) {
      const y = .77 - i * .025
      tube([[0,y,-.1],[s*.095,y+.015,-.12],[s*.17,y,.01],[s*.14,y-.025,.26],[s*.025,y-.032,.31]], .0015, pale)
      if (i % 2 === 0) tube([[0,y,.06],[s*.07,y-.025,.2],[s*.13,y-.05,.17]], .0005)
    }
    for (const [x,y] of [[.27,.7],[.34,.63],[.09,.43],[.11,.27],[.105,.15]]) {
      tube([[s*x,y,.05],[s*(x+.025),y-.045,.13],[s*(x+.022),y-.09,.09]], .0005)
    }
    // Extra veins: neck, arms (forearm network), torso and legs, so the vascular tree reads clearly.
    tube([[s*.02,.88,.06],[s*.05,.84,.1],[s*.09,.80,.08],[s*.15,.79,.0]], .0012)
    tube([[s*(male?.3:.27),.70,-.06],[s*(male?.33:.30),.64,.04],[s*(male?.37:.34),.58,.08],[s*.41,.53,.14]], .0011)
    tube([[s*(male?.33:.30),.64,-.08],[s*(male?.36:.33),.60,-.02],[s*.39,.55,.06],[s*.43,.50,.10]], .0008)
    for (let i = 0; i < 4; i++) tube([[s*(.36+i*.012),.6-i*.02,.02],[s*(.38+i*.012),.57-i*.02,.08],[s*(.40+i*.01),.54-i*.02,.12]], .0005)
    tube([[s*.03,.70,.12],[s*.07,.66,.16],[s*.1,.6,.17],[s*.11,.53,.15],[s*.1,.47,.1]], .0009)
    tube([[s*.05,.62,.14],[s*.09,.58,.18],[s*.12,.55,.16]], .0006)
    tube([[s*(male?.12:.1),.45,.06],[s*(male?.13:.115),.38,.1],[s*(male?.135:.12),.3,.06],[s*legX,.2,-.08],[s*legX,.1,-.1]], .0012)
    tube([[s*(male?.13:.115),.40,.0],[s*(male?.15:.135),.34,-.08],[s*(male?.145:.13),.26,-.12],[s*legX,.16,-.2]], .0008)
    for (let i = 0; i < 3; i++) tube([[s*(male?.13:.115),.36-i*.06,.06],[s*(male?.15:.135),.34-i*.06,.1],[s*(male?.16:.145),.31-i*.06,.05]], .0005)
  }
  tube([[0,.51,-.2],[0,.66,-.23],[0,.81,-.18],[0,.88,-.12]], .003, pale)
  // Only the veins are shown inside the body (user request): heart and lungs stay built for positions/status, but hidden.
  heart.visible = false
  anatomy.children.forEach(o => { if (o instanceof THREE.Mesh && o.material === lungMaterial) o.visible = false })
  const points = { skin: p(-.36,.585,.12), heart: heart.position.clone(), lungs: p(-.095,.75,.24), brain: p(0,.974,.12), eyes: p(-.035,.941,.42), ear: p(.105,.925,.01), bones: p(-(male?.14:.124),.31,.12), muscle: p(male?.13:.11,.435,.25) }
  const materials = new Map<THREE.Material, number>()
  group.traverse(o => { if (o instanceof THREE.Mesh) for (const m of Array.isArray(o.material) ? o.material : [o.material]) { materials.set(m, m.opacity); m.transparent = true } })
  return { group, heart, height: h, points, opacity: 0, target: 1, materials, glows: new Map(), statusMaterials }
}

const HOTSPOT_ICONS = { heart: HeartPulse, lungs: Wind, brain: Brain, sleep: Brain, ear: Ear, muscle: Dumbbell, skin: Thermometer, eyes: Eye, bones: Bone }
function HotspotContents({ hotspot }: { hotspot: Hotspot }) {
  const Icon = HOTSPOT_ICONS[hotspot.id as keyof typeof HOTSPOT_ICONS] ?? Brain
  return <>
    <span className="figure-marker" aria-hidden="true"><Icon size={18} strokeWidth={1.75} /></span>
    <span className="figure-label-line" aria-hidden="true" />
    <span className="figure-label" aria-hidden="true"><span className="figure-label-dot" />{hotspot.label}</span>
  </>
}

// Labels stay in screen space: choose the outward side, then separate visible pills
// vertically without moving the anatomical marker or the detail-panel anchor.
function layoutHotspotNames(buttons: (HTMLButtonElement | null | undefined)[], width: number, height: number, centerX: number) {
  const sides: { button: HTMLButtonElement; x: number; y: number; radius: number; reach: number; labelHeight: number }[][] = [[], []]
  for (const button of buttons) {
    if (!button || button.style.visibility === 'hidden') continue
    const x = parseFloat(button.style.left), y = parseFloat(button.style.top)
    const label = button.querySelector<HTMLElement>('.figure-label')
    if (!label) continue
    const radius = button.classList.contains('selected') ? 44 : 32
    const reach = radius + 24
    let left = x < centerX || (Math.abs(x - centerX) < 8 && button.dataset.preferLeft === 'true')
    const needed = reach + label.offsetWidth + 8
    if (left && x < needed && width - x > x) left = false
    else if (!left && width - x < needed && x > width - x) left = true
    button.classList.toggle('label-left', left)
    button.style.setProperty('--label-x', `${left ? -reach : reach}px`)
    button.style.setProperty('--label-anchor', left ? '-100%' : '0%')
    const show = button.matches('.lvl-watch, .lvl-alarm, .selected, :hover, :focus-visible')
    if (show) sides[left ? 0 : 1].push({ button, x, y, radius, reach, labelHeight: label.offsetHeight })
  }
  for (const [side, entries] of sides.entries()) {
    entries.sort((a, b) => a.y - b.y)
    const rows: number[] = []
    entries.forEach((entry, i) => {
      const half = entry.labelHeight / 2
      rows[i] = Math.max(8 + half, Math.min(entry.y, height - 8 - half), i ? rows[i - 1] + (entries[i - 1].labelHeight + entry.labelHeight) / 2 + 8 : 0)
    })
    for (let i = entries.length - 1; i >= 0; i--) {
      const entry = entries[i], half = entry.labelHeight / 2
      rows[i] = Math.min(rows[i], height - 8 - half, i < entries.length - 1 ? rows[i + 1] - (entries[i + 1].labelHeight + entry.labelHeight) / 2 - 8 : height)
      const dy = rows[i] - entry.y, dx = (side === 0 ? -1 : 1) * (entry.reach - entry.radius)
      entry.button.style.setProperty('--label-y', `${dy}px`)
      entry.button.style.setProperty('--label-line-start', `${side === 0 ? -entry.radius : entry.radius}px`)
      entry.button.style.setProperty('--label-line-length', `${Math.hypot(dx, dy)}px`)
      entry.button.style.setProperty('--label-line-angle', `${Math.atan2(dy, dx)}rad`)
    }
  }
}

type Props = { hotspots: Hotspot[]; selected?: string | null; onSelect: (id: string) => void; sex: Sex }
export default function BodyModel3D(props: Props) {
  const { lang } = useLang(), copy = COPY[lang]
  const host = useRef<HTMLDivElement>(null), buttons = useRef<Record<string, HTMLButtonElement | null>>({})
  const latest = useRef(props)
  useEffect(() => { latest.current = props }, [props])
  const engine = useRef<{ swap: (sex: Sex) => void; zoom: (factor: number) => void; focus: (id: string, side?: 'left' | 'right') => void; restore: () => void; reset: () => void } | null>(null)
  const [fallback, setFallback] = useState(false), [loading, setLoading] = useState(true), [zoom, setZoomValue] = useState(1)
  useEffect(() => {
    const el = host.current
    if (!el || fallback) return
    let renderer: THREE.WebGLRenderer
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }) } catch { setFallback(true); return }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setClearColor(0xffffff, 0)
    const canvas = renderer.domElement; el.prepend(canvas)
    canvas.tabIndex = 0; canvas.setAttribute('role', 'img')
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(32, 1, .01, 30)
    scene.add(new THREE.HemisphereLight(0xffffff, 0xa8b2c8, 2.4))
    for (const [x,y,z,power] of [[-2,3,4,3],[2,2,-3,2],[0,1,4,1]]) { const light = new THREE.DirectionalLight(0xffffff,power); light.position.set(x,y,z); scene.add(light) }
    const pivot = new THREE.Group(); scene.add(pivot)
    const shadowCanvas = document.createElement('canvas'); shadowCanvas.width = shadowCanvas.height = 128
    const ctx = shadowCanvas.getContext('2d')!
    const gradient = ctx.createRadialGradient(64,64,0,64,64,64); gradient.addColorStop(0,'rgba(72,88,112,.11)'); gradient.addColorStop(1,'rgba(72,88,112,0)'); ctx.fillStyle=gradient; ctx.fillRect(0,0,128,128)
    const shadowTexture = new THREE.CanvasTexture(shadowCanvas)
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(.85,.55),new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false }))
    shadow.rotation.x=-Math.PI/2; shadow.position.y=-.006; scene.add(shadow)
    // One shared soft texture; each model owns sprites at its calibrated organ points.
    const glowCanvas = document.createElement('canvas'); glowCanvas.width = glowCanvas.height = 128
    const glowContext = glowCanvas.getContext('2d')!
    const glowGradient = glowContext.createRadialGradient(64,64,0,64,64,64)
    glowGradient.addColorStop(0, 'rgba(255,255,255,1)')
    glowGradient.addColorStop(.38, 'rgba(255,255,255,.85)')
    glowGradient.addColorStop(.7, 'rgba(255,255,255,.3)')
    glowGradient.addColorStop(1, 'rgba(255,255,255,0)')
    glowContext.fillStyle = glowGradient; glowContext.fillRect(0,0,128,128)
    const glowTexture = new THREE.CanvasTexture(glowCanvas)
    let alive = true, ticket = 0, raf = 0, previous = 0, active: Model | undefined
    const visible: Model[] = []
    let angle = 0, tilt = 0, velocity = 0, magnification = 1, pan = 0, panX = 0, lastInteraction = 0, opened = false
    let focus: { mag: number; pan: number; angle: number; panX: number; speed?: number } | null = null
    let introDone = false
    let before: { mag: number; pan: number; angle: number; panX: number } | null = null
    const limY = () => Math.max(.35, (magnification-1)*.9), limX = () => Math.max(.3, (magnification-1)*.5)
    const clampPan = () => { pan=clamp(pan,-limY(),limY()); panX=clamp(panX,-limX(),limX()) }
    const motion = matchMedia('(prefers-reduced-motion: reduce)')
    const still = () => motion.matches || !!el.closest('.capture')
    const interact = () => { lastInteraction = performance.now() }
    const setZoom = (factor: number) => { focus = null; magnification = clamp(magnification*factor,.8,3); clampPan(); setZoomValue(magnification); interact() }
        const swap = (sex: Sex) => {
      const request = ++ticket
      load(sex).then(source => {
        if (!alive || request !== ticket) return
        const model = build(source,sex)
        for (const [id, point] of Object.entries(model.points)) {
          const material = new THREE.SpriteMaterial({ map: glowTexture, transparent: true, opacity: 0, depthWrite: false, depthTest: false, blending: THREE.NormalBlending })
          const glow = new THREE.Sprite(material)
          glow.position.copy(point); glow.scale.setScalar(model.height * .1); glow.renderOrder = 5
          model.group.add(glow); model.glows.set(id, glow)
        }
        visible.forEach(m => { m.target=0 }); visible.push(model); active=model; pivot.add(model.group); setLoading(false)
        // Opening shot: start on the whole body, then glide in to a half-body view (waist up), centred on the chest.
        if (!introDone) { introDone = true; magnification = 1; pan = 0; panX = 0; setZoomValue(1)
          focus = { mag: 1.3, pan: model.height * (.51 - .64), angle, panX: 0, speed: 1.6 }; interact() }
      }).catch(() => { if (alive && request === ticket) setFallback(true) })
    }
    const focusOn = (id: string, side?: 'left' | 'right') => {
      const point = active?.points[id]; if (!point || !active) return
      // Turn that part towards the camera and zoom in. The detail panel opens on `side`, so the body slides the other
      // way: panel on the left -> the zone ends up on the right of the view, and vice versa.
      let target = Math.atan2(-point.x, point.z); const turn = ((target - angle + Math.PI) % (2*Math.PI) + 2*Math.PI) % (2*Math.PI) - Math.PI; target = angle + turn
      const mag = 2.2, vfov = THREE.MathUtils.degToRad(camera.fov), h = active.height
      const fit = Math.max(h*1.18/2/Math.tan(vfov/2), h*.64/2/Math.tan(vfov/2)/camera.aspect)
      const half = (fit/mag)*Math.tan(vfov/2)*camera.aspect
      const shiftX = side === 'left' ? half*.4 : side === 'right' ? -half*.4 : 0
      if (!before) before = { mag: magnification, pan, angle, panX }
      focus = { mag, pan: h*.51 - point.y, angle: target, panX: shiftX }; velocity = 0; tilt = 0; interact()
    }
    const restore = () => { if (!before) return; focus = { ...before, speed: 4 }; before = null; velocity = 0; interact() }
    engine.current = { swap, zoom: setZoom, focus: focusOn, restore, reset: () => { focus=null; angle=tilt=velocity=pan=panX=0; magnification=1; setZoomValue(1); interact() } }
    swap(latest.current.sex)
    const resize = () => { const w=el.clientWidth,h=el.clientHeight; renderer.setSize(w,h); camera.aspect=w/Math.max(h,1); camera.updateProjectionMatrix() }
    const observer = new ResizeObserver(resize); observer.observe(el); resize()
    const pointers = new Map<number,{x:number;y:number}>()
    const panning = new Set<number>()
    const down = (e: PointerEvent) => { if ((e.button!==0 && e.button!==1) || (e.target as Element).closest('button')) return; if (e.button===1) { e.preventDefault(); panning.add(e.pointerId) } focus=null; pointers.set(e.pointerId,{x:e.clientX,y:e.clientY}); el.setPointerCapture(e.pointerId); canvas.focus({preventScroll:true}); velocity=0; interact() }
    const move = (e: PointerEvent) => {
      const old=pointers.get(e.pointerId); if (!old) return
      const before=[...pointers.values()]; pointers.set(e.pointerId,{x:e.clientX,y:e.clientY}); const after=[...pointers.values()]
      const dx=e.clientX-old.x,dy=e.clientY-old.y
      if (before.length===2) { const distance=(a: typeof before)=>Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y); setZoom(distance(after)/Math.max(1,distance(before))); pan+=dy/el.clientHeight/magnification*1.8 }
      else if (panning.has(e.pointerId) || e.shiftKey) { pan-=dy/el.clientHeight/magnification*1.8; panX+=dx/el.clientHeight/magnification*1.8 }
      else { angle+=dx*.008; velocity=still()?0:dx*.00045; tilt=clamp(tilt+dy*.003,-Math.PI/12,Math.PI/12) }
      clampPan(); interact()
    }
    const up = (e: PointerEvent) => { pointers.delete(e.pointerId); panning.delete(e.pointerId); interact() }
    const wheel = (e: WheelEvent) => { e.preventDefault()
      if (e.ctrlKey) { setZoom(Math.exp(-e.deltaY*.01)); return }
      // Mouse wheel forward/back (vertical scroll) zooms in/out; a horizontal trackpad swipe rotates.
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) { focus=null; angle+=e.deltaX*.006; velocity=0; interact(); return }
      const lines = e.deltaMode === 1 ? 40 : 1
      setZoom(Math.exp(-e.deltaY*lines*.0025)) }
    const key = (e: KeyboardEvent) => { if (e.key==='ArrowLeft'||e.key==='ArrowRight') { e.preventDefault(); angle+=e.key==='ArrowLeft'?-.15:.15; velocity=0; interact() } }
    const lost = (e: Event) => { e.preventDefault(); setFallback(true) }
    el.addEventListener('pointerdown',down); el.addEventListener('pointermove',move); el.addEventListener('pointerup',up); el.addEventListener('pointercancel',up); el.addEventListener('lostpointercapture',up)
    el.addEventListener('wheel',wheel,{passive:false}); canvas.addEventListener('keydown',key); canvas.addEventListener('webglcontextlost',lost)
    const v = new THREE.Vector3()
    const frame = (now: number) => {
      if (!alive) return
      const dt=Math.min((now-previous)/1000 || .016,.05); previous=now
      if (latest.current.selected) opened=true
      if (!pointers.size && !still()) { angle+=velocity*dt*60; velocity*=Math.exp(-dt*5); if (!opened && now-lastInteraction>2500) angle+=dt*.16 }
      const height=active?.height??1.65
      if (focus) {
        const k = still() ? 1 : 1 - Math.exp(-dt*(focus.speed ?? 6))
        magnification += (focus.mag-magnification)*k; pan += (focus.pan-pan)*k; angle += (focus.angle-angle)*k; panX += (focus.panX-panX)*k
        if (Math.abs(focus.mag-magnification)<.01 && Math.abs(focus.pan-pan)<.002 && Math.abs(focus.angle-angle)<.002 && Math.abs(focus.panX-panX)<.002) { magnification=focus.mag; pan=focus.pan; angle=focus.angle; panX=focus.panX; focus=null; setZoomValue(magnification) }
      }
      shadow.position.set(panX,pan-.006,0)
      pivot.position.set(panX,height/2+pan,0); pivot.rotation.set(tilt,angle,0)
      for (const model of visible) {
        model.group.position.y=-height/2
        model.opacity=still()?model.target:THREE.MathUtils.damp(model.opacity,model.target,8,dt)
        for (const [material,base] of model.materials) { material.opacity=base*model.opacity; if (material instanceof THREE.ShaderMaterial) material.uniforms.opacity.value=model.opacity }
        for (const [id, glow] of model.glows) {
          const level = latest.current.hotspots.find(h => h.id === id)?.level
          glow.visible = false  // no orange on the body: status lives on the points only
          if (glow.visible) {
            glow.material.color.set(level === 'alarm' ? '#FF5A36' : '#F59E0B')
            const pulse = still() ? .5 : (1 + Math.sin(now * Math.PI * 2 / 4800 + [...model.glows.keys()].indexOf(id))) / 2
            glow.material.opacity = (.3 + .08 * pulse) * model.opacity
            // Radius is 14–20% of body height. Shape each wash to its anatomy.
            const diameter = model.height * (.11 + .01 * pulse)
            const aspect = id === 'skin' ? .5 : id === 'muscle' ? .65 : 1
            glow.scale.set(diameter * aspect, diameter, 1)
          }
        }
        for (const [id, entries] of model.statusMaterials) {
          const level = latest.current.hotspots.find(h => h.id === id)?.level
          // Organs keep their normal colour (user request): status shows on the points, not on the anatomy.
          const attention = false && (level === 'watch' || level === 'alarm')
          const pulse = still() ? .5 : (1 + Math.sin(now * Math.PI * 2 / 4800)) / 2
          for (const { material, color, opacity } of entries) {
            material.color.copy(attention ? new THREE.Color(level === 'alarm' ? '#E8532E' : '#F28C28') : color)
            material.emissive.set(attention ? level === 'alarm' ? '#FF5A36' : '#F59E0B' : '#000000')
            material.emissiveIntensity = attention ? .18 + .06 * pulse : 0
            material.opacity = (attention ? .5 + .06 * pulse : opacity) * model.opacity
          }
        }
        const heartLevel = latest.current.hotspots.find(h => h.id === 'heart')?.level
        const beat = still() || (heartLevel !== 'watch' && heartLevel !== 'alarm') ? 1 : 1 + .015 * Math.pow(Math.max(0, Math.sin(now * Math.PI * 2 / 4800)), 8)
        model.heart.scale.setScalar(beat)
      }
      for (let i=visible.length-1;i>=0;i--) if (!visible[i].target && visible[i].opacity<.01) { pivot.remove(visible[i].group); dispose(visible[i].group); visible.splice(i,1) }
      const vfov=THREE.MathUtils.degToRad(camera.fov), fit=Math.max(height*1.18/2/Math.tan(vfov/2),height*.64/2/Math.tan(vfov/2)/camera.aspect)
      camera.position.set(0,height*.51,fit/magnification); camera.lookAt(0,height*.51,0); camera.updateMatrixWorld(); pivot.updateMatrixWorld(true)
      for (const hotspot of latest.current.hotspots) {
        const button=buttons.current[hotspot.id], point=active?.points[hotspot.id]
        if (!button || !point || !active) continue
        v.copy(point); active.group.localToWorld(v)
        const facing=point.clone().setY(0).normalize().applyEuler(pivot.rotation).z>-.12
        v.project(camera); const x=(v.x+1)*el.clientWidth/2,y=(1-v.y)*el.clientHeight/2
        button.style.left=`${x}px`; button.style.top=`${y}px`; button.style.setProperty('--hotspot-facing', facing ? '1' : '.6'); button.style.visibility=v.z>1||x<0||x>el.clientWidth||y<0||y>el.clientHeight?'hidden':'visible'
      }
      v.copy(pivot.position).project(camera)
      layoutHotspotNames(Object.values(buttons.current), el.clientWidth, el.clientHeight, (v.x + 1) * el.clientWidth / 2)
      renderer.render(scene,camera); raf=requestAnimationFrame(frame)
    }
    const visibility = () => { cancelAnimationFrame(raf); pointers.clear(); velocity=0; if (!document.hidden) { previous=performance.now(); raf=requestAnimationFrame(frame) } }
    document.addEventListener('visibilitychange',visibility); if (!document.hidden) raf=requestAnimationFrame(frame)
    return () => {
      alive=false; ticket++; cancelAnimationFrame(raf); observer.disconnect(); document.removeEventListener('visibilitychange',visibility)
      el.removeEventListener('wheel',wheel); el.removeEventListener('pointerdown',down); el.removeEventListener('pointermove',move); el.removeEventListener('pointerup',up); el.removeEventListener('pointercancel',up); el.removeEventListener('lostpointercapture',up); canvas.removeEventListener('keydown',key); canvas.removeEventListener('webglcontextlost',lost)
      dispose(scene); shadowTexture.dispose(); glowTexture.dispose(); renderer.dispose(); renderer.forceContextLoss(); canvas.remove(); engine.current=null
    }
  }, [fallback])
  useEffect(() => { engine.current?.swap(props.sex) }, [props.sex])
  // Closing the detail panel puts the body back where it was before the zoom.
  useEffect(() => { if (!props.selected) engine.current?.restore() }, [props.selected])
  useEffect(() => { host.current?.querySelector('canvas')?.setAttribute('aria-label',copy.figure) }, [copy.figure,loading])
  if (fallback) return <BodyFallback {...props} />
  return <>
    <div ref={host} className="body-figure body-model" aria-label={copy.figure}>
      {loading && <span className="body-model-loading" role="status">{copy.loading}</span>}
      {props.hotspots.map(h => <button key={h.id} ref={el=>{buttons.current[h.id]=el}} type="button" data-prefer-left={h.left} aria-label={`${h.label}, ${copy.level[h.level]}`} aria-pressed={props.selected===h.id} aria-haspopup="dialog" className={`figure-hotspot lvl-${h.level}${props.selected===h.id?' selected':''}`} style={{visibility:loading?'hidden':undefined}} onClick={e=>{e.currentTarget.focus({preventScroll:true});const r=e.currentTarget.getBoundingClientRect(),hb=host.current?.getBoundingClientRect();const side:'left'|'right'=hb&&r.left+r.width/2-hb.left<hb.width/2?'left':'right';if(host.current)host.current.dataset.panelSide=side;engine.current?.focus(h.id,side);props.onSelect(h.id)}}><HotspotContents hotspot={h} /></button>)}
    </div>
    <div className="figure-zoom" role="group" aria-label={copy.controls}>
      <button type="button" aria-label={copy.zoomOut} title={copy.zoomOut} disabled={zoom<=.8} onClick={()=>engine.current?.zoom(1/1.2)}>−</button>
      <button type="button" aria-label={copy.reset} title={copy.reset} onClick={()=>engine.current?.reset()}>↺</button>
      <button type="button" aria-label={copy.zoomIn} title={copy.zoomIn} disabled={zoom>=3} onClick={()=>engine.current?.zoom(1.2)}>+</button>
    </div>
  </>
}

// The fallback camera remains owned by BodyFigure; project only the hotspot overlay
// from its transformed image bounds so circles and names retain their screen size.
const FALLBACK_POINTS: Record<string, [number, number]> = {
  heart: [63, 57], lungs: [35, 53], brain: [50, 6], eyes: [45, 13],
  ear: [64, 17], bones: [33, 39], muscle: [84, 48], skin: [20, 53],
}
function BodyFallback(props: Props) {
  const { lang } = useLang()
  const host = useRef<HTMLDivElement>(null)
  const buttons = useRef<Record<string, HTMLButtonElement | null>>({})
  useEffect(() => {
    let frame = 0
    const track = () => {
      const container = host.current
      const stage = container?.querySelector('.body-figure-stage')
      if (container && stage) {
        const bounds = container.getBoundingClientRect(), image = stage.getBoundingClientRect()
        for (const [id, button] of Object.entries(buttons.current)) {
          if (!button) continue
          const point = props.sex === 'male'
            ? ({ heart: [62, 56], lungs: [35, 52], eyes: [47, 13], bones: [31, 39], muscle: [85, 47] } as Record<string, number[]>)[id] ?? FALLBACK_POINTS[id]
            : FALLBACK_POINTS[id]
          if (!point) continue
          const x = image.left + image.width * point[0] / 100 - bounds.left
          const y = image.top + image.height * point[1] / 100 - bounds.top
          button.style.left = `${x}px`; button.style.top = `${y}px`
          button.style.visibility = x < 0 || y < 0 || x > bounds.width || y > bounds.height ? 'hidden' : 'visible'
        }
        layoutHotspotNames(Object.values(buttons.current), bounds.width, bounds.height, image.left + image.width / 2 - bounds.left)
      }
      frame = requestAnimationFrame(track)
    }
    frame = requestAnimationFrame(track)
    return () => cancelAnimationFrame(frame)
  }, [props.sex])
  return <div ref={host} className="body-fallback-live">
    <BodyFigure {...props} hotspots={[]} />
    {props.hotspots.map(h => <button key={h.id} ref={el => { buttons.current[h.id] = el }} type="button" data-prefer-left={h.left}
      className={`figure-hotspot lvl-${h.level}${props.selected === h.id ? ' selected' : ''}`} style={{ visibility: 'hidden' }}
      aria-label={`${h.label}, ${COPY[lang].level[h.level]}`} aria-pressed={props.selected === h.id} aria-haspopup="dialog"
      onClick={e => { e.currentTarget.focus({ preventScroll: true }); props.onSelect(h.id) }}>
      <HotspotContents hotspot={h} />
    </button>)}
  </div>
}
