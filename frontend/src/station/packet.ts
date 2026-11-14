import type { Link } from '../link'
import type { Lang } from '../i18n'

export function packetStatus(link: Link, start: number | null, now: number, lang: Lang) {
  const s = {
    en: { queued: 'No link: queued. Will send when the link returns.', empty: 'No packet waiting', sending: 'Sending to Earth', sent: 'Sent and acknowledged', eta: 'Arrives in' },
    es: { queued: 'Sin enlace: en cola. Se enviará cuando vuelva el enlace.', empty: 'No hay paquetes pendientes', sending: 'Enviando a Tierra', sent: 'Enviado y confirmado', eta: 'Llega en' },
  }[lang]
  if (start == null) return s.empty
  if (link.mode === 'none') return s.queued
  const left = Math.max(0, Math.ceil((link.delayS ?? 0) - (now - start) / 1000))
  if (!left) return s.sent
  if (link.mode === 'realtime') return s.sending
  return `${s.eta} ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`
}
