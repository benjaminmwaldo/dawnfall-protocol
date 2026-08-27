import { BOSS_NAMES, UPGRADES, characterById, isBoss, teamBuffByBoss, upgradeById, weaponById } from './data'
import { angularDistance, bossWeakPointAngle, bossWeakPointIsOpen } from './boss'
import { difficultyById } from './difficulty'
import { HALF_HEART_VALUE, HEAL_CRYSTAL_SECONDS, HEART_REGEN_SECONDS, HEART_VALUE, quantizeEnemyDamage } from './health'
import { mapById, type MapDefinition } from './maps'
import { SeededRandom } from './random'
import { circleHitsSolidTerrain, pointTouchesThorns, segmentHitsSolidTerrain } from './terrain'
import type {
  BossType,
  CompanionKind,
  EnemyState,
  EnemyType,
  GameEvent,
  GameSnapshot,
  InputState,
  MapId,
  MapWall,
  PickupState,
  PlayerConfig,
  PlayerState,
  ProjectileState,
  StructureState,
  DifficultyId,
} from './types'

const EMPTY_INPUT: InputState = { up: false, down: false, left: false, right: false, firing: false, interact: false, special: false, aim: 0 }
const DRAFT_INPUT_DELAY = 0.5
const SPAWN_PADDING = 110
const TAU = Math.PI * 2
const HIT_INVULNERABILITY = 0.42
const KINETIC_SHELL_BONUS = 0.28
export const PLAYER_COLLISION_RADIUS = 17
const THORN_DAMAGE_COOLDOWN = 0.9
const THORN_MOVE_MULTIPLIER = 0.68
const BOSS_SCHEDULE: Array<{ at: number; type: BossType }> = [
  { at: 0.12, type: 'void-hart' },
  { at: 0.24, type: 'tollkeeper' },
  { at: 0.36, type: 'prism-witch' },
  { at: 0.48, type: 'broodmother' },
  { at: 0.60, type: 'iron-choir' },
  { at: 0.71, type: 'graveknight' },
  { at: 0.81, type: 'star-eater' },
]
const FINAL_ENCOUNTER_AT = 0.88
const FINAL_TRIO: BossType[] = ['broodmother', 'graveknight', 'eclipse-eye']
const FINAL_BOSS_HEALTH_MULTIPLIER = 1.75
const FINAL_BOSS_CADENCE = 0.78

const distanceSquared = (ax: number, ay: number, bx: number, by: number) => {
  const dx = ax - bx
  const dy = ay - by
  return dx * dx + dy * dy
}
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
const rank = (player: PlayerState | undefined, id: string) => player?.perks[id] ?? 0
const xpRequiredForLevel = (level: number, partySize: number) => Math.floor(
  115 * Math.pow(1.32, Math.max(0, level - 1)) * (1 + Math.max(0, partySize - 1) * 0.45),
)
const PET_UPGRADES: Partial<Record<string, CompanionKind>> = {
  gravewing: 'gravewing', ashkit: 'ashkit', 'aegis-hound': 'aegis-hound', 'mercy-moth': 'mercy-moth',
  shadecat: 'shadecat', 'storm-wisp': 'storm-wisp', thornling: 'thornling', sunbird: 'sunbird',
}
const MULTIPLAYER_ONLY_UPGRADES = new Set(['sanctuary', 'merciful-hand', 'last-rite'])
const COMPANION_ATTACKS: Record<CompanionKind, { cooldown: number; damage: number; speed: number; range: number; pierce: number; chain: number; burn: boolean; color: string }> = {
  gravewing: { cooldown: 1.05, damage: 90, speed: 665, range: 470, pierce: 0, chain: 1, burn: false, color: '#f2d479' },
  ashkit: { cooldown: 0.72, damage: 42, speed: 560, range: 350, pierce: 0, chain: 1, burn: true, color: '#ff735c' },
  'aegis-hound': { cooldown: 1.2, damage: 58, speed: 445, range: 310, pierce: 3, chain: 0, burn: false, color: '#74d8c2' },
  'mercy-moth': { cooldown: 1.35, damage: 30, speed: 510, range: 370, pierce: 0, chain: 1, burn: false, color: '#c9b9ff' },
  shadecat: { cooldown: 0.58, damage: 72, speed: 780, range: 300, pierce: 2, chain: 0, burn: false, color: '#7f8cff' },
  'storm-wisp': { cooldown: 0.95, damage: 44, speed: 580, range: 420, pierce: 0, chain: 3, burn: false, color: '#65bfff' },
  thornling: { cooldown: 0.82, damage: 52, speed: 475, range: 320, pierce: 1, chain: 0, burn: false, color: '#e45d82' },
  sunbird: { cooldown: 0.78, damage: 66, speed: 730, range: 440, pierce: 3, chain: 0, burn: false, color: '#ffd783' },
}

export class GameEngine {
  readonly snapshot: GameSnapshot
  private readonly random: SeededRandom
  private entityId = 1
  private eventId = 1
  private spawnTimer = 0.25
  private nextBossIndex = 0
  private finalEncounterStarted = false
  private readonly projectileHits = new Map<number, Set<number>>()
  private readonly map: MapDefinition

  constructor(configs: PlayerConfig[], duration: number, seed = Date.now(), mapId: MapId = 'gloamreach', difficulty: DifficultyId = 'standard') {
    this.random = new SeededRandom(seed)
    this.map = mapById(mapId)
    this.snapshot = {
      seed,
      mapId: this.map.id,
      difficulty,
      phase: 'playing',
      timeRemaining: duration,
      duration,
      players: configs.map((config, index) => this.createPlayer(config, index, configs.length)),
      companions: [],
      enemies: [],
      projectiles: [],
      pickups: [],
      structures: this.createStructures(),
      teamBuffs: {},
      events: [],
    }
  }

  step(dt: number, inputs: ReadonlyMap<string, InputState>): GameSnapshot {
    const delta = clamp(dt, 0, 0.05)
    this.snapshot.events = this.snapshot.events.slice(-22)

    if (this.snapshot.phase === 'upgrade') {
      if (this.snapshot.upgrade) {
        this.snapshot.upgrade.acceptsInputIn = Math.max(0, this.snapshot.upgrade.acceptsInputIn - delta)
        this.snapshot.upgrade.expiresIn -= delta
        if (this.snapshot.upgrade.expiresIn <= 0) {
          const pending = this.snapshot.upgrade.offers.filter((offer) => !offer.selectedId)
          for (const offer of pending) this.chooseUpgrade(offer.ids[0], offer.chooserId)
        }
      }
      return this.snapshot
    }
    if (this.snapshot.phase !== 'playing') return this.snapshot

    this.snapshot.timeRemaining -= delta
    if (this.completeVictoryIfReady()) return this.snapshot

    this.updatePlayers(delta, inputs)
    this.resolveUnrevivablePlayers()
    this.updateCompanions(delta)
    this.updateStructures(delta)
    this.handleSpawns(delta, inputs)
    this.updateEnemies(delta, inputs)
    this.updateProjectiles(delta)
    if (this.completeVictoryIfReady()) return this.snapshot
    this.updatePickups(delta)
    this.handleRevives(delta, inputs)
    this.checkLevelUp()

    if (this.snapshot.players.every((player) => player.eliminated)) {
      this.snapshot.phase = 'defeat'
      this.pushEvent('lose', undefined, undefined, 'THE NIGHT CLAIMED EVERY HUNTER.')
    }
    return this.snapshot
  }

  private completeVictoryIfReady(): boolean {
    const finalBossAlive = this.snapshot.enemies.some((enemy) => enemy.finale && enemy.health > 0)
    if (this.snapshot.timeRemaining > 0 || !this.finalEncounterStarted || finalBossAlive) return false
    this.snapshot.phase = 'victory'
    this.pushEvent('win', undefined, undefined, 'DAWN BROKE. THE DAWNLESS TRIUMVIRATE FELL.')
    return true
  }

  chooseUpgrade(upgradeId: string, chooserId: string): boolean {
    const draft = this.snapshot.upgrade
    const offer = draft?.offers.find((entry) => entry.chooserId === chooserId)
    const player = this.snapshot.players.find((entry) => entry.id === chooserId)
    if (!draft || draft.acceptsInputIn > 0 || !offer || offer.selectedId || !player || this.snapshot.phase !== 'upgrade' || !offer.ids.includes(upgradeId)) return false
    const definition = upgradeById(upgradeId)
    if (definition.character && definition.character !== player.character) return false
    if (definition.weapon && definition.weapon !== player.weapon) return false

    const current = rank(player, upgradeId)
    if (current >= definition.maxLevel) return false
    player.perks[upgradeId] = current + 1
    if (upgradeId === 'vitality') this.addMaximumHealth(player, HEART_VALUE)
    if (upgradeId === 'unyielding') this.addMaximumHealth(player, HEART_VALUE * 2)
    if (upgradeId === 'deep-mag') this.addMagazine(player, 0.5)
    if (upgradeId === 'charged-mag') this.addMagazine(player, 0.4)
    const companionKind = PET_UPGRADES[upgradeId]
    if (companionKind) this.summonCompanion(player, companionKind)

    offer.selectedId = upgradeId
    this.pushEvent('level', player.x, player.y, `${player.name.toUpperCase()} LOCKED ${definition.name.toUpperCase()}`)

    if (draft.offers.every((entry) => entry.selectedId)) {
      const requirement = this.snapshot.players[0]?.xpToNext ?? xpRequiredForLevel(draft.level, this.snapshot.players.length)
      const nextLevel = draft.level + 1
      const nextRequirement = xpRequiredForLevel(nextLevel, this.snapshot.players.length)
      for (const squadmate of this.snapshot.players) {
        squadmate.xp = Math.max(0, squadmate.xp - requirement)
        squadmate.level = nextLevel
        squadmate.xpToNext = nextRequirement
      }
      this.snapshot.upgrade = undefined
      this.snapshot.phase = 'playing'
      this.pushEvent('level', undefined, undefined, `SQUAD LEVEL ${nextLevel} · EVERY BUILD ADVANCED`)
    }
    return true
  }

  rerollUpgrade(chooserId: string): boolean {
    const draft = this.snapshot.upgrade
    const offer = draft?.offers.find((entry) => entry.chooserId === chooserId)
    const player = this.snapshot.players.find((entry) => entry.id === chooserId)
    if (!draft || draft.acceptsInputIn > 0 || !offer || offer.selectedId || !player || offer.rerollsLeft <= 0 || this.snapshot.phase !== 'upgrade') return false
    const nextChoices = this.createUpgradeChoices(player, new Set(offer.ids))
    if (nextChoices.length !== 3) return false
    offer.ids = nextChoices
    offer.rerollsLeft -= 1
    draft.expiresIn = Math.max(draft.expiresIn, 6)
    this.pushEvent('level', player.x, player.y, `${player.name.toUpperCase()} REROLLED · ${offer.rerollsLeft} LEFT`)
    return true
  }

  private createPlayer(config: PlayerConfig, index: number, partySize: number): PlayerState {
    const weapon = weaponById(config.weapon)
    const maxHealth = HEART_VALUE * characterById(config.character).startingHearts
    const angle = (Math.PI * 2 * index) / Math.max(1, 4)
    return {
      ...config,
      x: Math.cos(angle) * 34,
      y: Math.sin(angle) * 34,
      vx: 0,
      vy: 0,
      aim: 0,
      health: maxHealth,
      maxHealth,
      heartRegen: 0,
      isolatedFor: 0,
      ammo: weapon.magazine,
      maxAmmo: weapon.magazine,
      reloadRemaining: 0,
      reloadDuration: weapon.reload,
      fireCooldown: 0,
      specialCooldown: 0,
      specialPulse: 0,
      specialHeld: false,
      invulnerable: 0,
      hazardCooldown: 0,
      hazardExposure: 0,
      downed: false,
      eliminated: false,
      downTimer: partySize > 1 ? 24 : 0,
      reviveProgress: 0,
      shotCount: 0,
      kills: 0,
      damageDealt: 0,
      awakened: false,
      soulwardUsed: false,
      hasteRemaining: 0,
      level: 1,
      xp: 0,
      xpToNext: xpRequiredForLevel(1, partySize),
      perks: {},
    }
  }

  private createStructures(): StructureState[] {
    return this.map.structures.map((structure) => ({
      ...structure,
      id: this.entityId++,
      cooldown: structure.effect === 'turret' ? 0.8 : 0,
      crystalCharge: 0,
      crystalReady: false,
    }))
  }

  private updatePlayers(dt: number, inputs: ReadonlyMap<string, InputState>) {
    for (const player of this.snapshot.players) {
      player.invulnerable = Math.max(0, player.invulnerable - dt)
      player.hazardCooldown = Math.max(0, player.hazardCooldown - dt)
      player.fireCooldown = Math.max(0, player.fireCooldown - dt)
      player.specialCooldown = Math.max(0, player.specialCooldown - dt)
      player.specialPulse = Math.max(0, player.specialPulse - dt)
      player.hasteRemaining = Math.max(0, player.hasteRemaining - dt)
      if (player.eliminated) continue
      if (player.downed) {
        player.isolatedFor = 0
        player.downTimer = Math.max(0, player.downTimer - dt)
        if (player.downTimer <= 0) {
          player.eliminated = true
          player.reviveProgress = 0
        }
        continue
      }

      player.heartRegen += dt
      if (player.heartRegen >= HEART_REGEN_SECONDS) {
        player.heartRegen %= HEART_REGEN_SECONDS
        if (player.health < player.maxHealth) {
          this.heal(player, HEART_VALUE)
          this.pushEvent('buff', player.x, player.y, `${player.name.toUpperCase()} REGAINED A HEART`)
        }
      }

      const input = inputs.get(player.id) ?? EMPTY_INPUT
      player.aim = Number.isFinite(input.aim) ? input.aim : player.aim
      if (input.special && !player.specialHeld && player.specialCooldown <= 0) this.activateSpecial(player)
      player.specialHeld = input.special
      let moveX = Number.isFinite(input.moveX) ? clamp(input.moveX ?? 0, -1, 1) : Number(input.right) - Number(input.left)
      let moveY = Number.isFinite(input.moveY) ? clamp(input.moveY ?? 0, -1, 1) : Number(input.down) - Number(input.up)
      const magnitude = Math.hypot(moveX, moveY)
      if (magnitude > 1) { moveX /= magnitude; moveY /= magnitude }
      const burningNearby = player.character === 'cinder' && rank(player, 'ash-step') > 0 && this.snapshot.enemies.some((enemy) => enemy.burn > 0 && distanceSquared(player.x, player.y, enemy.x, enemy.y) < 260 * 260)
      const chilledNearby = player.character === 'eira' && rank(player, 'snowstep') > 0 && this.snapshot.enemies.some((enemy) => enemy.slow > 0 && distanceSquared(player.x, player.y, enemy.x, enemy.y) < 250 * 250)
      const lastStand = rank(player, 'iron-heart') > 0 && player.health <= player.maxHealth * 0.5
      const thornPatch = pointTouchesThorns(this.map, player.x, player.y, PLAYER_COLLISION_RADIUS)
      player.hazardExposure = thornPatch ? Math.min(1, player.hazardExposure + dt * 4) : Math.max(0, player.hazardExposure - dt * 6)
      const moveMultiplier = Math.pow(1.25, rank(player, 'fleetfoot'))
        * Math.pow(1.12, this.snapshot.teamBuffs['eclipse-stride'] ?? 0)
        * Math.pow(1.08, this.snapshot.teamBuffs['hart-stride'] ?? 0)
        * (burningNearby ? 1.35 : 1)
        * (chilledNearby ? 1.28 : 1)
        * (lastStand ? 1.2 : 1)
        * (player.hasteRemaining > 0 ? 1.22 : 1)
        * (thornPatch ? THORN_MOVE_MULTIPLIER : 1)
      const speed = 176 * moveMultiplier
      player.vx = moveX * speed
      player.vy = moveY * speed
      this.moveCircle(player, player.vx * dt, player.vy * dt, PLAYER_COLLISION_RADIUS)
      const enteredThorns = pointTouchesThorns(this.map, player.x, player.y, PLAYER_COLLISION_RADIUS)
      if (enteredThorns && player.hazardCooldown <= 0) {
        player.hazardCooldown = THORN_DAMAGE_COOLDOWN
        const healthBeforeBriars = player.health
        this.damagePlayer(player, HALF_HEART_VALUE)
        if (player.health < healthBeforeBriars) this.pushEvent('hurt', enteredThorns.x, enteredThorns.y, 'BLOOD BRIARS · HALF-HEART BLEED')
      }

      const inFormation = this.snapshot.players.length === 1 || this.snapshot.players.some((ally) => ally.id !== player.id
        && !ally.downed && !ally.eliminated && distanceSquared(player.x, player.y, ally.x, ally.y) < 320 * 320)
      const previousIsolation = player.isolatedFor
      player.isolatedFor = inFormation ? Math.max(0, player.isolatedFor - dt * 3) : player.isolatedFor + dt
      if (previousIsolation < 3 && player.isolatedFor >= 3) this.pushEvent('hurt', player.x, player.y, `${player.name.toUpperCase()} IS SEPARATED · THE NIGHT IS HUNTING HER`)

      if (player.reloadRemaining > 0) {
        player.reloadRemaining -= dt
        if (player.reloadRemaining <= 0) {
          player.reloadRemaining = 0
          player.ammo = player.maxAmmo
        }
      } else if (input.firing) {
        this.tryFire(player)
      }

      const nearAlly = this.snapshot.players.some((ally) => ally.id !== player.id && !ally.downed && !ally.eliminated && distanceSquared(player.x, player.y, ally.x, ally.y) < 150 * 150)
      const awakenedWarden = this.snapshot.players.find((ally) => ally.character === 'warden' && ally.awakened && !ally.eliminated)
      const regeneration = (nearAlly ? rank(player, 'sanctuary') * 2.5 : 0)
        + (awakenedWarden ? 0.55 + rank(awakenedWarden, 'lantern-grace') * 2 : 0)
        + (player.character === 'seraph' ? rank(player, 'dawn-armor') * 1.5 : 0)
      if (regeneration > 0) player.health = Math.min(player.maxHealth, player.health + dt * regeneration)
    }
  }

  private activateSpecial(player: PlayerState) {
    const definition = characterById(player.character)
    const cooldownMultiplier = (player.character === 'rapunsel' && rank(player, 'quick-braid') > 0 ? 0.6 : 1)
      * (player.character === 'mara' && rank(player, 'borrowed-time') > 0 ? 0.72 : 1)
      * Math.pow(0.9, this.snapshot.teamBuffs['star-hour'] ?? 0)
    player.specialCooldown = definition.activeCooldown * cooldownMultiplier
    player.specialPulse = player.character === 'rapunsel' ? 0.72 : 0.52
    const livingEnemies = () => this.snapshot.enemies.filter((enemy) => enemy.health > 0)

    if (player.character === 'vesper') {
      const targets = livingEnemies()
        .sort((a, b) => distanceSquared(player.x, player.y, a.x, a.y) - distanceSquared(player.x, player.y, b.x, b.y))
        .slice(0, player.awakened ? 8 : 5)
      for (const target of targets) this.damageEnemy(target, player.awakened ? 150 : 110, player.id)
    }

    if (player.character === 'cinder') {
      for (const enemy of livingEnemies().filter((target) => distanceSquared(player.x, player.y, target.x, target.y) <= 185 * 185)) {
        enemy.burn = Math.max(enemy.burn, 4)
        enemy.burnOwner = player.id
        this.damageEnemy(enemy, 62, player.id)
      }
    }

    if (player.character === 'bastion') {
      for (const enemy of livingEnemies().filter((target) => distanceSquared(player.x, player.y, target.x, target.y) <= 175 * 175)) this.damageEnemy(enemy, 78, player.id)
      for (const ally of this.snapshot.players.filter((target) => !target.downed && !target.eliminated && distanceSquared(player.x, player.y, target.x, target.y) <= 230 * 230)) {
        ally.invulnerable = Math.max(ally.invulnerable, 1.6)
      }
    }

    if (player.character === 'warden') {
      for (const ally of this.snapshot.players.filter((target) => !target.downed && !target.eliminated)) this.heal(ally, HEART_VALUE)
    }

    if (player.character === 'nyx') {
      this.moveCircle(player, Math.cos(player.aim) * 145, Math.sin(player.aim) * 145, PLAYER_COLLISION_RADIUS)
      player.invulnerable = Math.max(player.invulnerable, 2)
      player.hasteRemaining = Math.max(player.hasteRemaining, 2)
    }

    if (player.character === 'tempest') {
      const targets = livingEnemies()
        .sort((a, b) => distanceSquared(player.x, player.y, a.x, a.y) - distanceSquared(player.x, player.y, b.x, b.y))
        .slice(0, player.awakened ? 12 : 8)
      for (const target of targets) {
        target.slow = Math.max(target.slow, 2)
        this.damageEnemy(target, 86, player.id)
      }
    }

    if (player.character === 'briar') {
      const targets = livingEnemies().filter((target) => distanceSquared(player.x, player.y, target.x, target.y) <= 165 * 165)
      for (const target of targets) this.damageEnemy(target, 76, player.id)
      this.heal(player, Math.min(HEART_VALUE, targets.length * 2.5))
    }

    if (player.character === 'seraph') {
      for (let ray = 0; ray < 12; ray += 1) {
        const angle = player.aim + (ray / 12) * Math.PI * 2
        this.snapshot.projectiles.push({
          id: this.entityId++, ownerId: player.id, x: player.x, y: player.y,
          vx: Math.cos(angle) * 560, vy: Math.sin(angle) * 560,
          radius: 6, damage: player.awakened ? 78 : 58, life: 0.8, pierce: player.awakened ? 3 : 1,
          bounces: 0, enemy: false, chain: 0, burn: false, color: '#ffd783',
        })
      }
    }

    if (player.character === 'rapunsel') {
      const radius = 128 * (rank(player, 'silken-radius') > 0 ? 1.5 : 1)
      const damage = 94 * (rank(player, 'silken-radius') > 0 ? 1.35 : 1)
      const echoes = player.awakened || rank(player, 'thousand-strands') > 0 ? 2 : 1
      const before = player.kills
      for (let echo = 0; echo < echoes; echo += 1) {
        for (const enemy of livingEnemies().filter((target) => distanceSquared(player.x, player.y, target.x, target.y) <= radius * radius)) this.damageEnemy(enemy, damage, player.id)
      }
      if (rank(player, 'silk-guard') > 0) player.invulnerable = Math.max(player.invulnerable, 2)
      if (rank(player, 'braided-heart') > 0) this.heal(player, Math.min(HEART_VALUE, Math.max(0, player.kills - before) * HEART_VALUE * 0.1))
    }

    if (player.character === 'eira') {
      const targets = livingEnemies().filter((enemy) => {
        const distance = Math.sqrt(distanceSquared(player.x, player.y, enemy.x, enemy.y))
        const angle = Math.atan2(enemy.y - player.y, enemy.x - player.x)
        return distance <= 330 && angularDistance(angle, player.aim) < 0.8
      })
      const damage = player.awakened || rank(player, 'shatter-surge') > 0 ? 132 : 78
      for (const target of targets) { target.slow = Math.max(target.slow, 5); this.damageEnemy(target, damage, player.id) }
      if (rank(player, 'shatter-surge') > 0) {
        for (let shard = 0; shard < 6; shard += 1) this.spawnHunterProjectile(player, player.aim + (shard - 2.5) * 0.16, 610, 62, '#a9efff', 6, 2)
      }
    }

    if (player.character === 'mara') {
      const targets = livingEnemies().sort((a, b) => distanceSquared(player.x, player.y, a.x, a.y) - distanceSquared(player.x, player.y, b.x, b.y)).slice(0, player.awakened ? 9 : 6)
      const echoes = player.awakened || rank(player, 'double-exposure') > 0 ? 2 : 1
      for (let echo = 0; echo < echoes; echo += 1) for (const target of targets) this.damageEnemy(target, 58, player.id)
      if (rank(player, 'phase-credit') > 0) { player.invulnerable = Math.max(player.invulnerable, 2); player.hasteRemaining = Math.max(player.hasteRemaining, 2) }
    }

    if (player.character === 'zahra') {
      const radius = player.awakened || rank(player, 'event-horizon') > 0 ? 300 : 225
      for (const enemy of livingEnemies().filter((target) => distanceSquared(player.x, player.y, target.x, target.y) <= radius * radius)) {
        const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x)
        const pull = rank(player, 'event-horizon') > 0 ? 110 : 55
        this.moveCircle(enemy, Math.cos(angle) * pull, Math.sin(angle) * pull, enemy.radius)
        this.damageEnemy(enemy, 72, player.id)
        if (rank(player, 'red-giant') > 0 && enemy.health > 0) this.damageEnemy(enemy, 64, player.id)
      }
      if (rank(player, 'orbital-guard') > 0) {
        for (const projectile of this.snapshot.projectiles) if (projectile.enemy && distanceSquared(player.x, player.y, projectile.x, projectile.y) < radius * radius) projectile.life = 0
      }
    }

    this.pushEvent('buff', player.x, player.y, `${player.name.toUpperCase()} · ${definition.activeAbility.split(' — ')[0].toUpperCase()}`)
  }

  private resolveUnrevivablePlayers() {
    const standing = this.snapshot.players.some((player) => !player.downed && !player.eliminated)
    if (standing) return
    for (const player of this.snapshot.players.filter((hunter) => hunter.downed && !hunter.eliminated)) {
      player.downed = false
      player.eliminated = true
      player.downTimer = 0
      player.reviveProgress = 0
    }
  }

  private tryFire(player: PlayerState) {
    const weapon = weaponById(player.weapon)
    if (player.fireCooldown > 0) return
    if (!weapon.infiniteAmmo && player.ammo <= 0) { this.startReload(player); return }

    const ritualBoost = this.snapshot.structures.some((structure) => structure.effect === 'haste' && distanceSquared(player.x, player.y, structure.x, structure.y) < structure.radius * structure.radius)
    const emptyMagazineRatio = weapon.infiniteAmmo ? 0 : 1 - player.ammo / Math.max(1, player.maxAmmo)
    const burningNearby = player.character === 'cinder' && rank(player, 'ash-step') > 0 && this.snapshot.enemies.some((enemy) => enemy.burn > 0 && distanceSquared(player.x, player.y, enemy.x, enemy.y) < 260 * 260)
    const lastChamber = player.weapon === 'revolver' && rank(player, 'last-chamber') > 0 && player.ammo === 1
    const fireRate = weapon.fireRate
      * Math.pow(1.32, rank(player, 'barrage'))
      * (1 + emptyMagazineRatio * rank(player, 'relentless') * 0.6)
      * (1 + rank(player, 'charged-mag') * 0.35)
      * (1 + rank(player, 'fan-the-hammer') * 0.7)
      * Math.pow(1.12, this.snapshot.teamBuffs['quicksilver-bell'] ?? 0)
      * (burningNearby ? 1.35 : 1)
      * (ritualBoost ? 1.25 : 1)
    player.fireCooldown = 1 / fireRate
    if (!weapon.infiniteAmmo) player.ammo -= 1
    player.shotCount += 1

    const bonusProjectiles = rank(player, 'double-tap') + rank(player, 'twin-fangs') + rank(player, 'radiant-volley')
      + rank(player, 'sawed-off-crown') * 3 + rank(player, 'fourfold-doctrine') + rank(player, 'echo-rail')
      + rank(player, 'three-headed-flame') + rank(player, 'murder-of-nightjars') * 2 + rank(player, 'whirling-dawn') * 6
      + rank(player, 'echo-chamber') + rank(player, 'mass-driver')
    const projectileCount = weapon.projectiles + bonusProjectiles
    let totalSpread = weapon.spread + Math.max(0, projectileCount - weapon.projectiles) * 0.075
      + rank(player, 'sawed-off-crown') * 0.2 + rank(player, 'three-headed-flame') * 0.18
    totalSpread *= Math.pow(0.35, rank(player, 'burst-discipline'))
    if (rank(player, 'whirling-dawn') > 0) totalSpread = Math.PI * 2 * (projectileCount - 1) / projectileCount
    for (let index = 0; index < projectileCount; index += 1) {
      const offset = projectileCount === 1 ? 0 : (index / (projectileCount - 1) - 0.5) * totalSpread
      const jitter = weapon.melee ? 0 : this.random.range(-weapon.spread * 0.08, weapon.spread * 0.08)
      const angle = player.aim + offset + jitter
      const cadence = player.character === 'vesper' ? Math.max(2, 6 - rank(player, 'deadeye-rhythm') * 2 - (player.awakened ? 2 : 0)) : 0
      const forcedCritical = lastChamber || (cadence > 0 && player.shotCount % cadence === 0)
      const still = Math.hypot(player.vx, player.vy) < 8
      const criticalChance = 0.06 + rank(player, 'overcharge') * 0.2
        + (player.character === 'seraph' ? 0.08 : 0)
        + rank(player, 'halo-crit') * 0.18
        + (still ? rank(player, 'stillness') * 0.18 : 0)
      const critical = forcedCritical || this.random.next() < criticalChance
      const damagePenalty = Math.pow(0.88, rank(player, 'double-tap')) * Math.pow(0.92, rank(player, 'twin-fangs')) * Math.pow(0.72, rank(player, 'echo-rail'))
      const lastStand = rank(player, 'iron-heart') > 0 && player.health <= player.maxHealth * 0.5
      const funeralLoad = player.weapon === 'scattergun' && rank(player, 'funeral-load') > 0 && player.shotCount % 4 === 0
      const baseDamage = weapon.damage * Math.pow(1.1, this.snapshot.teamBuffs['prism-edge'] ?? 0)
        * Math.pow(1.45, rank(player, 'heavy-caliber'))
        * Math.pow(1.18, rank(player, 'longshot'))
        * Math.pow(1.3, rank(player, 'veilshot'))
        * Math.pow(1.25, rank(player, 'sunlance'))
        * Math.pow(1.35, rank(player, 'burst-discipline'))
        * Math.pow(1.8, rank(player, 'final-judgment'))
        * Math.pow(1.65, rank(player, 'shatter-core'))
        * Math.pow(1.35, rank(player, 'apex-guidance'))
        * Math.pow(1.15, this.snapshot.teamBuffs['grave-edge'] ?? 0)
        * (still ? Math.pow(1.4, rank(player, 'stillness')) : 1)
        * (lastStand ? 1.35 : 1)
        * (funeralLoad ? 1.8 : 1)
        * Math.pow(1.25, rank(player, 'mass-driver'))
        * damagePenalty
      const criticalMultiplier = 2.2
        * Math.pow(1.75, rank(player, 'golden-bullet'))
        * Math.pow(1.5, rank(player, 'halo-crit'))
        * (critical && player.character === 'seraph' && player.awakened ? 1.2 : 1)
      const projectileSpeed = weapon.speed
        * Math.pow(1.35, rank(player, 'longshot'))
        * Math.pow(1.35, rank(player, 'sunlance'))
        * (player.character === 'seraph' ? 1.15 : 1)
      const projectile: ProjectileState = {
        id: this.entityId++,
        ownerId: player.id,
        x: player.x + Math.cos(angle) * 20,
        y: player.y + Math.sin(angle) * 20,
        vx: Math.cos(angle) * projectileSpeed,
        vy: Math.sin(angle) * projectileSpeed,
        radius: weapon.radius * (critical ? 1.47 : 1) * Math.pow(1.25, rank(player, 'heavy-caliber')) * Math.pow(1.35, rank(player, 'rose-thorns')) * Math.pow(1.5, rank(player, 'shatter-core')) * Math.pow(1.25, rank(player, 'mass-driver')),
        damage: baseDamage * (critical ? criticalMultiplier : 1),
        life: weapon.life * Math.pow(1.65, rank(player, 'ghost-rounds')) * Math.pow(1.5, rank(player, 'apex-guidance')),
        pierce: weapon.pierce + rank(player, 'piercing-rounds') * 2 + rank(player, 'veilshot') * 2 + rank(player, 'rose-thorns') * 2
          + rank(player, 'ghost-rounds') * 2
          + rank(player, 'final-judgment') * 2 + rank(player, 'absolute-zero') * 2
          + rank(player, 'ice-lance') + rank(player, 'mass-driver')
          + (lastChamber ? 2 : 0)
          + (forcedCritical && player.awakened ? 1 : 0)
          + (critical && player.character === 'seraph' && player.awakened ? 1 : 0),
        bounces: 0,
        enemy: false,
        chain: weapon.chain + rank(player, 'static-link') * 2 + rank(player, 'ricochet-oath') * 2
          + (player.character === 'tempest' ? 1 : 0) + rank(player, 'stormchain') * 2 + rank(player, 'storm-capacitor') * 3,
        burn: Boolean(weapon.alwaysBurn) || player.character === 'cinder' || rank(player, 'combustion') > 0,
        color: critical ? '#fff2ad' : weapon.color ?? player.color,
        blastRadius: weapon.blastRadius ? weapon.blastRadius + rank(player, 'cluster-heaven') * 70 : undefined,
        blastDamage: weapon.blastDamage ? weapon.blastDamage * (baseDamage / weapon.damage) * (critical ? criticalMultiplier : 1) * Math.pow(1.9, rank(player, 'black-powder-sun')) : undefined,
        homing: weapon.homing ? weapon.homing * Math.pow(1.7, rank(player, 'apex-guidance')) : undefined,
        slowDuration: player.character === 'eira' ? (rank(player, 'permafrost') > 0 ? 4.5 : 1.25) : rank(player, 'absolute-zero') > 0 ? 6 : weapon.slowDuration,
        burnDuration: weapon.alwaysBurn ? 2.5 * Math.pow(2, rank(player, 'napalm-scripture')) : undefined,
        melee: weapon.melee,
      }
      this.snapshot.projectiles.push(projectile)
      this.projectileHits.set(projectile.id, new Set())
      const echoCadence = player.awakened || rank(player, 'stolen-second') > 0 ? 4 : 7
      if (player.character === 'mara' && player.shotCount % echoCadence === 0) {
        const echo: ProjectileState = { ...projectile, id: this.entityId++, damage: projectile.damage * (rank(player, 'echo-chamber') > 0 ? 1 : 0.72), color: '#bfa6ff' }
        this.snapshot.projectiles.push(echo)
        this.projectileHits.set(echo.id, new Set())
        if (rank(player, 'stolen-second') > 0) player.specialCooldown = Math.max(0, player.specialCooldown - 1)
      }
    }
    this.pushEvent('shot', player.x, player.y)
    if (!weapon.infiniteAmmo && player.ammo === 0) this.startReload(player)
  }

  private startReload(player: PlayerState) {
    const weapon = weaponById(player.weapon)
    player.reloadDuration = weapon.reload * Math.pow(0.58, rank(player, 'quick-hands')) * Math.pow(0.88, this.snapshot.teamBuffs['quicksilver-bell'] ?? 0)
    player.reloadRemaining = player.reloadDuration
  }

  private spawnHunterProjectile(player: PlayerState, angle: number, speed: number, damage: number, color: string, radius: number, pierce: number) {
    const projectile: ProjectileState = { id: this.entityId++, ownerId: player.id, x: player.x, y: player.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, radius, damage, life: 0.9, pierce, bounces: 0, enemy: false, chain: 0, burn: false, color, slowDuration: player.character === 'eira' ? 4 : undefined }
    this.snapshot.projectiles.push(projectile)
    this.projectileHits.set(projectile.id, new Set())
  }

  private updateCompanions(dt: number) {
    for (const companion of this.snapshot.companions) {
      const owner = this.snapshot.players.find((player) => player.id === companion.ownerId)
      if (!owner || owner.eliminated) continue
      companion.phase += dt * 1.5
      companion.attackCooldown -= dt
      const orbit = companion.phase + companion.id * 1.37
      const desiredX = owner.x + Math.cos(orbit) * 54
      const desiredY = owner.y + Math.sin(orbit) * 40
      companion.vx = (desiredX - companion.x) * 7
      companion.vy = (desiredY - companion.y) * 7
      this.moveCircle(companion, companion.vx * dt, companion.vy * dt, 8)

      const attack = COMPANION_ATTACKS[companion.kind]
      const target = this.nearestEnemy(companion.x, companion.y, attack.range)
      if (!target) {
        if (Math.hypot(companion.vx, companion.vy) > 1) companion.aim = Math.atan2(companion.vy, companion.vx)
        continue
      }
      companion.aim = Math.atan2(target.y - companion.y, target.x - companion.x)
      if (companion.attackCooldown > 0) continue
      if (companion.kind === 'mercy-moth') this.heal(owner, 3)
      if (companion.kind === 'thornling') this.heal(owner, 0.5)
      const projectile: ProjectileState = {
        id: this.entityId++, ownerId: owner.id, x: companion.x, y: companion.y,
        vx: Math.cos(companion.aim) * attack.speed, vy: Math.sin(companion.aim) * attack.speed,
        radius: companion.kind === 'aegis-hound' || companion.kind === 'sunbird' ? 6.8 : 5.2,
        damage: attack.damage, life: 0.9, pierce: attack.pierce, bounces: 0, enemy: false,
        chain: attack.chain, burn: attack.burn, color: attack.color,
      }
      this.snapshot.projectiles.push(projectile)
      this.projectileHits.set(projectile.id, new Set())
      companion.attackCooldown = attack.cooldown
      this.pushEvent('shot', companion.x, companion.y)
    }
  }

  private updateStructures(dt: number) {
    for (const structure of this.snapshot.structures) {
      if (structure.effect === 'heal') {
        if (!structure.crystalReady) {
          structure.crystalCharge = Math.min(HEAL_CRYSTAL_SECONDS, structure.crystalCharge + dt)
          if (structure.crystalCharge >= HEAL_CRYSTAL_SECONDS) {
            structure.crystalReady = true
            this.pushEvent('buff', structure.x, structure.y, 'A HEART CRYSTAL HAS FORMED')
          }
        }
        if (structure.crystalReady) {
          const recipient = this.snapshot.players
            .filter((player) => !player.downed && !player.eliminated && player.health < player.maxHealth
              && distanceSquared(player.x, player.y, structure.x, structure.y) < structure.radius * structure.radius)
            .sort((first, second) => first.health / first.maxHealth - second.health / second.maxHealth)[0]
          if (recipient) {
            this.heal(recipient, HEART_VALUE)
            structure.crystalReady = false
            structure.crystalCharge = 0
            this.pushEvent('buff', structure.x, structure.y, `${recipient.name.toUpperCase()} CLAIMED A HEART CRYSTAL`)
          }
        }
      }
      if (structure.effect === 'turret') {
        structure.cooldown -= dt
        if (structure.cooldown <= 0) {
          const target = this.nearestEnemy(structure.x, structure.y, 360)
          const owner = this.snapshot.players.find((player) => !player.eliminated)
          if (target && owner && this.hasLineOfSight(structure.x, structure.y, target.x, target.y)) {
            const angle = Math.atan2(target.y - structure.y, target.x - structure.x)
            const projectile: ProjectileState = { id: this.entityId++, ownerId: owner.id, x: structure.x, y: structure.y, vx: Math.cos(angle) * 545, vy: Math.sin(angle) * 545, radius: 5.2, damage: 22, life: 0.9, pierce: 0, bounces: 0, enemy: false, chain: 0, burn: false, color: this.map.accent }
            this.snapshot.projectiles.push(projectile)
            this.projectileHits.set(projectile.id, new Set())
            structure.cooldown = 1.1
          }
        }
      }
    }
  }

  private handleSpawns(dt: number, inputs: ReadonlyMap<string, InputState>) {
    const difficulty = difficultyById(this.snapshot.difficulty)
    const progress = 1 - this.snapshot.timeRemaining / this.snapshot.duration
    if (!this.finalEncounterStarted && progress >= FINAL_ENCOUNTER_AT) {
      this.finalEncounterStarted = true
      this.nextBossIndex = BOSS_SCHEDULE.length
      for (const type of FINAL_TRIO) this.spawnEnemy(type, inputs, true)
      this.pushEvent('boss', undefined, undefined, 'THE DAWNLESS TRIUMVIRATE HAS ENTERED THE HUNT')
    }
    const scheduled = BOSS_SCHEDULE[this.nextBossIndex]
    if (scheduled && progress >= scheduled.at && !this.snapshot.enemies.some((enemy) => isBoss(enemy.type))) {
      this.nextBossIndex += 1
      this.spawnEnemy(scheduled.type, inputs)
      this.pushEvent('boss', undefined, undefined, `${BOSS_NAMES[scheduled.type]} HAS ENTERED THE HUNT`)
    }

    this.spawnTimer -= dt
    if (this.spawnTimer > 0 || this.snapshot.enemies.length >= 230) return
    const multiplayerPressure = Math.max(0, this.snapshot.players.length - 1)
    const playerScale = 0.75 + this.snapshot.players.length * 0.58
    const bossPressure = this.snapshot.enemies.some((enemy) => isBoss(enemy.type)) ? 0.72 : 1
    const count = Math.min(16, Math.max(2, Math.floor((playerScale + progress * 5 + multiplayerPressure * 0.8) * bossPressure * difficulty.spawnDensity)))
    const pool: EnemyType[] = ['thrall', 'thrall']
    if (progress > 0.08) pool.push('skitter', 'leech')
    if (progress > 0.2) pool.push('spitter', 'wraith')
    if (progress > 0.34) pool.push('charger')
    if (progress > 0.48) pool.push('hexer')
    if (progress > 0.62) pool.push('bulwark')
    for (let index = 0; index < count; index += 1) this.spawnEnemy(this.random.pick(pool), inputs)
    this.spawnTimer = Math.max(0.08, 0.62 - progress * 0.45) / (playerScale * difficulty.spawnDensity)
  }

  private findOffscreenSpawn(inputs: ReadonlyMap<string, InputState>): { x: number; y: number } {
    const living = this.snapshot.players.filter((player) => !player.eliminated)
    if (this.map.spawnPoints.length > 0) {
      const isOffscreen = (point: { x: number; y: number }) => living.every((player) => {
        const input = inputs.get(player.id)
        const halfWidth = clamp(input?.viewportWidth ?? 1280, 320, 2560) / 2
        const halfHeight = clamp(input?.viewportHeight ?? 720, 240, 1440) / 2
        return Math.abs(point.x - player.x) > halfWidth + 30 || Math.abs(point.y - player.y) > halfHeight + 30
      })
      const viable = this.map.spawnPoints.filter(isOffscreen)
      const candidates = viable.length > 0 ? viable : [...this.map.spawnPoints].sort((a, b) => {
        const nearestA = Math.min(...living.map((player) => distanceSquared(a.x, a.y, player.x, player.y)))
        const nearestB = Math.min(...living.map((player) => distanceSquared(b.x, b.y, player.x, player.y)))
        return nearestB - nearestA
      }).slice(0, 2)
      const point = this.random.pick(candidates)
      return { x: point.x + this.random.range(-34, 34), y: point.y + this.random.range(-34, 34) }
    }
    const centerX = living.reduce((sum, player) => sum + player.x, 0) / Math.max(1, living.length)
    const centerY = living.reduce((sum, player) => sum + player.y, 0) / Math.max(1, living.length)
    const squadRadius = living.reduce((furthest, player) => Math.max(furthest, Math.hypot(player.x - centerX, player.y - centerY)), 0)
    const largestViewportRadius = living.reduce((largest, player) => {
      const input = inputs.get(player.id)
      const width = clamp(input?.viewportWidth ?? 1280, 320, 2560)
      const height = clamp(input?.viewportHeight ?? 720, 240, 1440)
      return Math.max(largest, Math.hypot(width / 2, height / 2))
    }, Math.hypot(640, 360))
    let fallback = { x: centerX + largestViewportRadius + SPAWN_PADDING, y: centerY }
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const angle = this.random.range(0, Math.PI * 2)
      const range = squadRadius + largestViewportRadius + SPAWN_PADDING + this.random.range(0, 150)
      const candidate = {
        x: clamp(centerX + Math.cos(angle) * range, this.map.bounds.minX + 80, this.map.bounds.maxX - 80),
        y: clamp(centerY + Math.sin(angle) * range, this.map.bounds.minY + 80, this.map.bounds.maxY - 80),
      }
      fallback = candidate
      if (!circleHitsSolidTerrain(this.map, candidate.x, candidate.y, 70)) return candidate
    }
    return fallback
  }

  private spawnEnemy(type: EnemyType, inputs: ReadonlyMap<string, InputState>, finale = false) {
    const difficulty = difficultyById(this.snapshot.difficulty)
    const spawn = this.findOffscreenSpawn(inputs)
    const progress = 1 - this.snapshot.timeRemaining / this.snapshot.duration
    const multiplayerPressure = Math.max(0, this.snapshot.players.length - 1)
    const regularScale = 1 + progress * 1.6 + multiplayerPressure * 0.42
    const bossScale = (0.72 + this.snapshot.players.length * 0.36) * (1 + progress * 0.38)
    const stats: Record<EnemyType, { hp: number; radius: number; speed: number; damage: number }> = {
      thrall: { hp: 34, radius: 13, speed: 58, damage: HALF_HEART_VALUE },
      skitter: { hp: 22, radius: 9, speed: 106, damage: HALF_HEART_VALUE },
      spitter: { hp: 58, radius: 15, speed: 48, damage: HALF_HEART_VALUE },
      bulwark: { hp: 225, radius: 23, speed: 35, damage: HEART_VALUE },
      wraith: { hp: 48, radius: 15, speed: 76, damage: HALF_HEART_VALUE },
      charger: { hp: 88, radius: 17, speed: 70, damage: HEART_VALUE },
      hexer: { hp: 72, radius: 16, speed: 43, damage: HALF_HEART_VALUE },
      leech: { hp: 30, radius: 11, speed: 92, damage: HALF_HEART_VALUE },
      tollkeeper: { hp: 4400, radius: 58, speed: 30, damage: HEART_VALUE },
      broodmother: { hp: 5000, radius: 62, speed: 34, damage: HEART_VALUE },
      graveknight: { hp: 5900, radius: 60, speed: 42, damage: HEART_VALUE + HALF_HEART_VALUE },
      'eclipse-eye': { hp: 6800, radius: 64, speed: 36, damage: HEART_VALUE },
      'void-hart': { hp: 4700, radius: 61, speed: 44, damage: HEART_VALUE + HALF_HEART_VALUE },
      'prism-witch': { hp: 5300, radius: 59, speed: 38, damage: HEART_VALUE },
      'iron-choir': { hp: 6500, radius: 68, speed: 27, damage: HEART_VALUE + HALF_HEART_VALUE },
      'star-eater': { hp: 7200, radius: 66, speed: 34, damage: HEART_VALUE + HALF_HEART_VALUE },
    }
    const base = stats[type]
    const scale = (isBoss(type) ? bossScale * (finale ? FINAL_BOSS_HEALTH_MULTIPLIER : 1) : regularScale) * difficulty.enemyHealth
    this.snapshot.enemies.push({
      id: this.entityId++, type,
      x: spawn.x, y: spawn.y,
      vx: 0, vy: 0, health: base.hp * scale, maxHealth: base.hp * scale, radius: base.radius,
      speed: base.speed * (1 + multiplayerPressure * 0.06) * (finale ? 1.1 : 1) * difficulty.enemySpeed, damage: quantizeEnemyDamage((base.damage + (finale ? HALF_HEART_VALUE : 0)) * difficulty.enemyDamage), attackCooldown: type === 'spitter' || type === 'hexer' ? this.random.range(0.8, 1.15) : this.random.range(0, finale ? 0.18 : 0.45),
      burn: 0, burnTick: 0.5, slow: 0, phase: type === 'charger' ? this.random.range(1, 3.1) : this.random.range(0, Math.PI * 2),
      abilityCooldown: isBoss(type) ? this.random.range(finale ? 0.45 : 1, finale ? 1.1 : 2) : 0,
      summonCooldown: isBoss(type) ? this.random.range(finale ? 1.8 : 3.2, finale ? 3 : 4.8) : 0,
      contactCooldown: 0,
      dashRemaining: 0,
      dashAngle: 0,
      strafeDirection: this.random.next() < 0.5 ? -1 : 1,
      finale,
    })
  }

  private summonBossAdds(types: EnemyType[], inputs: ReadonlyMap<string, InputState>) {
    const reinforcements = [...types]
    for (let playerIndex = 1; playerIndex < this.snapshot.players.length; playerIndex += 1) reinforcements.push(types[(playerIndex - 1) % types.length])
    if (this.snapshot.enemies.length + reinforcements.length >= 230) return
    for (const type of reinforcements) this.spawnEnemy(type, inputs)
  }

  private updateEnemies(dt: number, inputs: ReadonlyMap<string, InputState>) {
    for (const enemy of this.snapshot.enemies) {
      if (enemy.health <= 0) continue
      enemy.attackCooldown = Math.max(0, enemy.attackCooldown - dt)
      enemy.abilityCooldown = Math.max(0, (enemy.abilityCooldown ?? 0) - dt)
      enemy.summonCooldown = Math.max(0, (enemy.summonCooldown ?? 0) - dt)
      enemy.contactCooldown = Math.max(0, (enemy.contactCooldown ?? 0) - dt)
      enemy.dashRemaining = Math.max(0, (enemy.dashRemaining ?? 0) - dt)
      enemy.slow = Math.max(0, enemy.slow - dt)
      enemy.phase += dt
      if (enemy.burn > 0) {
        enemy.burn -= dt
        enemy.burnTick -= dt
        if (enemy.burnTick <= 0) {
          const owner = this.snapshot.players.find((player) => player.id === enemy.burnOwner)
          const burnDamage = (5 + rank(owner, 'combustion') * 4) * Math.pow(2.2, rank(owner, 'white-flame'))
          this.damageEnemy(enemy, burnDamage, enemy.burnOwner)
          enemy.burnTick = 0.5
        }
      }
      if (enemy.health <= 0) continue

      const target = this.nearestLivingPlayer(enemy.x, enemy.y)
      if (!target) continue
      const targetAngle = Math.atan2(target.y - enemy.y, target.x - enemy.x)
      const hasSight = this.hasLineOfSight(enemy.x, enemy.y, target.x, target.y)
      let angle = this.navigationAngle(enemy.x, enemy.y, target.x, target.y, targetAngle)
      const distance = Math.sqrt(distanceSquared(enemy.x, enemy.y, target.x, target.y))
      let speed = enemy.speed * (enemy.slow > 0 ? 0.48 : 1)
      const multiplayerPressure = Math.max(0, this.snapshot.players.length - 1)
      const bossCadence = (enemy.finale ? FINAL_BOSS_CADENCE : 1) * Math.pow(0.92, multiplayerPressure) * difficultyById(this.snapshot.difficulty).bossCadence
      const volleyBonus = multiplayerPressure * 2
      if (enemy.type === 'wraith') angle += Math.sin(enemy.phase * 3) * 0.32
      if (enemy.type === 'charger' && enemy.phase % 4.2 < 0.9) speed *= 2.25
      if (enemy.type === 'leech') speed *= 1.12
      if (target.isolatedFor >= 3 && this.snapshot.players.length > 1) speed *= 1.28

      if ((enemy.type === 'spitter' || enemy.type === 'hexer') && hasSight && distance < (enemy.type === 'hexer' ? 410 : 335)) {
        speed = distance < 220 ? -enemy.speed * 0.5 : 0
        if (enemy.attackCooldown <= 0) {
          this.spawnEnemyProjectile(enemy, targetAngle, enemy.type === 'hexer' ? 140 : 155, enemy.type === 'hexer' ? 9 : 7)
          enemy.attackCooldown = enemy.type === 'hexer' ? 2.45 : 2.05
        }
      }

      if (enemy.type === 'tollkeeper') {
        if (enemy.attackCooldown <= 0 && hasSight && distance < 900) {
          for (let shot = 0; shot < 12 + volleyBonus; shot += 1) this.spawnEnemyProjectile(enemy, shot / (12 + volleyBonus) * Math.PI * 2 + enemy.phase * 0.42, 118, HALF_HEART_VALUE)
          enemy.attackCooldown = 3.3 * bossCadence
        }
        if ((enemy.abilityCooldown ?? 0) <= 0) {
          enemy.dashAngle = angle
          enemy.dashRemaining = 0.62
          enemy.abilityCooldown = 5.1 * bossCadence
          for (let shot = -1; shot <= 1; shot += 1) this.spawnEnemyProjectile(enemy, targetAngle + shot * 0.18, 128, 10)
        }
        if ((enemy.summonCooldown ?? 0) <= 0) {
          this.summonBossAdds(['thrall', 'thrall', 'wraith'], inputs)
          enemy.summonCooldown = 8.2 * bossCadence
        }
      }

      if (enemy.type === 'broodmother') {
        if (hasSight && distance < 260) angle = targetAngle + Math.PI
        if (enemy.attackCooldown <= 0 && hasSight && distance < 940) {
          for (let shot = 0; shot < 10 + volleyBonus; shot += 1) this.spawnEnemyProjectile(enemy, shot / (10 + volleyBonus) * Math.PI * 2 - enemy.phase * 0.5, 108, HALF_HEART_VALUE)
          enemy.attackCooldown = 2.85 * bossCadence
        }
        if ((enemy.abilityCooldown ?? 0) <= 0) {
          enemy.dashAngle = angle + (enemy.strafeDirection ?? 1) * Math.PI / 2
          enemy.dashRemaining = 0.5
          enemy.abilityCooldown = 4.6 * bossCadence
          enemy.strafeDirection = -(enemy.strafeDirection ?? 1)
        }
        if ((enemy.summonCooldown ?? 0) <= 0) {
          this.summonBossAdds(['skitter', 'skitter', 'skitter', 'skitter', 'skitter', 'leech', 'leech'], inputs)
          enemy.summonCooldown = 5.8 * bossCadence
        }
      }

      if (enemy.type === 'graveknight') {
        if (enemy.attackCooldown <= 0 && hasSight && distance < 850) {
          for (let shot = -2 - multiplayerPressure; shot <= 2 + multiplayerPressure; shot += 1) this.spawnEnemyProjectile(enemy, targetAngle + shot * 0.13, 145, HALF_HEART_VALUE)
          enemy.attackCooldown = 2.4 * bossCadence
        }
        if ((enemy.abilityCooldown ?? 0) <= 0) {
          enemy.dashAngle = angle
          enemy.dashRemaining = 0.78
          enemy.abilityCooldown = 4.1 * bossCadence
          for (let shot = -3; shot <= 3; shot += 1) this.spawnEnemyProjectile(enemy, targetAngle + shot * 0.09, 150, 12)
        }
        if ((enemy.summonCooldown ?? 0) <= 0) {
          this.summonBossAdds(['wraith', 'wraith', 'wraith'], inputs)
          enemy.summonCooldown = 8.4 * bossCadence
        }
      }

      if (enemy.type === 'eclipse-eye') {
        if (hasSight) angle = targetAngle + (enemy.strafeDirection ?? 1) * (distance > 520 ? 0.55 : distance < 300 ? 2.2 : 1.35)
        speed *= 1.2
        if (enemy.attackCooldown <= 0 && hasSight && distance < 980) {
          for (let shot = 0; shot < 16 + volleyBonus; shot += 1) this.spawnEnemyProjectile(enemy, shot / (16 + volleyBonus) * Math.PI * 2 + enemy.phase * 0.7, 105, HALF_HEART_VALUE)
          enemy.attackCooldown = 2.35 * bossCadence
        }
        if ((enemy.abilityCooldown ?? 0) <= 0) {
          enemy.dashAngle = angle
          enemy.dashRemaining = 0.58
          enemy.abilityCooldown = 4.2 * bossCadence
          enemy.strafeDirection = -(enemy.strafeDirection ?? 1)
          const aimed = Math.atan2(target.y - enemy.y, target.x - enemy.x)
          for (let shot = -2; shot <= 2; shot += 1) this.spawnEnemyProjectile(enemy, aimed + shot * 0.12, 132, 10)
        }
        if ((enemy.summonCooldown ?? 0) <= 0) {
          this.summonBossAdds(['hexer', 'hexer', 'wraith', 'wraith'], inputs)
          enemy.summonCooldown = 7.2 * bossCadence
        }
      }

      if (enemy.type === 'void-hart') {
        if (enemy.attackCooldown <= 0 && hasSight && distance < 920) {
          for (let shot = 0; shot < 8 + volleyBonus; shot += 1) {
            const heavy = shot % 3 === 0
            this.spawnEnemyProjectile(enemy, shot / (8 + volleyBonus) * TAU + enemy.phase * 0.35, 150, heavy ? HEART_VALUE : HALF_HEART_VALUE, '#48e1d0', heavy ? 10 : 6.5)
          }
          enemy.attackCooldown = 2.7 * bossCadence
        }
        if ((enemy.abilityCooldown ?? 0) <= 0) {
          enemy.dashAngle = targetAngle
          enemy.dashRemaining = 1.15
          enemy.abilityCooldown = 4.8 * bossCadence
          for (let wake = -3; wake <= 3; wake += 1) this.spawnEnemyProjectile(enemy, targetAngle + Math.PI / 2 + wake * 0.16, 92, HEART_VALUE, '#28bbae', 9)
        }
        if ((enemy.summonCooldown ?? 0) <= 0) {
          this.summonBossAdds(['charger', 'charger', 'wraith'], inputs)
          enemy.summonCooldown = 7.4 * bossCadence
        }
      }

      if (enemy.type === 'prism-witch') {
        if (hasSight) angle = targetAngle + (enemy.strafeDirection ?? 1) * 1.35
        const prism = ['#ff5f74', '#ffb454', '#f4e56b', '#6fe0ac', '#69bfff', '#c982ff']
        if (enemy.attackCooldown <= 0 && hasSight && distance < 980) {
          for (let shot = 0; shot < 18 + volleyBonus; shot += 1) {
            const heavy = shot % 6 === 0
            this.spawnEnemyProjectile(enemy, shot / (18 + volleyBonus) * TAU - enemy.phase * 0.62, heavy ? 102 : 132, heavy ? HEART_VALUE + HALF_HEART_VALUE : HALF_HEART_VALUE, prism[shot % prism.length], heavy ? 12 : 6.5)
          }
          enemy.attackCooldown = 2.55 * bossCadence
        }
        if ((enemy.abilityCooldown ?? 0) <= 0) {
          for (let shot = -4; shot <= 4; shot += 1) this.spawnEnemyProjectile(enemy, targetAngle + shot * 0.075, 182, shot === 0 ? HEART_VALUE * 2 : HEART_VALUE, prism[(shot + 10) % prism.length], shot === 0 ? 14 : 8)
          enemy.abilityCooldown = 4.4 * bossCadence
          enemy.strafeDirection = -(enemy.strafeDirection ?? 1)
        }
        if ((enemy.summonCooldown ?? 0) <= 0) {
          this.summonBossAdds(['hexer', 'hexer', 'spitter', 'spitter'], inputs)
          enemy.summonCooldown = 7 * bossCadence
        }
      }

      if (enemy.type === 'iron-choir') {
        speed *= 0.86
        if (enemy.attackCooldown <= 0 && hasSight && distance < 920) {
          for (let shot = 0; shot < 12 + volleyBonus; shot += 1) {
            const heavy = shot % 4 === 0
            this.spawnEnemyProjectile(enemy, shot / (12 + volleyBonus) * TAU + enemy.phase * 0.18, shot % 2 ? 98 : 138, heavy ? HEART_VALUE + HALF_HEART_VALUE : HEART_VALUE, '#d69468', heavy ? 13 : 8)
          }
          enemy.attackCooldown = 3.15 * bossCadence
        }
        if ((enemy.abilityCooldown ?? 0) <= 0) {
          for (let ring = 0; ring < 3; ring += 1) for (let shot = 0; shot < 8; shot += 1) this.spawnEnemyProjectile(enemy, shot / 8 * TAU + ring * 0.17, 82 + ring * 38, HEART_VALUE, ring === 2 ? '#f0c49e' : '#a95f42', 9 + ring * 2)
          enemy.abilityCooldown = 5.3 * bossCadence
        }
        if ((enemy.summonCooldown ?? 0) <= 0) {
          this.summonBossAdds(['bulwark', 'bulwark', 'charger', 'charger', 'hexer'], inputs)
          enemy.summonCooldown = 6.6 * bossCadence
        }
      }

      if (enemy.type === 'star-eater') {
        if (hasSight) angle = targetAngle + (enemy.strafeDirection ?? 1) * (distance > 500 ? 0.75 : 1.65)
        speed *= 1.15
        if (enemy.attackCooldown <= 0 && hasSight && distance < 1050) {
          for (let shot = 0; shot < 20 + volleyBonus; shot += 1) {
            const heavy = shot % 5 === 0
            this.spawnEnemyProjectile(enemy, shot / (20 + volleyBonus) * TAU + Math.sin(enemy.phase) * 0.8, 116, heavy ? HEART_VALUE + HALF_HEART_VALUE : HALF_HEART_VALUE, heavy ? '#f3a1ff' : '#7f5cff', heavy ? 12 : 7)
          }
          enemy.attackCooldown = 2.25 * bossCadence
        }
        if ((enemy.abilityCooldown ?? 0) <= 0) {
          this.spawnBossLaser(enemy, targetAngle, '#b384ff', HEART_VALUE + HALF_HEART_VALUE)
          this.spawnBossLaser(enemy, targetAngle - 0.28, '#694cff', HEART_VALUE)
          this.spawnBossLaser(enemy, targetAngle + 0.28, '#694cff', HEART_VALUE)
          enemy.abilityCooldown = 5.8 * bossCadence
          enemy.strafeDirection = -(enemy.strafeDirection ?? 1)
        }
        if ((enemy.summonCooldown ?? 0) <= 0) {
          this.summonBossAdds(['wraith', 'wraith', 'hexer', 'charger'], inputs)
          enemy.summonCooldown = 7.8 * bossCadence
        }
      }

      if ((enemy.dashRemaining ?? 0) > 0 && isBoss(enemy.type)) {
        angle = enemy.dashAngle ?? angle
        const dashMultiplier = enemy.type === 'void-hart' ? 8.6 : enemy.type === 'graveknight' ? 5.4 : enemy.type === 'tollkeeper' ? 4.8 : enemy.type === 'eclipse-eye' ? 4.3 : 3.6
        speed = enemy.speed * dashMultiplier * (enemy.slow > 0 ? 0.72 : 1)
      }

      enemy.vx = Math.cos(angle) * speed
      enemy.vy = Math.sin(angle) * speed
      this.moveCircle(enemy, enemy.vx * dt, enemy.vy * dt, enemy.radius)
      const canContact = isBoss(enemy.type) ? (enemy.contactCooldown ?? 0) <= 0 : enemy.attackCooldown <= 0
      if (distance < enemy.radius + PLAYER_COLLISION_RADIUS && canContact) {
        this.damagePlayer(target, enemy.damage)
        if (isBoss(enemy.type)) enemy.contactCooldown = 0.72
        else enemy.attackCooldown = 1
      }
    }
    this.snapshot.enemies = this.snapshot.enemies.filter((enemy) => enemy.health > 0)
  }

  private spawnEnemyProjectile(enemy: EnemyState, angle: number, speed: number, damage: number, color = '#ef718e', radius = 6.5, life = 4.5) {
    this.snapshot.projectiles.push({ id: this.entityId++, ownerId: `enemy-${enemy.id}`, x: enemy.x, y: enemy.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, radius, damage: quantizeEnemyDamage(damage * difficultyById(this.snapshot.difficulty).enemyDamage), life, pierce: 0, bounces: 0, enemy: true, chain: 0, burn: false, color })
  }

  private spawnBossLaser(enemy: EnemyState, angle: number, color: string, damage: number) {
    for (let segment = 0; segment < 14; segment += 1) {
      const offset = segment * 34
      this.snapshot.projectiles.push({
        id: this.entityId++, ownerId: `enemy-${enemy.id}`,
        x: enemy.x + Math.cos(angle) * offset, y: enemy.y + Math.sin(angle) * offset,
        vx: Math.cos(angle) * 175, vy: Math.sin(angle) * 175,
        radius: segment % 3 === 0 ? 18 : 15, damage: quantizeEnemyDamage(damage * difficultyById(this.snapshot.difficulty).enemyDamage), life: 1.8,
        pierce: 0, bounces: 0, enemy: true, chain: 0, burn: false, color,
      })
    }
  }

  private updateProjectiles(dt: number) {
    for (const projectile of this.snapshot.projectiles) {
      projectile.life -= dt
      if (!projectile.enemy && (projectile.homing ?? 0) > 0) this.steerHomingProjectile(projectile, dt)
      const nextX = projectile.x + projectile.vx * dt
      const nextY = projectile.y + projectile.vy * dt
      if (this.segmentHitsWorld(projectile.x, projectile.y, nextX, nextY, projectile.radius)) {
        if (!projectile.enemy && (projectile.blastRadius ?? 0) > 0) {
          const hits = this.projectileHits.get(projectile.id) ?? new Set<number>()
          this.detonateProjectile(projectile, projectile.x, projectile.y, hits)
          this.projectileHits.set(projectile.id, hits)
        }
        projectile.life = 0
        this.pushEvent('hit', projectile.x, projectile.y)
        continue
      }
      projectile.x = nextX
      projectile.y = nextY
      if (projectile.life <= 0) {
        if (!projectile.enemy && (projectile.blastRadius ?? 0) > 0) {
          const hits = this.projectileHits.get(projectile.id) ?? new Set<number>()
          this.detonateProjectile(projectile, projectile.x, projectile.y, hits)
          this.projectileHits.set(projectile.id, hits)
        }
        continue
      }
      if (projectile.enemy) {
        for (const player of this.snapshot.players) {
          if (player.downed || player.eliminated) continue
          if (distanceSquared(projectile.x, projectile.y, player.x, player.y) < Math.pow(projectile.radius + PLAYER_COLLISION_RADIUS, 2)) {
            this.damagePlayer(player, projectile.damage)
            projectile.life = 0
            break
          }
        }
        continue
      }

      const hits = this.projectileHits.get(projectile.id) ?? new Set<number>()
      for (const enemy of this.snapshot.enemies) {
        if (enemy.health <= 0 || hits.has(enemy.id)) continue
        if (distanceSquared(projectile.x, projectile.y, enemy.x, enemy.y) > Math.pow(projectile.radius + enemy.radius, 2)) continue
        hits.add(enemy.id)
        const owner = this.snapshot.players.find((player) => player.id === projectile.ownerId)
        let damage = projectile.damage
        if (owner?.character === 'eira' && enemy.slow > 0 && rank(owner, 'ice-lance') > 0) damage *= 1.7
        if (owner && bossWeakPointIsOpen(enemy)) {
          const impactAngle = Math.atan2(projectile.y - enemy.y, projectile.x - enemy.x)
          if (angularDistance(impactAngle, bossWeakPointAngle(enemy)) < 0.62) {
            damage *= difficultyById(this.snapshot.difficulty).weakPointDamage
            if (owner.character === 'zahra') damage *= 1.2 * Math.pow(1.35, rank(owner, 'lensing'))
            this.pushEvent('buff', enemy.x, enemy.y, 'WEAK POINT')
          }
        }
        this.damageEnemy(enemy, damage, projectile.ownerId)
        if (projectile.burn && enemy.health > 0) { enemy.burn = projectile.burnDuration ?? 2.5; enemy.burnOwner = projectile.ownerId }
        const frostRank = rank(owner, 'frostbite')
        enemy.slow = Math.max(enemy.slow, projectile.slowDuration ?? 0, frostRank > 0 ? 2 : 0)
        if (projectile.chain > 0) this.arcDamage(enemy, projectile, hits)
        if ((projectile.blastRadius ?? 0) > 0) {
          this.detonateProjectile(projectile, enemy.x, enemy.y, hits)
          projectile.life = 0
        } else {
          projectile.pierce -= 1
          if (projectile.pierce < 0) projectile.life = 0
        }
        break
      }
      this.projectileHits.set(projectile.id, hits)
    }
    for (const projectile of this.snapshot.projectiles) if (projectile.life <= 0) this.projectileHits.delete(projectile.id)
    this.snapshot.projectiles = this.snapshot.projectiles.filter((projectile) => projectile.life > 0).slice(-560)
    this.snapshot.enemies = this.snapshot.enemies.filter((enemy) => enemy.health > 0)
  }

  private steerHomingProjectile(projectile: ProjectileState, dt: number) {
    const target = this.nearestEnemy(projectile.x, projectile.y, 720)
    if (!target) return
    const speed = Math.hypot(projectile.vx, projectile.vy)
    const current = Math.atan2(projectile.vy, projectile.vx)
    const desired = Math.atan2(target.y - projectile.y, target.x - projectile.x)
    const difference = Math.atan2(Math.sin(desired - current), Math.cos(desired - current))
    const next = current + clamp(difference, -(projectile.homing ?? 0) * dt, (projectile.homing ?? 0) * dt)
    projectile.vx = Math.cos(next) * speed
    projectile.vy = Math.sin(next) * speed
  }

  private detonateProjectile(projectile: ProjectileState, x: number, y: number, alreadyHit: Set<number>) {
    const radius = projectile.blastRadius ?? 0
    const damage = projectile.blastDamage ?? 0
    projectile.blastRadius = 0
    if (radius <= 0 || damage <= 0) return
    this.pushEvent('hit', x, y)
    for (const enemy of [...this.snapshot.enemies]) {
      if (enemy.health <= 0 || alreadyHit.has(enemy.id) || distanceSquared(x, y, enemy.x, enemy.y) > radius * radius) continue
      alreadyHit.add(enemy.id)
      this.damageEnemy(enemy, damage, projectile.ownerId)
      if (projectile.burn && enemy.health > 0) { enemy.burn = projectile.burnDuration ?? 2.5; enemy.burnOwner = projectile.ownerId }
      if ((projectile.slowDuration ?? 0) > 0) enemy.slow = Math.max(enemy.slow, projectile.slowDuration ?? 0)
    }
  }

  private arcDamage(origin: EnemyState, projectile: ProjectileState, alreadyHit: Set<number>) {
    const owner = this.snapshot.players.find((player) => player.id === projectile.ownerId)
    const range = owner?.character === 'tempest' && owner.awakened ? 190 : 150
    const retention = 0.52 + rank(owner, 'thunderhead') * 0.28 + rank(owner, 'feedback-loop') * 0.25 + (owner?.character === 'tempest' && owner.awakened ? 0.1 : 0)
    const candidates = this.snapshot.enemies
      .filter((enemy) => enemy.health > 0 && !alreadyHit.has(enemy.id) && distanceSquared(origin.x, origin.y, enemy.x, enemy.y) < range * range)
      .sort((a, b) => distanceSquared(origin.x, origin.y, a.x, a.y) - distanceSquared(origin.x, origin.y, b.x, b.y))
      .slice(0, projectile.chain)
    for (const target of candidates) {
      alreadyHit.add(target.id)
      this.damageEnemy(target, projectile.damage * retention, projectile.ownerId)
      if (rank(owner, 'ball-lightning') > 0) target.slow = Math.max(target.slow, 2.5)
      this.pushEvent('hit', target.x, target.y)
    }
  }

  private damageEnemy(enemy: EnemyState, amount: number, ownerId?: string) {
    if (enemy.health <= 0) return
    const owner = this.snapshot.players.find((player) => player.id === ownerId)
    let finalAmount = amount
    if (owner && enemy.health / enemy.maxHealth < 0.45) finalAmount *= Math.pow(1.5, rank(owner, 'hollow-points'))
    if (owner && isBoss(enemy.type)) finalAmount *= Math.pow(1.6, rank(owner, 'executioner'))
    enemy.health -= finalAmount
    if (owner) owner.damageDealt += finalAmount
    this.pushEvent('hit', enemy.x, enemy.y)
    if (enemy.health > 0) return

    if (owner) {
      owner.kills += 1
      if (owner.character === 'briar') this.heal(owner, owner.maxHealth * (0.0015 + rank(owner, 'bloodbloom') * 0.0035) * (owner.awakened ? 1.35 : 1))
      if (owner.weapon === 'sword' && rank(owner, 'blood-edge') > 0) this.heal(owner, owner.maxHealth * 0.0025)
      if (owner.character === 'nyx' && rank(owner, 'night-harvest') > 0 && owner.kills % 8 === 0) { this.heal(owner, 15); owner.hasteRemaining = 5 }
      if (owner.character === 'cinder' && rank(owner, 'phoenix-round') > 0 && owner.kills % 12 === 0) {
        this.heal(owner, 25)
        for (const nearby of [...this.snapshot.enemies]) {
          if (nearby.id !== enemy.id && nearby.health > 0 && distanceSquared(enemy.x, enemy.y, nearby.x, nearby.y) < 170 * 170) this.damageEnemy(nearby, 60, owner.id)
        }
      }
    }
    const values: Record<EnemyType, number> = { thrall: 4, skitter: 3, spitter: 6, bulwark: 10, wraith: 6, charger: 8, hexer: 8, leech: 4, tollkeeper: 75, broodmother: 85, graveknight: 95, 'eclipse-eye': 110, 'void-hart': 82, 'prism-witch': 88, 'iron-choir': 102, 'star-eater': 118 }
    const pickup: PickupState = { id: this.entityId++, x: enemy.x, y: enemy.y, value: values[enemy.type] }
    this.snapshot.pickups.push(pickup)

    if (enemy.finale) {
      const remaining = this.snapshot.enemies.filter((candidate) => candidate.finale && candidate.id !== enemy.id && candidate.health > 0).length
      this.pushEvent('boss', enemy.x, enemy.y, remaining > 0 ? `TRIUMVIRATE BROKEN · ${remaining} REMAIN` : 'THE DAWNLESS TRIUMVIRATE IS SHATTERED')
    }
    if (isBoss(enemy.type)) this.rewardBoss(enemy.type)
    const burnOwner = this.snapshot.players.find((player) => player.id === enemy.burnOwner)
    if (burnOwner && (rank(burnOwner, 'combustion') > 0 || (burnOwner.character === 'cinder' && (burnOwner.awakened || rank(burnOwner, 'flashpoint') > 0)))) {
      const flashpoint = burnOwner.character === 'cinder' && rank(burnOwner, 'flashpoint') > 0
      const explosionRange = flashpoint ? 180 : burnOwner.awakened && burnOwner.character === 'cinder' ? 118 : 95
      const explosionDamage = flashpoint ? 75 : burnOwner.awakened && burnOwner.character === 'cinder' ? 42 : rank(burnOwner, 'combustion') > 0 ? 16 : 0
      for (const nearby of [...this.snapshot.enemies]) {
        if (nearby.id !== enemy.id && nearby.health > 0 && distanceSquared(enemy.x, enemy.y, nearby.x, nearby.y) < explosionRange * explosionRange) this.damageEnemy(nearby, explosionDamage, burnOwner.id)
      }
    }
  }

  private damagePlayer(player: PlayerState, amount: number) {
    if (player.invulnerable > 0 || player.downed || player.eliminated) return
    const evadeChance = rank(player, 'afterimage') * 0.12
      + (player.character === 'nyx' ? (player.awakened ? 0.28 : 0.16) + rank(player, 'shadow-step') * 0.14 : 0)
    if (this.random.next() < evadeChance) {
      player.invulnerable = 0.42
      if (player.character === 'nyx' && player.awakened) player.hasteRemaining = 1.8
      this.pushEvent('hit', player.x, player.y)
      return
    }
    const bastion = this.snapshot.players.find((ally) => {
      if (ally.character !== 'bastion' || ally.downed || ally.eliminated) return false
      const range = (ally.awakened ? 300 : 150) + rank(ally, 'aegis-lattice') * 100
      return distanceSquared(player.x, player.y, ally.x, ally.y) < range * range
    })
    const auraReduction = bastion ? (bastion.awakened ? 0.32 : 0.18) + rank(bastion, 'aegis-lattice') * 0.12 : 0
    const coldBlooded = player.character === 'eira' && rank(player, 'cold-blooded') > 0 && this.snapshot.enemies.filter((enemy) => enemy.slow > 0 && distanceSquared(player.x, player.y, enemy.x, enemy.y) < 190 * 190).length >= 3
    const personalReduction = rank(player, 'steadfast') * 0.2 + rank(player, 'dawn-armor') * 0.2 + (this.snapshot.teamBuffs['iron-vow'] ?? 0) * 0.08
      + (player.reloadRemaining > 0 ? rank(player, 'shielded-mag') * 0.35 : 0)
      + (coldBlooded ? 0.3 : 0)
    const separationPenalty = player.isolatedFor >= 3 && this.snapshot.players.length > 1 ? HALF_HEART_VALUE : 0
    const mitigated = quantizeEnemyDamage(amount) * Math.max(0.3, 1 - auraReduction - personalReduction) + separationPenalty
    const finalDamage = Math.max(HALF_HEART_VALUE, Math.floor(mitigated / HALF_HEART_VALUE) * HALF_HEART_VALUE)
    player.health -= finalDamage
    player.invulnerable = HIT_INVULNERABILITY + rank(player, 'kinetic-shell') * KINETIC_SHELL_BONUS
    this.pushEvent('hurt', player.x, player.y)

    if (player.character === 'bastion' && rank(player, 'retaliation') > 0) {
      const targets = this.snapshot.enemies.filter((enemy) => enemy.health > 0 && distanceSquared(player.x, player.y, enemy.x, enemy.y) < 150 * 150).slice(0, 16)
      for (const target of targets) this.damageEnemy(target, 55, player.id)
    }
    if (player.character === 'briar' && rank(player, 'thorn-crown') > 0) {
      const target = this.nearestEnemy(player.x, player.y, 105)
      if (target) this.damageEnemy(target, finalDamage * rank(player, 'thorn-crown') * 0.65, player.id)
    }
    if (player.health > 0) return
    if (player.character === 'warden' && rank(player, 'soulward') > 0 && !player.soulwardUsed) {
      player.soulwardUsed = true
      player.health = 1
      player.invulnerable = 3
      this.pushEvent('revive', player.x, player.y, 'SOULWARD REFUSED THE FINAL BLOW')
      return
    }
    player.health = 0
    const standingAlly = this.snapshot.players.some((ally) => ally.id !== player.id && !ally.downed && !ally.eliminated)
    if (!standingAlly) {
      player.downed = false
      player.eliminated = true
      player.downTimer = 0
      player.reviveProgress = 0
      for (const stranded of this.snapshot.players.filter((ally) => ally.downed && !ally.eliminated)) {
        stranded.downed = false
        stranded.eliminated = true
        stranded.downTimer = 0
        stranded.reviveProgress = 0
      }
      return
    }
    player.downed = true
    player.downTimer = 24 + rank(player, 'unyielding') * 8
    player.reviveProgress = 0
  }

  private updatePickups(dt: number) {
    for (const pickup of this.snapshot.pickups) {
      for (const player of this.snapshot.players) {
        if (player.downed || player.eliminated) continue
        const magnet = 62 * Math.pow(2.25, rank(player, 'soul-magnet')) * Math.pow(1.2, this.snapshot.teamBuffs['eclipse-stride'] ?? 0)
        const distance = Math.sqrt(distanceSquared(pickup.x, pickup.y, player.x, player.y))
        if (distance < magnet * 2.4 && distance > 1) {
          const speed = 110 + (magnet * 2.4 - distance) * 2.2
          pickup.x += (player.x - pickup.x) / distance * speed * dt
          pickup.y += (player.y - pickup.y) / distance * speed * dt
        }
        if (distance < 22) {
          const multiplier = 1 + rank(player, 'scavenger') * 0.4 + rank(player, 'red-harvest') * 0.35
          const sharedXp = Math.max(1, Math.round(pickup.value * multiplier))
          for (const squadmate of this.snapshot.players) squadmate.xp += sharedXp
          if (rank(player, 'red-harvest') > 0) this.heal(player, 0.75)
          pickup.value = 0
          break
        }
      }
    }
    this.snapshot.pickups = this.snapshot.pickups.filter((pickup) => pickup.value > 0).slice(-320)
  }

  private handleRevives(dt: number, inputs: ReadonlyMap<string, InputState>) {
    for (const downed of this.snapshot.players.filter((player) => player.downed && !player.eliminated)) {
      const revivers = this.snapshot.players.filter((player) => {
        const input = inputs.get(player.id) ?? EMPTY_INPUT
        return !player.downed && !player.eliminated && input.interact && distanceSquared(player.x, player.y, downed.x, downed.y) < 68 * 68
      })
      if (revivers.length === 0) { downed.reviveProgress = Math.max(0, downed.reviveProgress - dt * 0.35); continue }
      const primaryReviver = revivers[0]
      const reviveSpeed = revivers.reduce((total, reviver) => total + (reviver.character === 'warden' ? 1.5 : 1) * (rank(reviver, 'merciful-hand') > 0 ? 2 : 1), 0)
      downed.reviveProgress += dt * reviveSpeed
      if (downed.reviveProgress >= 2.2) {
        downed.downed = false
        const lastRite = Math.max(...revivers.map((reviver) => rank(reviver, 'last-rite')))
        downed.health = downed.maxHealth * (lastRite > 0 ? 1 : 0.5)
        downed.downTimer = 24 + rank(downed, 'unyielding') * 8
        downed.reviveProgress = 0
        downed.invulnerable = 2 + lastRite
        downed.hasteRemaining = lastRite > 0 ? 6 : 0
        this.pushEvent('revive', downed.x, downed.y, `${primaryReviver.name.toUpperCase()}${revivers.length > 1 ? ' AND THE SQUAD' : ''} PULLED ${downed.name.toUpperCase()} BACK`)
      }
    }
  }

  private checkLevelUp() {
    if (this.snapshot.phase !== 'playing') return
    const leader = this.snapshot.players[0]
    if (!leader || leader.xp < leader.xpToNext) return
    const offers = this.snapshot.players
      .filter((player) => !player.eliminated)
      .map((player) => ({ chooserId: player.id, ids: this.createUpgradeChoices(player), rerollsLeft: 3 }))
      .filter((offer) => offer.ids.length > 0)
    if (offers.length === 0) return
    this.snapshot.upgrade = { level: leader.level, offers, expiresIn: 20, acceptsInputIn: DRAFT_INPUT_DELAY }
    this.snapshot.phase = 'upgrade'
    this.pushEvent('level', undefined, undefined, `SQUAD LEVEL READY · ${offers.length} BUILDS ARE BRANCHING`)
  }

  private createUpgradeChoices(player: PlayerState, excludedIds: ReadonlySet<string> = new Set()): string[] {
    const swordIncompatible = new Set(['quick-hands', 'deep-mag', 'relentless'])
    const available = (upgrade: (typeof UPGRADES)[number]) => rank(player, upgrade.id) < upgrade.maxLevel
      && !excludedIds.has(upgrade.id)
      && !(player.weapon === 'sword' && swordIncompatible.has(upgrade.id))
      && !(this.snapshot.players.length === 1 && MULTIPLAYER_ONLY_UPGRADES.has(upgrade.id))
    const signaturePool = UPGRADES.filter((upgrade) => upgrade.character === player.character && available(upgrade))
    const weaponPool = UPGRADES.filter((upgrade) => upgrade.weapon === player.weapon && available(upgrade))
    const commonPool = UPGRADES.filter((upgrade) => upgrade.category === 'common' && available(upgrade))
    const allPool = [...signaturePool, ...weaponPool, ...commonPool]
    const choices: string[] = []
    const takeUnique = (pool: typeof UPGRADES) => {
      const candidates = pool.filter((candidate) => !choices.includes(candidate.id))
      if (candidates.length > 0) choices.push(this.random.pick(candidates).id)
    }
    takeUnique(signaturePool)
    takeUnique(weaponPool)
    takeUnique(commonPool)
    while (choices.length < 3 && choices.length < allPool.length) takeUnique(allPool)
    return choices
  }

  private rewardBoss(type: BossType) {
    const buff = teamBuffByBoss(type)
    this.snapshot.teamBuffs[buff.id] = (this.snapshot.teamBuffs[buff.id] ?? 0) + 1
    if (type === 'broodmother') for (const player of this.snapshot.players) this.addMaximumHealth(player, HEART_VALUE)
    if (this.snapshot.players.some((player) => !player.awakened)) this.awakenSquad()
    this.pushEvent('buff', undefined, undefined, `SQUAD RELIC · ${buff.name.toUpperCase()} — ${buff.description.toUpperCase()}`)
  }

  private awakenSquad() {
    for (const player of this.snapshot.players) player.awakened = true
    this.pushEvent('awaken', undefined, undefined, 'BOSS BLOOD AWAKENED EVERY HUNTER')
  }

  private addMaximumHealth(player: PlayerState, amount: number) {
    player.maxHealth += amount
    player.health = Math.min(player.maxHealth, player.health + amount)
  }

  private addMagazine(player: PlayerState, ratio: number) {
    const addition = Math.max(1, Math.round(weaponById(player.weapon).magazine * ratio))
    player.maxAmmo += addition
    player.ammo += addition
  }

  private summonCompanion(player: PlayerState, kind: CompanionKind) {
    if (this.snapshot.companions.some((companion) => companion.ownerId === player.id && companion.kind === kind)) return
    this.snapshot.companions.push({
      id: this.entityId++, ownerId: player.id, kind,
      x: player.x - 42, y: player.y + 24, vx: 0, vy: 0, aim: player.aim,
      phase: this.random.range(0, Math.PI * 2), attackCooldown: 0.25,
    })
    this.pushEvent('awaken', player.x, player.y, `${player.name.toUpperCase()} BONDED WITH ${upgradeById(kind).name.toUpperCase()}`)
  }

  private heal(player: PlayerState, amount: number) {
    player.health = Math.min(player.maxHealth, player.health + amount)
  }

  private moveCircle(entity: { x: number; y: number; vx: number; vy: number }, dx: number, dy: number, radius: number) {
    const bounds = this.map.bounds
    const nextX = clamp(entity.x + dx, bounds.minX + radius, bounds.maxX - radius)
    if (!this.circleHitsObstacle(nextX, entity.y, radius)) entity.x = nextX
    else entity.vx = 0
    const nextY = clamp(entity.y + dy, bounds.minY + radius, bounds.maxY - radius)
    if (!this.circleHitsObstacle(entity.x, nextY, radius)) entity.y = nextY
    else entity.vy = 0
  }

  private circleHitsWall(x: number, y: number, radius: number): boolean {
    return this.map.walls.some((wall) => {
      const closestX = clamp(x, wall.x - wall.width / 2, wall.x + wall.width / 2)
      const closestY = clamp(y, wall.y - wall.height / 2, wall.y + wall.height / 2)
      return distanceSquared(x, y, closestX, closestY) < radius * radius
    })
  }

  private circleHitsObstacle(x: number, y: number, radius: number): boolean {
    return this.circleHitsWall(x, y, radius) || circleHitsSolidTerrain(this.map, x, y, radius)
  }

  private segmentHitsWall(ax: number, ay: number, bx: number, by: number, padding = 0): boolean {
    return this.map.walls.some((wall) => this.segmentIntersectsWall(ax, ay, bx, by, wall, padding))
  }

  private segmentHitsWorld(ax: number, ay: number, bx: number, by: number, padding = 0): boolean {
    return this.segmentHitsWall(ax, ay, bx, by, padding) || segmentHitsSolidTerrain(this.map, ax, ay, bx, by, padding)
  }

  private segmentIntersectsWall(ax: number, ay: number, bx: number, by: number, wall: MapWall, padding: number): boolean {
    const minX = wall.x - wall.width / 2 - padding
    const maxX = wall.x + wall.width / 2 + padding
    const minY = wall.y - wall.height / 2 - padding
    const maxY = wall.y + wall.height / 2 + padding
    const dx = bx - ax
    const dy = by - ay
    let minimum = 0
    let maximum = 1
    for (const [origin, delta, min, max] of [[ax, dx, minX, maxX], [ay, dy, minY, maxY]] as const) {
      if (Math.abs(delta) < 0.00001) {
        if (origin < min || origin > max) return false
        continue
      }
      const first = (min - origin) / delta
      const second = (max - origin) / delta
      const entry = Math.min(first, second)
      const exit = Math.max(first, second)
      minimum = Math.max(minimum, entry)
      maximum = Math.min(maximum, exit)
      if (minimum > maximum) return false
    }
    return maximum >= 0 && minimum <= 1
  }

  private hasLineOfSight(ax: number, ay: number, bx: number, by: number): boolean {
    return !this.segmentHitsWorld(ax, ay, bx, by, 2)
  }

  private navigationAngle(x: number, y: number, targetX: number, targetY: number, directAngle: number): number {
    if (this.map.id !== 'reliquary' || this.hasLineOfSight(x, y, targetX, targetY)) return directAngle
    const columnFor = (value: number) => value < -450 ? 0 : value > 450 ? 2 : 1
    const rowFor = (value: number) => value < -325 ? 0 : value > 325 ? 2 : 1
    const columns = [-900, 0, 900]
    const rows = [-650, 0, 650]
    const column = columnFor(x)
    const targetColumn = columnFor(targetX)
    const row = rowFor(y)
    const targetRow = rowFor(targetY)
    if (column !== targetColumn) {
      const direction = targetColumn > column ? 1 : -1
      const boundary = direction > 0 ? (column === 0 ? -450 : 450) : (column === 2 ? 450 : -450)
      return Math.atan2(rows[row] - y, boundary + direction * 118 - x)
    }
    if (row !== targetRow) {
      const direction = targetRow > row ? 1 : -1
      const boundary = direction > 0 ? (row === 0 ? -325 : 325) : (row === 2 ? 325 : -325)
      return Math.atan2(boundary + direction * 118 - y, columns[column] - x)
    }
    return directAngle
  }

  private nearestLivingPlayer(x: number, y: number): PlayerState | undefined {
    return this.snapshot.players.filter((player) => !player.downed && !player.eliminated).sort((a, b) => distanceSquared(x, y, a.x, a.y) - distanceSquared(x, y, b.x, b.y))[0]
  }

  private nearestEnemy(x: number, y: number, range: number): EnemyState | undefined {
    return this.snapshot.enemies.filter((enemy) => enemy.health > 0 && distanceSquared(x, y, enemy.x, enemy.y) <= range * range).sort((a, b) => distanceSquared(x, y, a.x, a.y) - distanceSquared(x, y, b.x, b.y))[0]
  }

  private pushEvent(type: GameEvent['type'], x?: number, y?: number, text?: string) {
    this.snapshot.events.push({ id: this.eventId++, type, x, y, text })
  }
}
