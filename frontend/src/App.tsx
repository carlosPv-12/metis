// Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
import { useEffect, useState } from 'react'
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Activity, BookOpen, Database, Film, HeartPulse, LayoutDashboard, MessageCircle, MoonStar, PersonStanding, Send, Siren, Sun } from 'lucide-react'
import { LangCtx, useT, habitatTime, type Lang } from './i18n'
import { CrewCtx, useCrew } from './ui'
import { useLoad } from './hooks'
import { useLang as useLangCtx } from './i18n'
import { api, NO_SERVER } from './api'
import Greeting from './screens/Greeting'
import Trend from './screens/Trend'
import Body from './screens/Body'
import Talk from './screens/Talk'
import Triage from './screens/Triage'
import SleepAir from './screens/SleepAir'
import Summary from './screens/Summary'
import Station from './screens/Station'
import How from './screens/How'
import NasaData from './screens/NasaData'
import Demo from './screens/Demo'
import { EarProvider, EarSwitch, VitalsBanner } from './voice'

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
  const [now, setNow] = useState(() => new Date())
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(id) }, [])
  const hhmm = habitatTime(now.getTime())
  const loc = useLocation()
  useEffect(() => { document.querySelector('.content')?.scrollTo(0, 0) }, [loc.pathname])
  const I = 18
  return (
    <div className="shell">
      <header className="top">
        <div className="brand"><span className="orb" />Metis</div>
        <div className="day"><span>{t('mission_day')} <b>112</b></span><span>{hhmm} <span className="dim">{t('habitat_time')}</span></span></div>
        <div className="spacer" />
        <EarSwitch />
        <CrewSwitch />
        <span className="pill ok" title={t('offline_badge')}><span className="dot" style={{ background: 'var(--ok)' }} />{t('offline_badge')}</span>
        {NO_SERVER && <span className="tag sim" title={t('no_server_tip')}>{t('no_server_badge')}</span>}
        {SPANISH_ENABLED && <LangSwitch />}
      </header>
      <nav className="rail" aria-label="Main">
        <div className="grp">{t('group_astronaut')}</div>
        <NavLink to="/today"><Sun size={I} /><span>{t('nav_today')}</span></NavLink>
        <NavLink to="/trends"><Activity size={I} /><span>{t('nav_trends')}</span></NavLink>
        <NavLink to="/body"><PersonStanding size={I} /><span>{t('nav_body')}</span></NavLink>
        <NavLink to="/talk"><MessageCircle size={I} /><span>{t('nav_talk')}</span></NavLink>
        <NavLink to="/triage"><Siren size={I} /><span>{t('nav_triage')}</span></NavLink>
        <NavLink to="/sleep-air"><MoonStar size={I} /><span>{t('nav_sleepair')}</span></NavLink>
        <NavLink to="/report"><Send size={I} /><span>{t('nav_report')}</span></NavLink>
        <div className="grp">{t('group_station')}</div>
        <NavLink to="/station"><LayoutDashboard size={I} /><span>{t('nav_station')}</span></NavLink>
        <div className="grp">{t('group_about')}</div>
        <NavLink to="/how"><BookOpen size={I} /><span>{t('nav_how')}</span></NavLink>
        <NavLink to="/data"><Database size={I} /><span>{t('nav_data')}</span></NavLink>
        <NavLink to="/demo"><Film size={I} /><span>{t('nav_demo')}</span></NavLink>
        <div className="foot"><HeartPulse size={13} style={{ verticalAlign: -2, marginRight: 5 }} />{t('simulated_note')}<br /><br />{t('not_diagnosis')}</div>
      </nav>
      <main className="content">
        <VitalsBanner />
        <Routes>
          <Route path="/" element={<Navigate to="/today" replace />} />
          <Route path="/today" element={<Greeting />} />
          <Route path="/trends" element={<Trend />} />
          <Route path="/body" element={<Body />} />
          <Route path="/talk" element={<Talk />} />
          <Route path="/triage" element={<Triage />} />
          <Route path="/sleep-air" element={<SleepAir />} />
          <Route path="/report" element={<Summary />} />
          <Route path="/station" element={<Station />} />
          <Route path="/how" element={<How />} />
          <Route path="/data" element={<NasaData />} />
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

function CrewSwitch() {
  const t = useT()
  const { crewId, setCrewId } = useCrew()
  const { data } = useLoad(api.crew)
  const crew = data?.crew ?? [{ id: 'lena', name: 'Lena' }, { id: 'marco', name: 'Marco' }]
  return (
    <div className="row small"><span className="muted">{t('viewing_as')}</span>
      <div className="seg" role="group" aria-label={t('viewing_as')}>
        {crew.map(c => <button key={c.id} className={crewId === c.id ? 'on' : ''} onClick={() => setCrewId(c.id)}>{c.name}</button>)}
      </div>
    </div>
  )
}
