// Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
// Always-on ear, fully hands-free, on every screen. No button: it starts listening when the app opens.
//   · «Metis» (alone or followed by a sentence) opens a CONVERSATION: from then on everything you say goes to
//     Metis, no need to repeat the word. It ends with «thanks Metis», «that's all», «finish», «gracias Metis»,
//     «eso es todo», «terminar»… or after a while in silence.
//   · An emergency needs no word at all (a collapse, chest pain): it goes straight to Talk, which opens the triage.
//   · People chatting nearby are ignored while no conversation is open.
// The backend decides (/api/voice/wake, fixed rule, no AI). Screens that listen on their own (triage questions)
// mark themselves busy and the ear steps aside meanwhile. Whatever is recorded while Metis speaks is dropped.
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AlertTriangle, Ear, EarOff, MessageCircle, Volume2 } from 'lucide-react'
import { api, NO_SERVER, type VitalsAlert } from './api'
import { isSpeaking, listenOnce, useSpeaker } from './hooks'
import { useLang, useT } from './i18n'
import { useCrew } from './ui'

type EarState = 'off' | 'waiting' | 'conversation' | 'hearing' | 'paused'
interface EarApi { on: boolean; state: EarState; heard: string | null; pending: string | null; warning: VitalsAlert | null
  toggle: () => void; takePending: () => string | null; setBusy: (who: string, busy: boolean) => void }

const EarCtx = createContext<EarApi | null>(null)
export const useEar = () => useContext(EarCtx)
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const CONV_IDLE_MS = 45000  // a conversation closes on its own after 45 s with nobody talking

export function EarProvider({ children }: { children: ReactNode }) {
  const { lang } = useLang(); const nav = useNavigate(); const loc = useLocation(); const { crewId } = useCrew()
  const sp = useSpeaker()
  // This screen is the earpiece of the crew member chosen in the header (Lena / Marco).
  const me = useRef(crewId)
  const myCheck = useRef<string | null>(null)   // set while Metis is waiting for MY answer to «are you okay?»
  const [on, setOn] = useState(!NO_SERVER)
  const [state, setState] = useState<EarState>('off')
  const [heard, setHeard] = useState<string | null>(null)
  const [pending, setPending] = useState<string | null>(null)
  const busy = useRef(new Set<string>())
  const langRef = useRef(lang); const pathRef = useRef(loc.pathname)
  useEffect(() => { langRef.current = lang; pathRef.current = loc.pathname; me.current = crewId }, [lang, loc.pathname, crewId])
  // Hidden browser tab: it stops listening (Chrome throttles it anyway) so only the tab you are looking at has the mic.
  const paused = () => busy.current.size > 0 || pathRef.current.startsWith('/demo') || document.hidden
  const conv = useRef(0)                  // > now while a conversation is open (shared with the vitals watcher)
  const [warning, setWarning] = useState<VitalsAlert | null>(null)

  const deliver = (text: string) => {
    setPending(text)
    if (!pathRef.current.startsWith('/talk')) nav('/talk')
  }

  useEffect(() => {
    if (!on) { setState('off'); return }
    const ac = new AbortController()
    ;(async () => {
      const inConv = () => Date.now() < conv.current
      while (!ac.signal.aborted) {
        if (paused() || isSpeaking()) {
          setState(paused() ? 'paused' : inConv() ? 'conversation' : 'waiting')
          if (inConv()) conv.current = Date.now() + CONV_IDLE_MS   // Metis talking or thinking does not count as silence
          await sleep(250); continue
        }
        setState(inConv() ? 'conversation' : 'waiting')
        const blob = await listenOnce({ signal: ac.signal, waitMs: inConv() ? Math.max(1000, conv.current - Date.now()) : 30000, maxMs: 15000,
          silenceMs: myCheck.current ? 700 : 1400,     // «are you okay?» expects a short answer
          discardIf: () => isSpeaking() || paused() })
        if (ac.signal.aborted) return
        if (!blob) continue
        const wasConv = inConv()
        setState('hearing')
        const l = langRef.current
        const r = await api.stt(blob, l, myCheck.current ? 'Yes, I’m fine. No. Help, alert the crew.' : undefined)
        if (ac.signal.aborted) return
        if (!r?.text) continue
        if (myCheck.current) {                 // Metis asked me «are you okay?»: this is my answer (no «Metis» needed)
          const c = await api.vitalsCheckin(me.current, r.text).catch(() => null)
          if (ac.signal.aborted) return
          if (c && c.state !== 'none') {
            setHeard(r.text)
            if (c.answer) myCheck.current = null
            conv.current = Date.now() + CONV_IDLE_MS
            await sp.speak((l === 'es' ? c.say_es : c.say_en) ?? '', l)
            continue
          }
          myCheck.current = null
        }
        const w = await api.wake(r.text, l).catch(() => null)
        if (ac.signal.aborted || !w) continue
        if (w.emergency) { setHeard(r.text); conv.current = 0; deliver(w.wake && w.command ? w.command : w.heard); continue }
        if (wasConv) {
          setHeard(r.text)
          if (w.end) {
            conv.current = 0
            await sp.speak(l === 'es' ? 'Cuando quieras. Di «Metis» si me necesitas.' : 'Anytime. Just say “Metis” if you need me.', l)
            continue
          }
          conv.current = Date.now() + CONV_IDLE_MS
          if (w.wake && !w.command) { await sp.speak(l === 'es' ? 'Dime.' : 'I’m listening.', l); continue }  // «Metis» again, alone
          deliver(w.wake ? w.command : w.heard)
          continue
        }
        if (w.wake) {
          setHeard(r.text); conv.current = Date.now() + CONV_IDLE_MS
          if (w.command) deliver(w.command)
          else { if (!pathRef.current.startsWith('/talk')) nav('/talk'); await sp.speak(l === 'es' ? 'Dime.' : 'I’m listening.', l) }
        }
        // no conversation and no «Metis»: people chatting nearby, ignored
      }
    })()
    return () => ac.abort()
  }, [on]) // eslint-disable-line react-hooks/exhaustive-deps

  // Vitals watcher, with the protocol Carlos asked for (14-nov):
  //   1. The AFFECTED person hears it first, on their own earpiece: what is happening, what to do, «are you okay?».
  //      Their spoken answer goes to the backend (no «Metis» needed).
  //   2. Only if they don't answer in time, ask for help or lose their pulse, the backend escalates. Then every OTHER
  //      earpiece says what is going on and what to do, and opens the crewmate checklist. Nobody is asked anything.
  // Switching Lena / Marco in the header switches whose earpiece this is.
  useEffect(() => {
    if (NO_SERVER) return
    const spoken = new Set<string>(); const queue: { text_en: string; text_es: string; go?: string; mine?: string }[] = []
    let alive = true, talking = false
    const tick = async () => {
      const v = await api.vitals().catch(() => null)
      if (!alive || !v) return
      const rank = { watch: 1, warning: 2, alarm: 3 } as const
      const checks = v.checks ?? [], alerts = v.alerts ?? []   // an older backend has no checks: don't crash
      setWarning(alerts.length ? [...alerts].sort((x, y) => (rank[y.level] ?? 0) - (rank[x.level] ?? 0))[0] : null)
      const open = new Set(checks.map(c => c.crew_id))
      for (const k of [...spoken]) if (!open.has(k.split(':')[0])) spoken.delete(k)       // back to normal: re-arm
      if (myCheck.current && !checks.some(c => c.crew_id === myCheck.current && c.state === 'asking')) myCheck.current = null
      for (const c of checks) {
        const mine = c.crew_id === me.current
        if (c.state === 'asking' && mine) {
          const k = `${c.crew_id}:ask:${c.level}`
          if (!spoken.has(k)) { spoken.add(k); queue.push({ text_en: c.advice_en, text_es: c.advice_es, mine: c.crew_id }) }
        }
        if (c.state === 'escalated' && c.escalated_at && v.now - c.escalated_at < 300) {
          const k = `${c.crew_id}:esc:${c.escalated_at}`
          if (spoken.has(k)) continue
          spoken.add(k)
          if (mine) { if (c.reason !== 'no_pulse') queue.push({ text_en: 'I’ve alerted the crew and the medical officer. Stay where you are, help is on the way.', text_es: 'He avisado a la tripulación y al oficial médico. Quédate donde estás, van a ayudarte.' }) }
          else queue.push({ text_en: c.instructions_en ?? '', text_es: c.instructions_es ?? '', go: `/triage?flow=companion_collapse&patient=${c.crew_id}` })
        }
      }
      if (talking || !queue.length || isSpeaking()) return
      const item = queue.shift()!; talking = true
      const l = langRef.current
      // Queue the warning FIRST, then open the checklist: its first question waits its turn in the shared voice queue.
      const said = sp.speak(l === 'es' ? item.text_es : item.text_en, l, { dedupe: true })
      if (item.go && !document.hidden && !pathRef.current.startsWith('/triage')) nav(item.go)   // only the tab you are looking at
      await said
      if (item.mine) myCheck.current = item.mine            // the next thing I say is my answer
      conv.current = Date.now() + CONV_IDLE_MS
      talking = false
    }
    tick(); const id = setInterval(tick, 2500)
    return () => { alive = false; clearInterval(id) }
  }, [crewId]) // eslint-disable-line react-hooks/exhaustive-deps

  const ear: EarApi = {
    on, state, heard, pending, warning,
    toggle: () => { if (!NO_SERVER) { setOn(o => !o); setHeard(null) } },
    takePending: () => { const p = pending; setPending(null); return p },
    setBusy: (who, b) => { if (b) busy.current.add(who); else busy.current.delete(who) },
  }
  return <EarCtx.Provider value={ear}>{children}</EarCtx.Provider>
}

/** Header status. Click = mute / unmute the ear. Until the page gets one click, the browser won't let Metis speak. */
export function EarSwitch() {
  const ear = useEar(); const t = useT()
  const [canSpeak, setCanSpeak] = useState(() => !!(navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation?.hasBeenActive)
  useEffect(() => {
    if (canSpeak) return
    const ok = () => setCanSpeak(true)
    window.addEventListener('pointerdown', ok, { once: true }); window.addEventListener('keydown', ok, { once: true })
    return () => { window.removeEventListener('pointerdown', ok); window.removeEventListener('keydown', ok) }
  }, [canSpeak])
  if (!ear || NO_SERVER) return null
  const label = !ear.on ? t('ear_off') : ear.state === 'conversation' ? t('ear_conv') : ear.state === 'hearing' ? t('transcribing')
    : ear.state === 'paused' ? t('ear_paused') : t('ear_waiting')
  const live = ear.state === 'conversation' || ear.state === 'hearing'
  return (
    <>
      {!canSpeak && ear.on && <span className="tag sim" title={t('audio_click_tip')}><Volume2 size={13} style={{ verticalAlign: -2 }} /> {t('audio_click')}</span>}
      <button className={`pill ${ear.on ? 'ok' : ''}`} onClick={ear.toggle} style={{ cursor: 'pointer' }}
        title={`${ear.on ? t('ear_mute_tip') : t('ear_unmute_tip')}${ear.heard ? `. ${t('heard')}: «${ear.heard}»` : ''}`}>
        {ear.on && <span className={`dot ${live ? 'pulse' : ''}`} style={{ background: live ? 'var(--metis)' : 'var(--ok)' }} />}
        {!ear.on ? <EarOff size={14} /> : ear.state === 'conversation' ? <MessageCircle size={14} /> : <Ear size={14} />}{label}
      </button>
      {ear.on && ear.heard && <span className="small dim" style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={ear.heard}>«{ear.heard}»</span>}
    </>
  )
}

/** Banner on top of every screen while someone's vitals are off their baseline. Click -> station console. */
export function VitalsBanner() {
  const ear = useEar(); const t = useT(); const { lang } = useLang(); const nav = useNavigate()
  const w = ear?.warning
  if (!w) return null
  const cls = w.level === 'alarm' ? 'rojo' : w.level === 'warning' ? 'naranja' : 'amarillo'
  return (
    <button className={`lvl ${cls}`} onClick={() => nav('/station')}
      style={{ display: 'flex', gap: 10, alignItems: 'center', width: '100%', textAlign: 'left', marginBottom: 14, cursor: 'pointer', padding: '10px 14px' }}>
      <AlertTriangle size={18} /><b style={{ whiteSpace: 'nowrap' }}>{t('early_warning')}</b><span>{lang === 'es' ? w.text_es : w.text_en}</span>
    </button>
  )
}
