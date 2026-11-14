// Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
// "How I feel": Metis keeps asking how the crew member is and offers to talk; below, the wellbeing signals it reads
// (self-reported mood plus sleep, HRV and resting heart rate against the personal band), the possible risks they point
// to (stress, low mood, fatigue, poor sleep, isolation, crew tension) with example signs, what helps, and a direct
// check with Metis (the psychological triage flows). Check-ins are private; sending one to ground is optional.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, ChevronDown, Lock, MessageCircle, Send, Stethoscope } from 'lucide-react'
import { api, type CrewDetail, type Metric } from '../api'
import { useLoad } from '../hooks'
import { useLang, useT } from '../i18n'
import { Card, DEC, Loading, MetisLine, Page, Spark, UNIT, fmt, levelOf, useCrew } from '../ui'
import { QUESTIONS, WB_TXT, SHARE_TXT, setShareLevel, useShareLevel, type ShareLevel, checkInText, shareCheckIn, useCheckIns, type CheckIn } from '../wellbeing'
import { TONES, VOICE_TXT, toneCounts, voiceMoments, type Tone } from '../voiceTone'
import '../wellbeing.css'

export type RiskId = 'stress' | 'mood' | 'fatigue' | 'sleep' | 'isolation' | 'conflict'
export type RiskLevel = 'low' | 'watch' | 'high'

export const WB_RISK_TXT = {
  en: {
    title: 'How I feel',
    ask: (n: string) => `${n}, is there something on your mind you would like to talk about?`,
    askAgain: (n: string) => `Thanks, ${n}. I am here whenever you want to talk about anything that is going on.`,
    quick: { good: 'I feel good', tired: 'A bit tired', stressed: 'Stressed', talk: 'I would like to talk' },
    talk: 'Talk to Metis', check: 'Do a check with Metis',
    glance: 'Today at a glance', examples: 'Examples', noSigns: 'No signs',
    lowMood: 'Low mood', voiceWeek: 'Voice this week', toneDetails: 'Tone breakdown', showAll: 'Show all', showLess: 'Show less',
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
      fatigue: { name: 'Fatigue', flow: 'cant_sleep',
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
      moodLow: (v: number) => `Mood ${v}/5 in your last days`,
      said: (what: string) => `You said: ${what}`,
    },
    checkin: 'Tell Metis how you feel', history: 'My last check-ins',
    recTitle: (n: string) => `${n}, this is what I recommend for the next days:`, talkOffer: 'Do you want to talk with me about it?', talkYes: 'Yes, talk with Metis',
  },
  es: {
    title: 'Cómo me siento',
    ask: (n: string) => `${n}, ¿hay algo que te ronde la cabeza y de lo que quieras hablar?`,
    askAgain: (n: string) => `Gracias, ${n}. Aquí estoy cuando quieras hablar de cualquier cosa que te esté pasando.`,
    quick: { good: 'Me siento bien', tired: 'Algo cansado/a', stressed: 'Con estrés', talk: 'Quiero hablar' },
    talk: 'Hablar con Metis', check: 'Hacer un chequeo con Metis',
    glance: 'Hoy de un vistazo', examples: 'Ejemplos', noSigns: 'Sin señales',
    lowMood: 'Ánimo bajo', voiceWeek: 'Voz esta semana', toneDetails: 'Detalle de tonos', showAll: 'Mostrar todo', showLess: 'Mostrar menos',
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
      fatigue: { name: 'Cansancio', flow: 'cant_sleep',
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
      moodLow: (v: number) => `Ánimo ${v}/5 en tus últimos días`,
      said: (what: string) => `Dijiste: ${what}`,
    },
    checkin: 'Cuéntale a Metis cómo te sientes', history: 'Mis últimos registros',
    recTitle: (n: string) => `${n}, esto es lo que te recomiendo para los próximos días:`, talkOffer: '¿Quieres hablarlo conmigo?', talkYes: 'Sí, hablar con Metis',
  },
}

/** Nights in a row, counting back from today, outside the band on the bad side. */
function streak(c: CrewDetail, m: Metric, dir: 1 | -1) {
  const b = c.baseline[m]; let n = 0
  for (let i = c.days.length - 1; i >= 0; i--) { const v = c.days[i][m]; if (dir < 0 ? v < b.band_low : v > b.band_high) n++; else break }
  return n
}

export function computeRisks(c: CrewDetail, last: CheckIn | undefined, lang: 'en' | 'es') {
  const x = WB_RISK_TXT[lang], wb = WB_TXT[lang]
  const today = c.days[c.days.length - 1]
  const recent = last && Date.now() - last.ts < 3 * 864e5 ? last : undefined
  const a = recent?.answers, tags = recent?.tags ?? []
  const hrv = streak(c, 'hrv_ms', -1), rhr = streak(c, 'resting_hr_bpm', 1), sl = streak(c, 'sleep_h', -1)
  const moodDays = c.days.slice(-5).map(d => d.mood_1_5), moodAvg = moodDays.reduce((s, v) => s + v, 0) / moodDays.length
  const out: Record<RiskId, { score: number; why: string[] }> = { stress: { score: 0, why: [] }, mood: { score: 0, why: [] }, fatigue: { score: 0, why: [] }, sleep: { score: 0, why: [] }, isolation: { score: 0, why: [] }, conflict: { score: 0, why: [] } }
  const add = (r: RiskId, pts: number, why: string) => { out[r].score += pts; out[r].why.push(why) }
  const said = (t: string) => x.reason.said(wb.tag[t].toLowerCase())
  if (hrv) add('stress', hrv >= 2 ? 2 : 1, x.reason.hrvLow(fmt(today.hrv_ms, 0), hrv))
  if (rhr) add('stress', 1, x.reason.rhrHigh(fmt(today.resting_hr_bpm, 0)))
  if (a && a.stress <= 2) add('stress', 2, `${wb.q.stress} ${a.stress}/5`)
  for (const t of ['workload', 'worried']) if (tags.includes(t)) add('stress', 1, said(t))
  if (moodAvg <= 3) add('mood', moodAvg <= 2.5 ? 2 : 1, x.reason.moodLow(Math.round(moodAvg)))
  if (a && a.mood <= 2) add('mood', 2, `${wb.q.mood} ${a.mood}/5`)
  if (tags.includes('bored')) add('mood', 1, said('bored'))
  if (sl) add('fatigue', 1, x.reason.sleepLow(fmt(today.sleep_h, 1), sl))
  if (a && a.energy <= 2) add('fatigue', 2, `${wb.q.energy} ${a.energy}/5`)
  if (tags.includes('tired')) add('fatigue', 1, said('tired'))
  if (sl) add('sleep', sl >= 2 ? 2 : 1, x.reason.sleepLow(fmt(today.sleep_h, 1), sl))
  if (today.co2_night_peak_mmhg > 3) add('sleep', 1, x.reason.co2(fmt(today.co2_night_peak_mmhg, 2)))
  if (a && a.sleep <= 2) add('sleep', 2, `${wb.q.sleep} ${a.sleep}/5`)
  if (a && a.connected <= 2) add('isolation', 2, `${wb.q.connected} ${a.connected}/5`)
  if (tags.includes('homesick')) add('isolation', 2, said('homesick'))
  if (tags.includes('crew')) add('conflict', 2, said('crew'))
  // How the voice sounded in the last 3 days
  const vt = VOICE_TXT[lang], tc = toneCounts(voiceMoments(c.id), 72)
  if (tc.sad) add('mood', 1, vt.reason(vt.tone.sad, tc.sad))
  if (tc.irritated) add('stress', 1, vt.reason(vt.tone.irritated, tc.irritated))
  if (tc.anxious) add('stress', 1, vt.reason(vt.tone.anxious, tc.anxious))
  if (tc.tired >= 2) add('fatigue', 1, vt.reason(vt.tone.tired, tc.tired))
  return (Object.keys(out) as RiskId[]).map(id => ({ id, ...out[id], level: (out[id].score >= 4 ? 'high' : out[id].score >= 2 ? 'watch' : 'low') as RiskLevel }))
    .sort((p, q) => q.score - p.score)
}

export default function Wellbeing() {
  const { lang } = useLang(); const t = useT(); const x = WB_RISK_TXT[lang]
  const { crewId } = useCrew()
  const { data: c } = useLoad(() => api.crewOne(crewId), [crewId])
  const history = useCheckIns(crewId)
  const nav = useNavigate()
  if (!c) return <Loading />
  const risks = computeRisks(c, history[0], lang)
  const today = c.days[c.days.length - 1]
  const SIGNALS: Metric[] = ['mood_1_5', 'sleep_h', 'hrv_ms', 'resting_hr_bpm']
  const go = (flow: string) => nav(`/triage/run?${new URLSearchParams({ flow, voice: '1' })}`)
  const top = risks.find(r => r.level !== 'low')
  const attention = risks.filter(r => r.level !== 'low')
  const recs = (attention.length ? attention : risks.slice(0, 1)).flatMap(r => x.risk[r.id].help.slice(0, 2)).slice(0, 4)

  return (
    <Page title={x.title}>
      {/* Metis is always the one asking */}
      <section className="card feature feature-gradient wb-ask" aria-live="polite">
        <MetisLine><p className="wb-ask-q">{x.ask(c.name)}</p></MetisLine>
        <div className="wb-ask-actions">
          <button type="button" className="btn primary" onClick={() => nav('/talk')}><MessageCircle size={16} />{x.quick.talk}</button>
          <button type="button" className="btn wb-check" onClick={() => go(x.risk[(top ?? risks[0]).id].flow)}><Stethoscope size={16} />{x.check}</button>
        </div>
      </section>

      <Card title={x.glance} className="wb-glance">
        <div className="wb-signals" aria-label={x.signals}>
          {SIGNALS.map(m => <div key={m} className={`wb-signal ${levelOf(m, today[m], c.baseline[m])}`}>
            <span>{t(`m_${m}`)}</span>
            <strong>{fmt(today[m], DEC[m])}<small>{m === 'mood_1_5' ? '/5' : t(UNIT[m])}</small></strong>
            <Spark days={c.days} m={m} b={c.baseline[m]} h={26} color="#2E96F5" />
          </div>)}
          <VoiceWeek crewId={c.id} />
        </div>
      </Card>

      <section className="wb-signs-section" aria-labelledby="wb-risks-h">
        <h2 id="wb-risks-h" className="wb-h">{x.risks}</h2>
        <div className="wb-risks">
          {attention.map(r => <RiskCard key={r.id} risk={r} lang={lang} />)}
        </div>
        <div className="wb-low-risks">
          {risks.some(r => r.level === 'low') && <span>{x.noSigns}:</span>}
          {risks.filter(r => r.level === 'low').map(r => <details key={r.id} className="wb-low-risk">
            <summary>{r.id === 'mood' ? x.lowMood : x.risk[r.id].name}</summary>
            <RiskCard risk={r} lang={lang} />
          </details>)}
        </div>
      </section>

      <VoiceTone crewId={c.id} />

      <div className="wb-grid">
        <Card title={x.help} className="wb-improve-card">
          <p className="wb-rec-title">{x.recTitle(c.name)}</p>
          <ul className="wb-recs">{recs.map(r => <li key={r}><Check size={14} aria-hidden />{r}</li>)}</ul>
        </Card>
        <History c={c} crewId={crewId} title={x.history} />
        <ShareChoice crewId={crewId} />
      </div>
    </Page>
  )
}

function RiskCard({ risk: r, lang }: { risk: ReturnType<typeof computeRisks>[number]; lang: 'en' | 'es' }) {
  const x = WB_RISK_TXT[lang], k = x.risk[r.id]
  return <article className={`card wb-risk ${r.level}`}>
    <header><h3>{k.name}</h3><span className={`wb-level ${r.level}`}>{x.level[r.level]}</span></header>
    <div className="wb-meter" aria-hidden><i style={{ width: `${Math.min(100, 12 + r.score * 18)}%` }} /></div>
    <p className="wb-why"><b>{x.why}:</b> {r.why.length ? r.why.join('; ') : x.noWhy}</p>
    <details className="wb-examples">
      <summary>{x.examples}<ChevronDown size={13} aria-hidden /></summary>
      <p className="wb-signs"><b>{x.signs}:</b> {k.signs.map((g, i) => (i ? g.replace(/^./, ch => ch.toLowerCase()) : g)).join(', ')}</p>
    </details>
  </article>
}

function sendToGround(ci: CheckIn, withNote: boolean, crewId: string, name: string) {
  const x = { ...ci, noteShared: withNote }
  void api.postEvent('send_flight_surgeon', crewId, { kind: 'wellbeing', text_en: checkInText(x, 'en', name), text_es: checkInText(x, 'es', name) })
  shareCheckIn(ci.id, withNote)
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
          <div className="wb-bars" aria-hidden>{QUESTIONS.map(q => <span key={q} title={`${s.q[q]} ${h.answers[q]}/5`}><i className={`v${h.answers[q]}`} style={{ height: `${h.answers[q] * 20}%` }} /></span>)}</div>
          {!h.shared && <button type="button" className="btn ghost wb-send" onClick={() => sendToGround(h, false, crewId, c.name)}><Send size={13} />{s.sendNow}</button>}
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

/** Compact weekly overview, kept beside the other wellbeing signals. */
function VoiceWeek({ crewId }: { crewId: string }) {
  const { lang } = useLang(); const v = VOICE_TXT[lang], x = WB_RISK_TXT[lang]
  const moments = voiceMoments(crewId)
  const counts = toneCounts(moments)
  const total = TONES.reduce((n, t) => n + counts[t], 0) || 1
  const ranked = TONES.filter(t => counts[t]).sort((a, b) => counts[b] - counts[a])
  const others = ranked.slice(1).filter(t => t !== 'neutral' && t !== 'calm' && t !== 'happy').slice(0, 2).map(t => v.tone[t].toLowerCase())
  const summary = ranked.length ? v.summary(v.tone[ranked[0]].toLowerCase(), others.length ? v.also(others.join(lang === 'es' ? ' y ' : ' and ')) : '') : ''
  return <div className="wb-voice-week">
    <span className="wb-stat-label">{x.voiceWeek}</span>
    <div className="wb-voice-bar" aria-hidden>{TONES.filter(t => counts[t]).map(t => <i key={t} className={`tone-${t}`} style={{ width: `${(counts[t] / total) * 100}%` }} />)}</div>
    <p className="wb-voice-summary">{summary}</p>
    <details className="wb-tone-details">
      <summary>{x.toneDetails}<ChevronDown size={12} aria-hidden /></summary>
      <p className="wb-stat-label">{v.week}</p>
      <ul className="wb-voice-legend">{ranked.map(t => <li key={t}><i className={`tone-${t}`} />{v.tone[t]}<b>{counts[t]}</b></li>)}</ul>
    </details>
  </div>
}

/** The most recent voice moments, with the complete history available on demand. */
function VoiceTone({ crewId }: { crewId: string }) {
  const { lang } = useLang(); const v = VOICE_TXT[lang], x = WB_RISK_TXT[lang]
  const [showAll, setShowAll] = useState(false)
  const moments = voiceMoments(crewId)
  const day = (ts: number) => {
    const d = new Date(ts), now = new Date(), y = new Date(now); y.setDate(now.getDate() - 1)
    const hm = d.toLocaleTimeString(lang === 'es' ? 'es-ES' : 'en-GB', { hour: '2-digit', minute: '2-digit' })
    const label = d.toDateString() === now.toDateString() ? v.today : d.toDateString() === y.toDateString() ? v.yesterday : d.toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-GB', { weekday: 'short', day: 'numeric' })
    return `${label} ${hm}`
  }
  return (
    <section className="wb-voice" aria-labelledby="wb-voice-h">
      <h2 id="wb-voice-h" className="wb-h">{v.title}</h2>
      <p className="wb-voice-sub">{v.sub}</p>
      <ol id="wb-voice-moments" className="wb-voice-list">
        {(showAll ? moments : moments.slice(0, 4)).map(m => <li key={m.id}>
          <time dateTime={new Date(m.ts).toISOString()}>{day(m.ts)}</time>
          <span className="wb-voice-ctx">{v.context[m.context]}</span>
          <span className={`wb-tone tone-${m.tone}`}><i />{v.tone[m.tone as Tone]}</span>
          <span className="wb-voice-conf" role="meter" aria-label={v.confidence} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(m.confidence * 100)} title={`${Math.round(m.confidence * 100)} % ${v.confidence}`}><i style={{ width: `${m.confidence * 100}%` }} /></span>
        </li>)}
      </ol>
      {moments.length > 4 && <button type="button" className="wb-text-toggle" aria-expanded={showAll} aria-controls="wb-voice-moments" onClick={() => setShowAll(value => !value)}>
        {showAll ? x.showLess : x.showAll}<ChevronDown size={14} aria-hidden style={{ transform: showAll ? 'rotate(180deg)' : undefined }} />
      </button>}
    </section>
  )
}
