import { useRef, type KeyboardEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import CrewAvatar from '../CrewAvatar'
import ConnectionPill from '../Connection'
import LinkChip from '../LinkChip'
import { EarSwitch } from '../voice'
import { ENV_PROFILES, fmtLinkDelay } from '../link'
import '../link.css'
import { api } from '../api'
import { useLoad } from '../hooks'
import { useLang, useT } from '../i18n'
import { useCrew } from '../ui'
import References from './References'
import { DEFAULT_SEX, SETTINGS_LABEL, setEnv, setMarsDelayMin, resetSettings, setCrewSex, sexOf, useSettings, type Sex, roleOf, setCrewRole } from '../settings'
import '../settings-page.css'

const TABS = ['crew', 'connection', 'environment', 'bodies', 'mockup', 'references'] as const
type Tab = typeof TABS[number]

const ROLE_TXT = {
  en: { title: 'Roles', field: 'Role of' },
  es: { title: 'Roles', field: 'Rol de' },
}

const COPY = {
  en: {
    tabs: { crew: 'Crew member', connection: 'Connection and voice', environment: 'Mission environment', bodies: 'Body figures', mockup: 'Mockup simulation', references: 'References' },
    descriptions: {
      crew: 'Choose who is using Metis now.',
      connection: 'Check the connection and manage hands-free voice.',
      environment: 'Choose the mission environment and its delay to Earth.',
      bodies: 'Choose the figure shown for each crew member on the Body map.',
      mockup: 'Choose a scenario to try with the live vitals.',
      references: 'Find the sources behind the data, rules and resources in Metis.',
    },
    selected: 'Selected', connection: 'Habitat connection', connectionHint: 'Shows whether Metis is connected to the habitat computer.',
    voice: 'Microphone and wake word', voiceHint: 'Turn listening for “Metis” on or off.',
    current: 'Current environment', delay: 'One-way delay', mars: 'Mars delay (minutes)',
    body: 'Body figure', female: 'Female', male: 'Male', reset: 'Restore defaults',
    mockupNote: 'Only for the mockup. These buttons simulate situations in the live vitals so you can show the demo; a real mission would not have them.',
  },
  es: {
    tabs: { crew: 'Tripulante', connection: 'Conexión y voz', environment: 'Entorno de la misión', bodies: 'Figuras del cuerpo', mockup: 'Simulación del mockup', references: 'Referencias' },
    descriptions: {
      crew: 'Elige quién está usando Metis ahora.',
      connection: 'Consulta la conexión y controla la voz manos libres.',
      environment: 'Elige el entorno de la misión y su retraso con la Tierra.',
      bodies: 'Elige la figura de cada tripulante en el mapa del cuerpo.',
      mockup: 'Elige una situación para probar las constantes en directo.',
      references: 'Consulta las fuentes de los datos, las reglas y los recursos de Metis.',
    },
    selected: 'Seleccionado', connection: 'Conexión con el hábitat', connectionHint: 'Indica si Metis está conectado al ordenador del hábitat.',
    voice: 'Micrófono y palabra de activación', voiceHint: 'Activa o desactiva la escucha de «Metis».',
    current: 'Entorno actual', delay: 'Retraso de ida', mars: 'Retraso de Marte (minutos)',
    body: 'Figura del cuerpo', female: 'Mujer', male: 'Hombre', reset: 'Restablecer',
    mockupNote: 'Solo para el mockup. Estos botones simulan situaciones en las constantes en directo para enseñar la demo; en una misión real no existirían.',
  },
}

export default function Settings() {
  const { lang } = useLang()
  const t = useT()
  const s = COPY[lang]
  const settings = useSettings()
  const { crewId, setCrewId } = useCrew()
  const { data } = useLoad(api.station)
  const crew = data?.crew ?? [
    { id: 'lena', name: 'Lena', role_en: '', role_es: '' },
    { id: 'marco', name: 'Marco', role_en: '', role_es: '' },
  ]
  const bodyCrew = data?.crew ?? Object.keys(DEFAULT_SEX).map(id => ({ id, name: id[0].toUpperCase() + id.slice(1), role_es: '', role_en: '' }))
  const [params, setParams] = useSearchParams()
  const requested = params.get('tab')
  const active: Tab = TABS.includes(requested as Tab) ? requested as Tab : params.get('section') === 'references' ? 'references' : 'crew'
  const tabButtons = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({})

  const selectTab = (tab: Tab) => {
    const next = new URLSearchParams(params)
    next.set('tab', tab)
    next.delete('section')
    setParams(next, { replace: true })
  }
  const navigateTabs = (event: KeyboardEvent<HTMLButtonElement>, tab: Tab) => {
    const index = TABS.indexOf(tab)
    let next: Tab
    switch (event.key) {
      case 'ArrowRight': next = TABS[(index + 1) % TABS.length]; break
      case 'ArrowLeft': next = TABS[(index - 1 + TABS.length) % TABS.length]; break
      case 'Home': next = TABS[0]; break
      case 'End': next = TABS[TABS.length - 1]; break
      default: return
    }
    event.preventDefault()
    selectTab(next)
    tabButtons.current[next]?.focus()
  }

  return (
    <div className="page settings-page">
      <h1 className="h1">{SETTINGS_LABEL[lang]}</h1>
      <div className="seg settings-tabs" role="tablist" aria-label={SETTINGS_LABEL[lang]}>
        {TABS.map(tab => (
          <button key={tab} ref={node => { tabButtons.current[tab] = node }} type="button" role="tab"
            id={`settings-tab-${tab}`} aria-controls={`settings-panel-${tab}`} aria-selected={active === tab}
            tabIndex={active === tab ? 0 : -1} className={active === tab ? 'on' : ''}
            onClick={() => selectTab(tab)} onKeyDown={event => navigateTabs(event, tab)}>
            {s.tabs[tab]}
          </button>
        ))}
      </div>

      {TABS.map(tab => (
        <section key={tab} className="settings-panel" id={`settings-panel-${tab}`} role="tabpanel"
          aria-labelledby={`settings-tab-${tab}`} tabIndex={0} hidden={active !== tab}>
          <header className="settings-panel-heading">
            <h2>{s.tabs[tab]}</h2>
            <p>{s.descriptions[tab]}</p>
          </header>

          {tab === 'crew' && <div className="settings-crew-grid" role="group" aria-label={s.tabs.crew}>
            {crew.map(c => <button key={c.id} type="button" className={`settings-crew-card ${crewId === c.id ? 'is-selected' : ''}`}
              aria-pressed={crewId === c.id} onClick={() => setCrewId(c.id)}>
              <CrewAvatar id={c.id} name={c.name} size={80} />
              <span className="settings-crew-copy"><strong>{c.name}</strong><span>{roleOf(settings, c, lang)}</span></span>
              {crewId === c.id && <span className="settings-selected"><span aria-hidden="true">✓ </span>{s.selected}</span>}
            </button>)}
          </div>}
          {tab === 'crew' && <div className="settings-roles">
            <h3>{ROLE_TXT[lang].title}</h3>
            {crew.map(c => <label key={c.id} className="settings-role-row">
              <CrewAvatar id={c.id} name={c.name} size={36} />
              <span className="settings-role-name">{c.name}</span>
              <input type="text" value={roleOf(settings, c, lang)} maxLength={60} aria-label={`${ROLE_TXT[lang].field} ${c.name}`}
                onChange={e => setCrewRole(c.id, e.target.value)} />
            </label>)}
          </div>}

          {tab === 'connection' && <div className="settings-control-list">
            <div className="settings-control-row">
              <div><h3>{s.connection}</h3><p>{s.connectionHint}</p></div>
              <div className="settings-connection-status"><ConnectionPill /></div>
            </div>
            <div className="settings-control-row">
              <div><h3>{s.voice}</h3><p>{s.voiceHint}</p></div>
              <div className="settings-voice-control"><EarSwitch /></div>
            </div>
          </div>}

          {tab === 'environment' && <div className="settings-environment">
            <div className="settings-current"><span>{s.current}</span><LinkChip /></div>
            <div className="mission-profiles" role="group" aria-label={s.tabs.environment}>
              {Object.values(ENV_PROFILES).map(p => <button key={p.id} type="button" className={`mission-profile ${settings.env === p.id ? 'selected' : ''}`} aria-pressed={settings.env === p.id} onClick={() => setEnv(p.id)}>
                <strong>{p.label[lang]}</strong>
                <span>{s.delay}: {fmtLinkDelay(p.id === 'mars' ? settings.marsDelayMin * 60 : p.oneWayS, lang)}</span>
              </button>)}
            </div>
            {settings.env === 'mars' && <div className="settings-mars">
              <label htmlFor="settings-mars-delay">{s.mars}: <strong>{settings.marsDelayMin}</strong></label>
              <input id="settings-mars-delay" type="range" min="5" max="20" step="1" value={settings.marsDelayMin} onChange={e => setMarsDelayMin(Number(e.target.value))} />
              <div className="settings-range-limits" aria-hidden="true"><span>5 min</span><span>20 min</span></div>
            </div>}
          </div>}

          {tab === 'bodies' && <>
            <div className="settings-body-list">
              {bodyCrew.map(c => <div key={c.id} className="settings-body-row">
                <div className="settings-person"><CrewAvatar id={c.id} name={c.name} size={52} />
                  <div><strong>{c.name}</strong><span>{lang === 'es' ? c.role_es : c.role_en}</span></div>
                </div>
                <div className="seg" role="group" aria-label={`${s.body}, ${c.name}`}>
                  {(['female', 'male'] as Sex[]).map(sex => <button key={sex} type="button" className={sexOf(settings, c.id) === sex ? 'on' : ''}
                    aria-pressed={sexOf(settings, c.id) === sex} onClick={() => setCrewSex(c.id, sex)}>
                    <span aria-hidden="true">{sex === 'female' ? '♀' : '♂'}</span> {s[sex]}
                  </button>)}
                </div>
              </div>)}
            </div>
            <div className="settings-panel-footer"><button type="button" className="btn" onClick={resetSettings}>{s.reset}</button></div>
          </>}

          {tab === 'mockup' && <>
            <p className="settings-mockup-note">{s.mockupNote}</p>
            <div className="settings-scenarios">
              <button type="button" className="btn" onClick={() => api.vitalsScenario('marco', 'deterioration').catch(() => {})}>{t('sc_deteriorate')}</button>
              <button type="button" className="btn" onClick={() => api.vitalsScenario('kenji', 'exercise').catch(() => {})}>{t('sc_exercise')}</button>
              <button type="button" className="btn danger" onClick={() => api.vitalsScenario('marco', 'collapse').catch(() => {})}>{t('sc_collapse')}</button>
              <button type="button" className="btn ghost" onClick={() => api.vitalsReset().catch(() => {})}>{t('sc_reset')}</button>
            </div>
          </>}

          {tab === 'references' && <References embedded />}
        </section>
      ))}
    </div>
  )
}
