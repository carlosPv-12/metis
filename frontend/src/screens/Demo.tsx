// Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
// Director mode: the 30-second story on autopilot. Everything on screen is a pure function of `t` (ms),
// so `#/demo?capture=1` + window.__metisDemo.seek(ms) gives an exact, repeatable frame.
import { demoBattery } from '../earpieces'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { useLocation } from 'react-router-dom'
import { Activity, AlertTriangle, Bell, Ear, Moon, Orbit, Package, ShieldAlert, Wind } from 'lucide-react'
import { localCrew, type CrewDetail } from '../api'
import { DEMO_LINES, DEMO_UI, useLang, useT, placeL } from '../i18n'
import { fmt, Shape, type Level } from '../ui'
import Body3D from '../Body3D'
const LENA_BATT = demoBattery('lena')
import { BP_POS, bodyLevels } from './Body'

const DURATION = 30000
const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x))
/** 0→1 fade in over [a, a+d], 1→0 fade out over [b-d, b]. */
const win = (t: number, a: number, b: number, d = 400) => clamp((t - a) / d) * clamp((b - t) / d)
const ease = (x: number) => 1 - Math.pow(1 - clamp(x), 3)
const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`

declare global { interface Window { __metisDemo?: { duration: number; seek: (ms: number) => void; play: () => void; pause: () => void; t: () => number; ready: boolean } } }

export default function Demo() {
  const loc = useLocation()
  const capture = new URLSearchParams(loc.search).get('capture') === '1'
  const [t, setT] = useState(() => clamp(Number(new URLSearchParams(loc.search).get('t') ?? 0) || 0, 0, DURATION))
  const [playing, setPlaying] = useState(!capture)
  const tRef = useRef(0); tRef.current = t
  const [scale, setScale] = useState(1)
  const tr = useT()

  const box = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    // capture mode: fixed 1:1 stage at the top-left, independent of how the headless browser reports its size
    const el = box.current!; const fit = () => setScale(capture ? 1 : Math.min(el.clientWidth / 1920, el.clientHeight / 1080) || 1)
    fit(); const ro = new ResizeObserver(fit); ro.observe(el); return () => ro.disconnect()
  }, [])
  // real-time playback (never runs in capture mode unless play() is called explicitly)
  useEffect(() => {
    if (!playing) return
    let raf = 0; const start = performance.now() - tRef.current
    const loop = () => { const nt = performance.now() - start; if (nt >= DURATION) { setT(DURATION); setPlaying(false); return } setT(nt); raf = requestAnimationFrame(loop) }
    raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf)
  }, [playing])
  useEffect(() => {
    const api = {
      duration: DURATION,
      seek: (ms: number) => { const v = clamp(ms, 0, DURATION); tRef.current = v; flushSync(() => { setPlaying(false); setT(v) }) },
      play: () => setPlaying(true), pause: () => setPlaying(false), t: () => tRef.current, ready: false,
    }
    window.__metisDemo = api
    document.fonts.ready.then(() => { api.ready = true })
    const key = (e: KeyboardEvent) => {
      if (e.code === 'Space') { e.preventDefault(); if (tRef.current >= DURATION) setT(0); setPlaying(p => !p) }
      if (e.code === 'ArrowRight') setT(v => clamp(v + 1000, 0, DURATION))
      if (e.code === 'ArrowLeft') setT(v => clamp(v - 1000, 0, DURATION))
    }
    window.addEventListener('keydown', key)
    return () => { window.removeEventListener('keydown', key); delete window.__metisDemo }
  }, [])

  return (
    <div ref={box} className={`demo ${capture ? 'capture' : ''}`}>
      <div style={capture ? { position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, overflow: 'hidden', background: 'var(--bg)' } : { position: 'absolute', left: '50%', top: '50%', width: 1920, height: 1080, transform: `translate(-50%,-50%) scale(${scale})`, transformOrigin: 'center', overflow: 'hidden', background: 'var(--bg)' }}>
        <Stage t={t} />
      </div>
      {!capture && (
        <div className="ctrl">
          <input type="range" min={0} max={DURATION} step={100} value={t} onChange={e => { setPlaying(false); setT(+e.target.value) }} style={{ width: 260 }} aria-label="timeline" />
          <span className="mono">{(t / 1000).toFixed(1)} s</span>
          <button className="btn" style={{ padding: '4px 10px' }} onClick={() => { if (t >= DURATION) setT(0); setPlaying(p => !p) }}>{playing ? '❚❚' : '▶'}</button>
          <span>{tr('demo_hint')}</span>
        </div>
      )}
    </div>
  )
}

function Stage({ t }: { t: number }) {
  const { lang } = useLang(); const tr = useT(); const U = DEMO_UI[lang]
  const lena = localCrew.crew.lena as CrewDetail
  const lenaHs = useMemo(() => { const lv = bodyLevels(lena); return (['heart', 'lungs', 'brain', 'ear'] as const).map(id => ({ id, pos: BP_POS[id], level: lv[id], label: '' })) }, [lena])
  const alarm = t >= 6000 && t < 25000
  const marcoHs = useMemo(() => [{ id: 'heart', pos: BP_POS.heart, level: 'alarm' as Level, label: '' }, { id: 'ear', pos: BP_POS.ear, level: 'ok' as Level, label: '' }], [])
  const clock = t < 6000 ? `07:02:${String(14 + Math.floor(t / 1000)).padStart(2, '0')}` : `07:04:${String(Math.floor((t - 6000) / 1000) + 2).padStart(2, '0')}`
  const cap = DEMO_LINES.find(l => t >= l.from && t < l.to)
  const capA = cap ? win(t, cap.from, cap.to, 180) : 0

  return (
    <>
      {/* HUD */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 84, display: 'flex', alignItems: 'center', gap: 36, padding: '0 56px', borderBottom: '1px solid var(--line)', fontSize: 20, opacity: 1 - ease((t - 25000) / 600), background: alarm ? `rgba(228,55,0,${0.08 + 0.06 * Math.max(0, Math.sin(t / 160))})` : 'transparent' }}>
        <div className="brand" style={{ fontSize: 26, width: 'auto' }}><span className="orb" style={{ width: 30, height: 30 }} />Metis</div>
        <span className="mono muted">{tr('mission_day')} <b style={{ color: 'var(--text)' }}>112</b>, {clock}</span>
        <div style={{ flex: 1 }} />
        {alarm && <span className="tag alarm" style={{ fontSize: 18, padding: '6px 14px' }}><AlertTriangle size={18} />{U.marco_alarm}</span>}
        <span className="pill ok" style={{ fontSize: 17, padding: '8px 16px' }}><span className="dot" style={{ background: 'var(--ok)', width: 9, height: 9 }} />{tr('offline_badge')}</span>
      </div>

      {/* Scene 1 — check-in */}
      <Scene a={win(t, -1000, 6300, 500)}>
        <div style={{ position: 'absolute', left: 80, top: 120, width: 1000 }}>
          <div className="small muted" style={{ fontSize: 20, letterSpacing: '.12em', textTransform: 'uppercase' }}>{U.checkin}, Lena</div>
          <div style={{ display: 'flex', gap: 22, marginTop: 26 }}>
            <div className="orb" style={{ flex: 'none', width: 64, height: 64, borderRadius: '50%', background: 'radial-gradient(circle at 35% 35%, #EAFE07, var(--metis) 30%, #0042A6 72%, #07173F)', boxShadow: `0 0 ${30 + 20 * Math.sin(t / 200)}px rgba(46,150,245,.5)` }} />
            <div style={{ fontSize: 38, lineHeight: 1.3, fontWeight: 400, minHeight: 150 }}>{typed(DEMO_LINES[0][lang], t, 0, 4400)}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20, marginTop: 30 }}>
            {([['resting_hr_bpm', <Activity key="a" size={20} />, 'u_bpm'], ['sleep_h', <Moon key="m" size={20} />, 'u_h'], ['co2_night_peak_mmhg', <Wind key="w" size={20} />, 'u_mmhg']] as const).map(([m, ic, u], i) => {
              const d = lena.days[lena.days.length - 1][m], b = lena.baseline[m]
              return (
                <div key={m} className="card" style={{ opacity: ease((t - 700 - i * 300) / 500), transform: `translateY(${(1 - ease((t - 700 - i * 300) / 500)) * 16}px)`, padding: '20px 22px' }}>
                  <div className="row muted" style={{ fontSize: 17 }}>{ic}{tr(`m_${m}`)}</div>
                  <div className="row" style={{ marginTop: 10, alignItems: 'baseline' }}><span className="metric-value s-watch" style={{ fontSize: 46 }}>{fmt(d, m === 'resting_hr_bpm' ? 0 : m === 'sleep_h' ? 1 : 2)}</span><span className="muted" style={{ fontSize: 18 }}>{tr(u)}</span><span className="s-watch" style={{ marginLeft: 'auto' }}><Shape level="watch" size={16} /></span></div>
                  <div className="dim" style={{ fontSize: 15 }}>{tr('your_band')} {fmt(b.band_low, m === 'co2_night_peak_mmhg' ? 1 : m === 'sleep_h' ? 1 : 0)}–{fmt(b.band_high, m === 'co2_night_peak_mmhg' ? 1 : m === 'sleep_h' ? 1 : 0)}</div>
                </div>
              )
            })}
          </div>
          <SleepCo2 days={lena.days.slice(-14)} p={ease((t - 1800) / 2800)} U={U} style={{ marginTop: 22, opacity: ease((t - 1600) / 500) }} />
        </div>
        <div style={{ position: 'absolute', right: 70, top: 110, width: 700, height: 860 }}>
          <Body3D hotspots={lenaHs} time={t} rotation={0.5 + t * 0.00035} height={860} />
          <div className="mono dim" style={{ position: 'absolute', top: 0, width: '100%', textAlign: 'center', fontSize: 16 }}>LENA, {tr('earpiece').toUpperCase()} {LENA_BATT}%</div>
        </div>
      </Scene>

      {/* Scene 2+3 — collapse and triage */}
      <Scene a={win(t, 6000, 19400, 350)}>
        <div style={{ position: 'absolute', left: 80, top: 140, width: 1080 }}>
          <div className="lvl rojo" style={{ display: 'flex', alignItems: 'center', gap: 22, padding: '22px 28px', transform: `scale(${1 + 0.03 * Math.max(0, 1 - (t - 6000) / 500)})`, transformOrigin: 'left center' }}>
            <AlertTriangle size={44} className="s-alarm" />
            <div><div style={{ fontSize: 34, fontWeight: 600 }}>Marco, {U.lab}</div><div className="s-alarm" style={{ fontSize: 22 }}><Ear size={18} style={{ verticalAlign: -2 }} /> {U.fall}</div></div>
            <div style={{ marginLeft: 'auto', textAlign: 'right', opacity: t >= 10000 ? 1 : 0 }}><div className="muted" style={{ fontSize: 16 }}>{tr('elapsed')}</div><div className="timer" style={{ fontSize: 44 }}>{mmss(Math.max(0, t - 10000) / 1000)}</div></div>
          </div>
          <div style={{ position: 'relative', marginTop: 34, height: 560 }}>
            <QCard a={win(t, 10000, 13700, 300)} q={U.q1} opts={[U.yes, U.no]} pick={t >= 12500 ? 1 : -1} step={1} />
            <QCard a={win(t, 13600, 16200, 300)} q={U.q2} opts={[U.yes2, U.no_diff]} pick={t >= 15100 ? 1 : -1} step={2} />
            <div style={{ position: 'absolute', inset: 0, opacity: win(t, 16100, 99999, 300) }}>
              <div className="lvl rojo" style={{ padding: '24px 30px' }}>
                <div style={{ fontSize: 18, textTransform: 'uppercase', letterSpacing: '.12em', fontWeight: 600 }} className="s-alarm">{tr('result')}: {tr('lvl_rojo')}</div>
                <div style={{ fontSize: 34, fontWeight: 600, lineHeight: 1.2, margin: '8px 0 10px' }}>{U.r_title}</div>
                <ol className="steps" style={{ fontSize: 20, lineHeight: 1.4 }}>{[U.r1, U.r2, U.r3, U.r4].map((s, i) => <li key={i} style={{ opacity: ease((t - 16400 - i * 350) / 350) }}>{s}</li>)}</ol>
              </div>
              <div className="row" style={{ marginTop: 22, gap: 16 }}>
                {[[Bell, tr('alert_crew'), 17300], [ShieldAlert, tr('alert_cmd'), 17800]].map(([Ic, l, at], i) => {
                  const on = t >= (at as number); const I2 = Ic as typeof Bell
                  return <div key={i} className={`btn big ${on ? 'danger' : ''}`} style={{ fontSize: 21, padding: '16px 22px' }}><I2 size={22} />{l as string}{on ? ' ✓' : ''}</div>
                })}
              </div>
            </div>
          </div>
        </div>
        <div style={{ position: 'absolute', right: 70, top: 110, width: 640, height: 860 }}>
          <Body3D hotspots={marcoHs} time={t} rotation={-0.25 + (t - 6000) * 0.0002} height={860} pulseId="heart" scanOn={false} />
          <div className="mono s-alarm" style={{ position: 'absolute', top: 0, width: '100%', textAlign: 'center', fontSize: 16 }}>MARCO, {tr('marco_role').toUpperCase()}</div>
        </div>
      </Scene>

      {/* Scene 4 — station console + Earth */}
      <Scene a={win(t, 19200, 25200, 400)}>
        <StationScene t={t} U={U} />
      </Scene>

      {/* Scene 5 — closing */}
      <Scene a={win(t, 25000, 99999, 700)}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
          <div style={{ width: 120, height: 120, borderRadius: '50%', background: 'radial-gradient(circle at 35% 35%, #EAFE07, var(--metis) 30%, #0042A6 72%, #07173F)', boxShadow: `0 0 ${70 + 30 * Math.sin(t / 400)}px rgba(46,150,245,.45)`, marginBottom: 48, transform: `scale(${0.85 + 0.15 * ease((t - 25000) / 900)})` }} />
          <div style={{ fontSize: 64, fontWeight: 600, letterSpacing: '-.015em', maxWidth: 1500, opacity: ease((t - 25300) / 700) }}>{tr('demo_close')}</div>
          <div className="muted" style={{ fontSize: 28, marginTop: 22, opacity: ease((t - 26000) / 700) }}>{tr('demo_close_sub')}</div>
          <div className="dim" style={{ fontSize: 18, marginTop: 60, opacity: ease((t - 26600) / 700) }}>{tr('demo_disclaimer')}. {U.team}</div>
        </div>
      </Scene>

      {cap && (
        <div className="cap" style={{ opacity: capA, fontSize: 30, bottom: 44 }}>
          <span className={`who ${cap.who === 'lena' ? 'lena' : ''}`}>{cap.who === 'lena' ? 'Lena' : 'Metis'}: </span>{cap[lang]}
        </div>
      )}
    </>
  )
}

function Scene({ a, children }: { a: number; children: ReactNode }) {
  return <div style={{ position: 'absolute', inset: 0, opacity: a, visibility: a <= 0.001 ? 'hidden' : 'visible' }}>{children}</div>
}
function typed(s: string, t: number, a: number, b: number) {
  const n = Math.round(s.length * clamp((t - a) / (b - a)))
  return <>{s.slice(0, n)}<span style={{ opacity: 0 }}>{s.slice(n)}</span></>
}

function QCard({ a, q, opts, pick, step }: { a: number; q: string; opts: string[]; pick: number; step: number }) {
  const tr = useT()
  return (
    <div className="card" style={{ position: 'absolute', inset: 0, bottom: 'auto', opacity: a, transform: `translateX(${(1 - a) * 30}px)`, padding: '30px 34px' }}>
      <div className="muted" style={{ fontSize: 18 }}>{tr('step')} {step}</div>
      <div style={{ fontSize: 42, fontWeight: 500, lineHeight: 1.25, margin: '10px 0 26px' }}>{q}</div>
      {opts.map((o, i) => (
        <div key={o} className="opt" style={{ fontSize: 28, padding: '22px 26px', borderColor: pick === i ? 'var(--metis)' : undefined, background: pick === i ? 'rgba(46,150,245,.12)' : undefined }}>{o}{pick === i && <span style={{ float: 'right' }} className="s-ok">●</span>}</div>
      ))}
    </div>
  )
}

function SleepCo2({ days, p, U, style }: { days: CrewDetail['days']; p: number; U: Record<string, string>; style?: CSSProperties }) {
  const W = 1000, H = 190, bw = W / days.length
  const ys = (v: number) => H - 30 - (v / 8) * (H - 50)
  const yc = (v: number) => H - 30 - (v / 4.5) * (H - 50)
  const line = days.map((d, i) => `${i ? 'L' : 'M'}${(i + 0.5) * bw},${yc(d.co2_night_peak_mmhg)}`).join(' ')
  return (
    <div className="card" style={{ padding: '18px 20px', ...style }}>
      <div className="row" style={{ gap: 22, fontSize: 16 }}><span className="muted">{U.last14}</span><span style={{ color: '#0960E1' }}>■ {U.sleep}</span><span className="s-watch">— {U.co2}</span><span className="dim" style={{ marginLeft: 'auto' }}>- - 3.0 mmHg</span></div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ marginTop: 6 }}>
        <defs><clipPath id="rev"><rect x="0" y="0" width={W * p} height={H} /></clipPath></defs>
        <line x1="0" x2={W} y1={yc(3)} y2={yc(3)} stroke="#B45309" strokeDasharray="6 5" strokeOpacity=".7" />
        <g clipPath="url(#rev)">
          {days.map((d, i) => <rect key={i} x={i * bw + 8} width={bw - 16} y={ys(d.sleep_h)} height={H - 30 - ys(d.sleep_h)} rx="4" fill={d.sleep_h < 5.5 ? '#0960E1' : 'rgba(46,150,245,.35)'} />)}
          <path d={line} fill="none" stroke="#B45309" strokeWidth="3" />
          {days.map((d, i) => d.co2_night_peak_mmhg > 3 && <circle key={i} cx={(i + 0.5) * bw} cy={yc(d.co2_night_peak_mmhg)} r="6" fill="#B45309" />)}
        </g>
        {days.map((d, i) => i % 2 === 1 && <text key={i} x={(i + 0.5) * bw} y={H - 6} fill="#4A5468" fontSize="14" textAnchor="middle" fontFamily="IBM Plex Mono">{d.mission_day}</text>)}
      </svg>
    </div>
  )
}

function StationScene({ t, U }: { t: number; U: Record<string, string> }) {
  const tr = useT()
  const crew = [['Lena', 'watch', 66, 'Lab'], ['Marco', 'alarm', 0, 'Lab'], ['Noor', 'ok', 74, 'Lab'], ['Kenji', 'ok', 71, 'Node']] as const
  const { lang } = useLang()
  const evs = [[19400, U.ev1, 'alarm'], [19900, U.ev2, 'watch'], [20500, U.ev4, 'ok'], [21000, U.ev3, 'info']] as const
  const delay = 300, sent = 21000
  const remain = Math.max(0, delay - Math.max(0, t - sent) / 1000)
  const prog = clamp((t - sent) / 4000) * 0.12 + clamp((t - sent) / 1000) * 0.03 // visual hint: packet leaves the habitat
  return (
    <div style={{ position: 'absolute', left: 80, right: 80, top: 130 }}>
      <div className="row" style={{ fontSize: 22, marginBottom: 20 }}><span className="muted" style={{ letterSpacing: '.12em', textTransform: 'uppercase', fontSize: 18 }}>{tr('station_title')}</span></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 20 }}>
        {crew.map(([n, l, hr, loc]) => (
          <div key={n} className={`crewcard ${l}`} style={{ padding: 22 }}>
            <div className="row between"><span style={{ fontSize: 30, fontWeight: 600 }}>{n}</span><span className={`tag ${l}`} style={{ fontSize: 16 }}><Shape level={l} />{tr(l === 'ok' ? 'st_nominal' : l === 'watch' ? 'st_watch' : 'st_alarm')}</span></div>
            <div className="muted" style={{ fontSize: 17 }}>{placeL(loc, lang)}</div>
            <div className="metric-value" style={{ fontSize: 34, marginTop: 12 }}>{n === 'Marco' ? <span className="s-alarm">{U.fall.split(',')[0]}</span> : <>{hr} <span className="muted" style={{ fontSize: 18 }}>{tr('u_bpm')}</span></>}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 20, marginTop: 20 }}>
        <div className="card" style={{ padding: 24, minHeight: 440 }}>
          <h3 style={{ fontSize: 16 }}>{tr('event_log')}</h3>
          <div className="log" style={{ fontSize: 20, maxHeight: 'none' }}>
            {evs.map(([at, txt, l]) => t >= at && (
              <div key={at} className="e" style={{ gridTemplateColumns: '120px 1fr', opacity: ease((t - at) / 300) }}><span className="dim">07:04:{String(Math.floor((at - 6000) / 1000) + 2).padStart(2, '0')}</span><span className={l === 'info' ? '' : `s-${l}`}>{txt}</span></div>
            ))}
          </div>
        </div>
        <div className="card" style={{ padding: 24, minHeight: 440 }}>
          <h3 style={{ fontSize: 16 }}><Orbit size={16} />{tr('comms')}: {tr('earth_delay')} {Math.floor(delay / 60)}:{String(delay % 60).padStart(2, '0')} {tr('min')}</h3>
          <div className="muted" style={{ fontSize: 16, marginTop: -4 }}>{tr('delay_scenario')}, {tr('delay_range').replace('{n}', '20')}</div>
          <svg viewBox="0 0 700 150" width="100%" style={{ marginTop: 6 }}>
            <line x1="60" x2="620" y1="75" y2="75" stroke="#D7DFEC" strokeWidth="2" strokeDasharray="3 7" />
            <circle cx="60" cy="75" r="22" fill="none" stroke="#0960E1" strokeWidth="2" /><circle cx="60" cy="75" r="8" fill="#0960E1" />
            <circle cx="620" cy="75" r="26" fill="#07173F" stroke="#0960E1" strokeWidth="2" />
            <text x="60" y="130" fill="#4A5468" fontSize="17" textAnchor="middle">{U.habitat}</text>
            <text x="690" y="130" fill="#4A5468" fontSize="17" textAnchor="end">{U.earth}</text>
            {t >= sent && <g transform={`translate(${60 + 560 * prog},75)`}><circle r="9" fill="#0960E1" /><circle r={14 + 6 * Math.sin(t / 200)} fill="none" stroke="#0960E1" strokeOpacity=".4" /></g>}
          </svg>
          <div className="row between" style={{ fontSize: 22, marginTop: 10 }}>
            <span><Package size={20} style={{ verticalAlign: -3 }} /> {tr('queued_packet')}</span>
            <span className="metric-value s-watch" style={{ fontSize: 30 }}>{t >= sent ? `${tr('arrives_in')} ${mmss(remain)}` : tr('none')}</span>
          </div>
          <div className="muted" style={{ fontSize: 17, marginTop: 18, opacity: ease((t - sent) / 400) }}>{tr('report_contents')}: {U.pkt}</div>
        </div>
      </div>
    </div>
  )
}
