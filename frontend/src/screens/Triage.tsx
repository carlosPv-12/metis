// Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
// "Triage": deterministic tree from the backend; the AI only speaks it. Big steps, timer, sources, crew alerts.
import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Bell, ChevronLeft, HeartHandshake, RotateCcw, Send, ShieldAlert, Stethoscope, Volume2, WifiOff } from 'lucide-react'
import { api, type FlowId, type TriageStep, type TriageNode } from '../api'
import { useSpeaker } from '../hooks'
import { useLang, useT } from '../i18n'
import { Card, MetisLine, Page, useCrew } from '../ui'
import localTree from '../../../backend/triage_tree.json'
import { toEnglish } from '../triage_en'

type RawNode = Record<string, unknown> & { type: 'question' | 'result'; options?: (Record<string, string> & { id: string; next: string })[]; sources?: string[] }
type Tree = { sources?: Record<string, { title: string; url?: string }>; flows: Record<string, Record<string, unknown> & { start: string; nodes: Record<string, RawNode> }> }
const LT = localTree as unknown as Tree

/** Same localisation as backend main.py loc_node(): pick *_en / *_es fields (old single-language fields still work). */
function localStep(flow: FlowId, lang: 'en' | 'es', node_id?: string, answer?: string): TriageStep {
  const f = LT.flows[flow]
  const g = (o: Record<string, unknown>, k: string) => (o[`${k}_${lang}`] ?? o[`${k}_en`] ?? o[k] ?? '') as never
  let nid = f.start
  if (node_id) { const cur = f.nodes[node_id]; if (cur?.type === 'question') nid = cur.options?.find(o => o.id === answer)?.next ?? nid }
  const n = f.nodes[nid]
  const node: TriageNode = n.type === 'question'
    ? { type: 'question', text: g(n, 'text'), why: g(n, 'why'), options: (n.options ?? []).map(o => ({ id: o.id, label: g(o, 'label'), next: o.next })) }
    : { type: 'result', level: n.level as never, title: g(n, 'title'), steps: g(n, 'steps') || [], surgeon_summary: g(n, 'surgeon_summary'), warning: g(n, 'warning') }
  const sources = (n.sources ?? []).map(id => LT.sources?.[id]).filter((x): x is { title: string; url?: string } => !!x).map(x => ({ title: x.title, url: x.url }))
  return { flow, flow_title: g(f, 'title'), node_id: nid, node, offline: true, lang, say: g(n, 'say') || undefined, sources, escalate: !!n.escalate }
}

async function step(flow: FlowId, lang: 'en' | 'es', node_id?: string, answer?: string): Promise<TriageStep> {
  const fix = (s: TriageStep) => (lang === 'en' && s.lang !== 'en' ? toEnglish(s) : s)
  return fix(await rawStep(flow, lang, node_id, answer))
}
async function rawStep(flow: FlowId, lang: 'en' | 'es', node_id?: string, answer?: string): Promise<TriageStep> {
  try { return await api.triage(flow, lang, node_id, answer) } catch { return localStep(flow, lang, node_id, answer) }
}

export default function Triage() {
  const t = useT(); const { lang } = useLang(); const { crewId } = useCrew()
  const loc = useLocation()
  const qFlow = new URLSearchParams(loc.search).get('flow') as FlowId | null
  const [flow, setFlow] = useState<FlowId | null>(qFlow)
  const [hist, setHist] = useState<{ step: TriageStep; answer?: string }[]>([])
  const [t0, setT0] = useState<number | null>(null)
  const [now, setNow] = useState(Date.now())
  const [sent, setSent] = useState<Record<string, boolean>>({})
  const sp = useSpeaker()
  const cur = hist[hist.length - 1]?.step

  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(id) }, [])
  useEffect(() => {
    if (!flow) return
    setHist([]); setSent({}); setT0(Date.now())
    step(flow, lang).then(s => setHist([{ step: s }]))
  }, [flow, lang])
  useEffect(() => {
    if (!cur) return
    const n = cur.node
    sp.speak(cur.say ?? (n.type === 'question' ? n.text : `${n.title}. ${n.steps[0] ?? ''}`), lang)
  }, [cur?.node_id]) // eslint-disable-line react-hooks/exhaustive-deps

  const answer = async (optId: string, label: string) => {
    if (!cur || !flow) return
    const s = await step(flow, lang, cur.node_id, optId)
    setHist(h => [...h.slice(0, -1), { step: h[h.length - 1].step, answer: label }, { step: s }])
  }
  const back = () => setHist(h => (h.length > 1 ? [...h.slice(0, -2), { step: h[h.length - 2].step }] : h))
  const fire = async (type: string) => {
    const patient = flow === 'companion_collapse' ? 'marco' : crewId
    try { await api.postEvent(type, patient, { flow, node_id: cur?.node_id, reporter: crewId, level: cur?.node.type === 'result' ? cur.node.level : undefined }) } catch { /* local only */ }
    setSent(s => ({ ...s, [type]: true }))
  }
  const el = t0 ? Math.floor((now - t0) / 1000) : 0
  const mmss = `${String(Math.floor(el / 60)).padStart(2, '0')}:${String(el % 60).padStart(2, '0')}`

  if (!flow) return (
    <Page title={t('triage_title')}>
      <div className="grid g2">
        {([['companion_collapse', 'flow_companion', 'flow_companion_sub', HeartHandshake, 'alarm'], ['self_chest_pressure', 'flow_self', 'flow_self_sub', ShieldAlert, 'watch']] as const).map(([id, k, ks, Icon, c]) => (
          <button key={id} className="card" onClick={() => setFlow(id)} style={{ textAlign: 'left', padding: 32, cursor: 'pointer', borderColor: c === 'alarm' ? 'rgba(255,90,95,.45)' : 'rgba(243,180,67,.4)' }}>
            <Icon size={40} className={`s-${c}`} />
            <div style={{ fontSize: 28, fontWeight: 600, margin: '16px 0 6px' }}>{t(k)}</div>
            <div className="muted" style={{ fontSize: 17 }}>{t(ks)}</div>
          </button>
        ))}
      </div>
      {/* Offline/disclaimer line removed at the user's request. WifiOff stays imported until PR #2 (voz-manos-libres) is merged, to avoid touching its import line; remove both then. */ void WifiOff}
    </Page>
  )

  const n = cur?.node
  return (
    <Page title={cur?.flow_title ?? t('triage_title')}
      right={<div style={{ textAlign: 'right' }}><div className="small muted">{t('elapsed')}</div><div className="timer">{mmss}</div></div>}>
      <div className="grid" style={{ gridTemplateColumns: '1.6fr 1fr', alignItems: 'start' }}>
        <div>
          <div className="row" style={{ gap: 6, marginBottom: 14 }}>
            {hist.map((_, i) => <div key={i} style={{ height: 5, flex: 1, maxWidth: 80, borderRadius: 9, background: i === hist.length - 1 ? 'var(--metis)' : 'var(--line2)' }} />)}
            <span className="small muted" style={{ marginLeft: 8 }}>{t('step')} {hist.length}</span>
          </div>
          {n?.type === 'question' && (
            <Card>
              <div className="tq">{n.text}</div>
              {n.options.map(o => <button key={o.id} className="opt" onClick={() => answer(o.id, o.label)}>{o.label}</button>)}
              <div className="small muted" style={{ marginTop: 8 }}><b>{t('why')}:</b> {n.why}</div>
            </Card>
          )}
          {n?.type === 'result' && (
            <div className={`lvl ${n.level}`}>
              <div className="small" style={{ textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 600 }}>{t('result')}: {t(`lvl_${n.level}`)}</div>
              <div style={{ fontSize: 28, fontWeight: 600, margin: '6px 0 4px', lineHeight: 1.25 }}>{n.title}</div>
              <ol className="steps">{n.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
              {n.warning && <div className="small" style={{ marginTop: 10, opacity: .85 }}>{n.warning}</div>}
            </div>
          )}
          <div className="row wrap" style={{ marginTop: 16 }}>
            <button className="btn danger big" onClick={() => fire('alert_crew')} disabled={sent.alert_crew}><Bell size={18} />{sent.alert_crew ? t('sent') : t('alert_crew')}</button>
            <button className="btn big" onClick={() => fire('alert_commander')} disabled={sent.alert_commander}><ShieldAlert size={18} />{sent.alert_commander ? t('sent') : t('alert_cmd')}</button>
            <button className="btn big" onClick={() => fire('send_flight_surgeon')} disabled={sent.send_flight_surgeon}><Send size={18} />{sent.send_flight_surgeon ? t('sent') : t('send_surgeon')}</button>
          </div>
          <div className="row" style={{ marginTop: 14 }}>
            <button className="btn ghost" onClick={back} disabled={hist.length < 2}><ChevronLeft size={16} />{t('back')}</button>
            <button className="btn ghost" onClick={() => setFlow(null)}><RotateCcw size={16} />{t('restart')}</button>
          </div>
        </div>
        <div className="grid" style={{ gap: 14 }}>
          <Card title={<><Volume2 size={14} />{t('metis_voice')}</>}>
            <MetisLine small speaking={sp.speaking}><div style={{ fontSize: 17 }}>{cur?.say ?? (n?.type === 'question' ? n.text : n?.title)}</div></MetisLine>
            <button className="btn" style={{ marginTop: 12 }} onClick={() => cur && sp.speak(cur.say ?? (n?.type === 'question' ? n.text : n?.title ?? ''), lang)}><Volume2 size={15} />{t('listen')}</button>
          </Card>
          {n?.type === 'result' && <Card title={<><Stethoscope size={14} />{t('surgeon_summary')}</>}><div className="small">{n.surgeon_summary}</div></Card>}
          {hist.length > 1 && <Card title={t('r_answers')}>
            {hist.filter(h => h.answer).map((h, i) => <div key={i} className="small" style={{ marginBottom: 6 }}><span className="muted">{h.step.node.type === 'question' ? h.step.node.text : ''}</span> → <b>{h.answer}</b></div>)}
          </Card>}
        </div>
      </div>
    </Page>
  )
}
