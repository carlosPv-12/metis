// Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
// "Settings": per-crew preferences (for now: which body figure — female / male — the Body map shows).
import CrewAvatar from '../CrewAvatar'
import { ENV_PROFILES, fmtLinkDelay } from '../link'
import '../link.css'
import { api } from '../api'
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useLoad } from '../hooks'
import { useLang, useT } from '../i18n'
import { Card, Page } from '../ui'
import References from './References'
import { DEFAULT_SEX, setEnv, setMarsDelayMin, resetSettings, setCrewSex, sexOf, useSettings, type Sex } from '../settings'

// Demo-only controls (moved here from the Station console): they drive the simulated live vitals on the backend.
const MOCK = {
  en: { title: 'Mockup simulation', note: 'Only for the mockup. These buttons simulate situations in the live vitals so you can show the demo; a real mission would not have them.' },
  es: { title: 'Simulación del mockup', note: 'Solo para el mockup. Estos botones simulan situaciones en las constantes en directo para enseñar la demo; en una misión real no existirían.' },
}

const TXT = {
  en: {
    title: 'Settings', sub: 'Preferences for this device. They are saved in this browser.',
    environment: 'Mission environment', delay: 'One-way delay', mars: 'Mars delay (minutes)', simulation: 'Simulated link for this demo.', crew: 'Crew', body: 'Body figure', female: 'Female', male: 'Male', reset: 'Restore defaults',
    note: 'Used by the Body map to show a female or male body.',
  },
  es: {
    title: 'Ajustes', sub: 'Preferencias de este dispositivo. Se guardan en este navegador.',
    environment: 'Entorno de la misión', delay: 'Retraso de ida', mars: 'Retraso de Marte (minutos)', simulation: 'Enlace simulado para esta demo.', crew: 'Tripulación', body: 'Figura del cuerpo', female: 'Mujer', male: 'Hombre', reset: 'Restablecer',
    note: 'El mapa del cuerpo usa esta figura de mujer o de hombre.',
  },
}

export default function Settings() {
  const { lang } = useLang(); const t = useT()
  const loc = useLocation()
  // /settings?section=references jumps straight to the References section.
  useEffect(() => { if (new URLSearchParams(loc.search).get('section') === 'references') setTimeout(() => document.getElementById('references')?.scrollIntoView({ block: 'start' }), 300) }, [loc.search])
  const s = TXT[lang]
  const settings = useSettings()
  const { data } = useLoad(api.station)
  const crew = data?.crew ?? Object.keys(DEFAULT_SEX).map(id => ({ id, name: id[0].toUpperCase() + id.slice(1), role_es: '', role_en: '' }))
  return (
    <Page title={s.title} sub={s.sub}>
      <Card title={s.environment}>
        <div className="mission-profiles" role="group" aria-label={s.environment}>
          {Object.values(ENV_PROFILES).map(p => <button key={p.id} type="button" className={`mission-profile ${settings.env === p.id ? 'selected' : ''}`} aria-pressed={settings.env === p.id} onClick={() => setEnv(p.id)}>
            <strong>{p.label[lang]}</strong>
            <span>{s.delay}: {fmtLinkDelay(p.id === 'mars' ? settings.marsDelayMin * 60 : p.oneWayS, lang)}</span>
          </button>)}
        </div>
        {settings.env === 'mars' && <label className="mars-slider">{s.mars}: <strong>{settings.marsDelayMin}</strong><input type="range" min="5" max="20" step="1" value={settings.marsDelayMin} onChange={e => setMarsDelayMin(Number(e.target.value))} /></label>}
      </Card>
      <Card className="settings-card" title={s.crew} right={<button type="button" className="btn" onClick={resetSettings}>{s.reset}</button>}>
        <p className="small muted" style={{ marginTop: 0 }}>{s.note}</p>
        <div className="settings-list">
          {crew.map(c => {
            const cur = sexOf(settings, c.id)
            const role = lang === 'es' ? c.role_es : c.role_en
            return (
              <div key={c.id} className="settings-row">
                <div className="settings-who">
                  <CrewAvatar id={c.id} name={c.name} size={44} />
                  <div><div className="settings-name">{c.name}</div>{role && <div className="small muted">{role}</div>}</div>
                </div>
                <div className="settings-field">
                  <span className="small muted">{s.body}</span>
                  <div className="seg" role="group" aria-label={`${s.body}, ${c.name}`}>
                    {(['female', 'male'] as Sex[]).map(v => (
                      <button key={v} type="button" className={cur === v ? 'on' : ''} aria-pressed={cur === v} onClick={() => setCrewSex(c.id, v)}>
                        <span aria-hidden>{v === 'female' ? '♀' : '♂'}</span> {s[v]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </Card>
      <Card className="settings-card settings-mockup" title={MOCK[lang].title}>
        <p className="small muted" style={{ marginTop: 0 }}>{MOCK[lang].note}</p>
        <div className="row wrap" style={{ gap: 8 }}>
          <button className="btn" onClick={() => api.vitalsScenario('marco', 'deterioration').catch(() => {})}>{t('sc_deteriorate')}</button>
          <button className="btn" onClick={() => api.vitalsScenario('kenji', 'exercise').catch(() => {})}>{t('sc_exercise')}</button>
          <button className="btn danger" onClick={() => api.vitalsScenario('marco', 'collapse').catch(() => {})}>{t('sc_collapse')}</button>
          <button className="btn ghost" onClick={() => api.vitalsReset().catch(() => {})}>{t('sc_reset')}</button>
        </div>
      </Card>
      <References embedded />
    </Page>
  )
}
