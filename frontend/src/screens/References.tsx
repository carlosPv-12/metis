import { useEffect, useState } from 'react'
import { api } from '../api'
import { useLang } from '../i18n'
import { Page, Shape } from '../ui'
import { collectReferences, LOCAL_REFERENCES, REFERENCE_GROUPS, searchReferences } from '../references'
import '../references.css'

const COPY = {
  es: {
    title: 'Referencias', sub: 'De dónde salen los datos, las reglas y los recursos de Metis.',
    search: 'Buscar referencias', placeholder: 'Prueba con sueño, CO₂ o triaje', clear: 'Borrar búsqueda',
    count: (shown: number, total: number) => `${shown} de ${total} referencias y supuestos`,
    note: 'La lista se puede consultar sin conexión. Los enlaces externos necesitan internet y se abren en otra pestaña.',
    scope: '«Verificado» identifica las fuentes documentadas en el proyecto. No significa que el triaje o Metis tengan validación clínica.',
    simulated: 'Las constantes de la tripulación son simuladas. Los hemogramas de OSD-569 son datos reales.',
    empty: 'No hay coincidencias. Prueba con otra palabra.', open: 'Abrir documento', newTab: 'se abre en otra pestaña',
    missing: 'El grafo no facilita un enlace para esta fuente.',
    status: { real: 'Datos reales', verified: 'Verificado', assumption: 'Supuesto', document: 'Recurso', unlinked: 'Sin enlace' },
  },
  en: {
    title: 'References', sub: 'Where the data, rules and resources in Metis come from.',
    search: 'Search references', placeholder: 'Try sleep, CO₂ or triage', clear: 'Clear search',
    count: (shown: number, total: number) => `${shown} of ${total} references and assumptions`,
    note: 'You can read this list offline. External links need internet and open in a new tab.',
    scope: '“Verified” identifies sources documented in the project. It does not mean the triage or Metis has clinical validation.',
    simulated: 'Crew vitals are simulated. The OSD-569 blood counts are real data.',
    empty: 'No matches. Try another word.', open: 'Open document', newTab: 'opens in a new tab',
    missing: 'The graph does not provide a link for this source.',
    status: { real: 'Real data', verified: 'Verified', assumption: 'Assumption', document: 'Resource', unlinked: 'No link' },
  },
}

export default function References({ embedded = false }: { embedded?: boolean } = {}) {
  const { lang } = useLang()
  const t = COPY[lang]
  const [query, setQuery] = useState('')
  const [references, setReferences] = useState(LOCAL_REFERENCES)
  useEffect(() => {
    let alive = true
    // Supplement the bundled list; the screen never waits for the backend.
    void Promise.allSettled([api.thresholds(), api.graph()]).then(([thresholds, graph]) => {
      if (alive) setReferences(collectReferences(thresholds.status === 'fulfilled' ? thresholds.value : [], graph.status === 'fulfilled' ? graph.value : undefined))
    })
    return () => { alive = false }
  }, [])
  const visible = searchReferences(references, query)
  const body = <div className="metis-references">
      <div className="card references-intro">
        <div className="references-search" role="search" aria-label={t.search}>
          <label htmlFor="references-search">{t.search}</label>
          <div className="references-search-row">
            <input id="references-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={t.placeholder} aria-describedby="references-count" />
            {query && <button type="button" className="btn" onClick={() => setQuery('')}>{t.clear}</button>}
          </div>
        </div>
        <p id="references-count" className="references-count" role="status" aria-live="polite" aria-atomic="true">{t.count(visible.length, references.length)}</p>
        
      </div>
      {!visible.length && <p className="card references-empty">{t.empty}</p>}
      {REFERENCE_GROUPS.map(group => {
        const entries = visible.filter(r => r.group === group.id)
        if (!entries.length) return null
        return <section key={group.id} aria-labelledby={`references-${group.id}`} className="references-group">
          <h2 id={`references-${group.id}`}>{group.title[lang]} <span className="pill">{entries.length}</span></h2>
          <ul className="references-grid">
            {entries.map(reference => <li className="card reference-card" key={reference.id}>
              <span className={`tag reference-tag reference-tag-${reference.status}`}>
                <Shape level={reference.status === 'assumption' || reference.status === 'unlinked' ? 'watch' : 'ok'} />
                {t.status[reference.status]}
              </span>
              <h3 lang={reference.title.en === reference.title.es ? 'en' : lang}>{reference.title[lang]}</h3>
              <p>{reference.description[lang]}</p>
              {reference.url && <a href={reference.url} target="_blank" rel="noopener noreferrer" aria-label={`${t.open}: ${reference.title[lang]} (${t.newTab})`}>
                {t.open} <span aria-hidden="true">↗</span><span className="reference-url">{reference.url}</span>
              </a>}
              {reference.status === 'unlinked' && <p className="references-note">{t.missing}</p>}
            </li>)}
          </ul>
        </section>
      })}
    </div>
  // Shown as a section inside Settings (embedded) or, for old links, as its own page.
  return embedded
    ? <section className="settings-references" id="references" aria-labelledby="references-title"><h2 id="references-title" className="h1 section-h">{t.title}</h2>{body}</section>
    : <Page title={t.title}>{body}</Page>
}
