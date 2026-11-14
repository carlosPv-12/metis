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

/** Speak text: local TTS endpoint first, browser speech synthesis as fallback. */
export function useSpeaker() {
  const [speaking, setSpeaking] = useState(false)
  const audio = useRef<HTMLAudioElement | null>(null)
  const stop = () => {
    audio.current?.pause(); audio.current = null
    try { window.speechSynthesis?.cancel() } catch { /* ignore */ }
    setSpeaking(false)
  }
  const speak = async (text: string, lang: Lang) => {
    stop(); setSpeaking(true)
    const blob = await api.tts(text, lang)
    if (blob) {
      const a = new Audio(URL.createObjectURL(blob)); audio.current = a
      a.onended = () => setSpeaking(false); a.onerror = () => setSpeaking(false)
      try { await a.play(); return } catch { /* fall through */ }
    }
    try {
      const u = new SpeechSynthesisUtterance(text); u.lang = lang === 'es' ? 'es-ES' : 'en-US'
      u.onend = () => setSpeaking(false); window.speechSynthesis.speak(u)
    } catch { setSpeaking(false) }
  }
  useEffect(() => stop, [])
  return { speak, stop, speaking }
}

export function fmtDelay(s: number) {
  const m = Math.floor(s / 60), r = Math.round(s % 60)
  return `${m}:${String(r).padStart(2, '0')}`
}
