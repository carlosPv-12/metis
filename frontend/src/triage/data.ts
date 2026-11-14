import tree from '../../../backend/triage_tree.json'
import { pick, type Lang } from '../i18n'

export type FlowGroup = 'emergency' | 'health' | 'mind'
type RawFlow = Record<string, unknown>
const flows = (tree as unknown as { flows: Record<string, RawFlow> }).flows

export function getFlows(lang: Lang) {
  return Object.entries(flows).map(([id, flow]) => {
    const emergency = id === 'companion_collapse' || id === 'self_chest_pressure'
    const group: FlowGroup = flow.group === 'emergency' || flow.group === 'health' || flow.group === 'mind'
      ? flow.group : emergency ? 'emergency' : 'health'
    const title = pick(flow, 'title', lang) || id.replaceAll('_', ' ')
    return {
      id, group, title,
      summary: pick(flow, 'summary', lang) || title,
      icon: typeof flow.icon === 'string' ? flow.icon : id === 'companion_collapse' ? 'Siren' : 'HeartPulse',
    }
  })
}
export type HubFlow = ReturnType<typeof getFlows>[number]
