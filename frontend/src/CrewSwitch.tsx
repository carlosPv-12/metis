// Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
// Top-bar crew picker: shows only the active crew member; the "+" button opens the list of the whole crew.
import { useEffect, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { api } from './api'
import { useLoad } from './hooks'
import { useLang } from './i18n'
import { useCrew } from './ui'
import CrewAvatar from './CrewAvatar'

const TXT = {
  en: { pick: 'Choose crew member', crew: 'Crew' },
  es: { pick: 'Elegir tripulante', crew: 'Tripulación' },
}

export default function CrewSwitch() {
  const { lang } = useLang()
  const s = TXT[lang]
  const { crewId, setCrewId } = useCrew()
  const { data } = useLoad(api.station)
  const crew = data?.crew ?? [{ id: 'lena', name: 'Lena', role_en: '', role_es: '' }, { id: 'marco', name: 'Marco', role_en: '', role_es: '' }]
  const cur = crew.find(c => c.id === crewId) ?? crew[0]
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)
  const btn = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const out = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); btn.current?.focus() } }
    document.addEventListener('mousedown', out); document.addEventListener('keydown', esc)
    wrap.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus()
    return () => { document.removeEventListener('mousedown', out); document.removeEventListener('keydown', esc) }
  }, [open])

  const choose = (id: string) => { setCrewId(id); setOpen(false); btn.current?.focus() }

  return (
    <div className="crew-switch" ref={wrap}>
      <span className="crew-current"><CrewAvatar id={cur.id} name={cur.name} size={30} />{cur.name}</span>
      <button ref={btn} type="button" className="crew-more" aria-haspopup="listbox" aria-expanded={open} aria-label={s.pick} title={s.pick} onClick={() => setOpen(o => !o)}>
        <Plus size={16} />
      </button>
      {open && (
        <div className="crew-menu" role="listbox" aria-label={s.crew}>
          {crew.map(c => {
            const role = lang === 'es' ? c.role_es : c.role_en
            return (
              <button key={c.id} type="button" role="option" aria-selected={c.id === crewId} className={c.id === crewId ? 'on' : ''} onClick={() => choose(c.id)}>
                <CrewAvatar id={c.id} name={c.name} size={36} />
                <span><span className="crew-name">{c.name}</span>{role && <span className="crew-role">{role}</span>}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
