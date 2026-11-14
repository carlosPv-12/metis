import { Link } from 'react-router-dom'
import { useLang } from './i18n'
import { fmtLinkDelay, useLink } from './link'
import './link.css'

export default function LinkChip() {
  const { lang } = useLang()
  const link = useLink()
  const text = { en: 'Mission environment settings', es: 'Ajustes del entorno de la misión' }[lang]
  return <Link to="/settings" className={`pill link-chip ${link.mode === 'none' ? 'link-offline' : ''}`} aria-label={`${text}: ${link.short[lang]}${link.delayS == null ? '' : `, ${fmtLinkDelay(link.delayS, lang)}`}`}>
    <span className="link-dot" aria-hidden />{link.short[lang]}{link.delayS != null && <> {fmtLinkDelay(link.delayS, lang)}</>}
  </Link>
}
