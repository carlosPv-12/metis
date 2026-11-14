// Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
// "NASA data": every NASA source used in the demo and what it is used for.
import { Database, ExternalLink } from 'lucide-react'
import { api } from '../api'
import { useLoad } from '../hooks'
import { useLang, useT, pick, unitL, srcL, valueL, ES_RULE } from '../i18n'
import { Card, Page } from '../ui'
import { BloodPanel, baselineWindow } from './Trend'
import { useCrew } from '../ui'

export default function NasaData() {
  const t = useT(); const { lang } = useLang()
  const { data: ths } = useLoad(api.thresholds)
  const { crewId } = useCrew()
  const { data: c } = useLoad(() => api.crewOne(crewId), [crewId])
  return (
    <Page title={t('data_title')} sub={t('data_sub')}>
      <div className="grid g2">
        <Card title={<><Database size={14} />{t('src_hrp')}</>}>
          <p style={{ marginTop: 0 }}>{t('src_hrp_use')}</p>
          <div className="small"><a href="https://www.nasa.gov/hrp/risks/" target="_blank" rel="noreferrer">nasa.gov/hrp/risks <ExternalLink size={11} /></a> · <a href="https://www.nasa.gov/hrp/hazards/" target="_blank" rel="noreferrer">nasa.gov/hrp/hazards <ExternalLink size={11} /></a></div>
        </Card>
        <Card title={<><Database size={14} />{t('src_osdr')}</>} right={<span className="tag real">{t('real_badge')}</span>}>
          <p style={{ marginTop: 0 }}>{t('src_osdr_use')}</p>
          <div className="small"><a href="https://osdr.nasa.gov/osdr/data/osd/files/569" target="_blank" rel="noreferrer">osdr.nasa.gov/osdr/data/osd/files/569 <ExternalLink size={11} /></a></div>
        </Card>
      </div>
      <Card style={{ marginTop: 18 }} title={t('nasa_line')} right={<span className="small muted">{t('your_band')}: {baselineWindow(c as unknown as Record<string, unknown>, ths, lang, t)}</span>}>
        <table className="t">
          <thead><tr><th></th><th>{t('rules')}</th><th className="n">{t('value')}</th><th>{t('sources')}</th><th></th></tr></thead>
          <tbody>{(ths ?? []).map(x => (
            <tr key={x.id}>
              <td>{pick(x as never, 'label', lang)}</td><td className="small muted">{x.rule && x.rule.length > 2 ? (lang === 'es' ? (x as { rule_es?: string }).rule_es ?? ES_RULE[x.id] ?? x.rule : x.rule) : ''}</td>
              <td className="n" style={{ whiteSpace: 'nowrap' }}>{x.rule && x.rule.length <= 2 ? x.rule + ' ' : ''}{valueL(x.value, lang)} {unitL(x.unit, lang)}</td>
              <td className="small">{x.source_url ? <a href={x.source_url} target="_blank" rel="noreferrer">{srcL(x.source_title, lang)}</a> : <span className="muted">{srcL(x.source_title, lang)}</span>}</td>
              <td><span className={`tag ${x.verified ? 'ok' : 'watch'}`}>{x.verified ? t('verified') : t('unverified')}</span></td>
            </tr>
          ))}</tbody>
        </table>
      </Card>
      <BloodPanel />
    </Page>
  )
}
