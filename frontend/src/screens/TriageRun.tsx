import { useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useLang } from '../i18n'
import Triage from './Triage'
import TriageVoice from '../triage/TriageVoice'
import { copy } from '../triage/copy'
import { getFlows } from '../triage/data'
import Orbit from '../triage/Orbit'
import '../triage.css'

function Runner({ voice, mind }: { voice: boolean; mind: boolean }) {
  const runner = useRef<HTMLDivElement>(null)
  const { lang } = useLang()
  return <div className="triage-run triage-run-session" data-lang={lang}>
    <Orbit />
    <div ref={runner} className="triage-run-content"><Triage /></div>
    <TriageVoice runner={runner} enabled={voice} mind={mind} />
  </div>
}

export default function TriageRun() {
  const { lang } = useLang()
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  const flow = getFlows(lang).find(item => item.id === params.get('flow'))
  if (!flow) return <div className="triage-run"><div className="page"><p>{copy[lang].invalid}</p><Link className="triage-talk" to="/triage">{copy[lang].hub}</Link></div></div>
  // Remount when the URL changes: the legacy runner reads ?flow only on mount.
  return <Runner key={location.search} voice={params.get('voice') === '1'} mind={flow.group === 'mind'} />
}
