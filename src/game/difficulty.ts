import type { DifficultyId } from './types'

export interface DifficultyDefinition {
  id: DifficultyId
  name: string
  epithet: string
  description: string
  enemyHealth: number
  enemySpeed: number
  enemyDamage: number
  spawnDensity: number
  bossCadence: number
  weakPointDamage: number
  accent: string
}

export const DIFFICULTIES: readonly DifficultyDefinition[] = [
  { id: 'story', name: 'Embers', epithet: 'STORY', description: 'A forgiving route through the ruins: fewer bodies, softer hits, generous weak points.', enemyHealth: 0.78, enemySpeed: 0.92, enemyDamage: 0.72, spawnDensity: 0.72, bossCadence: 1.16, weakPointDamage: 2.65, accent: '#86d7b5' },
  { id: 'standard', name: 'Nightfall', epithet: 'INTENDED', description: 'The designed cooperative challenge. Every mistake matters; every build can still carry.', enemyHealth: 1, enemySpeed: 1, enemyDamage: 1, spawnDensity: 1, bossCadence: 1, weakPointDamage: 2.25, accent: '#f2d479' },
  { id: 'nightmare', name: 'Black Signal', epithet: 'HARD', description: 'Denser swarms, faster horrors, shorter boss tells, and heavier half-heart damage packets.', enemyHealth: 1.28, enemySpeed: 1.1, enemyDamage: 1.24, spawnDensity: 1.3, bossCadence: 0.86, weakPointDamage: 2.05, accent: '#ef8a71' },
  { id: 'apocalypse', name: 'Extinction', epithet: 'BRUTAL', description: 'The Collapse repeats at full force. Relentless density, empowered elites, and lethal night lords.', enemyHealth: 1.58, enemySpeed: 1.2, enemyDamage: 1.55, spawnDensity: 1.62, bossCadence: 0.72, weakPointDamage: 1.85, accent: '#ef4f73' },
] as const

export const difficultyById = (id: DifficultyId): DifficultyDefinition => DIFFICULTIES.find((difficulty) => difficulty.id === id) ?? DIFFICULTIES[1]
