// Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
// "How it works": knowledge graph (d3-force), local architecture, earpiece concept in 3D.
import { useEffect, useMemo, useRef, useState } from 'react'
import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation, type SimulationNodeDatum } from 'd3-force'
import * as THREE from 'three'
import { ArrowRight, Ear, Globe2, LayoutDashboard, Cpu } from 'lucide-react'
import { api } from '../api'
import { useLoad, fmtDelay } from '../hooks'
import { useLang, useT, pick } from '../i18n'
import { Card, Page } from '../ui'

const TYPE_COL: Record<string, string> = { crew: '#ffd88a', metis: '#9ee9dc', ai: '#9ee9dc', station: '#6fb6ff', hub: '#6fb6ff', knowledge: '#c3a6ff', protocol: '#c3a6ff', symptom: '#ff8a8d', nasa: '#f3b443', source: '#f3b443', inventory: '#3ad1ae', equipment: '#3ad1ae', medication: '#3ad1ae', earth: '#7fb2ff', ground: '#7fb2ff', sensor: '#8b9bb0', device: '#8b9bb0' }
type N = SimulationNodeDatum & { id: string; type: string; label_en: string; label_es: string }

function KnowledgeGraph() {
  const { lang } = useLang()
  const { data } = useLoad(api.graph)
  const [hover, setHover] = useState<string | null>(null)
  const W = 900, H = 640
  const laid = useMemo(() => {
    if (!data) return null
    const linked = new Set(data.edges.flatMap(e => [e.source, e.target]))
    const nodes: N[] = data.nodes.filter(n => linked.has(n.id)).map(n => ({ ...n }))
    const ids = new Set(nodes.map(n => n.id))
    const links = data.edges.filter(e => ids.has(e.source) && ids.has(e.target)).map(e => ({ ...e }))
    const sim = forceSimulation(nodes).force('link', forceLink(links).id((d) => (d as N).id).distance(85).strength(0.6))
      .force('charge', forceManyBody().strength(nodes.length > 25 ? -260 : -420)).force('center', forceCenter(W / 2, H / 2)).force('collide', forceCollide(nodes.length > 25 ? 26 : 38)).stop()
    for (let i = 0; i < 320; i++) sim.tick()
    // fit the layout into the box
    const xs = nodes.map(n => n.x ?? 0), ys = nodes.map(n => n.y ?? 0)
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys)
    for (const n of nodes) { n.x = 80 + ((n.x! - x0) / (x1 - x0 || 1)) * (W - 160); n.y = 30 + ((n.y! - y0) / (y1 - y0 || 1)) * (H - 70) }
    return { nodes, links: links as unknown as { source: N; target: N; relation: string }[] }
  }, [data])
  if (!laid) return <div style={{ height: H }} />
  const near = (id: string) => !hover || hover === id || laid.links.some(l => (l.source.id === hover && l.target.id === id) || (l.target.id === hover && l.source.id === id))
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
      {laid.links.map((l, i) => {
        const on = !hover || l.source.id === hover || l.target.id === hover
        return <g key={i} opacity={on ? 1 : 0.12}>
          <line x1={l.source.x} y1={l.source.y} x2={l.target.x} y2={l.target.y} stroke="#2c3b52" strokeWidth={1.4} />
          {hover && on && <text x={((l.source.x ?? 0) + (l.target.x ?? 0)) / 2} y={((l.source.y ?? 0) + (l.target.y ?? 0)) / 2 - 4} fill="#8b9bb0" fontSize="10.5" textAnchor="middle">{l.relation}</text>}
        </g>
      })}
      {laid.nodes.map(n => (
        <g key={n.id} transform={`translate(${n.x},${n.y})`} opacity={near(n.id) ? 1 : 0.2} onMouseEnter={() => setHover(n.id)} onMouseLeave={() => setHover(null)} style={{ cursor: 'pointer' }}>
          <circle r={n.type === 'station' || n.type === 'hub' ? 15 : n.type === 'metis' || n.type === 'ai' ? 11 : 7} fill={TYPE_COL[n.type] ?? '#8b9bb0'} fillOpacity={0.18} stroke={TYPE_COL[n.type] ?? '#8b9bb0'} strokeWidth={1.6} />
          {(hover === n.id || (hover && near(n.id)) || (!hover && (laid.nodes.length <= 25 || ['crew', 'station', 'earth', 'hub', 'ground', 'ai'].includes(n.type)))) && (() => { const l = pick(n as never, 'label', lang); const short = hover === n.id || l.length <= 26 ? l : l.slice(0, 24) + '…'; return <text y={n.type === 'station' || n.type === 'hub' ? 30 : 22} fill="#e7eef7" fontSize="12" textAnchor="middle" style={{ paintOrder: 'stroke', stroke: '#0c141f', strokeWidth: 4 }}>{short}</text> })()}
          <title>{pick(n as never, 'label', lang)}</title>
        </g>
      ))}
    </svg>
  )
}

function Earpiece3D() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current!; let r: THREE.WebGLRenderer
    try { r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }) } catch { return }
    r.setPixelRatio(Math.min(devicePixelRatio, 2)); el.appendChild(r.domElement)
    const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(32, 1, 0.1, 20); cam.position.set(0, 0.25, 3.2); cam.lookAt(0, 0, 0)
    scene.add(new THREE.HemisphereLight('#cfe9ff', '#0a1220', 1.4)); const dl = new THREE.DirectionalLight('#ffffff', 2.2); dl.position.set(2, 3, 2); scene.add(dl)
    const shell = new THREE.MeshStandardMaterial({ color: '#d9e1ea', roughness: 0.35, metalness: 0.15 })
    const dark = new THREE.MeshStandardMaterial({ color: '#1b2533', roughness: 0.6 })
    const glow = new THREE.MeshBasicMaterial({ color: '#9ee9dc' })
    const g = new THREE.Group(); scene.add(g)
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.045, 18, 80, Math.PI * 1.25), shell); hook.rotation.z = Math.PI * 0.35; g.add(hook)
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.32, 10, 24), shell); body.position.set(0.18, -0.38, 0.02); body.rotation.z = 0.35; g.add(body)
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.03, 32), dark); pad.position.set(0.22, -0.36, 0.12); pad.rotation.x = Math.PI / 2; g.add(pad)
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.018, 12, 8), glow); led.position.set(0.12, -0.18, 0.13); g.add(led)
    const mic = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.012, 16), dark); mic.position.set(0.28, -0.6, 0.11); mic.rotation.x = Math.PI / 2; g.add(mic)
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.75, 0.756, 96), new THREE.MeshBasicMaterial({ color: '#5fe1ff', transparent: true, opacity: 0.25, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.y = -0.85; scene.add(ring)
    const size = () => { const w = el.clientWidth, h = el.clientHeight; r.setSize(w, h); cam.aspect = w / h; cam.updateProjectionMatrix() }
    size(); const ro = new ResizeObserver(size); ro.observe(el)
    let raf = 0; const t0 = performance.now()
    const loop = () => { const t = (performance.now() - t0) / 1000; g.rotation.y = t * 0.5; g.position.y = Math.sin(t) * 0.03; (led.material as THREE.MeshBasicMaterial).color.setHSL(0.47, 0.6, 0.55 + 0.2 * Math.sin(t * 3)); r.render(scene, cam); raf = requestAnimationFrame(loop) }
    loop()
    return () => { cancelAnimationFrame(raf); ro.disconnect(); r.dispose(); r.domElement.remove() }
  }, [])
  return <div ref={ref} style={{ height: 300, borderRadius: 12, background: 'radial-gradient(ellipse at 50% 45%, rgba(95,225,255,.10), transparent 65%)' }} />
}

export default function How() {
  const t = useT()
  const { data: st } = useLoad(api.station)
  const { data } = useLoad(api.graph)
  const arch = [[Ear, 'arch_ear', 'arch_ear_d'], [Cpu, 'arch_metis', 'arch_metis_d'], [LayoutDashboard, 'arch_console', 'arch_console_d'], [Globe2, 'arch_earth', 'arch_earth_d']] as const
  return (
    <Page title={t('how_title')} sub={t('how_sub')}>
      <Card title={t('arch_title')}>
        <div className="row" style={{ alignItems: 'stretch', gap: 10 }}>
          {arch.map(([Ic, k, d], i) => (
            <div key={k} className="row" style={{ flex: 1, gap: 10, alignItems: 'center' }}>
              <div style={{ flex: 1, padding: 16, borderRadius: 12, border: `1px solid ${i === 3 ? 'rgba(111,182,255,.35)' : 'rgba(158,233,220,.3)'}`, background: i === 3 ? 'var(--info-bg)' : 'rgba(158,233,220,.05)', height: '100%' }}>
                <Ic size={22} style={{ color: i === 3 ? 'var(--info)' : 'var(--metis)' }} />
                <div style={{ fontWeight: 600, margin: '8px 0 4px' }}>{t(k)}</div><div className="small muted">{t(d)}</div>
              </div>
              {i < 3 && <div style={{ textAlign: 'center', color: i === 2 ? 'var(--info)' : 'var(--metis)' }}><ArrowRight size={20} />{i === 2 && <div className="mono small">{fmtDelay(st?.comms.one_way_delay_s ?? 300)}</div>}</div>}
            </div>
          ))}
        </div>
        <div className="row small" style={{ marginTop: 12, gap: 14 }}><span className="tag ok">{t('offline_badge')}</span><span className="muted">{t('arch_note')}</span></div>
      </Card>
      <div className="grid" style={{ gridTemplateColumns: '1.6fr 1fr', marginTop: 18 }}>
        <Card title={t('graph_title')}><p className="small muted" style={{ marginTop: -4 }}>{t('graph_sub')}</p><KnowledgeGraph />
          <div className="row wrap small" style={{ gap: 14 }}>{Object.entries(TYPE_COL).filter(([k]) => (data?.nodes ?? []).some(n => n.type === k)).map(([k, c]) => <span key={k}><span style={{ color: c }}>●</span> <span className="muted">{t(`gt_${k}` as never)}</span></span>)}</div>
        </Card>
        <Card title={t('hw_title')} right={<span className="tag watch">{t('concept')}</span>}>
          <Earpiece3D />
          <p className="small" style={{ marginBottom: 0 }}>{t('hw_specs')}</p>
        </Card>
      </div>
    </Page>
  )
}
