import type { BossType, CharacterId, EnemyType, TeamBuffDefinition, UpgradeDefinition, WeaponId } from './types'

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
  { id: 'vesper', name: 'Vesper', epithet: 'The Deadeye', glyph: '✦', color: '#f2d479', description: 'Measured shots, brutal payoffs.', baseAbility: 'Sixth Sense — every sixth shot is a critical hit.', awakening: 'Perfect Rhythm — every fourth shot crits and pierces.' },
  { id: 'cinder', name: 'Cinder', epithet: 'The Ashborn', glyph: '◆', color: '#ff735c', description: 'Turns packed hordes into kindling.', baseAbility: 'Kindling — weapon hits ignite enemies.', awakening: 'Flashover — burning enemies explode on death.' },
  { id: 'bastion', name: 'Bastion', epithet: 'The Oathbound', glyph: '⬡', color: '#74d8c2', description: 'A knight who makes danger break around her.', baseAbility: 'Bulwark — nearby allies take 18% less damage.', awakening: 'Hold the Line — the aura doubles in range and strength.' },
  { id: 'warden', name: 'Warden', epithet: 'The Last Light', glyph: '✚', color: '#b6a5ff', description: 'Keeps bad runs from becoming final runs.', baseAbility: 'Second Wind — revive allies 50% faster.', awakening: 'Grace — living hunters slowly regenerate health.' },
  { id: 'nyx', name: 'Nyx', epithet: 'The Veilblade', glyph: '☾', color: '#7f8cff', description: 'Slips between blows and cuts through crowded lanes.', baseAbility: 'Veilstep — 16% chance to evade incoming damage.', awakening: 'Night Without End — evades become 28% and grant haste.' },
  { id: 'tempest', name: 'Tempest', epithet: 'The Stormheart', glyph: 'ϟ', color: '#65bfff', description: 'Makes every target the start of a lightning storm.', baseAbility: 'Conduction — every projectile chains once.', awakening: 'Supercell — chains travel farther and strike harder.' },
  { id: 'briar', name: 'Briar', epithet: 'The Bloodrose', glyph: '❧', color: '#e45d82', description: 'Feeds on the horde and punishes anything that closes.', baseAbility: 'Bloodbloom — kills restore a sliver of health.', awakening: 'Red Spring — healing doubles and excess becomes armor.' },
  { id: 'seraph', name: 'Seraph', epithet: 'The Dawnwing', glyph: '☼', color: '#ffd783', description: 'Radiant rounds reward fearless, precise play.', baseAbility: 'Sunfire — faster shots and +8% critical chance.', awakening: 'First Light — critical hits deal greater damage and pierce.' },
]

export const WEAPONS: WeaponDefinition[] = [
  { id: 'revolver', name: 'Oathkeeper', glyph: '⌁', description: 'Six precise shots. High damage and clean criticals.', damage: 30, fireRate: 3.1, projectiles: 1, magazine: 6, reload: 1.05, speed: 760, spread: 0.025, pierce: 0, chain: 0 },
  { id: 'scattergun', name: 'Gravesong', glyph: '≋', description: 'A short-range fan that erases crowded lanes.', damage: 12, fireRate: 1.25, projectiles: 5, magazine: 4, reload: 1.3, speed: 620, spread: 0.5, pierce: 0, chain: 0 },
  { id: 'arc-rifle', name: 'Blue Ruin', glyph: 'ϟ', description: 'Fast rounds that arc into a second target.', damage: 15, fireRate: 5.4, projectiles: 1, magazine: 16, reload: 1.55, speed: 700, spread: 0.045, pierce: 0, chain: 1 },
]

const common = (definition: Omit<UpgradeDefinition, 'category' | 'character'>): UpgradeDefinition => ({ ...definition, category: 'common' })
const signature = (character: CharacterId, definition: Omit<UpgradeDefinition, 'category' | 'character'>): UpgradeDefinition => ({ ...definition, category: 'signature', character })

export const UPGRADES: UpgradeDefinition[] = [
  common({ id: 'quick-hands', name: 'Quick Hands', icon: '↻', description: 'Reload 18% faster per rank.', maxLevel: 3, accent: '#f2d479' }),
  common({ id: 'double-tap', name: 'Double Tap', icon: 'Ⅱ', description: '+1 projectile, but shots deal 12% less damage.', maxLevel: 2, accent: '#e5b06d' }),
  common({ id: 'static-link', name: 'Static Link', icon: 'ϟ', description: 'Hits arc to one additional nearby enemy.', maxLevel: 3, accent: '#74c8ff' }),
  common({ id: 'combustion', name: 'Combustion', icon: '◆', description: 'Hits ignite; burn damage grows each rank.', maxLevel: 3, accent: '#ff735c' }),
  common({ id: 'fleetfoot', name: 'Fleetfoot', icon: '»', description: 'Move 12% faster per rank.', maxLevel: 3, accent: '#74d8c2' }),
  common({ id: 'vitality', name: 'Vitality', icon: '♥', description: '+25 maximum health and heal 25.', maxLevel: 3, accent: '#e8879c' }),
  common({ id: 'soul-magnet', name: 'Soul Magnet', icon: '◎', description: 'Pull experience from 45% farther away.', maxLevel: 3, accent: '#b6a5ff' }),
  common({ id: 'barrage', name: 'Barrage', icon: '≡', description: 'Fire 15% faster per rank.', maxLevel: 3, accent: '#f0f4e8' }),
  common({ id: 'heavy-caliber', name: 'Heavy Caliber', icon: '●', description: '+22% damage and projectile size.', maxLevel: 3, accent: '#d7a56d' }),
  common({ id: 'sanctuary', name: 'Sanctuary', icon: '✚', description: 'Regenerate health while near an ally.', maxLevel: 2, accent: '#86e8bb' }),
  common({ id: 'overcharge', name: 'Overcharge', icon: '✦', description: '+9% critical chance per rank.', maxLevel: 3, accent: '#f2d479' }),
  common({ id: 'frostbite', name: 'Frostbite', icon: '❄', description: 'Hits slow enemies for longer each rank.', maxLevel: 3, accent: '#a6d9ff' }),
  common({ id: 'longshot', name: 'Longshot', icon: '➶', description: '+18% projectile speed and +8% damage.', maxLevel: 3, accent: '#d9e4c8' }),
  common({ id: 'piercing-rounds', name: 'Piercing Rounds', icon: '⇥', description: 'Projectiles pass through one more enemy.', maxLevel: 2, accent: '#c7b59b' }),
  common({ id: 'hollow-points', name: 'Hollow Points', icon: '◒', description: 'Deal 18% more damage to wounded enemies.', maxLevel: 3, accent: '#ef718e' }),
  common({ id: 'steadfast', name: 'Steadfast', icon: '◇', description: 'Take 8% less damage per rank.', maxLevel: 3, accent: '#74d8c2' }),
  common({ id: 'deep-mag', name: 'Deep Magazine', icon: '▤', description: '+25% magazine capacity per rank.', maxLevel: 3, accent: '#f2d479' }),
  common({ id: 'executioner', name: 'Executioner', icon: '†', description: 'Deal 20% more damage to bosses.', maxLevel: 3, accent: '#ef718e' }),
  common({ id: 'afterimage', name: 'Afterimage', icon: '≈', description: 'Gain 5% chance to evade damage.', maxLevel: 3, accent: '#91a0ff' }),
  common({ id: 'relentless', name: 'Relentless', icon: '⌁', description: 'Fire faster as your magazine empties.', maxLevel: 3, accent: '#ffac72' }),
  common({ id: 'scavenger', name: 'Scavenger', icon: '✧', description: 'Collected soul shards grant 15% more XP.', maxLevel: 3, accent: '#b6a5ff' }),
  common({ id: 'iron-heart', name: 'Iron Heart', icon: '⬟', description: '+15 maximum health and heal 15.', maxLevel: 3, accent: '#d58b72' }),
  common({ id: 'kinetic-shell', name: 'Kinetic Shell', icon: '◉', description: 'Damage immunity lasts longer after a hit.', maxLevel: 3, accent: '#7ed5ca' }),
  common({ id: 'ghost-rounds', name: 'Ghost Rounds', icon: '◌', description: 'Shots travel farther and gain pierce at rank two.', maxLevel: 2, accent: '#a9c9d8' }),

  signature('vesper', { id: 'deadeye-rhythm', name: 'Deadeye Rhythm', icon: 'Ⅵ', description: 'Critical-shot cadence triggers one shot sooner.', maxLevel: 2, accent: '#f2d479' }),
  signature('vesper', { id: 'golden-bullet', name: 'Golden Bullet', icon: '✹', description: 'Critical hits deal 35% more damage.', maxLevel: 2, accent: '#ffd86b' }),
  signature('vesper', { id: 'ricochet-oath', name: 'Ricochet Oath', icon: '↝', description: 'Every shot gains an additional chain.', maxLevel: 2, accent: '#f4e2a2' }),
  signature('vesper', { id: 'stillness', name: 'Perfect Stillness', icon: '⊙', description: 'Moving less sharpens damage and critical chance.', maxLevel: 2, accent: '#fff0bd' }),
  signature('cinder', { id: 'white-flame', name: 'White Flame', icon: '♨', description: 'Burn ticks deal 45% more damage.', maxLevel: 3, accent: '#ff9b65' }),
  signature('cinder', { id: 'flashpoint', name: 'Flashpoint', icon: '✺', description: 'Burning deaths explode harder and farther.', maxLevel: 2, accent: '#ff5f45' }),
  signature('cinder', { id: 'ash-step', name: 'Ash Step', icon: '»', description: 'Move faster while burning enemies are nearby.', maxLevel: 2, accent: '#f8875f' }),
  signature('cinder', { id: 'phoenix-round', name: 'Phoenix Round', icon: '♢', description: 'Every twentieth burning kill restores health.', maxLevel: 2, accent: '#ffc078' }),
  signature('bastion', { id: 'aegis-lattice', name: 'Aegis Lattice', icon: '⬡', description: 'Bulwark aura grows stronger and wider.', maxLevel: 3, accent: '#74d8c2' }),
  signature('bastion', { id: 'retaliation', name: 'Retaliation', icon: '↶', description: 'Taking damage releases a ring of oath shards.', maxLevel: 2, accent: '#8de7d5' }),
  signature('bastion', { id: 'unyielding', name: 'Unyielding', icon: '▰', description: '+30 maximum health and longer bleedout.', maxLevel: 2, accent: '#a6eee0' }),
  signature('bastion', { id: 'shielded-mag', name: 'Shielded Magazine', icon: '▣', description: 'Reloading grants stronger damage resistance.', maxLevel: 2, accent: '#5fc8b4' }),
  signature('warden', { id: 'merciful-hand', name: 'Merciful Hand', icon: '✚', description: 'Revive allies another 35% faster.', maxLevel: 3, accent: '#b6a5ff' }),
  signature('warden', { id: 'lantern-grace', name: 'Lantern Grace', icon: '♧', description: 'Your passive regeneration grows stronger.', maxLevel: 3, accent: '#d0c6ff' }),
  signature('warden', { id: 'last-rite', name: 'Last Rite', icon: '☥', description: 'Allies return with more health and brief haste.', maxLevel: 2, accent: '#c9b9ff' }),
  signature('warden', { id: 'soulward', name: 'Soulward', icon: '◈', description: 'Your first fatal blow instead leaves you at one health.', maxLevel: 1, accent: '#e4dcff' }),
  signature('nyx', { id: 'shadow-step', name: 'Shadow Step', icon: '☾', description: 'Veilstep evade chance rises by 7%.', maxLevel: 3, accent: '#7f8cff' }),
  signature('nyx', { id: 'twin-fangs', name: 'Twin Fangs', icon: '⌁', description: 'Add a mirrored projectile with reduced damage.', maxLevel: 2, accent: '#9aa5ff' }),
  signature('nyx', { id: 'veilshot', name: 'Veilshot', icon: '⇢', description: 'Shots pierce and deal more damage.', maxLevel: 2, accent: '#6f7ce7' }),
  signature('nyx', { id: 'night-harvest', name: 'Night Harvest', icon: '✦', description: 'Every tenth kill restores health and grants haste.', maxLevel: 2, accent: '#a5acff' }),
  signature('tempest', { id: 'stormchain', name: 'Stormchain', icon: 'ϟ', description: 'Lightning chains to one additional target.', maxLevel: 3, accent: '#65bfff' }),
  signature('tempest', { id: 'thunderhead', name: 'Thunderhead', icon: '☁', description: 'Chain strikes retain more damage.', maxLevel: 3, accent: '#8dd4ff' }),
  signature('tempest', { id: 'charged-mag', name: 'Charged Magazine', icon: '▤', description: 'Fire faster and gain magazine capacity.', maxLevel: 2, accent: '#4aaeff' }),
  signature('tempest', { id: 'ball-lightning', name: 'Ball Lightning', icon: '◉', description: 'Chained targets are heavily slowed.', maxLevel: 2, accent: '#a5e2ff' }),
  signature('briar', { id: 'bloodbloom', name: 'Bloodbloom', icon: '❧', description: 'Kills restore substantially more health.', maxLevel: 3, accent: '#e45d82' }),
  signature('briar', { id: 'thorn-crown', name: 'Thorn Crown', icon: '♛', description: 'Return damage to enemies that strike you.', maxLevel: 3, accent: '#f07a98' }),
  signature('briar', { id: 'rose-thorns', name: 'Rose Thorns', icon: '⇥', description: 'Shots gain pierce and projectile size.', maxLevel: 2, accent: '#d84a72' }),
  signature('briar', { id: 'red-harvest', name: 'Red Harvest', icon: '✽', description: 'Soul shards are worth more and heal slightly.', maxLevel: 2, accent: '#ff91aa' }),
  signature('seraph', { id: 'sunlance', name: 'Sunlance', icon: '☼', description: 'Shots fly faster and deal radiant bonus damage.', maxLevel: 3, accent: '#ffd783' }),
  signature('seraph', { id: 'radiant-volley', name: 'Radiant Volley', icon: '✣', description: 'Add a radiant projectile to every volley.', maxLevel: 2, accent: '#ffe6a8' }),
  signature('seraph', { id: 'dawn-armor', name: 'Dawn Armor', icon: '♢', description: 'Reduce incoming damage and recover after hits.', maxLevel: 3, accent: '#f1c865' }),
  signature('seraph', { id: 'halo-crit', name: 'Halo of Judgment', icon: '✺', description: 'Gain critical chance and critical damage.', maxLevel: 2, accent: '#fff0bd' }),
]

export const BOSS_TYPES = new Set<EnemyType>(['tollkeeper', 'broodmother', 'graveknight', 'eclipse-eye'])
export const BOSS_NAMES: Record<BossType, string> = { tollkeeper: 'THE TOLLKEEPER', broodmother: 'THE BROODMOTHER', graveknight: 'THE GRAVEKNIGHT', 'eclipse-eye': 'THE ECLIPSE EYE' }
export const TEAM_BUFFS: TeamBuffDefinition[] = [
  { id: 'quicksilver-bell', name: 'Quicksilver Bell', icon: '♢', description: 'The squad fires and reloads 12% faster.', accent: '#e6b96b', boss: 'tollkeeper' },
  { id: 'brood-vigor', name: 'Brood Vigor', icon: '♥', description: 'Every hunter gains 25 maximum health and heals.', accent: '#ef718e', boss: 'broodmother' },
  { id: 'grave-edge', name: 'Grave Edge', icon: '†', description: 'The squad deals 15% more weapon damage.', accent: '#77d4a6', boss: 'graveknight' },
  { id: 'eclipse-stride', name: 'Eclipse Stride', icon: '◐', description: 'The squad moves faster and pulls shards farther.', accent: '#aa86ff', boss: 'eclipse-eye' },
]

export const characterById = (id: CharacterId) => CHARACTERS.find((item) => item.id === id) ?? CHARACTERS[0]
export const weaponById = (id: WeaponId) => WEAPONS.find((item) => item.id === id) ?? WEAPONS[0]
export const upgradeById = (id: string) => UPGRADES.find((item) => item.id === id) ?? UPGRADES[0]
export const teamBuffByBoss = (boss: BossType) => TEAM_BUFFS.find((item) => item.boss === boss) ?? TEAM_BUFFS[0]
export const teamBuffById = (id: string) => TEAM_BUFFS.find((item) => item.id === id) ?? TEAM_BUFFS[0]
export const isBoss = (type: EnemyType): type is BossType => BOSS_TYPES.has(type)
export const PLAYER_COLORS = ['#f2d479', '#ff735c', '#74d8c2', '#b6a5ff', '#7f8cff', '#65bfff', '#e45d82', '#ffd783']
