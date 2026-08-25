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
  { id: 'revolver', name: 'Oathkeeper', glyph: '⌁', description: 'Six precise shots. High damage and clean criticals.', damage: 30, fireRate: 3.1, projectiles: 1, magazine: 6, reload: 1.05, speed: 650, spread: 0.025, pierce: 0, chain: 0 },
  { id: 'scattergun', name: 'Gravesong', glyph: '≋', description: 'A short-range fan that erases crowded lanes.', damage: 12, fireRate: 1.25, projectiles: 5, magazine: 4, reload: 1.3, speed: 530, spread: 0.5, pierce: 0, chain: 0 },
  { id: 'arc-rifle', name: 'Blue Ruin', glyph: 'ϟ', description: 'Fast rounds that arc into a second target.', damage: 15, fireRate: 5.4, projectiles: 1, magazine: 16, reload: 1.55, speed: 600, spread: 0.045, pierce: 0, chain: 1 },
]

const common = (definition: Omit<UpgradeDefinition, 'category' | 'character'>): UpgradeDefinition => ({ ...definition, category: 'common' })
const signature = (character: CharacterId, definition: Omit<UpgradeDefinition, 'category' | 'character'>): UpgradeDefinition => ({ ...definition, category: 'signature', character })

export const UPGRADES: UpgradeDefinition[] = [
  common({ id: 'quick-hands', name: 'Quick Hands', icon: '↻', description: 'Reloads complete 42% faster.', maxLevel: 1, accent: '#f2d479' }),
  common({ id: 'double-tap', name: 'Double Tap', icon: 'Ⅱ', description: '+1 projectile to every volley; each deals 12% less damage.', maxLevel: 1, accent: '#e5b06d' }),
  common({ id: 'static-link', name: 'Static Link', icon: 'ϟ', description: 'Every hit arcs into two additional enemies.', maxLevel: 1, accent: '#74c8ff' }),
  common({ id: 'combustion', name: 'Combustion', icon: '◆', description: 'Hits ignite for heavy damage; burning kills erupt.', maxLevel: 1, accent: '#ff735c' }),
  common({ id: 'fleetfoot', name: 'Fleetfoot', icon: '»', description: 'Move 25% faster.', maxLevel: 1, accent: '#74d8c2' }),
  common({ id: 'vitality', name: 'Titan Blood', icon: '♥', description: '+50 maximum health and immediately heal 50.', maxLevel: 1, accent: '#e8879c' }),
  common({ id: 'soul-magnet', name: 'Soul Vortex', icon: '◎', description: 'Vacuum soul shards from 125% farther away.', maxLevel: 1, accent: '#b6a5ff' }),
  common({ id: 'barrage', name: 'Barrage', icon: '≡', description: 'Fire 32% faster.', maxLevel: 1, accent: '#f0f4e8' }),
  common({ id: 'heavy-caliber', name: 'Siege Caliber', icon: '●', description: '+45% weapon damage and +25% projectile size.', maxLevel: 1, accent: '#d7a56d' }),
  common({ id: 'sanctuary', name: 'Sanctuary', icon: '✚', description: 'Regenerate 2.5 health per second while near an ally.', maxLevel: 1, accent: '#86e8bb' }),
  common({ id: 'overcharge', name: 'Overcharge', icon: '✦', description: '+20% critical-hit chance.', maxLevel: 1, accent: '#f2d479' }),
  common({ id: 'frostbite', name: 'Frostbite', icon: '❄', description: 'Hits cripple enemies to 40% speed for two seconds.', maxLevel: 1, accent: '#a6d9ff' }),
  common({ id: 'longshot', name: 'Longshot', icon: '➶', description: '+35% projectile speed and +18% weapon damage.', maxLevel: 1, accent: '#d9e4c8' }),
  common({ id: 'piercing-rounds', name: 'Ghostpiercer', icon: '⇥', description: 'Every projectile passes through two more enemies.', maxLevel: 1, accent: '#c7b59b' }),
  common({ id: 'hollow-points', name: 'Hollow Points', icon: '◒', description: 'Deal 50% more damage to enemies below 45% health.', maxLevel: 1, accent: '#ef718e' }),
  common({ id: 'steadfast', name: 'Steadfast', icon: '◇', description: 'Take 20% less damage from every source.', maxLevel: 1, accent: '#74d8c2' }),
  common({ id: 'deep-mag', name: 'Bottomless Magazine', icon: '▤', description: '+50% magazine capacity.', maxLevel: 1, accent: '#f2d479' }),
  common({ id: 'executioner', name: 'Executioner', icon: '†', description: 'Deal 60% more damage to bosses.', maxLevel: 1, accent: '#ef718e' }),
  common({ id: 'afterimage', name: 'Afterimage', icon: '≈', description: 'Gain a 12% chance to evade any hit.', maxLevel: 1, accent: '#91a0ff' }),
  common({ id: 'relentless', name: 'Relentless', icon: '⌁', description: 'Fire up to 60% faster as the magazine empties.', maxLevel: 1, accent: '#ffac72' }),
  common({ id: 'scavenger', name: 'Soul Feast', icon: '✧', description: 'Collected soul shards grant 40% more squad XP.', maxLevel: 1, accent: '#b6a5ff' }),
  common({ id: 'iron-heart', name: 'Last Stand', icon: '⬟', description: 'Below half health, gain +35% damage and +20% speed.', maxLevel: 1, accent: '#d58b72' }),
  common({ id: 'kinetic-shell', name: 'Kinetic Shell', icon: '◉', description: 'Extend post-hit immunity from 0.42 to 0.70 seconds.', maxLevel: 1, accent: '#7ed5ca' }),
  common({ id: 'ghost-rounds', name: 'Ghost Rounds', icon: '◌', description: 'Shots last 65% longer and pass through two more enemies.', maxLevel: 1, accent: '#a9c9d8' }),

  signature('vesper', { id: 'deadeye-rhythm', name: 'Deadeye Rhythm', icon: 'Ⅳ', description: 'Every fourth trigger pull is a guaranteed critical hit.', maxLevel: 1, accent: '#f2d479' }),
  signature('vesper', { id: 'golden-bullet', name: 'Golden Bullet', icon: '✹', description: 'Critical hits deal 75% more damage.', maxLevel: 1, accent: '#ffd86b' }),
  signature('vesper', { id: 'ricochet-oath', name: 'Ricochet Oath', icon: '↝', description: 'Every shot ricochets into two additional targets.', maxLevel: 1, accent: '#f4e2a2' }),
  signature('vesper', { id: 'stillness', name: 'Perfect Stillness', icon: '⊙', description: 'While still, gain +40% damage and +18% critical chance.', maxLevel: 1, accent: '#fff0bd' }),
  signature('vesper', { id: 'gravewing', name: 'Gravewing', icon: '♜', description: 'Summon a clockwork raven that hunts priority targets.', maxLevel: 1, accent: '#f2d479' }),
  signature('cinder', { id: 'white-flame', name: 'White Flame', icon: '♨', description: 'Burn ticks deal more than double damage.', maxLevel: 1, accent: '#ff9b65' }),
  signature('cinder', { id: 'flashpoint', name: 'Flashpoint', icon: '✺', description: 'Burning deaths detonate across a massive radius.', maxLevel: 1, accent: '#ff5f45' }),
  signature('cinder', { id: 'ash-step', name: 'Ash Step', icon: '»', description: 'Burning enemies nearby grant +35% movement and fire rate.', maxLevel: 1, accent: '#f8875f' }),
  signature('cinder', { id: 'phoenix-round', name: 'Phoenix Round', icon: '♢', description: 'Every twelfth kill heals 25 and releases a fire nova.', maxLevel: 1, accent: '#ffc078' }),
  signature('cinder', { id: 'ashkit', name: 'Ashkit', icon: '♞', description: 'Summon an ember fox whose bites ignite whole packs.', maxLevel: 1, accent: '#ff735c' }),
  signature('bastion', { id: 'aegis-lattice', name: 'Aegis Lattice', icon: '⬡', description: 'Bulwark gains +100 range and 12% more protection.', maxLevel: 1, accent: '#74d8c2' }),
  signature('bastion', { id: 'retaliation', name: 'Retaliation', icon: '↶', description: 'Taking damage blasts every nearby enemy for 55.', maxLevel: 1, accent: '#8de7d5' }),
  signature('bastion', { id: 'unyielding', name: 'Unyielding', icon: '▰', description: '+60 maximum health and eight extra bleedout seconds.', maxLevel: 1, accent: '#a6eee0' }),
  signature('bastion', { id: 'shielded-mag', name: 'Shielded Magazine', icon: '▣', description: 'Take 35% less damage while reloading.', maxLevel: 1, accent: '#5fc8b4' }),
  signature('bastion', { id: 'aegis-hound', name: 'Aegis Hound', icon: '♟', description: 'Summon an armored hound that bowls through enemy lines.', maxLevel: 1, accent: '#74d8c2' }),
  signature('warden', { id: 'merciful-hand', name: 'Merciful Hand', icon: '✚', description: 'Revive allies twice as fast.', maxLevel: 1, accent: '#b6a5ff' }),
  signature('warden', { id: 'lantern-grace', name: 'Lantern Grace', icon: '♧', description: 'Awakened regeneration increases by two health per second.', maxLevel: 1, accent: '#d0c6ff' }),
  signature('warden', { id: 'last-rite', name: 'Last Rite', icon: '☥', description: 'Revived allies return at full health with six seconds of haste.', maxLevel: 1, accent: '#c9b9ff' }),
  signature('warden', { id: 'soulward', name: 'Soulward', icon: '◈', description: 'Your first fatal blow instead leaves you at one health.', maxLevel: 1, accent: '#e4dcff' }),
  signature('warden', { id: 'mercy-moth', name: 'Mercy Moth', icon: '🦋', description: 'Summon a lantern moth that heals you while firing soulbolts.', maxLevel: 1, accent: '#c9b9ff' }),
  signature('nyx', { id: 'shadow-step', name: 'Shadow Step', icon: '☾', description: 'Veilstep gains another 14% evade chance.', maxLevel: 1, accent: '#7f8cff' }),
  signature('nyx', { id: 'twin-fangs', name: 'Twin Fangs', icon: '⌁', description: 'Add a mirrored projectile with only 8% reduced damage.', maxLevel: 1, accent: '#9aa5ff' }),
  signature('nyx', { id: 'veilshot', name: 'Veilshot', icon: '⇢', description: 'Shots gain +30% damage and pierce two more enemies.', maxLevel: 1, accent: '#6f7ce7' }),
  signature('nyx', { id: 'night-harvest', name: 'Night Harvest', icon: '✦', description: 'Every eighth kill heals 15 and grants five seconds of haste.', maxLevel: 1, accent: '#a5acff' }),
  signature('nyx', { id: 'shadecat', name: 'Shadecat', icon: '♤', description: 'Summon a spectral cat that phases through crowded lanes.', maxLevel: 1, accent: '#7f8cff' }),
  signature('tempest', { id: 'stormchain', name: 'Stormchain', icon: 'ϟ', description: 'Lightning reaches two additional targets.', maxLevel: 1, accent: '#65bfff' }),
  signature('tempest', { id: 'thunderhead', name: 'Thunderhead', icon: '☁', description: 'Chain strikes retain 80% of the original hit.', maxLevel: 1, accent: '#8dd4ff' }),
  signature('tempest', { id: 'charged-mag', name: 'Charged Magazine', icon: '▤', description: '+35% fire rate and +40% magazine capacity.', maxLevel: 1, accent: '#4aaeff' }),
  signature('tempest', { id: 'ball-lightning', name: 'Ball Lightning', icon: '◉', description: 'Chained targets are crippled for 2.5 seconds.', maxLevel: 1, accent: '#a5e2ff' }),
  signature('tempest', { id: 'storm-wisp', name: 'Storm Wisp', icon: '☄', description: 'Summon a living storm that arcs through three enemies.', maxLevel: 1, accent: '#65bfff' }),
  signature('briar', { id: 'bloodbloom', name: 'Bloodbloom', icon: '❧', description: 'Every kill restores 1.8% of maximum health.', maxLevel: 1, accent: '#e45d82' }),
  signature('briar', { id: 'thorn-crown', name: 'Thorn Crown', icon: '♛', description: 'Return 65% of incoming damage to a nearby attacker.', maxLevel: 1, accent: '#f07a98' }),
  signature('briar', { id: 'rose-thorns', name: 'Rose Thorns', icon: '⇥', description: 'Shots gain +35% size and pierce two more enemies.', maxLevel: 1, accent: '#d84a72' }),
  signature('briar', { id: 'red-harvest', name: 'Red Harvest', icon: '✽', description: 'Soul shards grant +35% XP and heal two health.', maxLevel: 1, accent: '#ff91aa' }),
  signature('briar', { id: 'thornling', name: 'Thornling', icon: '♣', description: 'Summon a hungry rosebeast whose bites restore your health.', maxLevel: 1, accent: '#e45d82' }),
  signature('seraph', { id: 'sunlance', name: 'Sunlance', icon: '☼', description: 'Shots gain +35% speed and +25% radiant damage.', maxLevel: 1, accent: '#ffd783' }),
  signature('seraph', { id: 'radiant-volley', name: 'Radiant Volley', icon: '✣', description: 'Add a full-damage radiant projectile to every volley.', maxLevel: 1, accent: '#ffe6a8' }),
  signature('seraph', { id: 'dawn-armor', name: 'Dawn Armor', icon: '♢', description: 'Take 20% less damage and regenerate 1.5 health per second.', maxLevel: 1, accent: '#f1c865' }),
  signature('seraph', { id: 'halo-crit', name: 'Halo of Judgment', icon: '✺', description: '+18% critical chance and +50% critical damage.', maxLevel: 1, accent: '#fff0bd' }),
  signature('seraph', { id: 'sunbird', name: 'Sunbird', icon: '♨', description: 'Summon a radiant falcon whose lances pierce enemy lines.', maxLevel: 1, accent: '#ffd783' }),
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
