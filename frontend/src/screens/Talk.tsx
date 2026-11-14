// Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
// "Talk": push-to-talk (MediaRecorder -> /api/voice/stt -> /api/metis/chat -> /api/voice/tts), or text.
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mic, SendHorizontal, Siren, Volume2 } from 'lucide-react'
import { api, NO_SERVER } from '../api'
import { useSpeaker } from '../hooks'
import { useLang, useT, type Key } from '../i18n'
import { MetisLine, Page, useCrew } from '../ui'

interface Msg { who: 'me' | 'metis'; text: string; meta?: string; escalated?: boolean; flow?: string }

export default function Talk() {
  const t = useT(); const { lang } = useLang(); const { crewId } = useCrew(); const nav = useNavigate()
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [phase, setPhase] = useState<'idle' | 'rec' | 'stt' | 'think'>('idle')
  const [err, setErr] = useState<string | null>(null)
  const rec = useRef<MediaRecorder | null>(null); const chunks = useRef<Blob[]>([])
  const sp = useSpeaker()
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [msgs, phase])

  const send = async (text: string, meta?: string) => {
    if (!text.trim()) return
    const hist = msgs.map(m => ({ role: m.who === 'me' ? 'user' : 'assistant', content: m.text }))
    setMsgs(m => [...m, { who: 'me', text, meta }]); setInput(''); setPhase('think')
    const r = await api.chat(crewId, text, lang, hist)
    const src = r.source === 'llm' || r.source?.startsWith?.('llm') ? t('src_llm') : t('src_fallback')
    setMsgs(m => [...m, { who: 'metis', text: r.text, meta: `${src}${r.latency_ms ? ` · ${(r.latency_ms / 1000).toFixed(1)} s` : ''}`, escalated: r.safety === 'escalated', flow: (r as { suggest_flow?: string }).suggest_flow }])
    setPhase('idle')
    sp.speak(r.text, lang)
  }

  const start = async () => {
    setErr(null); sp.stop()
    if (NO_SERVER) { setErr(t('no_server_mic')); return }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream); chunks.current = []
      mr.ondataavailable = e => chunks.current.push(e.data)
      mr.onstop = async () => {
        stream.getTracks().forEach(tr => tr.stop())
        setPhase('stt')
        const r = await api.stt(new Blob(chunks.current, { type: mr.mimeType }))
        if (r?.text) send(r.text, `STT${r.latency_ms ? ' · ' + (r.latency_ms / 1000).toFixed(1) + ' s' : ''}`)
        else { setPhase('idle'); setErr(t('mic_denied')) }
      }
      mr.start(); rec.current = mr; setPhase('rec')
    } catch { setErr(t('mic_denied')); setPhase('idle') }
  }
  const stop = () => { if (rec.current && rec.current.state === 'recording') rec.current.stop(); rec.current = null }

  const quick: Key[] = ['quick_1', 'quick_2', 'quick_3', 'quick_4']
  return (
    <Page title={t('talk_title')}>
      <div className="grid" style={{ gridTemplateColumns: '1fr 300px', alignItems: 'stretch', height: 'calc(100vh - 200px)', minHeight: 520 }}>
        <section className="card" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div className="chat" style={{ flex: 1 }}>
            <MetisLine small><div className="bubble metis" style={{ maxWidth: '90%' }}>{t('talk_intro')}</div></MetisLine>
            {msgs.map((m, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.who === 'me' ? 'flex-end' : 'flex-start' }}>
                <div className={`bubble ${m.who}`}>{m.text}</div>
                {m.meta && <div className="small dim" style={{ margin: '4px 6px' }}>{m.who === 'metis' && <Volume2 size={12} style={{ verticalAlign: -2, marginRight: 4 }} />}{m.meta}</div>}
                {m.escalated && (
                  <div className="lvl rojo" style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 16 }}>
                    <span style={{ fontWeight: 600 }}>{t('escalated')}</span>
                    <button className="btn danger big" onClick={() => nav(m.flow ? '/triage?flow=' + m.flow : /collaps|despl|marco/i.test(msgs[i - 1]?.text ?? '') ? '/triage?flow=companion_collapse' : '/triage?flow=self_chest_pressure')}><Siren size={18} />{t('open_triage')}</button>
                  </div>
                )}
              </div>
            ))}
            {phase === 'think' && <div className="bubble metis muted">{t('thinking')}</div>}
            {phase === 'stt' && <div className="bubble me muted">{t('transcribing')}</div>}
            <div ref={end} />
          </div>
          <div className="row wrap" style={{ gap: 8, margin: '12px 0' }}>
            {quick.map(k => <button key={k} className="chip" onClick={() => send(t(k))}>{t(k)}</button>)}
          </div>
          <form className="row" onSubmit={e => { e.preventDefault(); send(input) }}>
            <input className="field" value={input} onChange={e => setInput(e.target.value)} placeholder={t('type_message')} aria-label={t('type_message')} />
            <button className="btn primary" type="submit" disabled={!input.trim() || phase !== 'idle'}><SendHorizontal size={16} />{t('send')}</button>
          </form>
        </section>
        <section className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, textAlign: 'center' }}>
          <button className={`ptt ${phase === 'rec' ? 'rec' : ''}`} aria-label={t('hold_to_talk')}
            onPointerDown={start} onPointerUp={stop} onPointerLeave={stop}
            onKeyDown={e => { if ((e.key === ' ' || e.key === 'Enter') && phase === 'idle') { e.preventDefault(); start() } }}
            onKeyUp={e => { if (e.key === ' ' || e.key === 'Enter') stop() }}>
            <Mic size={38} />
          </button>
          <div style={{ fontWeight: 500 }}>{phase === 'rec' ? t('release_to_send') : phase === 'stt' ? t('transcribing') : phase === 'think' ? t('thinking') : t('hold_to_talk')}</div>
          {sp.speaking && <div className="s-ok small">{t('speaking')}</div>}
          {err && <div className="small s-watch">{err}</div>}
          <div className="small dim" style={{ marginTop: 20 }}>{t('offline_badge')}</div>
        </section>
      </div>
    </Page>
  )
}
