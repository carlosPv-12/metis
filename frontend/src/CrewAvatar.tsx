// Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
// Round crew portrait. Uses src/assets/crew/<id>.webp when it exists (AI-generated portraits of FICTIONAL
// crew), otherwise the initial. Brand: photos always inside a circular holding shape.
const PHOTOS = import.meta.glob('./assets/crew/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>

export function crewPhoto(id: string): string | undefined { return PHOTOS[`./assets/crew/${id}.webp`] }

export default function CrewAvatar({ id, name, size = 28, className = '' }: { id: string; name: string; size?: number; className?: string }) {
  const src = crewPhoto(id)
  return (
    <span className={`crew-avatar ${src ? 'has-photo' : ''} ${className}`} style={{ width: size, height: size, fontSize: Math.round(size * 0.46) }} aria-hidden>
      {src ? <img src={src} alt="" width={size} height={size} loading="lazy" decoding="async" /> : name[0]}
    </span>
  )
}
