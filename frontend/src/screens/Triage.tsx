// Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
// "Triage": deterministic tree from the backend; the AI only speaks it. Big steps, timer, sources, crew alerts.
import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Bell, ChevronLeft, HeartHandshake, Mic, MicOff, RotateCcw, Send, ShieldAlert, Stethoscope, Volume2, WifiOff } from 'lucide-react'
import { api, NO_SERVER, type FlowId, type TriageStep, type TriageNode } from '../api'
import { listenOnce, useSpeaker } from '../hooks'
import { useLang, useT, type Key } from '../i18n'
import { Card, MetisLine, Page, useCrew } from '../ui'
import { useEar } from '../voice'
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
  const qPatient = new URLSearchParams(loc.search).get('patient')   // set when Metis escalates someone's vitals
  const [flow, setFlow] = useState<FlowId | null>(qFlow)
  const [hist, setHist] = useState<{ step: TriageStep; answer?: string }[]>([])
  const [t0, setT0] = useState<number | null>(null)
  const [now, setNow] = useState(Date.now())
  const [sent, setSent] = useState<Record<string, boolean>>({})
  const sentRef = useRef<Record<string, boolean>>({})  // same as `sent`, readable inside async voice loops
  const [autoAlerted, setAutoAlerted] = useState(false)
  const sp = useSpeaker()
  const cur = hist[hist.length - 1]?.step
  // Hands-free: Metis asks out loud, listens on its own, and the backend matches the answer (fixed rule, no AI).
  // In an emergency your hands are busy; the buttons still work at any moment.
  const [handsFree, setHandsFree] = useState(!NO_SERVER)
  const [ls, setLs] = useState<'idle' | 'listening' | 'stt'>('idle')
  const [heard, setHeard] = useState<string | null>(null)
  const abort = useRef<AbortController | null>(null)
  const ear = useEar()
  const newRound = () => { abort.current?.abort(); const ac = new AbortController(); abort.current = ac; setLs('idle'); return ac }
  // While this screen listens on its own, the always-on ear steps aside; it comes back when we stop.
  const hold = () => { const key = 'triage:' + Math.random(); ear?.setBusy(key, true); return () => ear?.setBusy(key, false) }

  /** Keep listening for an answer to the current question (no time limit: an emergency question must get an answer);
   *  advance when the backend understands it, ask again when it doesn't. */
  const listenLoop = async (ac: AbortController, s: TriageStep) => {
    if (!flow || s.node.type !== 'question') return
    const release = hold()
    try { await listenQuestion(ac, s) } finally { release() }
  }
  const listenQuestion = async (ac: AbortController, s: TriageStep) => {
    if (!flow) return
    while (!ac.signal.aborted) {
      if (document.hidden) { await new Promise(r => setTimeout(r, 500)); continue }   // another tab has the mic
      setLs('listening')
      const blob = await listenOnce({ signal: ac.signal, waitMs: 15000, maxMs: 9000, silenceMs: 700 })   // short answers: don't wait
      if (ac.signal.aborted) return
      if (!blob) continue
      setLs('stt')
      const hint = s.node.type === 'question' ? s.node.options.map(o => o.label).join('. ') + '.' : ''
      const r = await api.stt(blob, lang, hint)
      if (ac.signal.aborted) return
      if (!r?.text) continue
      setHeard(r.text)
      const v = await api.triageVoice(flow, lang, s.node_id, r.text).catch(() => null)
      if (ac.signal.aborted) return
      if (v?.understood) {
        setLs('idle')
        setHist(h => [...h.slice(0, -1), { step: h[h.length - 1].step, answer: v.answer_label ?? v.answer }, { step: v }])
        return
      }
      setLs('idle')
      await sp.speak(v?.say ?? (lang === 'es' ? 'Perdona, no te he entendido.' : "Sorry, I didn't catch that."), lang)
    }
  }

  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(id) }, [])
  useEffect(() => {
    if (!flow) return
    setHist([]); setSent({}); sentRef.current = {}; setAutoAlerted(false); setT0(Date.now())
    step(flow, lang).then(s => setHist([{ step: s }]))
  }, [flow, lang])

  const listenNow = () => {
    if (!cur) return
    sp.stop(); const ac = newRound()
    if (cur.node.type === 'question') listenLoop(ac, cur); else commandLoop(ac, cur.node.level)
  }
  const toggleHandsFree = () => {
    const on = !handsFree; setHandsFree(on)
    if (on) listenNow(); else newRound()
  }

  const answer = async (optId: string, label: string) => {
    if (!cur || !flow) return
    newRound(); sp.stop()
    const s = await step(flow, lang, cur.node_id, optId)
    setHist(h => [...h.slice(0, -1), { step: h[h.length - 1].step, answer: label }, { step: s }])
  }
  const back = () => setHist(h => (h.length > 1 ? [...h.slice(0, -2), { step: h[h.length - 2].step }] : h))
  const fire = async (type: string) => {
    if (sentRef.current[type]) return
    sentRef.current[type] = true
    const patient = flow === 'companion_collapse' ? (qPatient ?? 'marco') : crewId
    try { await api.postEvent(type, patient, { flow, node_id: cur?.node_id, reporter: crewId, level: cur?.node.type === 'result' ? cur.node.level : undefined }) } catch { /* local only */ }
    setSent(s => ({ ...s, [type]: true }))
  }
  const fireMany = async (types: string[]) => { for (const ty of types) await fire(ty) }
  const ACTIONS = ['alert_crew', 'alert_commander', 'send_flight_surgeon']

  /** Result screen. Red or orange: Metis alerts everyone on its own and says so — nobody is asked.
   *  Yellow: nothing is sent, but spoken orders still work. */
  const resultFlow = async (ac: AbortController, s: TriageStep) => {
    if (s.node.type !== 'result') return
    if (s.node.level === 'rojo' || s.node.level === 'naranja') { await sp.speak(t('auto_alerted'), lang); return }  // already sent
    if (!handsFree) return
    await commandLoop(ac, s.node.level)
  }
  /** Spoken orders on the result screen, for up to a minute; then the always-on ear («Metis») takes over again. */
  const commandLoop = async (ac: AbortController, level: string) => {
    const release = hold()
    try { await listenCommands(ac, level) } finally { release(); if (!ac.signal.aborted) setLs('idle') }
  }
  const listenCommands = async (ac: AbortController, _level: string) => {
    const until = Date.now() + 60000
    for (let attempt = 0; attempt < 2 && Date.now() < until && !ac.signal.aborted;) {
      setLs('listening')
      const blob = await listenOnce({ signal: ac.signal, waitMs: Math.max(1000, until - Date.now()), maxMs: 9000, silenceMs: 800 })
      if (ac.signal.aborted) return
      if (!blob) continue
      attempt++
      setLs('stt')
      const r = await api.stt(blob, lang, 'Alert the crew. Call the commander. Send it to the flight surgeon.')
      if (ac.signal.aborted) return
      if (!r?.text) continue
      setHeard(r.text)
      const c = await api.triageCommand(r.text, lang).catch(() => null)
      if (ac.signal.aborted) return
      setLs('idle')
      const todo = (c?.actions ?? []).filter(a => !sentRef.current[a])
      if (c?.actions?.length) {
        await fireMany(todo)
        await sp.speak((c?.actions?.length ? c.actions : todo).map(a => t(('said_' + a) as Key)).join(' ') || t('said_alert_crew'), lang)
        return
      }
      if (c?.confirm === false) { await sp.speak(t('ok_no_alert'), lang); return }
      await sp.speak(t('say_cmd_again'), lang)
    }
  }
  useEffect(() => {
    if (!cur) return
    const n = cur.node, ac = newRound(), s = cur
    setHeard(null)
    // Urgent (red) result: the alerts go out right away, before Metis even finishes reading the result.
    // In an emergency nobody is asked: red AND orange results alert everyone straight away.
    if (n.type === 'result' && (n.level === 'rojo' || n.level === 'naranja')) { fireMany(ACTIONS); setAutoAlerted(true) }
    ;(async () => {
      await sp.speak(cur.say ?? (n.type === 'question' ? n.text : `${n.title}. ${n.steps[0] ?? ''}`), lang)
      if (ac.signal.aborted) return
      if (n.type === 'question') { if (handsFree) await listenLoop(ac, s) }
      else await resultFlow(ac, s)
    })()
    return () => ac.abort()
  }, [cur?.node_id]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => abort.current?.abort(), [])

  const el = t0 ? Math.floor((now - t0) / 1000) : 0
  const mmss = `${String(Math.floor(el / 60)).padStart(2, '0')}:${String(el % 60).padStart(2, '0')}`

  if (!flow) return (
    <Page title={t('triage_title')} sub={t('triage_sub')}>
      <div className="grid g2">
        {([['companion_collapse', 'flow_companion', 'flow_companion_sub', HeartHandshake, 'alarm'], ['self_chest_pressure', 'flow_self', 'flow_self_sub', ShieldAlert, 'watch']] as const).map(([id, k, ks, Icon, c]) => (
          <button key={id} className="card" onClick={() => setFlow(id)} style={{ textAlign: 'left', padding: 32, cursor: 'pointer', borderColor: c === 'alarm' ? 'rgba(255,90,95,.45)' : 'rgba(243,180,67,.4)' }}>
            <Icon size={40} className={`s-${c}`} />
            <div style={{ fontSize: 28, fontWeight: 600, margin: '16px 0 6px' }}>{t(k)}</div>
            <div className="muted" style={{ fontSize: 17 }}>{t(ks)}</div>
          </button>
        ))}
      </div>
      <p className="small dim" style={{ marginTop: 20 }}><WifiOff size={13} style={{ verticalAlign: -2 }} /> {t('triage_offline')} · {t('not_diagnosis')}</p>
    </Page>
  )

  const n = cur?.node
  return (
    <Page title={cur?.flow_title ?? t('triage_title')} sub={t('triage_sub')}
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
              {!NO_SERVER && (
                <div className="row" style={{ gap: 10, margin: '4px 0 12px', alignItems: 'center' }}>
                  <button className={`btn ${ls === 'listening' ? 'primary' : ''}`} onClick={listenNow} disabled={ls !== 'idle'} aria-label={t('answer_aloud')}>
                    <Mic size={16} />{ls === 'listening' ? t('listening') : ls === 'stt' ? t('transcribing') : t('answer_aloud')}
                  </button>
                  <button className="btn ghost" onClick={toggleHandsFree} aria-pressed={handsFree}>
                    {handsFree ? <Mic size={15} /> : <MicOff size={15} />}{t('hands_free')}: {handsFree ? 'ON' : 'OFF'}
                  </button>
                  {heard && <span className="small muted">{t('heard')}: «{heard}»</span>}
                </div>
              )}
              {n.options.map(o => <button key={o.id} className="opt" onClick={() => answer(o.id, o.label)}>{o.label}</button>)}
              <div className="small muted" style={{ marginTop: 8 }}><b>{t('why')}:</b> {n.why}</div>
            </Card>
          )}
          {n?.type === 'result' && (
            <div className={`lvl ${n.level}`}>
              <div className="small" style={{ textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 600 }}>{t('result')} · {t(`lvl_${n.level}`)}</div>
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
          {n?.type === 'result' && (
            <div className="row wrap" style={{ gap: 10, marginTop: 10, alignItems: 'center' }}>
              {autoAlerted && <span className="small s-alarm" style={{ fontWeight: 600 }}>{t('auto_alerted_badge')}</span>}
              {!NO_SERVER && !autoAlerted && <>
                <button className={`btn ${ls === 'listening' ? 'primary' : ''}`} onClick={listenNow} disabled={ls !== 'idle'}>
                  <Mic size={16} />{ls === 'listening' ? t('listening') : ls === 'stt' ? t('transcribing') : t('give_order')}
                </button>
                <span className="small muted">{t('voice_cmds_hint')}</span>
              </>}
              {heard && !autoAlerted && <span className="small muted">{t('heard')}: «{heard}»</span>}
            </div>
          )}
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
          <Card title={t('sources')}>
            {(cur?.sources?.length ? cur.sources : [{ title: 'NASA-STD-3001 Vol. 1 Rev C [V1 3006] — two Crew Medical Officers per vehicle', url: 'https://standards.nasa.gov/sites/default/files/standards/NASA/C//nasa-std-3001-vol-1-rev-c-signature.pdf' }, { title: 'NASA HRP — Cardiovascular Adaptations', url: 'https://www.nasa.gov/hrp/risks/' }]).map((s, i) => (
              <div key={i} className="small" style={{ marginBottom: 8 }}>{s.url ? <a href={s.url} target="_blank" rel="noreferrer">{s.title}</a> : s.title}</div>
            ))}
          </Card>
          {n?.type === 'result' && <Card title={<><Stethoscope size={14} />{t('surgeon_summary')}</>}><div className="small">{n.surgeon_summary}</div></Card>}
          {hist.length > 1 && <Card title={t('r_answers')}>
            {hist.filter(h => h.answer).map((h, i) => <div key={i} className="small" style={{ marginBottom: 6 }}><span className="muted">{h.step.node.type === 'question' ? h.step.node.text : ''}</span> → <b>{h.answer}</b></div>)}
          </Card>}
          <div className="small dim"><WifiOff size={13} style={{ verticalAlign: -2 }} /> {t('triage_offline')}</div>
        </div>
      </div>
    </Page>
  )
}
