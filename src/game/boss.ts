import { isBoss } from './data'
import type { EnemyState } from './types'

const OFFSETS: Partial<Record<EnemyState['type'], number>> = {
  tollkeeper: -1.1,
  broodmother: 2.15,
  graveknight: -0.35,
  'eclipse-eye': 0,
  'void-hart': 1.15,
  'prism-witch': -2.35,
  'iron-choir': 2.7,
  'star-eater': 0.6,
}

export const angularDistance = (first: number, second: number) => Math.abs(Math.atan2(Math.sin(first - second), Math.cos(first - second)))

export const bossWeakPointAngle = (enemy: EnemyState) => (OFFSETS[enemy.type] ?? 0) + enemy.phase * 0.28

export const bossWeakPointIsOpen = (enemy: EnemyState) => isBoss(enemy.type)
  && (enemy.abilityCooldown ?? 99) > 0
  && (enemy.abilityCooldown ?? 99) <= 1.08

export const bossWarningStrength = (enemy: EnemyState) => {
  if (!isBoss(enemy.type)) return 0
  const remaining = enemy.abilityCooldown ?? 99
  return remaining > 0 && remaining <= 1.08 ? 1 - remaining / 1.08 : 0
}
