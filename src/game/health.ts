export const HEART_VALUE = 25
export const HALF_HEART_VALUE = HEART_VALUE / 2
export const HEART_REGEN_SECONDS = 60
export const HEAL_CRYSTAL_SECONDS = 60

export const quantizeEnemyDamage = (damage: number): number => Math.max(
  HALF_HEART_VALUE,
  Math.round(damage / HALF_HEART_VALUE) * HALF_HEART_VALUE,
)

export const heartSlots = (maxHealth: number): number => Math.max(1, Math.round(maxHealth / HEART_VALUE))

export const heartFill = (health: number, slot: number): number => Math.max(
  0,
  Math.min(1, (health - slot * HEART_VALUE) / HEART_VALUE),
)
