// Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
// "How I feel": Metis asks how the crew member is; the daily check-in uses the kind of 0-10 scales NASA crews used on
// the ISS (Reaction Self Test) plus the Samn-Perelli fatigue scale, and every 14 days the PHQ-4 (free use, Pfizer).
// Below: the wellbeing signals Metis reads (check-in + sleep, HRV and resting heart rate against the personal band),
// the possible risks they point to with their reasons, Metis's advice for these answers and a direct check with Metis
// (the psychological triage flows). Check-ins are private; sending one to ground is optional.
// Risks and advice come from the backend (backend/wellbeing.py); computeRisks() below is the same rule set for the
// single-file demo without a backend.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, ChevronDown, ExternalLink, Lock, MessageCircle, Send, Stethoscope } from 'lucide-react'
import { api, NO_SERVER, type CrewDetail, type Metric, type WbAdvice, type WbRisk, type WbRiskId, type WbWhy } from '../api'
import { useLoad } from '../hooks'
import { useLang, useT } from '../i18n'
import { Card, DEC, Loading, MetisLine, Page, Spark, UNIT, fmt, levelOf, useCrew } from '../ui'
import { DAILY_ID, PHQ4_ID, PHQ4_QUESTIONS, QUESTIONS, RANGE, TAGS, WB_TXT, SHARE_TXT, addCheckIn, concerning, fmtAnswer, isDaily, setShareLevel, shareCheckIn,
  useCheckIns, useShareLevel, type CheckIn, type PhqQuestion, type Question, type ShareLevel } from '../wellbeing'
import '../wellbeing.css'

export type RiskId = WbRiskId
export type RiskLevel = 'low' | 'watch' | 'high'

export const WB_RISK_TXT = {
  en: {
    title: 'How I feel',
    ask: (n: string) => `${n}, how are you feeling today? Is there something on your mind you would like to talk about?`,
    askAgain: (n: string) => `Thanks, ${n}. I am here whenever you want to talk about anything that is going on.`,
    quick: { good: 'I feel good', tired: 'A bit tired', stressed: 'Stressed', talk: 'I would like to talk' },
    talk: 'Talk to Metis', check: 'Do a check with Metis',
    signals: 'What Metis reads about how you feel', risks: 'Possible signs to watch',
    level: { low: 'Low', watch: 'Watch', high: 'High' } as Record<RiskLevel, string>,
    why: 'Why', signs: 'Examples of signs', help: 'What I can do', hide: 'Hide',
    noWhy: 'Nothing points this way right now.',
    risk: {
      stress: { name: 'Stress', flow: 'anxiety_panic',
        signs: ['Racing thoughts or feeling on edge', 'Snapping at crewmates', 'Tight jaw, neck or shoulders', 'Hard to focus on a procedure'],
        help: ['Slow breathing: in for 4, hold 4, out for 6, for two minutes', 'Break the next task into small steps and tick them off', 'Move: a short session on the treadmill or the cycle', 'Tell the commander if the workload is too high'] },
      mood: { name: 'Low mood (risk of depression)', flow: 'persistent_low_mood',
        signs: ['Things you enjoyed feel flat', 'Wanting to stay in the bunk', 'Feeling hopeless or guilty', 'Eating or sleeping much more or less'],
        help: ['Plan one small thing you enjoy today', 'Call or write to someone at home', 'Time at the window or under the bright light panel', 'Talk to the crew medical officer if it lasts more than two weeks'] },
      fatigue: { name: 'Fatigue', flow: 'fatigue',
        signs: ['Heavy eyes during the day', 'Slower reactions', 'More small mistakes', 'Needing caffeine to get going'],
        help: ['Keep a short nap under 30 minutes', 'Do the hardest tasks at your best time of day', 'Hydrate and eat at regular times', 'Ask to swap a demanding task if you can'] },
      sleep: { name: 'Poor sleep', flow: 'cant_sleep',
        signs: ['Taking long to fall asleep', 'Waking up several times', 'Shorter nights than your usual', 'Headache in the morning (can be CO₂)'],
        help: ['Same sleep window every night', 'Bunk dark, cool and ventilated; check the airflow', 'No screens in the last 30 minutes', 'Write down what is on your mind before sleeping'] },
      isolation: { name: 'Isolation and homesickness', flow: 'isolation_homesickness',
        signs: ['Missing home a lot', 'Feeling apart from the crew', 'Less interest in talking', 'Counting the days'],
        help: ['Schedule a call or message with family', 'Share a meal with the crew', 'Keep a personal ritual from home', 'Talk to Metis or a crewmate about it'] },
      conflict: { name: 'Crew tension', flow: 'crew_conflict',
        signs: ['Avoiding a crewmate', 'Small things causing big arguments', 'Feeling unheard', 'Tension during shared tasks'],
        help: ['Talk about the task, not the person', 'Take a pause before answering', 'Ask the commander for a short crew debrief', 'Let Metis help you prepare what to say'] },
    } as Record<RiskId, { name: string; flow: string; signs: string[]; help: string[] }>,
    reason: {
      hrvLow: (v: string, n: number) => `Heart rate variability ${v} ms, below your band (${n} ${n === 1 ? 'night' : 'nights'})`,
      rhrHigh: (v: string) => `Resting heart rate ${v} bpm, above your band`,
      sleepLow: (v: string, n: number) => `Sleep ${v} h, below your band (${n} ${n === 1 ? 'night' : 'nights'})`,
      co2: (v: string) => `Bunk CO₂ peak ${v} mmHg, above the 3 mmHg limit`,
      said: (what: string) => `You said: ${what}`,
      phq2: (v: number) => `Two-week check: low mood score ${v}/6 (3 or more is worth a talk)`,
      gad2: (v: number) => `Two-week check: worry score ${v}/6 (3 or more is worth a talk)`,
    },
    checkin: 'Tell Metis how you feel', history: 'My last check-ins',
    recTitle: (n: string) => `${n}, this is what I recommend for the next days:`, talkOffer: 'Do you want to talk with me about it?', talkYes: 'Yes, talk with Metis',
  },
  es: {
    title: 'Cómo me siento',
    ask: (n: string) => `${n}, ¿qué tal te sientes hoy? ¿Hay algo que te ronde la cabeza y de lo que quieras hablar?`,
    askAgain: (n: string) => `Gracias, ${n}. Aquí estoy cuando quieras hablar de cualquier cosa que te esté pasando.`,
    quick: { good: 'Me siento bien', tired: 'Algo cansado/a', stressed: 'Con estrés', talk: 'Quiero hablar' },
    talk: 'Hablar con Metis', check: 'Hacer un chequeo con Metis',
    signals: 'Lo que Metis lee de cómo te sientes', risks: 'Posibles señales a vigilar',
    level: { low: 'Bajo', watch: 'Vigilar', high: 'Alto' } as Record<RiskLevel, string>,
    why: 'Por qué', signs: 'Ejemplos de señales', help: 'Qué puedo hacer', hide: 'Ocultar',
    noWhy: 'Ahora mismo nada apunta a esto.',
    risk: {
      stress: { name: 'Estrés', flow: 'anxiety_panic',
        signs: ['Pensamientos acelerados o sensación de tensión', 'Saltar con los compañeros', 'Mandíbula, cuello u hombros tensos', 'Cuesta concentrarse en un procedimiento'],
        help: ['Respiración lenta: inspira 4, aguanta 4, suelta 6, durante dos minutos', 'Divide la siguiente tarea en pasos pequeños', 'Muévete: un rato en la cinta o en la bici', 'Avisa al comandante si la carga de trabajo es demasiada'] },
      mood: { name: 'Ánimo bajo (riesgo de depresión)', flow: 'persistent_low_mood',
        signs: ['Lo que antes te gustaba ahora no te dice nada', 'Ganas de quedarte en la litera', 'Sensación de desesperanza o culpa', 'Comer o dormir mucho más o mucho menos'],
        help: ['Planea hoy una cosa pequeña que te guste', 'Llama o escribe a alguien de casa', 'Un rato en la ventana o bajo el panel de luz', 'Habla con el oficial médico si dura más de dos semanas'] },
      fatigue: { name: 'Cansancio', flow: 'fatigue',
        signs: ['Ojos pesados durante el día', 'Reacciones más lentas', 'Más errores pequeños', 'Necesitar cafeína para arrancar'],
        help: ['Siesta corta, de menos de 30 minutos', 'Las tareas difíciles a tu mejor hora', 'Bebe agua y come a horas regulares', 'Pide cambiar una tarea exigente si se puede'] },
      sleep: { name: 'Mal sueño', flow: 'cant_sleep',
        signs: ['Tardar mucho en dormirte', 'Despertarte varias veces', 'Noches más cortas de lo normal', 'Dolor de cabeza al despertar (puede ser CO₂)'],
        help: ['El mismo horario de sueño cada noche', 'Litera a oscuras, fresca y ventilada; revisa la ventilación', 'Sin pantallas la última media hora', 'Apunta lo que te preocupa antes de dormir'] },
      isolation: { name: 'Aislamiento y nostalgia', flow: 'isolation_homesickness',
        signs: ['Echar mucho de menos casa', 'Sentirte apartado/a de la tripulación', 'Menos ganas de hablar', 'Contar los días'],
        help: ['Programa una llamada o mensaje con tu familia', 'Comparte una comida con la tripulación', 'Mantén un ritual personal de casa', 'Habla de ello con Metis o con un compañero'] },
      conflict: { name: 'Tensión en la tripulación', flow: 'crew_conflict',
        signs: ['Evitar a un compañero', 'Discusiones grandes por cosas pequeñas', 'Sentir que no te escuchan', 'Tensión en las tareas compartidas'],
        help: ['Habla de la tarea, no de la persona', 'Haz una pausa antes de contestar', 'Pide al comandante una breve puesta en común', 'Deja que Metis te ayude a preparar qué decir'] },
    } as Record<RiskId, { name: string; flow: string; signs: string[]; help: string[] }>,
    reason: {
      hrvLow: (v: string, n: number) => `Variabilidad cardiaca ${v} ms, por debajo de tu banda (${n} ${n === 1 ? 'noche' : 'noches'})`,
      rhrHigh: (v: string) => `Pulso en reposo ${v} lpm, por encima de tu banda`,
      sleepLow: (v: string, n: number) => `Sueño ${v} h, por debajo de tu banda (${n} ${n === 1 ? 'noche' : 'noches'})`,
      co2: (v: string) => `Pico de CO₂ en la litera ${v} mmHg, por encima del límite de 3 mmHg`,
      said: (what: string) => `Dijiste: ${what}`,
      phq2: (v: number) => `Chequeo de dos semanas: ánimo bajo ${v}/6 (3 o más merece una charla)`,
      gad2: (v: number) => `Chequeo de dos semanas: preocupación ${v}/6 (3 o más merece una charla)`,
    },
    checkin: 'Cuéntale a Metis cómo te sientes', history: 'Mis últimos registros',
    recTitle: (n: string) => `${n}, esto es lo que te recomiendo para los próximos días:`, talkOffer: '¿Quieres hablarlo conmigo?', talkYes: 'Sí, hablar con Metis',
  },
}

/** Text of one reason (the backend sends codes and values, the screen writes them). */
export function whyText(w: WbWhy, lang: 'en' | 'es') {
  const x = WB_RISK_TXT[lang].reason, wb = WB_TXT[lang]
  switch (w.code) {
    case 'hrv_low': return x.hrvLow(fmt(w.value ?? 0, 0), w.nights ?? 1)
    case 'rhr_high': return x.rhrHigh(fmt(w.value ?? 0, 0))
    case 'sleep_low': return x.sleepLow(fmt(w.value ?? 0, 1), w.nights ?? 1)
    case 'co2': return x.co2(fmt(w.value ?? 0, 2))
    case 'answer': return `${wb.q[w.q as Question] ?? w.q} ${fmtAnswer(w.q ?? '', w.value ?? 0)}`
    case 'tag': return x.said((wb.tag[w.tag ?? ''] ?? w.tag ?? '').toLowerCase())
    case 'phq2': return x.phq2(w.value ?? 0)
    case 'gad2': return x.gad2(w.value ?? 0)
  }
}

/** Nights in a row, counting back from today, outside the band on the bad side. */
function streak(c: CrewDetail, m: Metric, dir: 1 | -1) {
  const b = c.baseline[m]; let n = 0
  for (let i = c.days.length - 1; i >= 0; i--) { const v = c.days[i][m]; if (dir < 0 ? v < b.band_low : v > b.band_high) n++; else break }
  return n
}

/** Same rules as risks() in backend/wellbeing.py: used only without a backend (single-file demo). */
export function computeRisks(c: CrewDetail, history: CheckIn[], now = Date.now()): WbRisk[] {
  const today = c.days[c.days.length - 1]
  const daily = history.find(h => isDaily(h) && now - h.ts < 3 * 864e5)
  const phq = history.find(h => h.instrument === PHQ4_ID && now - h.ts < 14 * 864e5)
  const ids: RiskId[] = ['stress', 'mood', 'fatigue', 'sleep', 'isolation', 'conflict']
  const out = Object.fromEntries(ids.map(r => [r, { score: 0, why: [] as WbWhy[] }])) as Record<RiskId, { score: number; why: WbWhy[] }>
  const add = (r: RiskId, pts: number, w: WbWhy) => { out[r].score += pts; out[r].why.push(w) }
  const hrv = streak(c, 'hrv_ms', -1), rhr = streak(c, 'resting_hr_bpm', 1), sl = streak(c, 'sleep_h', -1)
  if (hrv) add('stress', hrv >= 2 ? 2 : 1, { code: 'hrv_low', value: today.hrv_ms, nights: hrv })
  if (rhr) add('stress', 1, { code: 'rhr_high', value: today.resting_hr_bpm })
  if (sl) { add('fatigue', 1, { code: 'sleep_low', value: today.sleep_h, nights: sl }); add('sleep', sl >= 2 ? 2 : 1, { code: 'sleep_low', value: today.sleep_h, nights: sl }) }
  if (today.co2_night_peak_mmhg > 3) add('sleep', 1, { code: 'co2', value: today.co2_night_peak_mmhg })
  if (daily) {
    const a = daily.answers, A = (q: string, value: number): WbWhy => ({ code: 'answer', q, value })
    if (a.stress >= 7) add('stress', 2, A('stress', a.stress)); else if (a.stress >= 5) add('stress', 1, A('stress', a.stress))
    if (a.workload >= 8) add('stress', 1, A('workload', a.workload))
    if (a.mood <= 3) add('mood', 2, A('mood', a.mood)); else if (a.mood <= 5) add('mood', 1, A('mood', a.mood))
    if (a.fatigue >= 6) add('fatigue', 3, A('fatigue', a.fatigue)); else if (a.fatigue >= 5) add('fatigue', 2, A('fatigue', a.fatigue))
    if (a.sleep_hours < 6) add('sleep', 1, A('sleep_hours', a.sleep_hours))
    if (a.sleep_quality <= 4) add('sleep', 2, A('sleep_quality', a.sleep_quality))
    if (a.crew <= 4) add('conflict', 2, A('crew', a.crew))
    for (const [t, r] of [['workload', 'stress'], ['worried', 'stress'], ['bored', 'mood'], ['tired', 'fatigue'], ['homesick', 'isolation'], ['crew', 'conflict']] as [string, RiskId][])
      if (daily.tags.includes(t)) add(r, t === 'homesick' || t === 'crew' ? 2 : 1, { code: 'tag', tag: t })
  }
  if (phq?.scores) {
    if (phq.scores.mood_positive) add('mood', 3, { code: 'phq2', value: phq.scores.phq2 })
    if (phq.scores.anxiety_positive) add('stress', 3, { code: 'gad2', value: phq.scores.gad2 })
  }
  const lvl = (s: number): RiskLevel => (s >= 4 ? 'high' : s >= 2 ? 'watch' : 'low')
  return ids.map(id => ({ id, score: out[id].score, level: lvl(out[id].score), why: out[id].why })).sort((p, q) => q.score - p.score)
}

/** Advice without a backend: the risk's own "what I can do" lines (the backend gives answer-specific advice). */
function localAdvice(risks: WbRisk[], lang: 'en' | 'es'): WbAdvice[] {
  const x = WB_RISK_TXT[lang]
  const top = risks.filter(r => r.level !== 'low').slice(0, 3)
  if (!top.length) return [{ code: 'ok', en: WB_TXT.en.tipOk, es: WB_TXT.es.tipOk, flow: null, source: { title: '', url: '' } }]
  return top.map(r => ({ code: r.id, en: WB_RISK_TXT.en.risk[r.id].help[0], es: WB_RISK_TXT.es.risk[r.id].help[0], flow: x.risk[r.id].flow, source: { title: '', url: '' } }))
}

type Draft = Partial<Record<Question, number>>
/** The quick answers at the top only pre-fill the check-in; the person confirms it. */
const QUICK: Record<'good' | 'tired' | 'stressed', { draft: Draft; tags: string[] }> = {
  good: { draft: { fatigue: 2, stress: 2, mood: 8 }, tags: [] },
  tired: { draft: { fatigue: 5 }, tags: ['tired'] },
  stressed: { draft: { stress: 7 }, tags: ['worried'] },
}

export default function Wellbeing() {
  const { lang } = useLang(); const t = useT(); const x = WB_RISK_TXT[lang]
  const { crewId } = useCrew()
  const { data: c } = useLoad(() => api.crewOne(crewId), [crewId])
  const history = useCheckIns(crewId)
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [prefill, setPrefill] = useState<{ draft: Draft; tags: string[] } | null>(null)
  const [advice, setAdvice] = useState<WbAdvice[] | null>(null)
  const [serverRisks, setServerRisks] = useState<WbRisk[] | null>(null)
  const [phqDue, setPhqDue] = useState<boolean | null>(null)
  const [phqDismissed, setPhqDismissed] = useState(false)
  const newest = history[0]?.id
  useEffect(() => {
    if (NO_SERVER) return
    let alive = true
    api.wbRisks(crewId).then(r => { if (alive) setServerRisks(r) }).catch(() => {})
    api.wbPhq4Due(crewId).then(d => { if (alive) setPhqDue(d) }).catch(() => {})
    return () => { alive = false }
  }, [crewId, newest])
  useEffect(() => { setAdvice(null); setFormOpen(false); setPrefill(null); setPhqDismissed(false) }, [crewId])
  if (!c) return <Loading />
  const risks = serverRisks ?? computeRisks(c, history)
  const localPhqDue = !history.some(h => h.instrument === PHQ4_ID && Date.now() - h.ts < 14 * 864e5)
  const showPhq = !phqDismissed && (phqDue ?? localPhqDue)
  const today = c.days[c.days.length - 1]
  const SIGNALS: Metric[] = ['mood_1_5', 'sleep_h', 'hrv_ms', 'resting_hr_bpm']
  const go = (flow: string) => nav(`/triage/run?${new URLSearchParams({ flow, voice: '1' })}`)
  const top = risks.find(r => r.level !== 'low')
  const attention = risks.filter(r => r.level !== 'low')
  const recs = (attention.length ? attention : risks.slice(0, 1)).flatMap(r => x.risk[r.id].help.slice(0, 2)).slice(0, 4)
  const quick = (k: keyof typeof QUICK) => { setPrefill(QUICK[k]); setFormOpen(true); setAdvice(null) }
  const saved = (a: WbAdvice[] | null) => { setAdvice(a ?? localAdvice(computeRisks(c, history), lang)); setFormOpen(false); setPrefill(null) }

  return (
    <Page title={x.title}>
      {/* Metis is always the one asking */}
      <section className="card feature feature-gradient wb-ask" aria-live="polite">
        <MetisLine><p className="wb-ask-q">{advice ? x.askAgain(c.name) : x.ask(c.name)}</p></MetisLine>
        <div className="wb-ask-actions">
          {!advice && !formOpen && <>
            <button type="button" className="wb-chip" onClick={() => quick('good')}>{x.quick.good}</button>
            <button type="button" className="wb-chip" onClick={() => quick('tired')}>{x.quick.tired}</button>
            <button type="button" className="wb-chip" onClick={() => quick('stressed')}>{x.quick.stressed}</button>
          </>}
          <button type="button" className="btn primary" onClick={() => nav('/talk')}><MessageCircle size={16} />{advice ? x.talk : x.quick.talk}</button>
          {top && <button type="button" className="btn wb-check" onClick={() => go(x.risk[top.id].flow)}><Stethoscope size={16} />{x.check}</button>}
        </div>
      </section>

      {advice && <AdviceCard advice={advice} name={c.name} onFlow={go} />}
      {!advice && (formOpen
        ? <DailyCheckIn key={JSON.stringify(prefill)} crewId={crewId} name={c.name} prefill={prefill} onSaved={saved} onCancel={() => setFormOpen(false)} />
        : <div className="wb-open-form"><button type="button" className="btn primary" onClick={() => setFormOpen(true)}><Check size={16} />{WB_TXT[lang].today}</button></div>)}
      {showPhq && !formOpen && <Phq4 crewId={crewId} name={c.name} onSaved={a => { setPhqDue(false); saved(a) }} onLater={() => setPhqDismissed(true)} />}

      <h2 className="section-h wb-h">{x.signals}</h2>
      <div className="wb-signals">
        {SIGNALS.map(m => {
          const b = c.baseline[m], l = levelOf(m, today[m], b)
          return <div key={m} className={`wb-signal ${l}`}>
            <span>{t(`m_${m}`)}</span>
            <strong>{fmt(today[m], DEC[m])}<small>{m === 'mood_1_5' ? '/5' : t(UNIT[m])}</small></strong>
            <Spark days={c.days} m={m} b={b} h={38} color="#9CBF00" />
          </div>
        })}
      </div>

      <h2 className="section-h wb-h">{x.risks}</h2>
      <div className="wb-risks">
        {risks.map(r => {
          const k = x.risk[r.id]
          return <article key={r.id} className={`wb-risk ${r.level}`}>
            <header><h3>{k.name}</h3><span className={`wb-level ${r.level}`}>{x.level[r.level]}</span></header>
            <div className="wb-meter" aria-hidden><i style={{ width: `${Math.min(100, 12 + r.score * 18)}%` }} /></div>
            <p className="wb-why"><b>{x.why}:</b> {r.why.length ? r.why.map(w => whyText(w, lang)).join('; ') : x.noWhy}</p>
            <p className="wb-signs"><b>{x.signs}:</b> {k.signs.map((g, i) => (i ? g.replace(/^./, ch => ch.toLowerCase()) : g)).join(', ')}</p>
          </article>
        })}
      </div>

      <div className="wb-grid">
        {/* "What I can do": Metis's own recommendations for the signs that need attention, and an offer to talk */}
        <div className="wb-improve">
          <button type="button" className="btn wb-help-btn" aria-expanded={open} onClick={() => setOpen(v => !v)}>
            <ChevronDown size={15} style={{ transform: open ? 'rotate(180deg)' : 'none' }} />{open ? x.hide : x.help}
          </button>
          {open && <section className="card wb-improve-card">
            <MetisLine>
              <p className="wb-rec-title">{x.recTitle(c.name)}</p>
              <ul className="wb-recs">{recs.map(r => <li key={r}><Check size={15} aria-hidden />{r}</li>)}</ul>
              <div className="wb-talk-offer"><span>{x.talkOffer}</span>
                <button type="button" className="btn primary" onClick={() => nav('/talk')}><MessageCircle size={16} />{x.talkYes}</button></div>
            </MetisLine>
          </section>}
        </div>
        <div className="wb-side">
          <History c={c} crewId={crewId} title={x.history} />
          <ShareChoice crewId={crewId} />
        </div>
      </div>
    </Page>
  )
}

/** Metis's advice for the answers just saved, each with its source and, if it fits, a triage to open. */
function AdviceCard({ advice, name, onFlow }: { advice: WbAdvice[]; name: string; onFlow: (flow: string) => void }) {
  const { lang } = useLang(); const s = WB_TXT[lang]
  return (
    <section className="card wb-improve-card wb-advice" aria-live="polite">
      <MetisLine>
        <p className="wb-rec-title">{s.adviceTitle(name)}</p>
        <ul className="wb-recs">{advice.map(a => <li key={a.code}>
          <Check size={15} aria-hidden />
          <span>{lang === 'es' ? a.es : a.en}
            {a.source.url && <a className="wb-src" href={a.source.url} target="_blank" rel="noreferrer" title={a.source.title}> <ExternalLink size={11} aria-hidden />{s.source}</a>}
            {a.flow && <button type="button" className="btn ghost wb-send" onClick={() => onFlow(a.flow!)}><Stethoscope size={13} />{s.openTriage}</button>}
          </span>
        </li>)}</ul>
      </MetisLine>
    </section>
  )
}

/** One 0-10 (or 1-7 / 0-3) answer as a row of buttons; fine for touch and for reading out. */
function Scale({ q, value, onPick, labels }: { q: string; value: number | undefined; onPick: (v: number) => void; labels?: string[] }) {
  const [lo, hi] = RANGE[q as Question | PhqQuestion]
  const vals = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)
  return (
    <div className={`wb-scale ${labels ? 'wb-scale-anchored' : ''}`} role="radiogroup">
      {vals.map(v => <button key={v} type="button" role="radio" aria-checked={value === v} className={`wb-dot ${value === v ? 'on' : ''} ${concerning(q, v) ? 'warn' : ''}`}
        onClick={() => onPick(v)} title={labels?.[v - lo]}>
        <span>{v}</span>{labels && <em>{labels[v - lo]}</em>}
      </button>)}
    </div>
  )
}

function DailyCheckIn({ crewId, name, prefill, onSaved, onCancel }: { crewId: string; name: string; prefill: { draft: Draft; tags: string[] } | null; onSaved: (a: WbAdvice[] | null) => void; onCancel: () => void }) {
  const { lang } = useLang(); const s = WB_TXT[lang]
  const [a, setA] = useState<Draft>(prefill?.draft ?? {})
  const [tags, setTags] = useState<string[]>(prefill?.tags ?? [])
  const [note, setNote] = useState('')
  const [share, setShare] = useState(false)
  const [shareNote, setShareNote] = useState(false)
  const [busy, setBusy] = useState(false)
  const complete = QUESTIONS.every(q => typeof a[q] === 'number')
  const set = (q: Question, v: number) => setA(p => ({ ...p, [q]: v }))
  // From the previous state, so quick repeated taps all count.
  const stepHours = (d: number) => setA(p => ({ ...p, sleep_hours: Math.min(14, Math.max(0, (p.sleep_hours ?? 7) + d)) }))
  const save = async () => {
    if (!complete || busy) return
    setBusy(true)
    const ci: CheckIn = { id: `${Date.now()}`, ts: Date.now(), crewId, instrument: DAILY_ID, answers: a as Record<string, number>, tags, note, shared: share, noteShared: share && shareNote }
    onSaved(await addCheckIn(ci, name))
  }
  return (
    <section className="card wb-form" aria-label={s.today}>
      <h2 className="section-h" style={{ margin: 0 }}>{s.today}</h2>
      <p className="small muted" style={{ margin: '4px 0 6px' }}>{s.todaySub}</p>
      {QUESTIONS.map(q => <div key={q} className="wb-q">
        <span className="wb-q-label">{s.ask[q]}</span>
        {q === 'sleep_hours'
          ? <div className="wb-hours">
              <button type="button" className="wb-dot" aria-label="−" onClick={() => stepHours(-0.5)}><span>−</span></button>
              <strong>{typeof a[q] === 'number' ? `${a[q]} h` : '— h'}</strong>
              <button type="button" className="wb-dot" aria-label="+" onClick={() => stepHours(0.5)}><span>+</span></button>
            </div>
          : <div>
              <Scale q={q} value={a[q]} onPick={v => set(q, v)} labels={q === 'fatigue' ? s.fatigue : undefined} />
              {s.ends[q] && <div className="wb-ends small muted"><span>{s.ends[q][0]}</span><span>{s.ends[q][1]}</span></div>}
            </div>}
      </div>)}
      <div className="wb-tags"><span className="wb-q-label">{s.onMind}</span>
        <div>{TAGS.map(tg => <button key={tg} type="button" className={`wb-tag ${tags.includes(tg) ? 'on' : ''}`} aria-pressed={tags.includes(tg)}
          onClick={() => setTags(p => (p.includes(tg) ? p.filter(y => y !== tg) : [...p, tg]))}>{s.tag[tg]}</button>)}</div>
      </div>
      <label className="wb-note"><span className="wb-q-label">{s.note}</span>
        <textarea rows={2} value={note} placeholder={s.notePh} onChange={e => setNote(e.target.value)} /></label>
      <div className={`wb-share ${share ? 'on' : ''}`}>
        <label className="wb-switch"><input type="checkbox" checked={share} onChange={e => setShare(e.target.checked)} /><i />{s.share}</label>
        {share && note.trim() && <label className="wb-switch small"><input type="checkbox" checked={shareNote} onChange={e => setShareNote(e.target.checked)} /><i />{s.shareNote}</label>}
      </div>
      <div className="wb-actions">
        <button type="button" className="btn primary" disabled={!complete || busy} onClick={save}>{share ? <Send size={15} /> : <Lock size={15} />}{share ? s.saveSend : s.save}</button>
        <button type="button" className="btn ghost" onClick={onCancel}>{s.phqLater}</button>
      </div>
    </section>
  )
}

function Phq4({ crewId, name, onSaved, onLater }: { crewId: string; name: string; onSaved: (a: WbAdvice[] | null) => void; onLater: () => void }) {
  const { lang } = useLang(); const s = WB_TXT[lang]
  const [a, setA] = useState<Partial<Record<PhqQuestion, number>>>({})
  const [busy, setBusy] = useState(false)
  const complete = PHQ4_QUESTIONS.every(q => typeof a[q] === 'number')
  const save = async () => {
    if (!complete || busy) return
    setBusy(true)
    onSaved(await addCheckIn({ id: `${Date.now()}`, ts: Date.now(), crewId, instrument: PHQ4_ID, answers: a as Record<string, number>, tags: [], note: '', shared: false, noteShared: false }, name))
  }
  return (
    <section className="card wb-form wb-phq" aria-label={s.phqTitle}>
      <h2 className="section-h" style={{ margin: 0 }}>{s.phqTitle}</h2>
      <p className="small muted" style={{ margin: '4px 0 2px' }}>{s.phqSub}</p>
      <p className="wb-q-label" style={{ margin: '8px 0 0' }}>{s.phqIntro}</p>
      {PHQ4_QUESTIONS.map(q => <div key={q} className="wb-q">
        <span className="wb-q-label">{s.phq[q]}</span>
        <div className="wb-scale" role="radiogroup">{s.phqOpts.map((o, i) =>
          <button key={o} type="button" role="radio" aria-checked={a[q] === i} className={`wb-tag ${a[q] === i ? 'on' : ''}`} onClick={() => setA(p => ({ ...p, [q]: i }))}>{o}</button>)}</div>
      </div>)}
      <p className="small muted" style={{ margin: '8px 0 0' }}>PHQ-4 © Pfizer Inc., free for download and use (Kroenke et al., Psychosomatics 2009).</p>
      <div className="wb-actions">
        <button type="button" className="btn primary" disabled={!complete || busy} onClick={save}><Lock size={15} />{s.phqSave}</button>
        <button type="button" className="btn ghost" onClick={onLater}>{s.phqLater}</button>
      </div>
    </section>
  )
}

/** The backend saves it as shared and creates the packet for the flight surgeon (without a backend: a local packet). */
function sendToGround(ci: CheckIn, withNote: boolean, name: string) {
  void shareCheckIn(ci, withNote, name)
}

function History({ c, crewId, title }: { c: CrewDetail; crewId: string; title: string }) {
  const { lang } = useLang(); const s = WB_TXT[lang]
  const history = useCheckIns(crewId)
  const when = (ts: number) => new Date(ts).toLocaleString(lang === 'es' ? 'es-ES' : 'en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  return (
    <Card title={title}>
      {!history.length && <p className="small muted" style={{ margin: 0 }}>{s.none}</p>}
      <ul className="wb-history">{history.slice(0, 6).map(h => (
        <li key={h.id}>
          <div className="wb-history-top"><time>{when(h.ts)}</time>
            {h.shared ? <span className="wb-badge shared"><Send size={11} /> {s.shared}</span> : <span className="wb-badge"><Lock size={11} /> {s.private}</span>}</div>
          {isDaily(h)
            ? <div className="wb-bars" aria-hidden>{QUESTIONS.map(q => {
                const [lo, hi] = RANGE[q], v = h.answers[q], bad = concerning(q, v)
                const good = q === 'fatigue' || q === 'stress' || q === 'workload' ? (hi - v) / (hi - lo) : (v - lo) / (hi - lo)   // tall = good
                return <span key={q} title={`${s.q[q]} ${fmtAnswer(q, v)}`}><i className={bad ? 'v1' : ''} style={{ height: `${Math.max(8, Math.min(1, good) * 100)}%` }} /></span>
              })}</div>
            : <span className="small">{h.scores ? `${s.phqTitle}: PHQ-4 ${h.scores.total}/12` : s.phqTitle}</span>}
          {!h.shared && <button type="button" className="btn ghost wb-send" onClick={() => sendToGround(h, false, c.name)}><Send size={13} />{s.sendNow}</button>}
        </li>
      ))}</ul>
    </Card>
  )
}

/** The crew member chooses how much of this page ground can see. */
function ShareChoice({ crewId }: { crewId: string }) {
  const { lang } = useLang(); const s = SHARE_TXT[lang]
  const level = useShareLevel(crewId)
  return (
    <Card title={<><Lock size={14} />{s.title}</>}>
      <div className="seg wb-share-seg" role="radiogroup" aria-label={s.title}>
        {(['none', 'summary', 'signals'] as ShareLevel[]).map(l => <button key={l} type="button" role="radio" aria-checked={level === l} className={level === l ? 'on' : ''} onClick={() => setShareLevel(crewId, l)}>{s[l]}</button>)}
      </div>
      <p className="small muted" style={{ margin: '10px 0 0' }}>{s.hint[level]}</p>
    </Card>
  )
}
