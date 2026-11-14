// Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
import { useEffect, useRef, useState } from 'react'
import { api } from './api'
import type { Lang } from './i18n'

/** Load once (or again when deps change). */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    fn().then(d => { if (alive) setData(d) }).catch(e => { if (alive) setError(String(e)) })
    return () => { alive = false }
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps
  return { data, error }
}

/** Poll every `ms` milliseconds. */
export function usePoll<T>(fn: () => Promise<T>, ms: number, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  useEffect(() => {
    let alive = true
    const tick = () => fn().then(d => { if (alive) setData(d) }).catch(() => {})
    tick(); const id = setInterval(tick, ms)
    return () => { alive = false; clearInterval(id) }
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps
  return data
}

// Who is speaking right now (any screen). The always-on listener ignores what it hears meanwhile:
// otherwise it would hear Metis's own voice through the speakers.
const speakers = new Set<object>()
export const isSpeaking = () => speakers.size > 0

// ONE voice for the whole app: every screen shares this queue, so two messages never play on top of each other
// (e.g. the emergency instructions and the first triage question). Each phrase waits for the previous one.
// The queue lives on `window` so a hot reload (Vite) cannot leave a second, old queue playing at the same time.
const W = window as unknown as { __metisVoiceQueue?: Promise<void> }
W.__metisVoiceQueue ??= Promise.resolve()

// Across browser TABS too: a Web Lock lets only one tab speak at a time, and a proactive warning that another tab
// (or an old copy of this one) already said in the last 20 s is not said again. Two tabs open used to say the same
// emergency at the same time.
type LockOpts = { signal?: AbortSignal }
const withVoiceLock = (fn: () => Promise<void>) => {
  const l = (navigator as unknown as { locks?: { request: (n: string, o: LockOpts, cb: () => Promise<void>) => Promise<void> } }).locks
  if (!l?.request) return fn()
  // Never wait more than 5 s for another tab's turn: if its lock got stuck, speak anyway rather than stay silent.
  return l.request('metis-voice', { signal: AbortSignal.timeout(5000) }, fn).catch(() => fn())
}
const DEDUPE_MS = 20000
function alreadySaid(text: string): boolean {
  try {
    const now = Date.now()
    const said = JSON.parse(localStorage.getItem('metis.said') ?? '{}') as Record<string, number>
    for (const k of Object.keys(said)) if (now - said[k] > DEDUPE_MS) delete said[k]
    const dup = said[text] != null
    if (!dup) said[text] = now
    localStorage.setItem('metis.said', JSON.stringify(said))
    return dup
  } catch { return false }
}

/** Speak text: local TTS endpoint first, browser speech synthesis as fallback.
 *  speak() waits its turn in the shared queue and resolves when the phrase has finished (or was stopped),
 *  so hands-free mode can start listening right after. stop() only cancels this screen's phrase. */
export function useSpeaker() {
  const [speaking, setSpeaking] = useState(false)
  const me = useRef({})
  useEffect(() => { if (speaking) speakers.add(me.current); else speakers.delete(me.current) }, [speaking])
  useEffect(() => () => { speakers.delete(me.current) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const audio = useRef<HTMLAudioElement | null>(null)
  const synth = useRef(false)
  const job = useRef<{ done: () => void } | null>(null)
  const stop = () => {
    audio.current?.pause(); audio.current = null
    if (synth.current) { try { window.speechSynthesis?.cancel() } catch { /* ignore */ } synth.current = false }
    job.current?.done()
  }
  /** dedupe: for proactive warnings — skip it if any tab already said this exact text in the last 20 s. */
  const speak = (text: string, lang: Lang, opts: { dedupe?: boolean } = {}) => {
    stop()
    return new Promise<void>(resolve => {
      let finished = false, release = () => {}
      const j = { done: () => {
        if (finished) return
        finished = true; release()
        if (job.current === j) { job.current = null; setSpeaking(false); speakers.delete(me.current) }
        resolve()
      } }
      job.current = j; setSpeaking(true); speakers.add(me.current)
      const blobP = api.tts(text, lang)          // fetch now; play when it is our turn
      const run = () => withVoiceLock(async () => {
        if (finished) return
        if (opts.dedupe && alreadySaid(text)) { j.done(); return }
        // Never wait forever for the voice: after 8 s use the browser's voice, so the shared queue can't stall.
        const blob = await Promise.race([blobP, new Promise<null>(r => setTimeout(() => r(null), 8000))])
        if (finished) return
        await new Promise<void>(finishPhrase => {
          // Watchdog: Chrome sometimes never fires «end» (known bug of its built-in voice). Without this the shared
          // queue stalled and Metis went silent until a reload. Generous: ~12 characters per second plus 6 s.
          const mine = { audio: null as HTMLAudioElement | null }
          const guard = setTimeout(() => { try { if (synth.current) window.speechSynthesis?.cancel() } catch { /* ignore */ } mine.audio?.pause(); res() },
            6000 + Math.ceil(text.length / 12) * 1000)
          let over = false
          const res = () => { if (over) return; over = true; clearTimeout(guard); finishPhrase() }
          release = res                           // stop() frees the queue straight away (and clears the watchdog)
          const viaSynth = () => {
            try {
              const u = new SpeechSynthesisUtterance(text); u.lang = lang === 'es' ? 'es-ES' : 'en-US'
              u.onend = () => res(); u.onerror = () => res(); synth.current = true; window.speechSynthesis.speak(u)
            } catch { res() }
          }
          if (!blob) { viaSynth(); return }
          const a = new Audio(URL.createObjectURL(blob)); audio.current = a; mine.audio = a
          a.onended = () => res(); a.onerror = () => res()
          a.play().catch(viaSynth)
        })
        audio.current = null; synth.current = false
        j.done()
      })
      W.__metisVoiceQueue = W.__metisVoiceQueue!.then(run, run)
    })
  }
  useEffect(() => stop, []) // eslint-disable-line react-hooks/exhaustive-deps
  return { speak, stop, speaking }
}

// Which tab acts (listens, opens the checklist): the LAST ONE YOU USED. Not "the visible one": on Windows Chrome marks
// a page hidden as soon as another window (the terminal) covers it, and then Metis stopped listening and acting.
// With a single tab it is always that tab.
const TAB = Math.random().toString(36).slice(2)
const claim = () => { try { localStorage.setItem('metis.leader', TAB) } catch { /* private mode: single tab */ } }
export const isLeader = () => { try { const l = localStorage.getItem('metis.leader'); return !l || l === TAB } catch { return true } }
if (typeof window !== 'undefined') {
  claim()
  window.addEventListener('focus', claim); window.addEventListener('pointerdown', claim)
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') claim() })
  window.addEventListener('pagehide', () => { try { if (localStorage.getItem('metis.leader') === TAB) localStorage.removeItem('metis.leader') } catch { /* ignore */ } })
}

// One microphone stream, opened once and reused by every take (always-on ear, triage, check-ins).
let mic: MediaStream | null = null
async function getMic(): Promise<MediaStream> {
  if (mic && mic.getAudioTracks().some(t => t.readyState === 'live')) return mic
  mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
  return mic
}

/** Listen once without touching anything: records until the person stops talking (`silenceMs` of silence after speech),
 *  or gives up after `maxMs` / `waitMs` with no speech. Returns the audio, or null if nothing was said or the mic failed.
 *  Voice detection runs on the AUDIO thread (every ~43 ms), which Chrome never slows down; a timer-based check
 *  dropped to once per second whenever the page was covered and missed short answers like «yes». */
export async function listenOnce(opts: { maxMs?: number; waitMs?: number; silenceMs?: number; signal?: AbortSignal; discardIf?: () => boolean } = {}): Promise<Blob | null> {
  const { maxMs = 10000, waitMs = 5000, silenceMs = 1400, signal, discardIf } = opts
  if (signal?.aborted) return null
  let stream: MediaStream
  try { stream = await getMic() } catch { return null }
  const ctx = new AudioContext()
  ctx.resume().catch(() => {})
  const src = ctx.createMediaStreamSource(stream)
  const proc = ctx.createScriptProcessor(2048, 1, 1)
  src.connect(proc); proc.connect(ctx.destination)          // output stays silent; the connection makes it run
  const rec = new MediaRecorder(stream); const chunks: Blob[] = []
  rec.ondataavailable = e => chunks.push(e.data)
  return new Promise(resolve => {
    const t0 = Date.now(); let spoke = false; let lastVoice = 0; let ended = false; let tainted = false
    let id: ReturnType<typeof setInterval> | undefined   // declared first: end() may run before the timer exists
    // Background-noise level, learnt on the fly: a noisy venue raises the bar, a quiet room lowers it.
    let floor = 0.01
    const end = (keep: boolean) => {
      if (ended) return; ended = true; clearInterval(id)
      proc.onaudioprocess = null
      try { src.disconnect(); proc.disconnect() } catch { /* ignore */ }
      // the mic stream stays open for the next take (opening it again each time added a delay)
      rec.onstop = () => { ctx.close().catch(() => {}); resolve(keep && spoke && !tainted ? new Blob(chunks, { type: rec.mimeType }) : null) }
      try { rec.stop() } catch { rec.onstop?.(new Event('stop')) }
    }
    const check = () => {
      if (ended) return
      if (discardIf?.()) { tainted = true; return }   // e.g. Metis is talking: whatever we record now is her voice
      if (tainted) { end(false); return }             // she finished: drop this take and let the caller listen again
      const now = Date.now()
      if (spoke && now - lastVoice > silenceMs) end(true)
      else if (!spoke && now - t0 > waitMs) end(false)
      else if (now - t0 > maxMs) end(true)
    }
    if (signal?.aborted) { end(false); return }                 // aborted while the mic was opening
    signal?.addEventListener('abort', () => end(false))
    proc.onaudioprocess = e => {
      const buf = e.inputBuffer.getChannelData(0)
      let sum = 0; for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i]
      const rms = Math.sqrt(sum / buf.length)
      floor = rms < floor ? floor * 0.7 + rms * 0.3 : floor * 0.995 + rms * 0.005
      if (!tainted && rms > Math.max(0.015, floor * 3)) { spoke = true; lastVoice = Date.now() }
      check()
    }
    id = setInterval(check, 200)                      // backup for the time limits (fine even if slowed down)
    rec.start()
  })
}

export function fmtDelay(s: number) {
  const m = Math.floor(s / 60), r = Math.round(s % 60)
  return `${m}:${String(r).padStart(2, '0')}`
}
