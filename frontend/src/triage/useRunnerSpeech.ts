import { useCallback, useLayoutEffect, useRef } from 'react'
import { useSpeaker } from '../hooks'
import type { Lang } from '../i18n'

// Speech for the triage follow-up helper. It used to swap the global `api.tts` for a version that never resolved
// outside its own calls: every other phrase (emergency warnings, the triage questions, the always-on ear) hung
// forever, the shared voice queue stalled and Metis went silent and deaf until a reload (found 14-nov by Carlos).
// Screen-only mode is handled by the triage runner itself (?voice=0), so nothing global is patched any more.
export function useRunnerSpeech() {
  const speaker = useSpeaker()
  const latest = useRef(speaker)
  useLayoutEffect(() => { latest.current = speaker })
  // Stable callbacks: callers use them as effect dependencies, so they must not change on every render.
  const stop = useCallback(() => latest.current.stop(), [])
  const speak = useCallback((text: string, lang: Lang) => { void latest.current.speak(text, lang) }, [])
  return { speak, stop, speaking: speaker.speaking }
}
