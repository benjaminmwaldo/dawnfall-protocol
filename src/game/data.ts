import type { CharacterId, UpgradeDefinition, WeaponId } from './types'

export interface CharacterDefinition {
  id: CharacterId
  name: string
  epithet: string
  glyph: string
  color: string
  description: string
  baseAbility: string
  awakening: string
}

export interface WeaponDefinition {
  id: WeaponId
  name: string
  glyph: string
  description: string
  damage: number
  fireRate: number
  projectiles: number
  magazine: number
  reload: number
  speed: number
  spread: number
  pierce: number
  chain: number
}

export const CHARACTERS: CharacterDefinition[] = [
  {
    id: 'vesper',
    name: 'Vesper',
    epithet: 'The Deadeye',
    glyph: '✦',
    color: '#f2d479',
    description: 'Measured shots, brutal payoffs.',
    baseAbility: 'Sixth Sense — every sixth shot is a critical hit.',
    awakening: 'Perfect Rhythm — every fourth shot crits and pierces.',
  },
  {
    id: 'cinder',
    name: 'Cinder',
    epithet: 'The Ashborn',
    glyph: '◆',
    color: '#ff735c',
    description: 'Turns packed hordes into kindling.',
    baseAbility: 'Kindling — weapon hits ignite enemies.',
    awakening: 'Flashover — burning enemies explode on death.',
  },
  {
    id: 'bastion',
    name: 'Bastion',
    epithet: 'The Oathbound',
    glyph: '⬡',
    color: '#74d8c2',
    description: 'A moving safe zone for the squad.',
    baseAbility: 'Bulwark — nearby allies take 18% less damage.',
    awakening: 'Hold the Line — the aura doubles in range and strength.',
  },
  {
    id: 'warden',
    name: 'Warden',
    epithet: 'The Last Light',
    glyph: '✚',
    color: '#b6a5ff',
    description: 'Keeps bad runs from becoming final runs.',
    baseAbility: 'Second Wind — revive allies 50% faster.',
    awakening: 'Grace — the squad slowly regenerates health.',
  },
]

export const WEAPONS: WeaponDefinition[] = [
  {
    id: 'revolver',
    name: 'Oathkeeper',
    glyph: '⌁',
    description: 'Six precise shots. High damage and clean criticals.',
    damage: 30,
    fireRate: 3.1,
    projectiles: 1,
    magazine: 6,
    reload: 1.05,
    speed: 760,
    spread: 0.025,
    pierce: 0,
    chain: 0,
  },
  {
    id: 'scattergun',
    name: 'Gravesong',
    glyph: '≋',
    description: 'A short-range fan that erases crowded lanes.',
    damage: 12,
    fireRate: 1.25,
    projectiles: 5,
    magazine: 4,
    reload: 1.3,
    speed: 620,
    spread: 0.5,
    pierce: 0,
    chain: 0,
  },
  {
    id: 'arc-rifle',
    name: 'Blue Ruin',
    glyph: 'ϟ',
    description: 'Fast rounds that arc into a second target.',
    damage: 15,
    fireRate: 5.4,
    projectiles: 1,
    magazine: 16,
    reload: 1.55,
    speed: 700,
    spread: 0.045,
    pierce: 0,
    chain: 1,
  },
]

export const UPGRADES: UpgradeDefinition[] = [
  { id: 'quick-hands', name: 'Quick Hands', icon: '↻', description: 'Reload 18% faster per rank.', maxLevel: 3, accent: '#f2d479' },
  { id: 'double-tap', name: 'Double Tap', icon: 'Ⅱ', description: '+1 projectile, but shots deal 12% less damage.', maxLevel: 2, accent: '#e5b06d' },
  { id: 'static-link', name: 'Static Link', icon: 'ϟ', description: 'Hits arc to one additional nearby enemy.', maxLevel: 3, accent: '#74c8ff' },
  { id: 'combustion', name: 'Combustion', icon: '◆', description: 'Hits ignite; burn damage grows each rank.', maxLevel: 3, accent: '#ff735c' },
  { id: 'fleetfoot', name: 'Fleetfoot', icon: '»', description: 'Move 12% faster per rank.', maxLevel: 3, accent: '#74d8c2' },
  { id: 'vitality', name: 'Vitality', icon: '♥', description: '+25 maximum health and heal 25.', maxLevel: 3, accent: '#e8879c' },
  { id: 'soul-magnet', name: 'Soul Magnet', icon: '◎', description: 'Pull experience from 45% farther away.', maxLevel: 3, accent: '#b6a5ff' },
  { id: 'barrage', name: 'Barrage', icon: '≡', description: 'Fire 15% faster per rank.', maxLevel: 3, accent: '#f0f4e8' },
  { id: 'heavy-caliber', name: 'Heavy Caliber', icon: '●', description: '+22% damage and projectile size.', maxLevel: 3, accent: '#d7a56d' },
  { id: 'sanctuary', name: 'Sanctuary', icon: '✚', description: 'The squad regenerates health near allies.', maxLevel: 2, accent: '#86e8bb' },
  { id: 'overcharge', name: 'Overcharge', icon: '✦', description: '+9% critical chance per rank.', maxLevel: 3, accent: '#f2d479' },
  { id: 'frostbite', name: 'Frostbite', icon: '❄', description: 'Hits slow enemies; rank three can freeze.', maxLevel: 3, accent: '#a6d9ff' },
]

export const characterById = (id: CharacterId) => CHARACTERS.find((item) => item.id === id) ?? CHARACTERS[0]
export const weaponById = (id: WeaponId) => WEAPONS.find((item) => item.id === id) ?? WEAPONS[0]
export const upgradeById = (id: string) => UPGRADES.find((item) => item.id === id) ?? UPGRADES[0]

export const PLAYER_COLORS = ['#f2d479', '#74d8c2', '#ff735c', '#b6a5ff']

