export type CharacterId = 'vesper' | 'cinder' | 'bastion' | 'warden'
export type WeaponId = 'revolver' | 'scattergun' | 'arc-rifle'
export type EnemyType = 'thrall' | 'skitter' | 'spitter' | 'bulwark' | 'tollkeeper'
export type GamePhase = 'playing' | 'upgrade' | 'victory' | 'defeat'

export interface PlayerConfig {
  id: string
  name: string
  character: CharacterId
  weapon: WeaponId
  color: string
}

export interface InputState {
  up: boolean
  down: boolean
  left: boolean
  right: boolean
  firing: boolean
  interact: boolean
  aim: number
}

export interface PlayerState extends PlayerConfig {
  x: number
  y: number
  vx: number
  vy: number
  aim: number
  health: number
  maxHealth: number
  ammo: number
  maxAmmo: number
  reloadRemaining: number
  reloadDuration: number
  fireCooldown: number
  invulnerable: number
  downed: boolean
  eliminated: boolean
  downTimer: number
  reviveProgress: number
  shotCount: number
  kills: number
  damageDealt: number
  awakened: boolean
  perks: Record<string, number>
}

export interface EnemyState {
  id: number
  type: EnemyType
  x: number
  y: number
  vx: number
  vy: number
  health: number
  maxHealth: number
  radius: number
  speed: number
  damage: number
  attackCooldown: number
  burn: number
  burnTick: number
  burnOwner?: string
  slow: number
  phase: number
}

export interface ProjectileState {
  id: number
  ownerId: string
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  damage: number
  life: number
  pierce: number
  bounces: number
  enemy: boolean
  chain: number
  burn: boolean
  color: string
}

export interface PickupState {
  id: number
  x: number
  y: number
  value: number
}

export interface StructureState {
  id: number
  type: 'moonwell' | 'ward-tower' | 'ritual-stone'
  x: number
  y: number
  radius: number
  cooldown: number
}

export interface GameEvent {
  id: number
  type: 'shot' | 'hit' | 'hurt' | 'level' | 'boss' | 'revive' | 'awaken' | 'win' | 'lose'
  x?: number
  y?: number
  text?: string
}

export interface UpgradeOffer {
  ids: string[]
  chooserId: string
  expiresIn: number
}

export interface GameSnapshot {
  seed: number
  phase: GamePhase
  timeRemaining: number
  duration: number
  level: number
  xp: number
  xpToNext: number
  players: PlayerState[]
  enemies: EnemyState[]
  projectiles: ProjectileState[]
  pickups: PickupState[]
  structures: StructureState[]
  upgrade?: UpgradeOffer
  events: GameEvent[]
}

export interface UpgradeDefinition {
  id: string
  name: string
  icon: string
  description: string
  maxLevel: number
  accent: string
}

