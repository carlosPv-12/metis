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

/** Speak text: local TTS endpoint first, browser speech synthesis as fallback.
 *  speak() resolves when the voice has finished (or failed), so hands-free mode can start listening right after. */
export function useSpeaker() {
  const [speaking, setSpeaking] = useState(false)
  const me = useRef({})
  useEffect(() => { if (speaking) speakers.add(me.current); else speakers.delete(me.current) }, [speaking])
  useEffect(() => () => { speakers.delete(me.current) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const audio = useRef<HTMLAudioElement | null>(null)
  const done = useRef<(() => void) | null>(null)
  const finish = () => { setSpeaking(false); const d = done.current; done.current = null; d?.() }
  const stop = () => {
    audio.current?.pause(); audio.current = null
    try { window.speechSynthesis?.cancel() } catch { /* ignore */ }
    finish()
  }
  const speak = (text: string, lang: Lang) => new Promise<void>(resolve => {
    stop(); setSpeaking(true); speakers.add(me.current); done.current = resolve
    ;(async () => {
      const blob = await api.tts(text, lang)
      if (done.current !== resolve) return // stopped or replaced meanwhile
      if (blob) {
        const a = new Audio(URL.createObjectURL(blob)); audio.current = a
        a.onended = finish; a.onerror = finish
        try { await a.play(); return } catch { /* fall through */ }
      }
      try {
        const u = new SpeechSynthesisUtterance(text); u.lang = lang === 'es' ? 'es-ES' : 'en-US'
        u.onend = finish; u.onerror = finish; window.speechSynthesis.speak(u)
      } catch { finish() }
    })()
  })
  useEffect(() => stop, []) // eslint-disable-line react-hooks/exhaustive-deps
  return { speak, stop, speaking }
}

/** Listen once without touching anything: records until the person stops talking (about 1 s of silence after speech),
 *  or gives up after `maxMs` / `waitMs` with no speech. Returns the audio, or null if nothing was said or the mic failed. */
export async function listenOnce(opts: { maxMs?: number; waitMs?: number; silenceMs?: number; signal?: AbortSignal; discardIf?: () => boolean } = {}): Promise<Blob | null> {
  const { maxMs = 10000, waitMs = 5000, silenceMs = 1400, signal, discardIf } = opts
  let stream: MediaStream
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }) } catch { return null }
  const ctx = new AudioContext(); const an = ctx.createAnalyser(); an.fftSize = 1024
  ctx.createMediaStreamSource(stream).connect(an)
  const buf = new Float32Array(an.fftSize)
  const rec = new MediaRecorder(stream); const chunks: Blob[] = []
  rec.ondataavailable = e => chunks.push(e.data)
  return new Promise(resolve => {
    const t0 = Date.now(); let spoke = false; let lastVoice = 0; let ended = false; let tainted = false
    // Background-noise level, learnt on the fly: a noisy venue raises the bar, a quiet room lowers it.
    let floor = 0.01
    const end = (keep: boolean) => {
      if (ended) return; ended = true; clearInterval(id)
      rec.onstop = () => { stream.getTracks().forEach(t => t.stop()); ctx.close().catch(() => {}); resolve(keep && spoke && !tainted ? new Blob(chunks, { type: rec.mimeType }) : null) }
      try { rec.stop() } catch { rec.onstop?.(new Event('stop')) }
    }
    signal?.addEventListener('abort', () => end(false))
    const id = setInterval(() => {
      if (discardIf?.()) { tainted = true; return }   // e.g. Metis is talking: whatever we record now is her voice
      if (tainted) { end(false); return }             // she finished: drop this take and let the caller listen again
      an.getFloatTimeDomainData(buf)
      let sum = 0; for (const v of buf) sum += v * v
      const rms = Math.sqrt(sum / buf.length), now = Date.now()
      floor = rms < floor ? floor * 0.7 + rms * 0.3 : floor * 0.995 + rms * 0.005
      if (rms > Math.max(0.015, floor * 3)) { spoke = true; lastVoice = now }
      if (spoke && now - lastVoice > silenceMs) end(true)
      else if (!spoke && now - t0 > waitMs) end(false)
      else if (now - t0 > maxMs) end(true)
    }, 80)
    rec.start()
  })
}

export function fmtDelay(s: number) {
  const m = Math.floor(s / 60), r = Math.round(s % 60)
  return `${m}:${String(r).padStart(2, '0')}`
}
