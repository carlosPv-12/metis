import { useEffect, useRef, useState } from 'react'
import { Activity, Bandage, Brain, CloudRain, Eye, Flame, HeartPulse, MessageCircle, Moon, MousePointer2, Siren, Thermometer, Users, Wind, X, type LucideIcon } from 'lucide-react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useLang, useT } from '../i18n'
import { Page } from '../ui'
import { copy } from '../triage/copy'
import { getFlows, type FlowGroup, type HubFlow } from '../triage/data'
import Orbit from '../triage/Orbit'
import '../triage.css'

// Keep the tree’s icon names explicit so the whole Lucide library is not bundled.
const flowIcons: Record<string, LucideIcon> = { Activity, Bandage, Brain, CloudRain, Eye, Flame, HeartPulse, Moon, Siren, Thermometer, Users, Wind }

function FlowIcon({ flow }: { flow: HubFlow }) {
  const Icon: LucideIcon = flowIcons[flow.icon] ?? (flow.group === 'emergency' ? Siren : HeartPulse)
  return <Icon size={28} strokeWidth={1.8} aria-hidden="true" />
}

function ModeDialog({ flow, onClose }: { flow: HubFlow; onClose: () => void }) {
  const { lang } = useLang()
  const s = copy[lang]
  const navigate = useNavigate()
  const dialog = useRef<HTMLDialogElement>(null)
  const voice = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const element = dialog.current
    const previous = document.activeElement as HTMLElement | null
    element?.showModal()
    voice.current?.focus()
    return () => { element?.close(); previous?.focus() }
  }, [])
  const choose = (enabled: boolean) => navigate(`/triage/run?${new URLSearchParams({ flow: flow.id, voice: enabled ? '1' : '0' })}`)
  return (
    <dialog ref={dialog} className="triage-mode" aria-labelledby="triage-mode-title" aria-describedby="triage-mode-flow"
      onCancel={onClose} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="triage-mode-content">
        <button type="button" className="triage-close" aria-label={s.close} onClick={onClose}><X size={22} aria-hidden="true" /></button>
        <p id="triage-mode-flow" className="triage-mode-flow">{flow.title}</p>
        <h2 id="triage-mode-title">{s.choose}</h2>
        <button type="button" ref={voice} className="triage-mode-choice triage-mode-voice" onClick={() => choose(true)}>
          <MessageCircle size={28} aria-hidden="true" /><span><strong>{s.voice}</strong><small>{s.voiceHint}</small></span>
        </button>
        <button type="button" className="triage-mode-choice" onClick={() => choose(false)}>
          <MousePointer2 size={28} aria-hidden="true" /><span><strong>{s.screen}</strong><small>{s.screenHint}</small></span>
        </button>
      </div>
    </dialog>
  )
}

export default function TriageHub() {
  const { lang } = useLang()
  const t = useT()
  const location = useLocation()
  const [selected, setSelected] = useState<HubFlow | null>(null)
  const legacyFlow = new URLSearchParams(location.search).get('flow')
  const flows = getFlows(lang)
  if (legacyFlow) return <Navigate replace to={`/triage/run?${new URLSearchParams({ flow: legacyFlow })}`} />
  return (
    <div className="triage-run triage-hub">
      <Page title={t('triage_title')} sub={copy[lang].intro}>
        <Orbit />
        {(['emergency', 'health', 'mind'] as FlowGroup[]).map(group => {
          const items = flows.filter(flow => flow.group === group)
          return (
            <section key={group} className={`triage-group triage-group-${group}`} aria-labelledby={`triage-group-${group}`}>
              <h2 id={`triage-group-${group}`}>{copy[lang][group]} <span className="triage-count">{items.length}</span></h2>
              <div className="triage-flow-grid">
                {items.map(flow => (
                  <button type="button" key={flow.id} className="triage-flow" aria-haspopup="dialog" onClick={() => setSelected(flow)}>
                    <span className="triage-flow-icon"><FlowIcon flow={flow} /></span>
                    <span className="triage-flow-text"><strong>{flow.title}</strong>{flow.summary && flow.summary.trim().toLowerCase() !== flow.title.trim().toLowerCase() && <span>{flow.summary}</span>}</span>
                    <span className="triage-flow-status">{copy[lang][group === 'emergency' ? 'urgent' : group === 'health' ? 'guided' : 'listening']}</span>
                  </button>
                ))}
              </div>
            </section>
          )
        })}
        {selected && <ModeDialog flow={selected} onClose={() => setSelected(null)} />}
      </Page>
    </div>
  )
}
