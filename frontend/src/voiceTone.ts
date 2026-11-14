// Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
// How the crew member's voice sounded each time they spoke to Metis (tone, pace and energy of the voice).
// Only the result is kept on board, never the recording. Prototype: the log is a fixed demo history per crew member.

export type Tone = 'neutral' | 'calm' | 'happy' | 'tired' | 'sad' | 'irritated' | 'anxious'
export type Context = 'checkin' | 'talk' | 'triage' | 'evening'
export interface VoiceMoment { id: string; ts: number; context: Context; tone: Tone; confidence: number }

const H = 36e5
/** [days ago, habitat time, context, tone, confidence] per crew member; newest first. */
const LOG: Record<string, [number, string, Context, Tone, number][]> = {
  lena: [[0, '07:02', 'checkin', 'tired', .74], [1, '21:40', 'evening', 'sad', .61], [1, '15:10', 'talk', 'irritated', .58], [1, '07:05', 'checkin', 'tired', .69], [2, '13:30', 'talk', 'neutral', .82], [2, '07:01', 'checkin', 'neutral', .77], [3, '21:15', 'evening', 'calm', .7], [4, '07:03', 'checkin', 'happy', .66]],
  marco: [[0, '07:10', 'checkin', 'neutral', .8], [1, '16:20', 'talk', 'happy', .72], [1, '07:08', 'checkin', 'calm', .75], [2, '21:05', 'evening', 'neutral', .79], [3, '07:12', 'checkin', 'happy', .68]],
  noor: [[0, '06:55', 'checkin', 'calm', .81], [1, '14:45', 'talk', 'happy', .7], [1, '06:58', 'checkin', 'neutral', .78], [2, '21:30', 'evening', 'calm', .74], [3, '07:00', 'checkin', 'happy', .69]],
  kenji: [[0, '06:40', 'checkin', 'neutral', .83], [1, '18:15', 'talk', 'irritated', .63], [1, '06:45', 'checkin', 'neutral', .8], [2, '22:10', 'evening', 'tired', .6], [3, '06:42', 'checkin', 'calm', .72]],
}
const T0 = Date.now()

export function voiceMoments(crewId: string): VoiceMoment[] {
  const midnight = new Date(); midnight.setHours(0, 0, 0, 0)
  return (LOG[crewId] ?? LOG.lena).map(([d, hm, context, tone, confidence], i) => {
    const [h, m] = hm.split(':').map(Number)
    let ts = midnight.getTime() - d * 24 * H + (h * 60 + m) * 6e4
    if (ts > T0) ts -= 24 * H  // early in the day: today's moment has not happened yet, show it as yesterday's
    return { id: `${crewId}-${i}`, ts, context, tone, confidence }
  })
}

/** Tones in the last `hours` hours, counted. */
export function toneCounts(m: VoiceMoment[], hours = 7 * 24): Record<Tone, number> {
  const out = { neutral: 0, calm: 0, happy: 0, tired: 0, sad: 0, irritated: 0, anxious: 0 } as Record<Tone, number>
  for (const v of m) if (T0 - v.ts <= hours * H) out[v.tone]++
  return out
}

export const TONES: Tone[] = ['happy', 'calm', 'neutral', 'tired', 'sad', 'anxious', 'irritated']

export const VOICE_TXT = {
  en: {
    title: 'How your voice sounded',
    sub: 'Each time you speak to Metis it notices the tone, pace and energy of your voice. Only the result is kept on board, never the recording.',
    week: 'This week', confidence: 'confidence',
    tone: { neutral: 'Neutral', calm: 'Calm', happy: 'Happy', tired: 'Tired', sad: 'Sad', irritated: 'Irritated', anxious: 'Anxious' } as Record<Tone, string>,
    context: { checkin: 'Morning check-in', talk: 'Talk with Metis', triage: 'Triage', evening: 'Evening chat' } as Record<Context, string>,
    today: 'Today', yesterday: 'Yesterday',
    summary: (main: string, extra: string) => `Your voice sounded mostly ${main} this week${extra}.`,
    also: (what: string) => `, and ${what} at times`,
    reason: (tone: string, n: number) => `Your voice sounded ${tone.toLowerCase()} ${n === 1 ? 'once' : `${n} times`} in the last 3 days`,
  },
  es: {
    title: 'Cómo sonó tu voz',
    sub: 'Cada vez que hablas con Metis, nota el tono, el ritmo y la energía de tu voz. A bordo solo se guarda el resultado, nunca la grabación.',
    week: 'Esta semana', confidence: 'confianza',
    tone: { neutral: 'Neutra', calm: 'Tranquila', happy: 'Contenta', tired: 'Cansada', sad: 'Triste', irritated: 'Irritada', anxious: 'Nerviosa' } as Record<Tone, string>,
    context: { checkin: 'Chequeo de la mañana', talk: 'Charla con Metis', triage: 'Triaje', evening: 'Charla de la noche' } as Record<Context, string>,
    today: 'Hoy', yesterday: 'Ayer',
    summary: (main: string, extra: string) => `Esta semana tu voz sonó sobre todo ${main}${extra}.`,
    also: (what: string) => ` y a ratos ${what}`,
    reason: (tone: string, n: number) => `Tu voz sonó ${tone.toLowerCase()} ${n === 1 ? 'una vez' : `${n} veces`} en los últimos 3 días`,
  },
}
