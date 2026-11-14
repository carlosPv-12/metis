// Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
// Local fallback data, used only when the backend endpoint is missing or down. All crew data is fictional.
import type { Lang } from './i18n'
import type { Station, Threshold, Graph, Chat } from './api'
import crewFile from '../../data/crew_lena.json'

const OCHMO_CO2 = 'https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-004-carbon-dioxide.pdf'

export const FALLBACK_THRESHOLDS: Threshold[] = [
  { id: 'co2_1h', label_en: 'Cabin CO₂, 1-hour average limit', label_es: 'CO₂ de cabina, límite de la media de 1 h', value: 3, unit: 'mmHg', rule: '≤', source_title: 'NASA-STD-3001 Vol. 2 [V2 6004], via OCHMO-TB-004 Carbon Dioxide', source_url: OCHMO_CO2, verified: true },
  { id: 'co2_7d_headache', label_en: 'CO₂ 7-day average to keep headache risk < 1%', label_es: 'CO₂ media de 7 días para riesgo de cefalea < 1 %', value: 2.5, unit: 'mmHg', rule: '<', source_title: 'OCHMO-TB-004 Carbon Dioxide, p. 5', source_url: OCHMO_CO2, verified: true },
  { id: 'co2_symptoms', label_en: 'CO₂ level with fatigue, malaise, decreased sleep', label_es: 'CO₂ con fatiga, malestar y menos sueño', value: 4.5, unit: 'mmHg', rule: '>', source_title: 'OCHMO-TB-004 Carbon Dioxide, p. 4', source_url: OCHMO_CO2, verified: true },
  { id: 'sleep_inflight', label_en: 'Average sleep in flight (ISS, actigraphy)', label_es: 'Sueño medio en vuelo (ISS, actigrafía)', value: '6.09 ± 0.67', unit: 'h', source_title: 'Barger et al., Lancet Neurology 2014 (PMC4188436)', source_url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4188436/', verified: true },
  { id: 'sleep_recommended', label_en: 'Recommended sleep', label_es: 'Sueño recomendado', value: '7–9', unit: 'h', source_title: 'NASA OCHMO-TB-041 Sleep Accommodations', source_url: 'https://www.nasa.gov/wp-content/uploads/2023/03/sleep-accomodations-technical-brief-ochmo.pdf', verified: true },
  { id: 'hr_inflight', label_en: 'Heart rate in flight (ISS, 9 astronauts)', label_es: 'Pulso en vuelo (ISS, 9 astronautas)', value: '60.0 ± 10.6', unit: 'bpm', source_title: 'Hughson et al., J Appl Physiol 2017 (PMC5792103), Table 1', source_url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5792103/', verified: true },
  { id: 'cmo_min', label_en: 'Crew Medical Officers per vehicle (minimum)', label_es: 'Oficiales médicos por vehículo (mínimo)', value: 2, unit: 'CMOs', rule: '≥', source_title: 'NASA-STD-3001 Vol. 1 Rev C [V1 3006]', source_url: 'https://standards.nasa.gov/sites/default/files/standards/NASA/C//nasa-std-3001-vol-1-rev-c-signature.pdf', verified: true },
  { id: 'hrv', label_en: 'HRV reference value for astronauts in flight', label_es: 'Valor de referencia de VFC en vuelo', value: '—', unit: 'ms', source_title: 'Not found in an open primary source; personal baseline only', verified: false },
]

export const FALLBACK_STATION: Station = {
  mission_day: 112,
  crew: [
    { id: 'lena', name: 'Lena', role_en: 'Flight engineer', role_es: 'Ingeniera de vuelo', status: 'watch', location: 'Crew quarters', hr: 66, alerts: ['sleep', 'co2'], note_en: 'Short sleep, bunk CO₂ peaks', note_es: 'Poco sueño, picos de CO₂ en la litera' },
    { id: 'marco', name: 'Marco', role_en: 'Non-medical crewmember', role_es: 'Tripulante no médico', status: 'ok', location: 'Lab', hr: 63, alerts: [] },
    { id: 'noor', name: 'Noor', role_en: 'Crew medical officer', role_es: 'Oficial médica', status: 'ok', location: 'Galley', hr: 61, alerts: [] },
    { id: 'kenji', name: 'Kenji', role_en: 'Commander', role_es: 'Comandante', status: 'ok', location: 'Node', hr: 57, alerts: [] },
  ],
  alerts: [{ level: 'watch', crew_id: 'lena', text_en: 'Lena: resting HR above personal band for 3 days', text_es: 'Lena: pulso en reposo sobre su banda 3 días' }],
  environment: [
    { module: 'Crew quarters (bunks)', module_en: 'Crew quarters (bunks)', module_es: 'Camarotes (literas)', co2_mmhg: 3.55, temp_c: 22.5, rh_pct: 47 },
    { module: 'Galley', module_en: 'Galley', module_es: 'Cocina', co2_mmhg: 2.1, temp_c: 22.7, rh_pct: 47 },
    { module: 'Lab', module_en: 'Lab', module_es: 'Laboratorio', co2_mmhg: 2.3, temp_c: 23.3, rh_pct: 48 },
    { module: 'Node', module_en: 'Node', module_es: 'Nodo', co2_mmhg: 1.9, temp_c: 21.8, rh_pct: 45 },
  ],
  comms: { one_way_delay_s: 300, range_max_s: 1200, scenario_en: 'Deep-space analog (HERA-style 5-minute one-way delay)', scenario_es: 'Análogo de espacio profundo (retraso de 5 min por sentido, como HERA)', link: 'delayed' },
  headsets: [
    { crew_id: 'lena', battery_pct: 78, link: 'ok', worn: true },
    { crew_id: 'marco', battery_pct: 64, link: 'ok', worn: true },
    { crew_id: 'noor', battery_pct: 91, link: 'ok', worn: true },
    { crew_id: 'kenji', battery_pct: 23, link: 'weak', worn: false },
  ],
  medkit: [
    { item_en: 'Automated external defibrillator', item_es: 'Desfibrilador externo automático', qty: 1, min: 1 },
    { item_en: 'Oxygen mask and supply', item_es: 'Mascarilla y suministro de oxígeno', qty: 2, min: 2 },
    { item_en: 'Pulse oximeter', item_es: 'Pulsioxímetro', qty: 3, min: 2 },
    { item_en: 'Blood pressure cuff', item_es: 'Manguito de tensión', qty: 2, min: 1 },
    { item_en: 'Sleep aid (per flight surgeon)', item_es: 'Ayuda para dormir (según cirujano)', qty: 6, min: 10, expires: '2027-03' },
  ],
  packet: null,
}

export const FALLBACK_GRAPH: Graph = {
  nodes: [
    { id: 'lena', type: 'crew', label_en: 'Lena', label_es: 'Lena' },
    { id: 'marco', type: 'crew', label_en: 'Marco', label_es: 'Marco' },
    { id: 'noor', type: 'crew', label_en: 'Noor (CMO)', label_es: 'Noor (CMO)' },
    { id: 'kenji', type: 'crew', label_en: 'Kenji (CDR)', label_es: 'Kenji (CDR)' },
    { id: 'metis_lena', type: 'metis', label_en: 'Lena’s Metis', label_es: 'Metis de Lena' },
    { id: 'metis_marco', type: 'metis', label_en: 'Marco’s Metis', label_es: 'Metis de Marco' },
    { id: 'metis_noor', type: 'metis', label_en: 'Noor’s Metis', label_es: 'Metis de Noor' },
    { id: 'metis_kenji', type: 'metis', label_en: 'Kenji’s Metis', label_es: 'Metis de Kenji' },
    { id: 'console', type: 'station', label_en: 'Station console', label_es: 'Centralita' },
    { id: 'triage', type: 'knowledge', label_en: 'Triage tree', label_es: 'Árbol de triaje' },
    { id: 'baseline', type: 'knowledge', label_en: 'Personal baselines', label_es: 'Líneas base personales' },
    { id: 'hrp', type: 'nasa', label_en: 'NASA HRP risks', label_es: 'Riesgos HRP de NASA' },
    { id: 'std3001', type: 'nasa', label_en: 'NASA-STD-3001', label_es: 'NASA-STD-3001' },
    { id: 'osdr', type: 'nasa', label_en: 'OSDR OSD-569', label_es: 'OSDR OSD-569' },
    { id: 'medkit', type: 'inventory', label_en: 'Medical kit', label_es: 'Botiquín' },
    { id: 'earth', type: 'earth', label_en: 'Flight surgeon (Earth)', label_es: 'Cirujano de vuelo (Tierra)' },
    { id: 'eclss', type: 'sensor', label_en: 'Cabin air sensors', label_es: 'Sensores de aire' },
  ],
  edges: [
    { source: 'lena', target: 'metis_lena', relation: 'talks with' }, { source: 'marco', target: 'metis_marco', relation: 'talks with' },
    { source: 'noor', target: 'metis_noor', relation: 'talks with' }, { source: 'kenji', target: 'metis_kenji', relation: 'talks with' },
    { source: 'metis_lena', target: 'console', relation: 'alerts' }, { source: 'metis_marco', target: 'console', relation: 'alerts' },
    { source: 'metis_noor', target: 'console', relation: 'alerts' }, { source: 'metis_kenji', target: 'console', relation: 'alerts' },
    { source: 'metis_lena', target: 'triage', relation: 'follows' }, { source: 'metis_marco', target: 'triage', relation: 'follows' },
    { source: 'metis_lena', target: 'baseline', relation: 'learns' }, { source: 'metis_marco', target: 'baseline', relation: 'learns' },
    { source: 'triage', target: 'hrp', relation: 'cites' }, { source: 'triage', target: 'std3001', relation: 'cites' },
    { source: 'baseline', target: 'osdr', relation: 'validated on' }, { source: 'console', target: 'medkit', relation: 'tracks' },
    { source: 'console', target: 'earth', relation: 'store & forward' }, { source: 'eclss', target: 'console', relation: 'feeds' },
    { source: 'eclss', target: 'baseline', relation: 'cross-checked' }, { source: 'triage', target: 'medkit', relation: 'uses' },
  ],
}

/** Scripted replies so the Talk screen still works with no LLM. Safety words escalate to triage. */
export function fallbackReply(message: string, lang: Lang, crewId = 'lena'): Chat {
  const m = message.toLowerCase()
  const es = lang === 'es'
  const urgent = /(chest|pecho|collaps|despl|faint|desmay|unconscious|incons|breath|respir)/.test(m)
  if (m === 'greeting' && crewId !== 'lena') {
    // Scripted greeting for any other crew member, from their own local data (no AI).
    const c = (crewFile as unknown as { crew: Record<string, { name: string; today_out_of_band: string[] }> }).crew[crewId]
    if (c) return { text: c.today_out_of_band.length === 0
      ? (es ? `Buenos días, ${c.name}. Hoy todas tus señales están dentro de tu banda personal. ¿Cómo te encuentras?` : `Good morning, ${c.name}. All your signals are inside your personal band today. How are you feeling?`)
      : (es ? `Buenos días, ${c.name}. Hoy ${c.today_out_of_band.length} de tus señales están fuera de tu banda personal. ¿Cómo te encuentras?` : `Good morning, ${c.name}. ${c.today_out_of_band.length} of your signals are outside your personal band today. How are you feeling?`), source: 'fallback', safety: 'ok' }
  }
  if (m === 'greeting') {
    const d = (crewFile as unknown as { crew: { lena: { days: { sleep_h: number; resting_hr_bpm: number }[] } } }).crew.lena.days.slice(-1)[0]
    return { text: es ? `Buenos días, Lena. Anoche dormiste ${d.sleep_h.toFixed(1).replace('.', ',')} horas y tu pulso en reposo, ${Math.round(d.resting_hr_bpm)}, está por encima de tu banda. ¿Cómo te encuentras?` : `Good morning, Lena. You slept ${d.sleep_h.toFixed(1)} hours last night, and your resting heart rate, ${Math.round(d.resting_hr_bpm)}, is above your usual band. How are you feeling?`, source: 'fallback', safety: 'ok' }
  }
  if (urgent) return { text: es ? 'Vamos paso a paso. Abro el triaje guiado ahora y aviso a la tripulación si hace falta.' : 'Let’s take this one step at a time. I’m opening guided triage now and I can alert the crew.', source: 'fallback', safety: 'escalated' }
  if (/(sleep|dorm|sueñ)/.test(m)) return { text: es ? 'Tus tres peores noches coinciden con los picos de CO₂ más altos de tu litera. Propongo revisar la ventilación esta noche.' : 'Your three worst nights line up with the highest CO₂ peaks at your bunk. I suggest checking the airflow in your quarters tonight.', source: 'fallback', safety: 'ok' }
  if (/(report|informe|surgeon|cirujano)/.test(m)) return { text: es ? 'He preparado el resumen para el cirujano de vuelo. Saldrá en el próximo enlace con Tierra.' : 'I’ve prepared the summary for the flight surgeon. It will go out with the next Earth link.', source: 'fallback', safety: 'ok' }
  return { text: es ? 'Estoy aquí. No diagnostico: te guío con procedimientos aprobados y preparo el resumen para el cirujano de vuelo.' : 'I’m here. I don’t diagnose — I guide you through approved procedures and prepare the summary for the flight surgeon.', source: 'fallback', safety: 'ok' }
}
