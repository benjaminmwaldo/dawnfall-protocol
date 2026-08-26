import type { BossType, CharacterId, EnemyType, TeamBuffDefinition, UpgradeDefinition, WeaponId } from './types'

export interface CharacterDefinition {
  id: CharacterId
  name: string
  epithet: string
  glyph: string
  color: string
  description: string
  startingHearts: number
  baseAbility: string
  activeAbility: string
  activeCooldown: number
  awakening: string
  origin: string
  build: string
  visualIdentity: string
  lore: string
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
  life: number
  radius: number
  color?: string
  blastRadius?: number
  blastDamage?: number
  homing?: number
  slowDuration?: number
  alwaysBurn?: boolean
  infiniteAmmo?: boolean
  melee?: boolean
}

export const CHARACTERS: CharacterDefinition[] = [
  { id: 'vesper', name: 'Vesper', epithet: 'The Deadeye', glyph: '✦', color: '#f2d479', description: 'Measured shots, brutal payoffs.', startingHearts: 5, baseAbility: 'Sixth Sense — every sixth shot is a critical hit.', activeAbility: 'Deadeye Focus — instantly marks and executes the nearest threats.', activeCooldown: 11, awakening: 'Perfect Rhythm — every fourth shot crits and pierces.', origin: 'English · 29', build: 'Tall, long-legged, slim-curvy', visualIdentity: 'Silver braid, severe gray eyes, long black field coat, articulated black-and-brass prosthetic right glove.', lore: 'A former Crown surveyor who mapped the first Black Signal exclusion zones and survived the team sent to silence her.' },
  { id: 'cinder', name: 'Scarlet', epithet: 'The Ashborn', glyph: '◆', color: '#ff735c', description: 'Turns packed hordes into kindling.', startingHearts: 5, baseAbility: 'Kindling — weapon hits ignite enemies.', activeAbility: 'Firebrand — release an igniting ring of flame.', activeCooldown: 10, awakening: 'Flashover — burning enemies explode on death.', origin: 'Irish-American · 26', build: 'Compact, athletic, freckled', visualIdentity: 'Copper curls, broad grin, soot-black armor, red scarf cut from an old protest banner.', lore: 'A city organizer before the Collapse, Scarlet now runs medicine through curfew lines and burns the regime’s corpse-factories.' },
  { id: 'bastion', name: 'Bastion', epithet: 'The Oathbound', glyph: '⬡', color: '#74d8c2', description: 'A knight who makes danger break around her.', startingHearts: 6, baseAbility: 'Bulwark — starts with a sixth heart; nearby allies take 18% less damage.', activeAbility: 'Aegis Pulse — protect nearby allies and crush the surrounding horde.', activeCooldown: 14, awakening: 'Hold the Line — the aura doubles in range and strength.', origin: 'Ghanaian-British · 34', build: 'Powerful, broad-shouldered', visualIdentity: 'Deep brown skin, high braided crown, teal riot plate rebuilt with hand-etched gold vows.', lore: 'Once a civil-defense captain, she turned her precinct into a sanctuary when the provisional government ordered the infected districts sealed.' },
  { id: 'warden', name: 'Aiko', epithet: 'The Last Light', glyph: '✚', color: '#b6a5ff', description: 'Carries survivors home when the sirens stop.', startingHearts: 5, baseAbility: 'Second Wind — revive allies 50% faster.', activeAbility: 'Mending Light — restore one heart to the squad.', activeCooldown: 16, awakening: 'Grace — living hunters slowly regenerate health.', origin: 'Japanese · 29', build: 'Petite, compact, softly athletic', visualIdentity: 'Heart-shaped Japanese face, subtle monolid eyes, a beauty mark under one eye, uneven chin-length black bob, repaired indigo shrine coat and signal lantern.', lore: 'Aiko was an emergency physician in Yokohama’s last vertical shelter. She crossed the dead rail to find the patients the evacuation authority abandoned.' },
  { id: 'nyx', name: 'Nyx', epithet: 'The Veilblade', glyph: '☾', color: '#7f8cff', description: 'Slips between blows and cuts through crowded lanes.', startingHearts: 5, baseAbility: 'Veilstep — 16% chance to evade incoming damage.', activeAbility: 'Nightstep — blink through danger and become briefly untouchable.', activeCooldown: 9, awakening: 'Night Without End — evades become 28% and grant haste.', origin: 'Greek · 24', build: 'Short, wiry, sharp', visualIdentity: 'Olive skin, hooked nose, cropped black curls, indigo hood and scavenged ceramic plates.', lore: 'A rooftop courier from the drowned Athens arcology, she stole a route-key that proves the night gates are being opened from inside.' },
  { id: 'tempest', name: 'Tempest', epithet: 'The Stormheart', glyph: 'ϟ', color: '#65bfff', description: 'Makes every target the start of a lightning storm.', startingHearts: 5, baseAbility: 'Conduction — every projectile chains once.', activeAbility: 'Cloudbreak — call lightning onto the nearest enemy pack.', activeCooldown: 10, awakening: 'Supercell — chains travel farther and strike harder.', origin: 'Nigerian · 27', build: 'Long-legged, muscular', visualIdentity: 'Dark skin, electric white microbraids, cobalt engineer harness, exposed copper induction coils.', lore: 'She kept Lagos Sector Nine powered after the grid became a weapon. The coils on her back still carry stolen storm-reactor charge.' },
  { id: 'briar', name: 'Briar', epithet: 'The Bloodrose', glyph: '❧', color: '#e45d82', description: 'Feeds on the horde and punishes anything that closes.', startingHearts: 5, baseAbility: 'Bloodbloom — kills restore a sliver of health.', activeAbility: 'Rosewake — erupt thorns around you and drink their damage.', activeCooldown: 12, awakening: 'Red Spring — healing doubles and excess becomes armor.', origin: 'French · 31', build: 'Softly curvy, grounded', visualIdentity: 'Auburn waves, long face, green eyes, living rose lattice growing through black reclamation armor.', lore: 'A botanist from the Lyon seed vault, Briar grafted the plague-resistant bloodrose into herself when the vault guards began burning the samples.' },
  { id: 'seraph', name: 'Seraph', epithet: 'The Dawnwing', glyph: '☼', color: '#ffd783', description: 'Radiant rounds reward fearless, precise play.', startingHearts: 5, baseAbility: 'Sunfire — faster shots and +8% critical chance.', activeAbility: 'Daybreak — fire a radiant twelve-ray sunburst.', activeCooldown: 10, awakening: 'First Light — critical hits deal greater damage and pierce.', origin: 'Italian · 30', build: 'Classical, medium, poised', visualIdentity: 'Honey-blonde curls, aquiline profile, ivory flight mantle, solar mirrors and weathered gold trim.', lore: 'The last pilot out of Vatican Air Command, she turned her mirror-wing against the commanders who chose which cities deserved sunrise.' },
  { id: 'rapunsel', name: 'Rapsy', epithet: 'The Living Braid', glyph: '⌇', color: '#c99365', description: 'A sweet-tempered hunter whose impossible braid has a mind of its own.', startingHearts: 5, baseAbility: 'Long Reach — hair slashes strike every enemy around her.', activeAbility: 'Tress Tempest — whip her hair through a full-circle slash.', activeCooldown: 8, awakening: 'Unbound — every hair slash echoes a second time.', origin: 'English · 25', build: 'Very petite, fine-boned', visualIdentity: 'Freckled gray-green eyes, narrow oval face, flat-chested frame, impossible chestnut hair and moss-gold hunter coat.', lore: 'Raised in a sealed biocontainment manor, Rapsy escaped when the living filament in her hair woke and tore the quarantine doors apart.' },
  { id: 'eira', name: 'Eira', epithet: 'The Frostline', glyph: '❄', color: '#a7dcff', description: 'Turns open ground into a killing winter.', startingHearts: 5, baseAbility: 'Cold Front — every weapon hit briefly slows its target.', activeAbility: 'Whiteout — flash-freeze a wide cone of enemies.', activeCooldown: 11, awakening: 'Zero Hour — frozen targets shatter into damaging ice.', origin: 'Icelandic · 31', build: 'Very tall, rangy, endurance-athletic', visualIdentity: 'Long angular face, wind-weathered fair skin, pale gray eyes, healed crooked nose, ash-blonde side braid and slate polar survey coat.', lore: 'Eira guarded Svalbard’s climate archive until the reactors were stripped for the capital. She carries its last stable cold core.' },
  { id: 'mara', name: 'Mara', epithet: 'The Echo Thief', glyph: 'Ⅱ', color: '#e3a2ff', description: 'Steals moments from the night and fires them twice.', startingHearts: 5, baseAbility: 'Afterimage Round — every seventh trigger repeats itself.', activeAbility: 'Second Take — replay a violent echo through nearby enemies.', activeCooldown: 12, awakening: 'Double Exposure — every fourth trigger repeats.', origin: 'Romanian · 27', build: 'Short, curvy, strong-legged', visualIdentity: 'Warm olive skin, square jaw, heavy dark curls, magenta time-rig, cropped salvage jacket and layered utility skirt.', lore: 'A Bucharest archive burglar, Mara found footage recorded tomorrow. The machine that made it now ticks inside her ribs.' },
  { id: 'zahra', name: 'Zahra', epithet: 'The Event Horizon', glyph: '◉', color: '#e8b66f', description: 'Bends whole packs into one fatal point.', startingHearts: 5, baseAbility: 'Redshift — shots deal more damage to exposed boss weak points.', activeAbility: 'Singularity — drag nearby horrors inward and crush them.', activeCooldown: 13, awakening: 'Black Sun — Singularity doubles its reach and collapse damage.', origin: 'Lebanese · 34', build: 'Tall, wiry, narrow-shouldered', visualIdentity: 'Long diamond-shaped face, tawny skin, amber eyes, strong brows, rounded straight nose, high black curl-tail and bronze gravitic instruments.', lore: 'Zahra maintained Beirut’s orbital elevator counterweights. When the skyhook fell, she learned to make gravity answer to human hands.' },
]

export const WEAPONS: WeaponDefinition[] = [
  { id: 'revolver', name: 'Oathkeeper', glyph: '⌁', description: 'Six precise shots. High damage and clean criticals.', damage: 30, fireRate: 3.1, projectiles: 1, magazine: 6, reload: 1.05, speed: 650, spread: 0.025, pierce: 0, chain: 0, life: 1.25, radius: 4.5 },
  { id: 'scattergun', name: 'Gravesong', glyph: '≋', description: 'Five short-range shells carve a wide killing fan.', damage: 12, fireRate: 1.25, projectiles: 5, magazine: 4, reload: 1.3, speed: 530, spread: 0.5, pierce: 0, chain: 0, life: 0.58, radius: 4.2 },
  { id: 'arc-rifle', name: 'Blue Ruin', glyph: 'ϟ', description: 'Rapid storm rounds leap into a second target.', damage: 15, fireRate: 5.4, projectiles: 1, magazine: 16, reload: 1.55, speed: 600, spread: 0.045, pierce: 0, chain: 1, life: 1.25, radius: 4.5, color: '#65bfff' },
  { id: 'burst-carbine', name: 'Threefold', glyph: 'Ⅲ', description: 'Each trigger launches a tight three-round burst.', damage: 11, fireRate: 2.65, projectiles: 3, magazine: 8, reload: 1.25, speed: 610, spread: 0.12, pierce: 0, chain: 0, life: 1.15, radius: 4, color: '#f1d9a2' },
  { id: 'railgun', name: 'Last Verdict', glyph: '━', description: 'A colossal rune rail punches through six bodies.', damage: 95, fireRate: 0.65, projectiles: 1, magazine: 3, reload: 1.8, speed: 900, spread: 0.004, pierce: 5, chain: 0, life: 1.45, radius: 7.2, color: '#fff0bd' },
  { id: 'grenade-launcher', name: 'Starfall', glyph: '✺', description: 'Heavy shells erupt across a wide impact circle.', damage: 38, fireRate: 0.85, projectiles: 1, magazine: 5, reload: 1.7, speed: 360, spread: 0.025, pierce: 0, chain: 0, life: 1.25, radius: 9, blastRadius: 120, blastDamage: 34, color: '#e8b85f' },
  { id: 'flamethrower', name: 'Cinderhose', glyph: '♨', description: 'A short inferno floods close lanes and always ignites.', damage: 5, fireRate: 9, projectiles: 2, magazine: 50, reload: 1.9, speed: 330, spread: 0.28, pierce: 0, chain: 0, life: 0.32, radius: 6, alwaysBurn: true, color: '#ff735c' },
  { id: 'frost-cannon', name: 'Wintermute', glyph: '❄', description: 'Massive crystal rounds pierce and freeze the horde.', damage: 45, fireRate: 1.05, projectiles: 1, magazine: 6, reload: 1.6, speed: 310, spread: 0.012, pierce: 2, chain: 0, life: 1.8, radius: 12, slowDuration: 4, color: '#9bdcff' },
  { id: 'seeker', name: 'Nightjar', glyph: '⌁', description: 'Paired spectral missiles bend toward living targets.', damage: 24, fireRate: 2, projectiles: 2, magazine: 8, reload: 1.65, speed: 420, spread: 0.16, pierce: 0, chain: 0, life: 2, radius: 6.5, homing: 3.8, color: '#9c82ff' },
  { id: 'sword', name: 'Dawncleaver', glyph: '†', description: 'An endless close-range sweep that cuts through packed enemies.', damage: 18, fireRate: 1.8, projectiles: 3, magazine: 1, reload: 0, speed: 340, spread: 0.85, pierce: 1, chain: 0, life: 0.26, radius: 10, color: '#fff0bd', infiniteAmmo: true, melee: true },
]

const common = (definition: Omit<UpgradeDefinition, 'category' | 'character' | 'weapon'>): UpgradeDefinition => ({ ...definition, category: 'common' })
const signature = (character: CharacterId, definition: Omit<UpgradeDefinition, 'category' | 'character' | 'weapon'>): UpgradeDefinition => ({ ...definition, category: 'signature', character })
const armament = (weapon: WeaponId, definition: Omit<UpgradeDefinition, 'category' | 'character' | 'weapon'>): UpgradeDefinition => ({ ...definition, category: 'weapon', weapon })

export const UPGRADES: UpgradeDefinition[] = [
  common({ id: 'quick-hands', name: 'Quick Hands', icon: '↻', description: 'Reloads complete 42% faster.', maxLevel: 1, accent: '#f2d479' }),
  common({ id: 'double-tap', name: 'Double Tap', icon: 'Ⅱ', description: '+1 projectile to every volley; each deals 12% less damage.', maxLevel: 1, accent: '#e5b06d' }),
  common({ id: 'static-link', name: 'Static Link', icon: 'ϟ', description: 'Every hit arcs into two additional enemies.', maxLevel: 1, accent: '#74c8ff' }),
  common({ id: 'combustion', name: 'Combustion', icon: '◆', description: 'Hits ignite for light damage; burning kills release a modest eruption.', maxLevel: 1, accent: '#ff735c' }),
  common({ id: 'fleetfoot', name: 'Fleetfoot', icon: '»', description: 'Move 25% faster.', maxLevel: 1, accent: '#74d8c2' }),
  common({ id: 'vitality', name: 'Titan Blood', icon: '♥', description: '+1 maximum heart and immediately refill it.', maxLevel: 1, accent: '#e8879c' }),
  common({ id: 'soul-magnet', name: 'Soul Vortex', icon: '◎', description: 'Vacuum soul shards from 125% farther away.', maxLevel: 1, accent: '#b6a5ff' }),
  common({ id: 'barrage', name: 'Barrage', icon: '≡', description: 'Fire 32% faster.', maxLevel: 1, accent: '#f0f4e8' }),
  common({ id: 'heavy-caliber', name: 'Siege Caliber', icon: '●', description: '+45% weapon damage and +25% projectile size.', maxLevel: 1, accent: '#d7a56d' }),
  common({ id: 'sanctuary', name: 'Sanctuary', icon: '✚', description: 'Restore 10% of a heart per second while near an ally.', maxLevel: 1, accent: '#86e8bb' }),
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

  armament('revolver', { id: 'last-chamber', name: 'Last Chamber', icon: '✹', description: 'The final round in each cylinder is a guaranteed critical and pierces two more enemies.', maxLevel: 1, accent: '#f2d479' }),
  armament('revolver', { id: 'fan-the-hammer', name: 'Fan the Hammer', icon: '»', description: 'Oathkeeper fires 70% faster.', maxLevel: 1, accent: '#e9ba68' }),
  armament('scattergun', { id: 'sawed-off-crown', name: 'Sawed-Off Crown', icon: '≋', description: 'Gravesong adds three shells and carves a wider fan.', maxLevel: 1, accent: '#d8b98a' }),
  armament('scattergun', { id: 'funeral-load', name: 'Funeral Load', icon: 'Ⅳ', description: 'Every fourth Gravesong blast deals 80% more damage.', maxLevel: 1, accent: '#c9a678' }),
  armament('arc-rifle', { id: 'storm-capacitor', name: 'Storm Capacitor', icon: 'ϟ', description: 'Blue Ruin chains into three additional enemies.', maxLevel: 1, accent: '#65bfff' }),
  armament('arc-rifle', { id: 'feedback-loop', name: 'Feedback Loop', icon: '↝', description: 'Blue Ruin chain strikes retain 25% more of the original hit.', maxLevel: 1, accent: '#8ed7ff' }),
  armament('burst-carbine', { id: 'fourfold-doctrine', name: 'Fourfold Doctrine', icon: 'Ⅳ', description: 'Threefold adds a fourth round to every burst.', maxLevel: 1, accent: '#f1d9a2' }),
  armament('burst-carbine', { id: 'burst-discipline', name: 'Burst Discipline', icon: '⊙', description: 'Threefold gains 35% damage and a dramatically tighter spread.', maxLevel: 1, accent: '#e6c994' }),
  armament('railgun', { id: 'final-judgment', name: 'Final Judgment', icon: '⇥', description: 'Last Verdict gains 80% damage and pierces two more bodies.', maxLevel: 1, accent: '#fff0bd' }),
  armament('railgun', { id: 'echo-rail', name: 'Echo Rail', icon: 'Ⅱ', description: 'Last Verdict fires a second parallel rail; each rail deals 28% less damage.', maxLevel: 1, accent: '#f2d479' }),
  armament('grenade-launcher', { id: 'cluster-heaven', name: 'Cluster Heaven', icon: '✺', description: 'Starfall explosions grow by 70 radius.', maxLevel: 1, accent: '#e8b85f' }),
  armament('grenade-launcher', { id: 'black-powder-sun', name: 'Black-Powder Sun', icon: '☀', description: 'Starfall explosion damage increases by 90%.', maxLevel: 1, accent: '#ffbd5d' }),
  armament('flamethrower', { id: 'napalm-scripture', name: 'Napalm Scripture', icon: '♨', description: 'Cinderhose burns last twice as long.', maxLevel: 1, accent: '#ff735c' }),
  armament('flamethrower', { id: 'three-headed-flame', name: 'Three-Headed Flame', icon: '≡', description: 'Cinderhose gains a third stream and floods a wider lane.', maxLevel: 1, accent: '#ff9564' }),
  armament('frost-cannon', { id: 'absolute-zero', name: 'Absolute Zero', icon: '❄', description: 'Wintermute freezes for six seconds and pierces two more enemies.', maxLevel: 1, accent: '#9bdcff' }),
  armament('frost-cannon', { id: 'shatter-core', name: 'Shatter Core', icon: '◆', description: 'Wintermute crystals gain 65% damage and 50% size.', maxLevel: 1, accent: '#c3ecff' }),
  armament('seeker', { id: 'murder-of-nightjars', name: 'Murder of Nightjars', icon: '✣', description: 'Nightjar launches two additional homing missiles.', maxLevel: 1, accent: '#9c82ff' }),
  armament('seeker', { id: 'apex-guidance', name: 'Apex Guidance', icon: '◎', description: 'Nightjar missiles turn harder, fly longer, and deal 35% more damage.', maxLevel: 1, accent: '#b09aff' }),
  armament('sword', { id: 'whirling-dawn', name: 'Whirling Dawn', icon: '☼', description: 'Dawncleaver becomes a nine-slash full-circle whirlwind.', maxLevel: 1, accent: '#fff0bd' }),
  armament('sword', { id: 'blood-edge', name: 'Blood Edge', icon: '♥', description: 'Dawncleaver kills restore only 0.25% of maximum health.', maxLevel: 1, accent: '#ef718e' }),

  signature('vesper', { id: 'deadeye-rhythm', name: 'Deadeye Rhythm', icon: 'Ⅳ', description: 'Every fourth trigger pull is a guaranteed critical hit.', maxLevel: 1, accent: '#f2d479' }),
  signature('vesper', { id: 'golden-bullet', name: 'Golden Bullet', icon: '✹', description: 'Critical hits deal 75% more damage.', maxLevel: 1, accent: '#ffd86b' }),
  signature('vesper', { id: 'ricochet-oath', name: 'Ricochet Oath', icon: '↝', description: 'Every shot ricochets into two additional targets.', maxLevel: 1, accent: '#f4e2a2' }),
  signature('vesper', { id: 'stillness', name: 'Perfect Stillness', icon: '⊙', description: 'While still, gain +40% damage and +18% critical chance.', maxLevel: 1, accent: '#fff0bd' }),
  signature('vesper', { id: 'gravewing', name: 'Gravewing', icon: '♜', description: 'Summon a clockwork raven that hunts priority targets.', maxLevel: 1, accent: '#f2d479' }),
  signature('cinder', { id: 'white-flame', name: 'White Flame', icon: '♨', description: 'Burn ticks deal more than double damage.', maxLevel: 1, accent: '#ff9b65' }),
  signature('cinder', { id: 'flashpoint', name: 'Flashpoint', icon: '✺', description: 'Burning deaths detonate across a massive radius.', maxLevel: 1, accent: '#ff5f45' }),
  signature('cinder', { id: 'ash-step', name: 'Ash Step', icon: '»', description: 'Burning enemies nearby grant +35% movement and fire rate.', maxLevel: 1, accent: '#f8875f' }),
  signature('cinder', { id: 'phoenix-round', name: 'Phoenix Round', icon: '♢', description: 'Every twelfth kill restores one heart and releases a fire nova.', maxLevel: 1, accent: '#ffc078' }),
  signature('cinder', { id: 'ashkit', name: 'Ashkit', icon: '♞', description: 'Summon an ember fox whose bites ignite whole packs.', maxLevel: 1, accent: '#ff735c' }),
  signature('bastion', { id: 'aegis-lattice', name: 'Aegis Lattice', icon: '⬡', description: 'Bulwark gains +100 range and 12% more protection.', maxLevel: 1, accent: '#74d8c2' }),
  signature('bastion', { id: 'retaliation', name: 'Retaliation', icon: '↶', description: 'Taking damage blasts every nearby enemy for 55.', maxLevel: 1, accent: '#8de7d5' }),
  signature('bastion', { id: 'unyielding', name: 'Unyielding', icon: '▰', description: '+2 maximum hearts and eight extra bleedout seconds.', maxLevel: 1, accent: '#a6eee0' }),
  signature('bastion', { id: 'shielded-mag', name: 'Shielded Magazine', icon: '▣', description: 'Take 35% less damage while reloading.', maxLevel: 1, accent: '#5fc8b4' }),
  signature('bastion', { id: 'aegis-hound', name: 'Aegis Hound', icon: '♟', description: 'Summon an armored hound that bowls through enemy lines.', maxLevel: 1, accent: '#74d8c2' }),
  signature('warden', { id: 'merciful-hand', name: 'Merciful Hand', icon: '✚', description: 'Revive allies twice as fast.', maxLevel: 1, accent: '#b6a5ff' }),
  signature('warden', { id: 'lantern-grace', name: 'Lantern Grace', icon: '♧', description: 'Awakened Grace restores an extra 8% of a heart per second.', maxLevel: 1, accent: '#d0c6ff' }),
  signature('warden', { id: 'last-rite', name: 'Last Rite', icon: '☥', description: 'Revived allies return at full health with six seconds of haste.', maxLevel: 1, accent: '#c9b9ff' }),
  signature('warden', { id: 'soulward', name: 'Soulward', icon: '◈', description: 'Your first fatal blow instead leaves you at one health.', maxLevel: 1, accent: '#e4dcff' }),
  signature('warden', { id: 'mercy-moth', name: 'Mercy Moth', icon: '🦋', description: 'Summon a lantern moth that heals you while firing soulbolts.', maxLevel: 1, accent: '#c9b9ff' }),
  signature('nyx', { id: 'shadow-step', name: 'Shadow Step', icon: '☾', description: 'Veilstep gains another 14% evade chance.', maxLevel: 1, accent: '#7f8cff' }),
  signature('nyx', { id: 'twin-fangs', name: 'Twin Fangs', icon: '⌁', description: 'Add a mirrored projectile with only 8% reduced damage.', maxLevel: 1, accent: '#9aa5ff' }),
  signature('nyx', { id: 'veilshot', name: 'Veilshot', icon: '⇢', description: 'Shots gain +30% damage and pierce two more enemies.', maxLevel: 1, accent: '#6f7ce7' }),
  signature('nyx', { id: 'night-harvest', name: 'Night Harvest', icon: '✦', description: 'Every eighth kill restores 60% of a heart and grants five seconds of haste.', maxLevel: 1, accent: '#a5acff' }),
  signature('nyx', { id: 'shadecat', name: 'Shadecat', icon: '♤', description: 'Summon a spectral cat that phases through crowded lanes.', maxLevel: 1, accent: '#7f8cff' }),
  signature('tempest', { id: 'stormchain', name: 'Stormchain', icon: 'ϟ', description: 'Lightning reaches two additional targets.', maxLevel: 1, accent: '#65bfff' }),
  signature('tempest', { id: 'thunderhead', name: 'Thunderhead', icon: '☁', description: 'Chain strikes retain 80% of the original hit.', maxLevel: 1, accent: '#8dd4ff' }),
  signature('tempest', { id: 'charged-mag', name: 'Charged Magazine', icon: '▤', description: '+35% fire rate and +40% magazine capacity.', maxLevel: 1, accent: '#4aaeff' }),
  signature('tempest', { id: 'ball-lightning', name: 'Ball Lightning', icon: '◉', description: 'Chained targets are crippled for 2.5 seconds.', maxLevel: 1, accent: '#a5e2ff' }),
  signature('tempest', { id: 'storm-wisp', name: 'Storm Wisp', icon: '☄', description: 'Summon a living storm that arcs through three enemies.', maxLevel: 1, accent: '#65bfff' }),
  signature('briar', { id: 'bloodbloom', name: 'Bloodbloom', icon: '❧', description: 'Every kill restores 0.35% additional maximum health.', maxLevel: 1, accent: '#e45d82' }),
  signature('briar', { id: 'thorn-crown', name: 'Thorn Crown', icon: '♛', description: 'Return 65% of incoming damage to a nearby attacker.', maxLevel: 1, accent: '#f07a98' }),
  signature('briar', { id: 'rose-thorns', name: 'Rose Thorns', icon: '⇥', description: 'Shots gain +35% size and pierce two more enemies.', maxLevel: 1, accent: '#d84a72' }),
  signature('briar', { id: 'red-harvest', name: 'Red Harvest', icon: '✽', description: 'Soul shards grant +35% XP and restore 8% of a heart.', maxLevel: 1, accent: '#ff91aa' }),
  signature('briar', { id: 'thornling', name: 'Thornling', icon: '♣', description: 'Summon a hungry rosebeast whose bites restore your health.', maxLevel: 1, accent: '#e45d82' }),
  signature('seraph', { id: 'sunlance', name: 'Sunlance', icon: '☼', description: 'Shots gain +35% speed and +25% radiant damage.', maxLevel: 1, accent: '#ffd783' }),
  signature('seraph', { id: 'radiant-volley', name: 'Radiant Volley', icon: '✣', description: 'Add a full-damage radiant projectile to every volley.', maxLevel: 1, accent: '#ffe6a8' }),
  signature('seraph', { id: 'dawn-armor', name: 'Dawn Armor', icon: '♢', description: 'Take 20% less damage and restore 6% of a heart per second.', maxLevel: 1, accent: '#f1c865' }),
  signature('seraph', { id: 'halo-crit', name: 'Halo of Judgment', icon: '✺', description: '+18% critical chance and +50% critical damage.', maxLevel: 1, accent: '#fff0bd' }),
  signature('seraph', { id: 'sunbird', name: 'Sunbird', icon: '♨', description: 'Summon a radiant falcon whose lances pierce enemy lines.', maxLevel: 1, accent: '#ffd783' }),
  signature('rapunsel', { id: 'silken-radius', name: 'Silken Radius', icon: '◎', description: 'Tress Tempest reaches 50% farther and deals 35% more damage.', maxLevel: 1, accent: '#d8a777' }),
  signature('rapunsel', { id: 'quick-braid', name: 'Quick Braid', icon: '↻', description: 'Tress Tempest recharges 40% faster.', maxLevel: 1, accent: '#e1b98e' }),
  signature('rapunsel', { id: 'thousand-strands', name: 'Thousand Strands', icon: '≋', description: 'Tress Tempest lashes twice and the echo deals full damage.', maxLevel: 1, accent: '#c99365' }),
  signature('rapunsel', { id: 'silk-guard', name: 'Silk Guard', icon: '◌', description: 'Casting Tress Tempest grants two seconds of invulnerability.', maxLevel: 1, accent: '#efd4b6' }),
  signature('rapunsel', { id: 'braided-heart', name: 'Braided Heart', icon: '♥', description: 'Hair-slash kills restore 10% of one heart each, up to one heart per cast.', maxLevel: 1, accent: '#dca17f' }),
  signature('eira', { id: 'permafrost', name: 'Permafrost', icon: '❄', description: 'Cold Front lasts three times longer.', maxLevel: 1, accent: '#a7dcff' }),
  signature('eira', { id: 'ice-lance', name: 'Ice Lance', icon: '⇥', description: 'Shots against slowed enemies gain +70% damage and two pierce.', maxLevel: 1, accent: '#c8ecff' }),
  signature('eira', { id: 'snowstep', name: 'Snowstep', icon: '»', description: 'Gain 30% movement speed while any nearby enemy is slowed.', maxLevel: 1, accent: '#8fcdf4' }),
  signature('eira', { id: 'shatter-surge', name: 'Shatter Surge', icon: '✦', description: 'Whiteout deals double damage and releases six ice lances.', maxLevel: 1, accent: '#d9f4ff' }),
  signature('eira', { id: 'cold-blooded', name: 'Cold-Blooded', icon: '◇', description: 'Take 30% less damage while surrounded by slowed enemies.', maxLevel: 1, accent: '#83c5e9' }),
  signature('mara', { id: 'echo-chamber', name: 'Echo Chamber', icon: 'Ⅱ', description: 'Repeated trigger volleys retain full damage and gain one projectile.', maxLevel: 1, accent: '#e3a2ff' }),
  signature('mara', { id: 'borrowed-time', name: 'Borrowed Time', icon: '⌛', description: 'Second Take recharges 35% faster.', maxLevel: 1, accent: '#cf91eb' }),
  signature('mara', { id: 'double-exposure', name: 'Double Exposure', icon: '≋', description: 'Second Take strikes twice with a delayed echo.', maxLevel: 1, accent: '#f0bbff' }),
  signature('mara', { id: 'phase-credit', name: 'Phase Credit', icon: '◌', description: 'Casting Second Take grants two seconds of haste and invulnerability.', maxLevel: 1, accent: '#c788e8' }),
  signature('mara', { id: 'stolen-second', name: 'Stolen Second', icon: '↶', description: 'Every repeated volley reduces Second Take cooldown by one second.', maxLevel: 1, accent: '#edaaff' }),
  signature('zahra', { id: 'event-horizon', name: 'Event Horizon', icon: '◎', description: 'Singularity reaches 55% farther and pulls twice as hard.', maxLevel: 1, accent: '#e8b66f' }),
  signature('zahra', { id: 'mass-driver', name: 'Mass Driver', icon: '●', description: 'Shots gain +55% size, +35% damage, and one pierce.', maxLevel: 1, accent: '#f0c987' }),
  signature('zahra', { id: 'lensing', name: 'Gravitic Lensing', icon: '◉', description: 'Exposed weak-point hits deal another 45% damage.', maxLevel: 1, accent: '#dca35c' }),
  signature('zahra', { id: 'red-giant', name: 'Red Giant', icon: '✺', description: 'Singularity collapses in a massive second blast.', maxLevel: 1, accent: '#f1a85f' }),
  signature('zahra', { id: 'orbital-guard', name: 'Orbital Guard', icon: '◌', description: 'Casting Singularity destroys nearby enemy bullets.', maxLevel: 1, accent: '#e5c99d' }),
]

export const BOSS_TYPES = new Set<EnemyType>(['tollkeeper', 'broodmother', 'graveknight', 'eclipse-eye', 'void-hart', 'prism-witch', 'iron-choir', 'star-eater'])
export const BOSS_NAMES: Record<BossType, string> = {
  tollkeeper: 'THE TOLLKEEPER', broodmother: 'THE BROODMOTHER', graveknight: 'THE GRAVEKNIGHT', 'eclipse-eye': 'THE ECLIPSE EYE',
  'void-hart': 'THE VOID HART', 'prism-witch': 'THE PRISM WITCH', 'iron-choir': 'THE IRON CHOIR', 'star-eater': 'THE STAR-EATER',
}
export const TEAM_BUFFS: TeamBuffDefinition[] = [
  { id: 'quicksilver-bell', name: 'Quicksilver Bell', icon: '♢', description: 'The squad fires and reloads 12% faster.', accent: '#e6b96b', boss: 'tollkeeper' },
  { id: 'brood-vigor', name: 'Brood Vigor', icon: '♥', description: 'Every hunter gains one maximum heart and refills it.', accent: '#ef718e', boss: 'broodmother' },
  { id: 'grave-edge', name: 'Grave Edge', icon: '†', description: 'The squad deals 15% more weapon damage.', accent: '#77d4a6', boss: 'graveknight' },
  { id: 'eclipse-stride', name: 'Eclipse Stride', icon: '◐', description: 'The squad moves faster and pulls shards farther.', accent: '#aa86ff', boss: 'eclipse-eye' },
  { id: 'hart-stride', name: 'Hart Stride', icon: '⌁', description: 'The squad moves 8% faster.', accent: '#53e0d2', boss: 'void-hart' },
  { id: 'prism-edge', name: 'Prism Edge', icon: '◇', description: 'The squad deals 10% more weapon damage.', accent: '#ef8dff', boss: 'prism-witch' },
  { id: 'iron-vow', name: 'Iron Vow', icon: '⬡', description: 'The squad takes 8% less damage.', accent: '#d69468', boss: 'iron-choir' },
  { id: 'star-hour', name: 'Star Hour', icon: '✦', description: 'Active abilities recharge 10% faster.', accent: '#9c82ff', boss: 'star-eater' },
]

export const characterById = (id: CharacterId) => CHARACTERS.find((item) => item.id === id) ?? CHARACTERS[0]
export const weaponById = (id: WeaponId) => WEAPONS.find((item) => item.id === id) ?? WEAPONS[0]
export const upgradeById = (id: string) => UPGRADES.find((item) => item.id === id) ?? UPGRADES[0]
export const teamBuffByBoss = (boss: BossType) => TEAM_BUFFS.find((item) => item.boss === boss) ?? TEAM_BUFFS[0]
export const teamBuffById = (id: string) => TEAM_BUFFS.find((item) => item.id === id) ?? TEAM_BUFFS[0]
export const isBoss = (type: EnemyType): type is BossType => BOSS_TYPES.has(type)
export const PLAYER_COLORS = ['#f2d479', '#ff735c', '#74d8c2', '#b6a5ff', '#7f8cff', '#65bfff', '#e45d82', '#ffd783', '#c99365', '#a7dcff', '#e3a2ff', '#e8b66f']
