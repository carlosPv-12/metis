import type { Graph, Threshold } from './api'
import { FALLBACK_THRESHOLDS } from './fallback'
import tree from '../../backend/triage_tree.json'
import config from '../../data/config.json'

export type Copy = { en: string; es: string }
export type ReferenceGroup = 'risks' | 'data' | 'thresholds' | 'triage' | 'sleep' | 'assumptions' | 'assets'
export interface Reference {
  id: string
  title: Copy
  description: Copy
  url?: string
  group: ReferenceGroup
  status: 'real' | 'verified' | 'assumption' | 'document' | 'unlinked'
  aliases?: string[]
}
const copy = (en: string, es = en): Copy => ({ en, es })
export const REFERENCE_GROUPS: { id: ReferenceGroup; title: Copy }[] = [
  { id: 'risks', title: copy('NASA risks', 'Riesgos de la NASA') },
  { id: 'data', title: copy('Real data', 'Datos reales') },
  { id: 'thresholds', title: copy('Thresholds and reference values', 'Umbrales y valores de referencia') },
  { id: 'triage', title: copy('Triage and emergency protocols', 'Protocolos de triaje y emergencias') },
  { id: 'sleep', title: copy('Sleep, CO₂ and heart', 'Sueño, CO₂ y corazón') },
  { id: 'assumptions', title: copy('Prototype assumptions (no published source)', 'Supuestos del prototipo (sin fuente publicada)') },
  { id: 'assets', title: copy('Visual resources', 'Recursos visuales') },
]
const NASA = 'https://www.nasa.gov/'
const OSD = 'https://osdr.nasa.gov/osdr/data/osd/files/569'
const descriptions: Record<string, Copy> = {
  cpr_microgravity: copy('Informs the guided response to a collapse in microgravity.', 'Orienta la respuesta guiada ante un desplome en microgravedad.'),
  acls_iss: copy('Provides context for resuscitation procedures aboard the ISS.', 'Aporta contexto para los procedimientos de reanimación en la ISS.'),
  code_blue: copy('Provides context for coordinating an emergency on orbit.', 'Aporta contexto para coordinar una emergencia en órbita.'),
  std3001_v1: copy('Supports the reference of at least two trained crew medical officers per vehicle.', 'Respalda la referencia de formar al menos a dos oficiales médicos por vehículo.'),
  ochmo_tb033: copy('Provides context for medical care and crew roles in flight.', 'Aporta contexto sobre la atención médica y las funciones de la tripulación en vuelo.'),
  hrp_cardiac: copy('Explains why a pulse alert needs an ECG to confirm an arrhythmia.', 'Explica por qué un aviso de pulso necesita un ECG para confirmar una arritmia.'),
  co2_tb004: copy('Supports cabin CO₂ design limits and the context for headache, fatigue and sleep alerts.', 'Respalda los límites de diseño de CO₂ y el contexto de los avisos de cefalea, fatiga y sueño.'),
  sleep_barger: copy('Provides the observed ISS sleep reference of 6.09 hours per night.', 'Aporta la referencia observada de 6,09 horas de sueño por noche en la ISS.'),
  erc_bls_2021: copy('Informs the breathing checks in the prototype triage tree.', 'Orienta las comprobaciones de respiración del árbol de triaje del prototipo.'),
  hrp_risks: copy('Connects body areas and alerts to NASA human spaceflight risks.', 'Relaciona las zonas del cuerpo y los avisos con los riesgos del vuelo espacial de la NASA.'),
}
const sleepSources = new Set(['hrp_cardiac', 'co2_tb004', 'sleep_barger'])
const triageReferences: Reference[] = Object.entries(tree.sources).map(([id, source]) => ({
  id, title: copy(source.title), url: source.url,
  description: descriptions[id] ?? copy('Informs the prototype triage tree.', 'Orienta el árbol de triaje del prototipo.'),
  group: id === 'hrp_risks' ? 'risks' : id === 'std3001_v1' ? 'thresholds' : sleepSources.has(id) ? 'sleep' : 'triage',
  status: 'verified', aliases: [`src:${id}`],
}))
const fixedReferences: Reference[] = [
  { id: 'hrp_hazards', title: copy('NASA HRP — 5 Hazards of Human Spaceflight', 'NASA HRP — Los cinco peligros del vuelo espacial'), url: `${NASA}hrp/hazards/`, group: 'risks', status: 'verified', aliases: ['src:hrp_hazards'], description: copy('Provides context for cabin conditions, isolation and the delay to Earth.', 'Aporta contexto sobre la cabina, el aislamiento y el retraso con la Tierra.') },
  { id: 'osd569', title: copy('NASA OSDR OSD-569 — Inspiration4'), url: OSD, group: 'data', status: 'real', aliases: ['src:osd569', 'osdr'], description: copy('Provides real blood counts to compare pre-flight samples with the first day after return.', 'Aporta hemogramas reales para comparar las muestras previas al vuelo con el primer día tras el regreso.') },
  { id: 'sleep_recommended', title: copy('NASA OCHMO-TB-041 Rev A — Sleep Accommodations'), url: `${NASA}wp-content/uploads/2023/03/sleep-accomodations-technical-brief-ochmo.pdf`, group: 'sleep', status: 'verified', description: copy('Supports the reference of 7–9 hours of sleep.', 'Respalda la referencia de dormir entre 7 y 9 horas.') },
  { id: 'hr_inflight', title: copy('Hughson et al. (2017), J Appl Physiol — Table 1'), url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5792103/', group: 'sleep', status: 'verified', description: copy('Provides a group heart-rate reference from nine astronauts, separate from personal baselines.', 'Aporta una referencia de pulso de nueve astronautas, distinta de la línea base personal.') },
  { id: 'pvt_b', title: copy('Basner M, Mollicone D, Dinges DF (2011). Validity and sensitivity of a brief psychomotor vigilance test (PVT-B) to total and partial sleep deprivation. Acta Astronautica 69:949–959.'), url: 'https://doi.org/10.1016/j.actaastro.2011.07.015', group: 'sleep', status: 'verified', description: copy('Informs the short reaction-time exercise; the browser version is not a validated clinical test.', 'Orienta el ejercicio breve de tiempo de reacción; la versión del navegador no es una prueba clínica validada.') },
  { id: 'blender', title: copy('Blender Studio — Human Base Meshes'), url: 'https://www.blender.org/download/demo-files/#assets', group: 'assets', status: 'document', description: copy('Provides the female and male 3D body meshes under CC0.', 'Aporta las mallas 3D de mujer y hombre con licencia CC0.') },
  { id: 'brand', title: copy('NASA Space Apps — Brand Guidelines', 'NASA Space Apps — Guía de marca'), url: 'https://assets.spaceappschallenge.org/media/documents/Space_Apps_Brand_Guide_-_23_May_2025.pdf', group: 'assets', status: 'document', description: copy('Guides the colours and use of Fira Sans, Overpass and Fira Code in Metis.', 'Orienta los colores y el uso de Fira Sans, Overpass y Fira Code en Metis.') },
  ...['fira-sans', 'overpass', 'fira-code'].map((font): Reference => ({ id: font, title: copy(`Fontsource — ${font === 'overpass' ? 'Overpass' : font === 'fira-code' ? 'Fira Code' : 'Fira Sans'}`), url: `https://fontsource.org/fonts/${font}`, group: 'assets', status: 'document', description: copy('Provides a locally bundled typeface under the SIL Open Font License 1.1.', 'Aporta una tipografía incluida en la app con licencia SIL Open Font License 1.1.') })),
]
const assumptionDescriptions: Record<string, Copy> = {
  hrv_band: copy('Uses synthetic HRV values and a personal band, with no published astronaut reference value.', 'Usa valores sintéticos de VFC y una banda personal, sin valor de referencia publicado para astronautas.'),
  baseline_band_sd: copy('Sets the demo personal band to the mean plus or minus two standard deviations.', 'Fija la banda personal de la demo en la media más o menos dos desviaciones estándar.'),
  baseline_days: copy('Uses the first 21 simulated days to learn each personal baseline.', 'Usa los primeros 21 días simulados para aprender cada línea base personal.'),
}
function thresholdReference(th: Threshold): Reference {
  const assumption = !th.verified && !th.source_url
  const id = th.id === 'hrv' ? 'hrv_band' : th.id
  return {
    id: `threshold:${id}`, title: assumption ? copy(th.label_en, th.label_es) : copy(th.source_title),
    url: safeReferenceUrl(th.source_url), group: assumption ? 'assumptions' : 'thresholds',
    status: assumption ? 'assumption' : th.verified ? 'verified' : 'document',
    description: assumptionDescriptions[id] ?? copy(`Provides context for “${th.label_en}”.`, `Aporta contexto para «${th.label_es}».`),
  }
}
export function safeReferenceUrl(value?: string): string | undefined {
  try { const url = new URL(value ?? ''); return ['https:', 'http:'].includes(url.protocol) ? url.href : undefined } catch { return undefined }
}
function normalized(value: string) { return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '') }
function urlKey(url?: string) { return url?.replace(/\/$/, '').toLowerCase() }
/** Keep one card per document; separate assumptions are individual design choices. */
function deduplicate(entries: Reference[]): Reference[] {
  const result: Reference[] = []
  for (const entry of entries) {
    const existing = result.find(r => r.id === entry.id || (r.status !== 'assumption' && entry.status !== 'assumption' && ((r.url && entry.url && urlKey(r.url) === urlKey(entry.url)) || normalized(r.title.en) === normalized(entry.title.en))))
    if (existing) existing.aliases = [...new Set([...(existing.aliases ?? []), entry.id, entry.title.en, entry.title.es, ...(entry.aliases ?? [])])]
    else result.push({ ...entry, aliases: [...(entry.aliases ?? [])] })
  }
  return result
}
/** Bundled catalogue renders immediately, including every source from config and triage. */
export const LOCAL_REFERENCES = deduplicate([
  ...triageReferences, ...fixedReferences,
  ...config.catalog.map(thresholdReference), ...FALLBACK_THRESHOLDS.map(thresholdReference),
])
export function collectReferences(thresholds: Threshold[] = [], graph?: Graph): Reference[] {
  const entries = deduplicate([...LOCAL_REFERENCES, ...thresholds.map(thresholdReference)])
  for (const node of graph?.nodes.filter(n => n.type === 'source') ?? []) {
    const match = entries.find(r => [r.id, r.title.en, r.title.es, ...(r.aliases ?? [])].some(key => normalized(key) === normalized(node.id) || normalized(key) === normalized(node.label_en) || normalized(key) === normalized(node.label_es)))
    if (match) { match.aliases = [...(match.aliases ?? []), node.label_en, node.label_es]; continue }
    const url = safeReferenceUrl((node as typeof node & { url?: string }).url) ?? safeReferenceUrl(node.label_en)
    entries.push({ id: node.id, title: copy(node.label_en, node.label_es), url, group: 'thresholds', status: url ? 'document' : 'unlinked', description: copy('Listed as a source in the Metis knowledge graph.', 'Figura como fuente en el grafo de conocimiento de Metis.') })
  }
  return deduplicate(entries)
}
export function searchReferences(entries: Reference[], query: string): Reference[] {
  const words = query.trim().split(/\s+/).map(normalized).filter(Boolean)
  return entries.filter(r => {
    const group = REFERENCE_GROUPS.find(g => g.id === r.group)!
    const text = normalized([r.title.en, r.title.es, r.description.en, r.description.es, r.url, group.title.en, group.title.es, ...(r.aliases ?? [])].join(' '))
    return words.every(word => text.includes(word))
  })
}
