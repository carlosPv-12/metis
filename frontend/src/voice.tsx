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
import { api, NO_SERVER, type StationEvent, type VitalsAlert } from './api'
import { isLeader, isSpeaking, listenOnce, useSpeaker } from './hooks'
import { useLang, useT } from './i18n'
import { useCrew } from './ui'

type EarState = 'off' | 'waiting' | 'conversation' | 'hearing' | 'paused'
export interface GroundMsg { id: string | number; text_en: string; text_es: string }
export interface SelfNotice { state: 'asking' | 'escalated'; seconds_left: number; text_en: string; text_es: string }
/** One line of the conversation with Metis. It lives here (not in Talk) so it survives leaving the Talk screen. */
export interface ChatMsg { who: 'me' | 'metis'; text: string; meta?: string; escalated?: boolean; flow?: string }
interface EarApi { on: boolean; state: EarState; heard: string | null; warning: VitalsAlert | null
  ignored: boolean; selfNotice: SelfNotice | null
  /** Messages from ground that have arrived on board: shown on screen until dismissed (not only spoken). */
  messages: GroundMsg[]; dismissMessage: (id: string | number) => void
  /** The conversation with Metis, on any screen: Talk only shows it. */
  chat: ChatMsg[]; thinking: boolean; opening: boolean; speaking: boolean
  ask: (text: string, meta?: string) => Promise<void>; stopVoice: () => void
  toggle: () => void; setBusy: (who: string, busy: boolean) => void }

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
  // A crewmate's emergency is going on: what I say goes to their checklist, never to small talk in the chat.
  const emergency = useRef<{ crew_id: string; go: string } | null>(null)
  const [on, setOn] = useState(!NO_SERVER)
  const [state, setState] = useState<EarState>('off')
  const [heard, setHeard] = useState<string | null>(null)
  const busy = useRef(new Set<string>())
  const t = useT()
  const tRef = useRef(t); tRef.current = t
  // The conversation with Metis. Kept here, above every screen, so leaving Talk while Metis thinks or speaks
  // does not cut the answer: the reply still arrives, is spoken, and is waiting in Talk when you come back.
  const [chat, setChat] = useState<ChatMsg[]>([])
  const chatRef = useRef<ChatMsg[]>([])
  const pushChat = (m: ChatMsg) => { chatRef.current = [...chatRef.current, m]; setChat(chatRef.current) }
  const [thinking, setThinking] = useState(false)
  const [opening, setOpening] = useState(false)
  const langRef = useRef(lang); const pathRef = useRef(loc.pathname)
  useEffect(() => { langRef.current = lang; pathRef.current = loc.pathname; me.current = crewId }, [lang, loc.pathname, crewId])
  // With several tabs open only the one you used last listens (see isLeader in hooks.ts).
  // Ground (flight surgeon / mission control) has no Metis: only notifications on screen. No listening there.
  const onGround = () => pathRef.current.startsWith('/ground')
  const paused = () => busy.current.size > 0 || pathRef.current.startsWith('/demo') || onGround() || !isLeader()
  const conv = useRef(0)                  // > now while a conversation is open (shared with the vitals watcher)
  const [warning, setWarning] = useState<VitalsAlert | null>(null)
  const [ignored, setIgnored] = useState(false)          // last thing heard was dropped (no «Metis», no conversation)
  const [selfNotice, setSelfNotice] = useState<SelfNotice | null>(null)
  const [messages, setMessages] = useState<GroundMsg[]>([])
  // Switching who you are (Lena, Kenji…) = another earpiece: forget the previous person's conversation, pending
  // question and emergency, and say whose earpiece this is now, so it is always clear who Metis is talking to.
  const firstCrew = useRef(true)
  useEffect(() => {
    if (firstCrew.current) { firstCrew.current = false; return }
    myCheck.current = null; emergency.current = null; conv.current = 0
    chatRef.current = []; setChat([]); setOpening(false)
    setHeard(null); setIgnored(false); setSelfNotice(null); setMessages([])
    sp.stop()
    const name = crewId.charAt(0).toUpperCase() + crewId.slice(1)
    sp.speak(langRef.current === 'es' ? `Ahora soy el auricular de ${name}.` : `This is now ${name}'s earpiece.`, langRef.current)
  }, [crewId]) // eslint-disable-line react-hooks/exhaustive-deps

  /** Ask Metis (typed, hold-to-talk or heard by the ear). Works on any screen: the answer is spoken from here. */
  const ask = async (text: string, meta?: string) => {
    if (!text.trim()) return
    const l = langRef.current; const T = tRef.current
    const hist = chatRef.current.map(m => ({ role: m.who === 'me' ? 'user' : 'assistant', content: m.text }))
    pushChat({ who: 'me', text, meta })
    busy.current.add('chat'); setThinking(true)   // the ear steps aside while Metis thinks (no double hearing)
    let r: Awaited<ReturnType<typeof api.chat>>
    try { r = await api.chat(me.current, text, l, hist) }
    finally { busy.current.delete('chat'); setThinking(false) }
    const src = r.source === 'llm' || r.source?.startsWith?.('llm') ? T('src_llm') : T('src_fallback')
    const flow = (r as { suggest_flow?: string }).suggest_flow
    const patient = (r as { patient?: string }).patient   // whose emergency (sent by the backend during an emergency)
    pushChat({ who: 'metis', text: r.text, meta: `${src}${r.latency_ms ? `, ${(r.latency_ms / 1000).toFixed(1)} s` : ''}`, escalated: r.safety === 'escalated', flow })
    // Emergency: no time to tap anything. Say it and open the triage straight away (hands-free there too).
    if (r.safety === 'escalated' && flow) {
      conv.current = 0; setOpening(true)
      await sp.speak(r.text, l)
      setOpening(false); nav('/triage?flow=' + flow + (patient ? '&patient=' + patient : ''))
      return
    }
    await sp.speak(r.text, l)
  }

  /** What the ear heard goes to Metis. openTalk: show the Talk screen (only when a conversation starts or for an
   *  emergency). Inside an open conversation Metis answers wherever you are: it never drags you back to Talk. */
  const deliver = (text: string, openTalk: boolean) => {
    if (openTalk && !pathRef.current.startsWith('/talk')) nav('/talk')
    void ask(text, tRef.current('heard')).catch(() => { /* chat has its own fallback; never break the ear loop */ })
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
        // Emergency mode: a crewmate's emergency is open. Status questions still go to Metis; anything else
        // takes you back to the checklist (where the triage listens), instead of turning into chat.
        if (emergency.current && !/\b(how|status|crew|queue|vitals)\b/i.test(r.text)) {
          setHeard(r.text)
          if (isLeader() && !pathRef.current.startsWith('/triage')) nav(emergency.current.go)
          continue
        }
        const w = await api.wake(r.text, l).catch(() => null)
        if (ac.signal.aborted || !w) continue
        setHeard(r.text); setIgnored(false)
        if (w.emergency) { conv.current = 0; deliver(w.wake && w.command ? w.command : w.heard, true); continue }
        if (wasConv) {
          setHeard(r.text)
          if (w.end) {
            conv.current = 0
            await sp.speak(l === 'es' ? 'Cuando quieras. Di «Metis» si me necesitas.' : 'Anytime. Just say “Metis” if you need me.', l)
            continue
          }
          conv.current = Date.now() + CONV_IDLE_MS
          if (w.wake && !w.command) { await sp.speak(l === 'es' ? 'Dime.' : 'I’m listening.', l); continue }  // «Metis» again, alone
          deliver(w.wake ? w.command : w.heard, false)
          continue
        }
        if (w.wake) {
          setHeard(r.text); conv.current = Date.now() + CONV_IDLE_MS
          if (w.command) deliver(w.command, true)
          else { if (!pathRef.current.startsWith('/talk')) nav('/talk'); await sp.speak(l === 'es' ? 'Dime.' : 'I’m listening.', l) }
        }
        else setIgnored(true)   // no conversation and no «Metis»: people chatting nearby, ignored (shown as such)
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
      const v = await api.vitals(me.current).catch(() => null)   // as this earpiece's owner: roles apply
      if (!alive || !v) return
      const rank = { watch: 1, warning: 2, alarm: 3 } as const
      const checks = v.checks ?? [], alerts = v.alerts ?? []   // an older backend has no checks: don't crash
      setWarning(alerts.length ? [...alerts].sort((x, y) => (rank[y.level] ?? 0) - (rank[x.level] ?? 0))[0] : null)
      const open = new Set(checks.map(c => c.crew_id))
      const esc = checks.filter(c => c.state === 'escalated' && c.crew_id !== me.current && c.escalated_at && v.now - c.escalated_at < 300)
        .sort((a, b) => (b.escalated_at ?? 0) - (a.escalated_at ?? 0))[0]
      emergency.current = esc ? { crew_id: esc.crew_id, go: `/triage?flow=companion_collapse&patient=${esc.crew_id}` } : null
      for (const k of [...spoken]) if (!k.startsWith('msg:') && !open.has(k.split(':')[0])) spoken.delete(k)       // back to normal: re-arm
      const mineCheck = checks.find(c => c.crew_id === me.current)
      setSelfNotice(!mineCheck ? null : mineCheck.state === 'asking'
        ? { state: 'asking', seconds_left: mineCheck.seconds_left,
            text_en: `Are you okay? Answer out loud. If you don't answer, Metis alerts the crew in ${mineCheck.seconds_left} s.`,
            text_es: `¿Estás bien? Responde en voz alta. Si no contestas, Metis avisa a la tripulación en ${mineCheck.seconds_left} s.` }
        : mineCheck.reason === 'no_pulse' ? null
        : { state: 'escalated', seconds_left: 0, text_en: 'Metis alerted the crew and the medical officer. Help is on the way.',
            text_es: 'Metis ha avisado a la tripulación y al oficial médico. Van a ayudarte.' })
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
          if (mine) { if (c.reason !== 'no_pulse') queue.push({ text_en: 'I’ve alerted the crew and the medical officer, and sent a message to the flight surgeon on Earth. Stay where you are, help is on the way.', text_es: 'He avisado a la tripulación y al oficial médico, y he enviado un mensaje al cirujano de vuelo, en Tierra. Quédate donde estás, van a ayudarte.' }) }
          else queue.push({ text_en: c.instructions_en ?? '', text_es: c.instructions_es ?? '', go: `/triage?flow=companion_collapse&patient=${c.crew_id}` })
        }
      }
      // Messages from the flight surgeon that have just ARRIVED on board (with the link delay): Metis reads them
      // out on the earpieces allowed to see them (the backend filters by role; a summary-only copy has no payload).
      const evs = await api.eventsAs(me.current).catch(() => [] as StationEvent[])
      if (!alive) return
      for (const e of evs as (StationEvent & { status?: string; arrives_ts?: string })[]) {
        if ((e.type !== 'surgeon_reply' && e.type !== 'ground_message') || e.status !== 'delivered' || !e.payload) continue
        const k = `msg:${e.id}`
        if (spoken.has(k) || Date.parse(e.arrives_ts ?? '') < Date.now() - 120000) continue
        spoken.add(k)
        setMessages(m => [{ id: e.id ?? k, text_en: e.text_en ?? '', text_es: e.text_es ?? '' }, ...m.filter(x => x.id !== e.id)].slice(0, 3))
        if (!onGround()) queue.push({ text_en: e.text_en ?? '', text_es: e.text_es ?? '' })
      }
      if (onGround()) { queue.length = 0; return }          // Ground: notifications only, Metis does not speak there
      if (talking || !queue.length || isSpeaking()) return
      const item = queue.shift()!; talking = true
      const l = langRef.current
      // Queue the warning FIRST, then open the checklist: its first question waits its turn in the shared voice queue.
      const said = sp.speak(l === 'es' ? item.text_es : item.text_en, l, { dedupe: true })
      if (item.go && isLeader() && !pathRef.current.startsWith('/triage')) nav(item.go)   // only the tab you used last
      if (item.go) console.info('[metis] emergency →', item.go, isLeader() ? '(opening)' : '(another tab handles it)')
      await said
      if (item.mine) { myCheck.current = item.mine; conv.current = Date.now() + CONV_IDLE_MS }   // my answer comes next
      else if (item.go) conv.current = 0   // a crewmate's emergency: the checklist listens now, not the chat
      talking = false
    }
    tick(); const id = setInterval(tick, 2500)
    return () => { alive = false; clearInterval(id) }
  }, [crewId]) // eslint-disable-line react-hooks/exhaustive-deps

  const ear: EarApi = {
    on, state, heard, warning, ignored, selfNotice, messages,
    dismissMessage: id => setMessages(m => m.filter(x => x.id !== id)),
    chat, thinking, opening, speaking: sp.speaking, ask, stopVoice: sp.stop,
    toggle: () => { if (!NO_SERVER) { setOn(o => !o); setHeard(null) } },
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
      {ear.on && ear.heard && <span className="small dim" style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        title={ear.heard}>«{ear.heard}»{ear.ignored && <b>, {t('ear_ignored')}</b>}</span>}
    </>
  )
}

/** Banner on top of every screen while someone's vitals are off their baseline. Click -> station console.
 *  Messages from ground are not shown here as a banner (they are read aloud by Metis and live in the Ground thread). */
export function VitalsBanner() {
  return <VitalsWarning />
}

function VitalsWarning() {
  const ear = useEar(); const t = useT(); const { lang } = useLang(); const nav = useNavigate()
  const me = ear?.selfNotice
  if (me) return (   // about ME: what Metis is doing about it, and the countdown before it alerts the crew
    <div className={`lvl ${me.state === 'asking' ? 'amarillo' : 'naranja'}`} role="status"
      style={{ display: 'flex', gap: 10, alignItems: 'center', width: '100%', marginBottom: 14, padding: '10px 14px' }}>
      <AlertTriangle size={18} /><b style={{ whiteSpace: 'nowrap' }}>{me.state === 'asking' ? t('heads_up') : t('crew_alerted')}</b>
      <span>{lang === 'es' ? me.text_es : me.text_en}</span>
    </div>)
  const w = ear?.warning
  if (!w) return null
  const cls = w.level === 'alarm' ? 'rojo' : w.level === 'warning' ? 'naranja' : 'amarillo'
  return (
    <button className={`lvl ${cls}`} onClick={() => nav('/station')}
      style={{ display: 'flex', gap: 10, alignItems: 'center', width: '100%', textAlign: 'left', marginBottom: 14, cursor: 'pointer', padding: '10px 14px' }}>
      <AlertTriangle size={18} /><b style={{ whiteSpace: 'nowrap' }}>{w.level === 'alarm' ? t('emergency_title') : w.level === 'warning' ? t('early_warning') : t('heads_up')}</b><span>{lang === 'es' ? w.text_es : w.text_en}</span>
    </button>
  )
}
