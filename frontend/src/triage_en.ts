// Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
// English rendering of backend/triage_tree.json, used ONLY if the backend does not yet answer in English.
// Same node ids and the same logic: this file only translates text.
type Q = { text: string; why: string; options: Record<string, string> }
type R = { title: string; steps: string[]; surgeon_summary: string; warning: string }
const W = 'Example content — pending validation against NASA sources.'
export const FLOW_EN: Record<string, string> = { companion_collapse: 'A crewmate collapsed with chest pain', self_chest_pressure: 'I feel pressure in my chest' }
export const NODES_EN: Record<string, Q | R> = {
  c1: { text: 'Does your crewmate respond when you speak or gently shake their shoulders?', why: 'Whether they are conscious decides the path.', options: { si: 'Yes', no: 'No' } },
  c2: { text: 'Are they breathing normally?', why: 'Normal breathing lets us keep assessing.', options: { si: 'Yes', no: 'No, or with difficulty' } },
  c3: { title: 'Emergency: call for help and follow the approved resuscitation procedure', steps: ['Alert the crew and raise the habitat medical alarm (example step).', 'Open the approved life-support procedure in the medical manual (pending: reference).', 'Contact the flight surgeon; the reply may arrive with a delay.'], surgeon_summary: 'Crewmate collapsed, unresponsive or not breathing normally. Metis guided the non-medical crew member step by step.', warning: W },
  c4: { text: 'Are they complaining of chest pain or tightness right now?', why: 'Active chest pain raises the priority.', options: { si: 'Yes', no: 'No' } },
  c5: { text: 'Cold sweat, pale skin, or pain spreading to the arm or jaw?', why: 'Warning signs that are passed on to the flight surgeon.', options: { si: 'Yes', no: 'No' } },
  c6: { title: 'Rest and monitor', steps: ['Have them sit or lie down and rest.', 'Repeat vital signs every 5 minutes and log them.', 'Notify the flight surgeon.'], surgeon_summary: 'Brief collapse, now pain-free; rest and monitoring.', warning: W },
  c7: { title: 'High priority: strict rest and notify the flight surgeon now', steps: ['Rest in a comfortable position; do not leave them alone.', 'Measure pulse and breathing and log them with the time.', 'Follow the flight surgeon’s instructions (pending: approved protocol).'], surgeon_summary: 'Chest pain with warning signs after a collapse.', warning: W },
  c8: { title: 'Rest, monitor and notify the flight surgeon', steps: ['Rest, with someone staying with them.', 'Repeat vital signs every 5 minutes.', 'Prepare the summary for the flight surgeon.'], surgeon_summary: 'Chest pain after a collapse, no additional warning signs.', warning: W },
  s1: { text: 'Is the pressure intense right now?', why: 'Current intensity.', options: { si: 'Yes', no: 'No' } },
  s2: { text: 'Is it hard to breathe, or are you in a cold sweat?', why: 'Warning signs.', options: { si: 'Yes', no: 'No' } },
  s3: { text: 'How long has it lasted?', why: 'Duration.', options: {} },
  s4: { text: 'Have you slept less than 6 hours the last few nights?', why: 'Cross-checks with sleep and your Metis trend.', options: { si: 'Yes', no: 'No' } },
  s5: { text: 'Does it spread to your arm, jaw or back?', why: 'Location.', options: { si: 'Yes', no: 'No' } },
  s6: { title: 'High priority: alert a crewmate and the flight surgeon now', steps: ['Stop and sit down to rest.', 'Alert a crewmate (pending: approved protocol).', 'Metis sends the summary to the flight surgeon.'], surgeon_summary: 'Chest pressure with warning signs reported by the crew member.', warning: W },
  s7: { title: 'Possibly linked to sleep and cabin air: rest and repeat measurements', steps: ['Rest for 10 minutes and re-check your pulse.', 'Review the sleep × CO₂ trend in Metis.', 'If it gets worse, go back to triage.'], surgeon_summary: 'Mild chest pressure with reduced sleep and elevated night CO₂ (simulated data).', warning: W },
  s8: { title: 'Rest, monitor and scheduled note to the flight surgeon', steps: ['Rest and repeat measurements in 15 minutes.', 'Write down symptoms with the time.', 'Metis queues the summary for the flight surgeon.'], surgeon_summary: 'Chest pressure without reported warning signs.', warning: W },
}
const DUR: Record<string, string> = { 'Menos de 10 minutos': 'Less than 10 minutes', 'Más de 10 minutos': 'More than 10 minutes', 'No o con dificultad': 'No, or with difficulty', 'Sí': 'Yes', 'No': 'No' }
import type { TriageStep } from './api'
/** Translate a Spanish-only step to English, keeping ids and logic untouched. */
export function toEnglish(s: TriageStep): TriageStep {
  const tr = NODES_EN[s.node_id]; if (!tr) return s
  const n = s.node
  const node = n.type === 'question'
    ? { ...n, text: (tr as Q).text, why: (tr as Q).why, options: n.options.map(o => ({ ...o, label: (tr as Q).options[o.id] ?? DUR[o.label] ?? o.label })) }
    : { ...n, title: (tr as R).title, steps: (tr as R).steps, surgeon_summary: (tr as R).surgeon_summary, warning: (tr as R).warning }
  return { ...s, flow_title: FLOW_EN[s.flow] ?? s.flow_title, node, say: undefined }
}
