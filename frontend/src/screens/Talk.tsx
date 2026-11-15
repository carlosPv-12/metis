// Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
// "Talk": push-to-talk (MediaRecorder -> /api/voice/stt -> /api/metis/chat -> /api/voice/tts), or text.
// The conversation itself lives in the always-on ear (voice.tsx), above every screen: leaving Talk while Metis
// thinks or speaks does not cut the answer, and the conversation is still here when you come back.
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mic, SendHorizontal, Siren, Volume2 } from 'lucide-react'
import { api, NO_SERVER } from '../api'
import { useLang, useT, type Key } from '../i18n'
import { MetisLine, Page } from '../ui'
import { useEar } from '../voice'

export default function Talk() {
  const t = useT(); const { lang } = useLang(); const nav = useNavigate()
  const [input, setInput] = useState('')
  const [rphase, setPhase] = useState<'idle' | 'rec' | 'stt'>('idle')
  const [err, setErr] = useState<string | null>(null)
  const ear = useEar()
  const msgs = ear?.chat ?? []
  const opening = !!ear?.opening
  const phase: 'idle' | 'rec' | 'stt' | 'think' = ear?.thinking ? 'think' : rphase
  const rec = useRef<MediaRecorder | null>(null); const chunks = useRef<Blob[]>([])
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [msgs.length, phase])

  const send = (text: string, meta?: string) => {
    if (!text.trim() || !ear) return
    setInput('')
    void ear.ask(text, meta).catch(() => { /* chat has its own fallback */ })
  }

  const start = async () => {
    setErr(null); ear?.stopVoice()
    if (NO_SERVER) { setErr(t('no_server_mic')); return }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream); chunks.current = []
      mr.ondataavailable = e => chunks.current.push(e.data)
      mr.onstop = async () => {
        stream.getTracks().forEach(tr => tr.stop())
        setPhase('stt')
        const r = await api.stt(new Blob(chunks.current, { type: mr.mimeType }), lang)
        setPhase('idle')
        if (r?.text) send(r.text, `STT${r.latency_ms ? ', ' + (r.latency_ms / 1000).toFixed(1) + ' s' : ''}`)
        else setErr(r ? t('didnt_hear') : t('mic_denied'))
      }
      mr.start(); rec.current = mr; setPhase('rec')
    } catch { setErr(t('mic_denied')); setPhase('idle') }
  }
  const stop = () => { if (rec.current && rec.current.state === 'recording') rec.current.stop(); rec.current = null }

  // While the hold-to-talk mic is open or transcribing, the ear steps aside (no double hearing).
  // (While Metis thinks, the ear itself steps aside: the conversation lives there.)
  useEffect(() => { ear?.setBusy('talk', rphase !== 'idle'); return () => ear?.setBusy('talk', false) }, [rphase]) // eslint-disable-line react-hooks/exhaustive-deps
  const quick: Key[] = ['quick_1', 'quick_2', 'quick_3', 'quick_4']
  return (
    <Page title={t('talk_title')}>
      <div className="grid talk-layout">
        <section className="card talk-chat-card">
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
            {opening && <div className="lvl rojo" style={{ fontWeight: 600 }}><Siren size={16} style={{ verticalAlign: -3, marginRight: 8 }} />{t('opening_triage')}</div>}
            {phase === 'stt' && <div className="bubble me muted">{t('transcribing')}</div>}
            <div ref={end} />
          </div>
          <div className="row wrap" style={{ gap: 8, margin: '12px 0' }}>
            {quick.map(k => <button key={k} className="chip" onClick={() => send(t(k))}>{t(k)}</button>)}
          </div>
          <form className="row talk-composer" onSubmit={e => { e.preventDefault(); send(input) }}>
            <input className="field" value={input} onChange={e => setInput(e.target.value)} placeholder={t('type_message')} aria-label={t('type_message')} inputMode="text" enterKeyHint="send" />
            <button className="btn primary talk-send" type="submit" aria-label={t('send')} disabled={!input.trim() || phase !== 'idle'}><SendHorizontal size={16} /><span>{t('send')}</span></button>
          </form>
        </section>
        <section className="card talk-voice-card">
          <button className={`ptt ${phase === 'rec' ? 'rec' : ''}`} aria-label={t('hold_to_talk')}
            onPointerDown={start} onPointerUp={stop} onPointerLeave={stop}
            onKeyDown={e => { if ((e.key === ' ' || e.key === 'Enter') && phase === 'idle') { e.preventDefault(); start() } }}
            onKeyUp={e => { if (e.key === ' ' || e.key === 'Enter') stop() }}>
            <Mic size={38} />
          </button>
          <div style={{ fontWeight: 500 }}>{phase === 'rec' ? t('release_to_send') : phase === 'stt' ? t('transcribing') : phase === 'think' ? t('thinking') : t('hold_to_talk')}</div>
          {ear?.speaking && <div className="s-ok small">{t('speaking')}</div>}
          {err && <div className="small s-watch">{err}</div>}
          {ear?.on && <div className="s-ok" style={{ maxWidth: 260 }}>{t('talk_handsfree')}</div>}
          <div className="small dim" style={{ marginTop: 20 }}>{t('offline_badge')}</div>
        </section>
      </div>
    </Page>
  )
}
