// Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
import { useEffect, useState } from 'react'
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Activity, LayoutDashboard, MessageCircle, PersonStanding, HeartPulse, Radio, Settings as SettingsIcon, Siren, Sun } from 'lucide-react'
import { LangCtx, useT, type Lang } from './i18n'
import { CrewCtx, useCrew } from './ui'
import EarthMessages, { EarthToasts } from './earth'
import { useLang as useLangCtx } from './i18n'
import Settings from './screens/Settings'
import Ground, { GroundCrewRail } from './screens/Ground'
import { useGroundView } from './ViewSwitch'
import './ground.css'
import { SETTINGS_LABEL } from './settings'
import Greeting from './screens/Greeting'
import Trend from './screens/Trend'
import Body from './screens/Body'
import Talk from './screens/Talk'
import TriageHub from './screens/TriageHub'
import TriageRun from './screens/TriageRun'
import Wellbeing from './screens/Wellbeing'
import Station from './screens/Station'
import Demo from './screens/Demo'
import { EarProvider, VitalsBanner } from './voice'

// English only for the demo and the submission (decided by Carlos, 14-nov). The Spanish texts stay in i18n.ts:
// set this to true to bring back the EN/ES switch.
const SPANISH_ENABLED = false

function readLang(): Lang {
  if (!SPANISH_ENABLED) return 'en'
  try { const q = new URLSearchParams(location.hash.split('?')[1] ?? ''); const l = q.get('lang') ?? localStorage.getItem('metis.lang'); return l === 'es' ? 'es' : 'en' } catch { return 'en' }
}

export default function App() {
  const [lang, setLangState] = useState<Lang>(readLang)
  const [crewId, setCrewId] = useState('lena')
  const setLang = (l: Lang) => { setLangState(l); try { localStorage.setItem('metis.lang', l) } catch { /* ignore */ } }
  useEffect(() => { document.documentElement.lang = lang }, [lang])
  const loc = useLocation()
  return (
    <LangCtx.Provider value={{ lang, setLang }}>
      <CrewCtx.Provider value={{ crewId, setCrewId }}>
        <EarProvider>{loc.pathname.startsWith('/demo') ? <Demo /> : <Shell />}</EarProvider>
      </CrewCtx.Provider>
    </LangCtx.Provider>
  )
}

function Shell() {
  const t = useT()
  const loc = useLocation()
  const { lang } = useLangCtx()
  useEffect(() => { document.querySelector('.content')?.scrollTo(0, 0) }, [loc.pathname])
  const I = 18
  const groundView = useGroundView()
  const { crewId } = useCrew()
  return (
    <div className={`shell${groundView ? ' ground-shell' : ''}`}>
      <header className="mobile-header">
        <div className="brand mobile-brand"><span className="orb" />Metis</div>
        <NavLink to="/settings" className="mobile-settings" aria-label={SETTINGS_LABEL[lang]} title={SETTINGS_LABEL[lang]}>
          <SettingsIcon size={20} />
        </NavLink>
      </header>
      <nav className="rail" aria-label="Main">
        <div className="brand rail-brand"><span className="orb" />Metis</div>
        {groundView ? <>
          <NavLink to="/ground" end className={({ isActive }) => (isActive && !new URLSearchParams(loc.search).get('crew') ? 'active' : '')}><LayoutDashboard size={I} /><span>{lang === 'es' ? 'Centralita' : 'Station control'}</span></NavLink>
          <GroundCrewRail />
        </> : <>
        <div className="grp">{t('group_astronaut')}</div>
        <NavLink to="/today"><Sun size={I} /><span>{t('nav_today')}</span></NavLink>
        <NavLink to="/trends"><Activity size={I} /><span>{t('nav_trends')}</span></NavLink>
        <NavLink to="/body"><PersonStanding size={I} /><span>{t('nav_body')}</span></NavLink>
        <NavLink to="/talk"><MessageCircle size={I} /><span>{t('nav_talk')}</span></NavLink>
        <NavLink to="/triage"><Siren size={I} /><span>{t('nav_triage')}</span></NavLink>
        <NavLink to="/report"><HeartPulse size={I} /><span>{t('nav_report')}</span></NavLink>
        <NavLink to="/messages"><Radio size={I} /><span>{t('nav_messages')}</span></NavLink>
        </>}
        <NavLink to="/settings" className="rail-settings"><SettingsIcon size={I} /><span>{SETTINGS_LABEL[lang]}</span></NavLink>
      </nav>
      <main className="content">
        <VitalsBanner />
        <EarthToasts key={groundView ? 'ground' : crewId} viewer={groundView ? 'ground' : crewId} />
        <Routes>
          <Route path="/" element={<Navigate to="/today" replace />} />
          <Route path="/today" element={<Greeting />} />
          <Route path="/trends" element={<Trend />} />
          <Route path="/body" element={<Body />} />
          <Route path="/talk" element={<Talk />} />
          <Route path="/triage" element={<TriageHub />} />
          <Route path="/triage/run" element={<TriageRun />} />
          <Route path="/sleep-air" element={<Navigate to="/trends" replace />} />
          <Route path="/report" element={<Wellbeing />} />
          <Route path="/messages" element={<EarthMessages viewer={crewId} />} />
          <Route path="/station" element={<Station />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/ground" element={<Ground />} />
          <Route path="/references" element={<Navigate to="/settings" replace />} />
          <Route path="*" element={<Navigate to="/today" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export function LangSwitch() {
  const { lang, setLang } = useLangCtx()
  return (
    <div className="seg" role="group" aria-label="Language">
      <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')} aria-pressed={lang === 'en'}>EN</button>
      <button className={lang === 'es' ? 'on' : ''} onClick={() => setLang('es')} aria-pressed={lang === 'es'}>ES</button>
    </div>
  )
}
