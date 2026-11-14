import { useEffect, useLayoutEffect, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { MessageCircle, Volume2, VolumeX } from 'lucide-react'
import { useLang } from '../i18n'
import { copy } from './copy'
import { useRunnerSpeech } from './useRunnerSpeech'

type Snapshot = { text: string; key: string; host: HTMLElement | null }
const empty: Snapshot = { text: '', key: '', host: null }

/** Observe only the runner, never the pill or follow-up, to avoid reading our own UI. */
export default function TriageVoice({ runner, enabled, mind }: {
  runner: RefObject<HTMLDivElement | null>; enabled: boolean; mind: boolean
}) {
  const { lang } = useLang()
  const s = copy[lang]
  const [muted, setMuted] = useState(false)
  const [snapshot, setSnapshot] = useState<Snapshot>(empty)
  const [dismissed, setDismissed] = useState('')
  const { speak, stop, speaking } = useRunnerSpeech()

  useLayoutEffect(() => {
    const root = runner.current
    if (!root) return
    let result: Element | null = null
    let host: HTMLDivElement | null = null
    let lastKey = ''
    let lastHost: HTMLElement | null = null
    const read = () => {
      const nextResult = root.querySelector('.lvl')
      if (result !== nextResult) {
        host?.remove()
        result = nextResult
        host = result ? document.createElement('div') : null
        if (host) {
          host.className = 'triage-followup-slot'
          result?.after(host)
        }
      }
      // Current runner: level label is child 1, result title is child 2.
      // Also support a future semantic heading without requiring runner edits.
      const title = result?.querySelector('h2, h3, h1') ?? result?.children[1]
      const text = result
        ? [title?.textContent, Array.from(result.querySelectorAll('.steps li'), item => item.textContent).join('. '), result.lastElementChild?.matches('.small') ? result.lastElementChild.textContent : ''].filter(Boolean).join('. ')
        : root.querySelector('.tq')?.textContent ?? ''
      const key = `${lang}:${result ? result.className : 'question'}:${text}`
      if (key !== lastKey || host !== lastHost) {
        lastKey = key
        lastHost = host
        setSnapshot({ text, key, host })
      }
    }
    const observer = new MutationObserver(read)
    observer.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class'] })
    read()
    return () => { observer.disconnect(); host?.remove() }
  }, [runner, lang])

  useEffect(() => {
    if (enabled && !muted && snapshot.text) speak(snapshot.text, lang)
    else stop()
    return stop
  }, [snapshot.key, snapshot.text, enabled, muted, lang, speak, stop])

  return <>
    {enabled && <div className="triage-voice-pill">
      {muted ? <VolumeX size={18} aria-hidden="true" /> : <Volume2 size={18} aria-hidden="true" />}
      <span role="status">{muted ? s.muted : speaking ? s.speaking : s.ready}</span>
      <button type="button" aria-pressed={muted} onClick={() => { stop(); setMuted(value => !value) }}>{muted ? s.unmute : s.mute}</button>
    </div>}
    {snapshot.host && dismissed !== snapshot.key && createPortal(
      <section className="triage-followup" aria-labelledby="triage-followup-title">
        <MessageCircle size={26} aria-hidden="true" />
        <h2 id="triage-followup-title">{mind ? s.mindFollowup : s.followup}</h2>
        <div className="triage-followup-actions">
          <Link className="triage-talk" to="/talk" onClick={stop}>{s.yes}</Link>
          <button type="button" className="triage-dismiss" onClick={() => setDismissed(snapshot.key)}>{s.no}</button>
        </div>
      </section>, snapshot.host)}
  </>
}
