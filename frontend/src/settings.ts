// Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
// User settings edited in the "Settings" screen. Stored in this browser (localStorage) — frontend only,
// so the backend contract (api.ts / API.md) is unchanged. If the crew profile ever moves to the backend
// (e.g. a `sex` field on /api/crew), only this file needs to change.
import { useSyncExternalStore } from 'react'

export type Sex = 'female' | 'male'
export type EnvId = 'iss' | 'eva' | 'moon' | 'mars' | 'blackout'

export const SETTINGS_LABEL = { en: 'Settings', es: 'Ajustes' } as const
export const REFERENCES_LABEL = { en: 'References', es: 'Referencias' } as const

/** Defaults from the crew data (Spanish roles: "Ingeniera (ficticia)", "Oficial médica (ficticia)", "(ficticio)"). */
export const DEFAULT_SEX: Record<string, Sex> = { lena: 'female', noor: 'female', marco: 'male', kenji: 'male' }

export interface Settings {
  sex: Record<string, Sex>
  /** Mission environment / Earth link profile (see link.ts). Default 'mars' = the demo's 5-min scenario. */
  env: EnvId
  /** One-way light delay to Earth for the Mars profile, in minutes (5–20). */
  marsDelayMin: number
}

const DEFAULTS: Settings = { sex: {}, env: 'mars', marsDelayMin: 5 }
const ENVS: EnvId[] = ['iss', 'eva', 'moon', 'mars', 'blackout']
const KEY = 'metis.settings'
const listeners = new Set<() => void>()

function read(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    const p = raw ? (JSON.parse(raw) as Partial<Settings>) : {}
    return {
      sex: { ...(p.sex ?? {}) },
      env: ENVS.includes(p.env as EnvId) ? (p.env as EnvId) : DEFAULTS.env,
      marsDelayMin: typeof p.marsDelayMin === 'number' ? Math.min(20, Math.max(5, p.marsDelayMin)) : DEFAULTS.marsDelayMin,
    }
  } catch { return { ...DEFAULTS, sex: {} } }
}

let current: Settings = read()

function write(next: Settings) {
  current = next
  try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* private mode: keep in memory */ }
  listeners.forEach(l => l())
}

function subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l) } }

export function useSettings(): Settings { return useSyncExternalStore(subscribe, () => current, () => current) }

/** Body figure for a crew member: the user's choice, else the default from the crew data, else female. */
export function sexOf(s: Settings, crewId: string): Sex { return s.sex[crewId] ?? DEFAULT_SEX[crewId] ?? 'female' }
export function useCrewSex(crewId: string): Sex { return sexOf(useSettings(), crewId) }

export function setCrewSex(crewId: string, sex: Sex) { write({ ...current, sex: { ...current.sex, [crewId]: sex } }) }
export function setEnv(env: EnvId) { write({ ...current, env }) }
export function setMarsDelayMin(min: number) { write({ ...current, marsDelayMin: Math.min(20, Math.max(5, Math.round(min))) }) }
export function resetSettings() { write({ ...DEFAULTS, sex: {} }) }
