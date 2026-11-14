import { useCallback, useLayoutEffect, useRef } from 'react'
import { api } from '../api'
import { useSpeaker } from '../hooks'
import type { Lang } from '../i18n'

// The unchanged runner calls useSpeaker automatically, even in screen-only mode.
// Own its TTS entry point for this route's lifetime. A suppressed call must stay
// pending: resolving null would make useSpeaker start browser speech instead.
// No browser APIs are patched; the original endpoint is restored on unmount.
const silent = () => new Promise<Blob | null>(() => {})

export function useRunnerSpeech() {
  const speaker = useSpeaker()
  const latest = useRef(speaker)
  useLayoutEffect(() => { latest.current = speaker })
  const gate = useRef({ allowed: false, generation: 0, mounted: false })

  useLayoutEffect(() => {
    const original = api.tts
    const current = gate.current
    current.mounted = true
    const scoped: typeof api.tts = (text, lang) => {
      if (!current.allowed) return silent()
      const generation = current.generation
      return original(text, lang).then(blob =>
        current.mounted && generation === current.generation ? blob : silent())
    }
    api.tts = scoped
    return () => {
      current.mounted = false
      current.generation++
      latest.current.stop()
      if (api.tts === scoped) api.tts = original
    }
  }, [])

  const stop = useCallback(() => {
    gate.current.generation++
    latest.current.stop()
  }, [])
  const speak = useCallback((text: string, lang: Lang) => {
    gate.current.generation++
    gate.current.allowed = true
    try { void latest.current.speak(text, lang) }
    finally { gate.current.allowed = false }
  }, [])
  return { speak, stop, speaking: speaker.speaking }
}
