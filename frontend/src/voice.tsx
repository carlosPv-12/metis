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
import { Ear, EarOff, MessageCircle, Volume2 } from 'lucide-react'
import { api, NO_SERVER } from './api'
import { isSpeaking, listenOnce, useSpeaker } from './hooks'
import { useLang, useT } from './i18n'

type EarState = 'off' | 'waiting' | 'conversation' | 'hearing' | 'paused'
interface EarApi { on: boolean; state: EarState; heard: string | null; pending: string | null
  toggle: () => void; takePending: () => string | null; setBusy: (who: string, busy: boolean) => void }

const EarCtx = createContext<EarApi | null>(null)
export const useEar = () => useContext(EarCtx)
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const CONV_IDLE_MS = 45000  // a conversation closes on its own after 45 s with nobody talking

export function EarProvider({ children }: { children: ReactNode }) {
  const { lang } = useLang(); const nav = useNavigate(); const loc = useLocation()
  const sp = useSpeaker()
  const [on, setOn] = useState(!NO_SERVER)
  const [state, setState] = useState<EarState>('off')
  const [heard, setHeard] = useState<string | null>(null)
  const [pending, setPending] = useState<string | null>(null)
  const busy = useRef(new Set<string>())
  const langRef = useRef(lang); const pathRef = useRef(loc.pathname)
  useEffect(() => { langRef.current = lang; pathRef.current = loc.pathname }, [lang, loc.pathname])
  const paused = () => busy.current.size > 0 || pathRef.current.startsWith('/demo')

  const deliver = (text: string) => {
    setPending(text)
    if (!pathRef.current.startsWith('/talk')) nav('/talk')
  }

  useEffect(() => {
    if (!on) { setState('off'); return }
    const ac = new AbortController()
    ;(async () => {
      let convUntil = 0                       // > now while a conversation is open
      const inConv = () => Date.now() < convUntil
      while (!ac.signal.aborted) {
        if (paused() || isSpeaking()) {
          setState(paused() ? 'paused' : inConv() ? 'conversation' : 'waiting')
          if (inConv()) convUntil = Date.now() + CONV_IDLE_MS   // Metis talking or thinking does not count as silence
          await sleep(250); continue
        }
        setState(inConv() ? 'conversation' : 'waiting')
        const blob = await listenOnce({ signal: ac.signal, waitMs: inConv() ? Math.max(1000, convUntil - Date.now()) : 30000, maxMs: 15000,
          discardIf: () => isSpeaking() || paused() })
        if (ac.signal.aborted) return
        if (!blob) continue
        const conv = inConv()
        setState('hearing')
        const l = langRef.current
        const r = await api.stt(blob, l)
        if (ac.signal.aborted) return
        if (!r?.text) continue
        const w = await api.wake(r.text, l).catch(() => null)
        if (ac.signal.aborted || !w) continue
        if (w.emergency) { setHeard(r.text); convUntil = 0; deliver(w.wake && w.command ? w.command : w.heard); continue }
        if (conv) {
          setHeard(r.text)
          if (w.end) {
            convUntil = 0
            await sp.speak(l === 'es' ? 'Cuando quieras. Di «Metis» si me necesitas.' : 'Anytime. Just say “Metis” if you need me.', l)
            continue
          }
          convUntil = Date.now() + CONV_IDLE_MS
          if (w.wake && !w.command) { await sp.speak(l === 'es' ? 'Dime.' : 'I’m listening.', l); continue }  // «Metis» again, alone
          deliver(w.wake ? w.command : w.heard)
          continue
        }
        if (w.wake) {
          setHeard(r.text); convUntil = Date.now() + CONV_IDLE_MS
          if (w.command) deliver(w.command)
          else { if (!pathRef.current.startsWith('/talk')) nav('/talk'); await sp.speak(l === 'es' ? 'Dime.' : 'I’m listening.', l) }
        }
        // no conversation and no «Metis»: people chatting nearby, ignored
      }
    })()
    return () => ac.abort()
  }, [on]) // eslint-disable-line react-hooks/exhaustive-deps

  const ear: EarApi = {
    on, state, heard, pending,
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
        title={`${ear.on ? t('ear_mute_tip') : t('ear_unmute_tip')}${ear.heard ? ` · ${t('heard')}: «${ear.heard}»` : ''}`}>
        {ear.on && <span className={`dot ${live ? 'pulse' : ''}`} style={{ background: live ? 'var(--metis)' : 'var(--ok)' }} />}
        {!ear.on ? <EarOff size={14} /> : ear.state === 'conversation' ? <MessageCircle size={14} /> : <Ear size={14} />}{label}
      </button>
    </>
  )
}
