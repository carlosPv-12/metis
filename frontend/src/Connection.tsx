// Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
// Top-bar pill: is Metis connected to the habitat computer (backend: local AI, voice, speech recognition)
// or running on its own (standalone: scripted lines, local triage tree, browser voice)?
import { useEffect, useState } from 'react'
import { api, NO_SERVER } from './api'
import { useLang } from './i18n'

type Conn = 'checking' | 'online' | 'standalone'

const TXT = {
  en: {
    checking: 'Connecting…', online: 'Online', standalone: 'Standalone mode',
    tip_online: 'Connected to the habitat computer: local AI, voice and speech recognition. Nothing needs Earth.',
    tip_standalone: 'No connection to the habitat computer: Metis uses scripted lines, the local triage tree and your browser’s voice.',
  },
  es: {
    checking: 'Conectando…', online: 'En línea', standalone: 'Modo autónomo',
    tip_online: 'Conectado al ordenador del hábitat: IA, voz y reconocimiento de voz locales. No hace falta la Tierra.',
    tip_standalone: 'Sin conexión con el ordenador del hábitat: Metis usa frases guionizadas, el árbol de triaje local y la voz del navegador.',
  },
}

const POLL_MS = 15000

export default function ConnectionPill() {
  const { lang } = useLang()
  const [conn, setConn] = useState<Conn>(NO_SERVER ? 'standalone' : 'checking')
  useEffect(() => {
    if (NO_SERVER) return
    let alive = true
    const check = () => api.status().then(s => { if (alive) setConn(s._fallback ? 'standalone' : 'online') })
    check()
    const id = setInterval(check, POLL_MS)
    return () => { alive = false; clearInterval(id) }
  }, [])
  const s = TXT[lang]
  const tip = conn === 'online' ? s.tip_online : conn === 'standalone' ? s.tip_standalone : s.checking
  return <span className={`pill conn ${conn}`} title={tip} role="status"><span className="dot" aria-hidden />{s[conn]}</span>
}
