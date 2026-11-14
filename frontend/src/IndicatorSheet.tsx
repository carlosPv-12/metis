import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { api } from './api'
import { useLoad } from './hooks'
import { useLang } from './i18n'
import { INDICATORS, SHEET_COPY, type IndicatorId } from './indicators'
import { findThr, numVal } from './thresholds'
import './indicators.css'

export function IndicatorSheet({ indicator, collapsible = false }: { indicator: IndicatorId; collapsible?: boolean }) {
  const { lang } = useLang()
  const copy = SHEET_COPY[lang], content = INDICATORS[indicator][lang]
  const { data: thresholds } = useLoad(api.thresholds)
  const co2 = numVal(findThr(thresholds, 'co2_1h', /co2.*1h|co2_limit|co2_1/))
  const sections = [
    { title: copy.measured, text: content.measured },
    { title: copy.action, text: content.action },
  ]
  return <div className="indicator-sheet">
    {sections.map(s => collapsible
      ? <details key={s.title}><summary>{s.title}</summary><p>{s.text}</p></details>
      : <section key={s.title}><h3>{s.title}</h3><p>{s.text}</p></section>)}
    {(indicator === 'lungs' || indicator === 'co2_night_peak_mmhg') && Number.isFinite(co2) && <p className="indicator-limit">{copy.co2} <strong>{co2.toLocaleString(lang === 'es' ? 'es-ES' : 'en-US')} mmHg</strong>. {copy.caution}</p>}
    <Link className="btn" to="/triage">{copy.triage} →</Link>
  </div>
}

export function IndicatorButton({ indicator }: { indicator: IndicatorId }) {
  const { lang } = useLang()
  const copy = SHEET_COPY[lang]
  const [open, setOpen] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const close = () => { setOpen(false); trigger.current?.focus() }
  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal()
    else if (!open && dialog.current?.open) dialog.current.close()
  }, [open])
  return <>
    <button ref={trigger} type="button" className="btn indicator-button" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>{copy.button}<span className="indicator-sr"> {INDICATORS[indicator][lang].title}</span></button>
    {open && createPortal(<dialog ref={dialog} className="indicator-dialog" aria-labelledby={titleId} onCancel={close} onClose={close}>
      <div className="indicator-dialog-heading"><h2 id={titleId}>{INDICATORS[indicator][lang].title}</h2><button type="button" className="btn" autoFocus onClick={close}>{copy.close} ×</button></div>
      <IndicatorSheet indicator={indicator} />
    </dialog>, document.body)}
  </>
}
