import { BOSS_NAMES, UPGRADES, isBoss, teamBuffByBoss, upgradeById, weaponById } from './data'
import { SeededRandom } from './random'
import type {
  BossType,
  CompanionKind,
  EnemyState,
  EnemyType,
  GameEvent,
  GameSnapshot,
  InputState,
  PickupState,
  PlayerConfig,
  PlayerState,
  ProjectileState,
  StructureState,
} from './types'

const EMPTY_INPUT: InputState = { up: false, down: false, left: false, right: false, firing: false, interact: false, aim: 0 }
const DRAFT_INPUT_DELAY = 0.5
const SPAWN_PADDING = 110
const HIT_INVULNERABILITY = 0.42
const KINETIC_SHELL_BONUS = 0.28
const BOSS_SCHEDULE: Array<{ at: number; type: BossType }> = [
  { at: 0.25, type: 'tollkeeper' },
  { at: 0.49, type: 'broodmother' },
  { at: 0.72, type: 'graveknight' },
  { at: 0.9, type: 'eclipse-eye' },
]

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
  private readonly projectileHits = new Map<number, Set<number>>()

  constructor(configs: PlayerConfig[], duration: number, seed = Date.now()) {
    this.random = new SeededRandom(seed)
    this.snapshot = {
      seed,
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

    this.snapshot.timeRemaining = Math.max(0, this.snapshot.timeRemaining - delta)
    if (this.snapshot.timeRemaining <= 0) {
      this.snapshot.phase = 'victory'
      this.pushEvent('win', undefined, undefined, 'DAWN BROKE. THE HUNTERS ENDURED.')
      return this.snapshot
    }

    this.updatePlayers(delta, inputs)
    this.updateCompanions(delta)
    this.updateStructures(delta)
    this.handleSpawns(delta, inputs)
    this.updateEnemies(delta, inputs)
    this.updateProjectiles(delta)
    this.updatePickups(delta)
    this.handleRevives(delta, inputs)
    this.checkLevelUp()

    if (this.snapshot.players.every((player) => player.eliminated)) {
      this.snapshot.phase = 'defeat'
      this.pushEvent('lose', undefined, undefined, 'THE NIGHT CLAIMED EVERY HUNTER.')
    }
    return this.snapshot
  }

  chooseUpgrade(upgradeId: string, chooserId: string): boolean {
    const draft = this.snapshot.upgrade
    const offer = draft?.offers.find((entry) => entry.chooserId === chooserId)
    const player = this.snapshot.players.find((entry) => entry.id === chooserId)
    if (!draft || draft.acceptsInputIn > 0 || !offer || offer.selectedId || !player || this.snapshot.phase !== 'upgrade' || !offer.ids.includes(upgradeId)) return false
    const definition = upgradeById(upgradeId)
    if (definition.character && definition.character !== player.character) return false

    const current = rank(player, upgradeId)
    if (current >= definition.maxLevel) return false
    player.perks[upgradeId] = current + 1
    if (upgradeId === 'vitality') this.addMaximumHealth(player, 50)
    if (upgradeId === 'unyielding') this.addMaximumHealth(player, 60)
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
    const maxHealth = config.character === 'bastion' ? 125 : config.character === 'warden' ? 110 : config.character === 'briar' ? 115 : config.character === 'seraph' ? 105 : 100
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
      ammo: weapon.magazine,
      maxAmmo: weapon.magazine,
      reloadRemaining: 0,
      reloadDuration: weapon.reload,
      fireCooldown: 0,
      invulnerable: 0,
      downed: false,
      eliminated: false,
      downTimer: 15,
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
    return [
      { id: this.entityId++, type: 'moonwell', x: -330, y: 190, radius: 80, cooldown: 0 },
      { id: this.entityId++, type: 'ward-tower', x: 360, y: -210, radius: 62, cooldown: 0.8 },
      { id: this.entityId++, type: 'ritual-stone', x: 80, y: 430, radius: 76, cooldown: 0 },
    ]
  }

  private updatePlayers(dt: number, inputs: ReadonlyMap<string, InputState>) {
    for (const player of this.snapshot.players) {
      player.invulnerable = Math.max(0, player.invulnerable - dt)
      player.fireCooldown = Math.max(0, player.fireCooldown - dt)
      player.hasteRemaining = Math.max(0, player.hasteRemaining - dt)
      if (player.eliminated) continue
      if (player.downed) {
        player.downTimer = Math.max(0, player.downTimer - dt)
        if (player.downTimer <= 0) {
          player.eliminated = true
          player.reviveProgress = 0
        }
        continue
      }

      const input = inputs.get(player.id) ?? EMPTY_INPUT
      player.aim = Number.isFinite(input.aim) ? input.aim : player.aim
      let moveX = Number(input.right) - Number(input.left)
      let moveY = Number(input.down) - Number(input.up)
      const magnitude = Math.hypot(moveX, moveY) || 1
      moveX /= magnitude
      moveY /= magnitude
      const burningNearby = player.character === 'cinder' && rank(player, 'ash-step') > 0 && this.snapshot.enemies.some((enemy) => enemy.burn > 0 && distanceSquared(player.x, player.y, enemy.x, enemy.y) < 260 * 260)
      const lastStand = rank(player, 'iron-heart') > 0 && player.health <= player.maxHealth * 0.5
      const moveMultiplier = Math.pow(1.25, rank(player, 'fleetfoot'))
        * Math.pow(1.12, this.snapshot.teamBuffs['eclipse-stride'] ?? 0)
        * (burningNearby ? 1.35 : 1)
        * (lastStand ? 1.2 : 1)
        * (player.hasteRemaining > 0 ? 1.22 : 1)
      const speed = 176 * moveMultiplier
      player.vx = moveX * speed
      player.vy = moveY * speed
      player.x = clamp(player.x + player.vx * dt, -1470, 1470)
      player.y = clamp(player.y + player.vy * dt, -1470, 1470)

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

  private tryFire(player: PlayerState) {
    const weapon = weaponById(player.weapon)
    if (player.fireCooldown > 0) return
    if (player.ammo <= 0) { this.startReload(player); return }

    const ritualBoost = this.snapshot.structures.some((structure) => structure.type === 'ritual-stone' && distanceSquared(player.x, player.y, structure.x, structure.y) < structure.radius * structure.radius)
    const emptyMagazineRatio = 1 - player.ammo / Math.max(1, player.maxAmmo)
    const burningNearby = player.character === 'cinder' && rank(player, 'ash-step') > 0 && this.snapshot.enemies.some((enemy) => enemy.burn > 0 && distanceSquared(player.x, player.y, enemy.x, enemy.y) < 260 * 260)
    const fireRate = weapon.fireRate
      * Math.pow(1.32, rank(player, 'barrage'))
      * (1 + emptyMagazineRatio * rank(player, 'relentless') * 0.6)
      * (1 + rank(player, 'charged-mag') * 0.35)
      * Math.pow(1.12, this.snapshot.teamBuffs['quicksilver-bell'] ?? 0)
      * (burningNearby ? 1.35 : 1)
      * (ritualBoost ? 1.25 : 1)
    player.fireCooldown = 1 / fireRate
    player.ammo -= 1
    player.shotCount += 1

    const bonusProjectiles = rank(player, 'double-tap') + rank(player, 'twin-fangs') + rank(player, 'radiant-volley')
    const projectileCount = weapon.projectiles + bonusProjectiles
    const totalSpread = weapon.spread + Math.max(0, projectileCount - weapon.projectiles) * 0.075
    for (let index = 0; index < projectileCount; index += 1) {
      const offset = projectileCount === 1 ? 0 : (index / (projectileCount - 1) - 0.5) * totalSpread
      const jitter = this.random.range(-weapon.spread * 0.08, weapon.spread * 0.08)
      const angle = player.aim + offset + jitter
      const cadence = player.character === 'vesper' ? Math.max(2, 6 - rank(player, 'deadeye-rhythm') * 2 - (player.awakened ? 2 : 0)) : 0
      const forcedCritical = cadence > 0 && player.shotCount % cadence === 0
      const still = Math.hypot(player.vx, player.vy) < 8
      const criticalChance = 0.06 + rank(player, 'overcharge') * 0.2
        + (player.character === 'seraph' ? 0.08 : 0)
        + rank(player, 'halo-crit') * 0.18
        + (still ? rank(player, 'stillness') * 0.18 : 0)
      const critical = forcedCritical || this.random.next() < criticalChance
      const damagePenalty = Math.pow(0.88, rank(player, 'double-tap')) * Math.pow(0.92, rank(player, 'twin-fangs'))
      const lastStand = rank(player, 'iron-heart') > 0 && player.health <= player.maxHealth * 0.5
      const baseDamage = weapon.damage
        * Math.pow(1.45, rank(player, 'heavy-caliber'))
        * Math.pow(1.18, rank(player, 'longshot'))
        * Math.pow(1.3, rank(player, 'veilshot'))
        * Math.pow(1.25, rank(player, 'sunlance'))
        * Math.pow(1.15, this.snapshot.teamBuffs['grave-edge'] ?? 0)
        * (still ? Math.pow(1.4, rank(player, 'stillness')) : 1)
        * (lastStand ? 1.35 : 1)
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
        radius: (critical ? 6.6 : 4.5) * Math.pow(1.25, rank(player, 'heavy-caliber')) * Math.pow(1.35, rank(player, 'rose-thorns')),
        damage: baseDamage * (critical ? criticalMultiplier : 1),
        life: (weapon.id === 'scattergun' ? 0.58 : 1.25) * Math.pow(1.65, rank(player, 'ghost-rounds')),
        pierce: weapon.pierce + rank(player, 'piercing-rounds') * 2 + rank(player, 'veilshot') * 2 + rank(player, 'rose-thorns') * 2
          + rank(player, 'ghost-rounds') * 2
          + (forcedCritical && player.awakened ? 1 : 0)
          + (critical && player.character === 'seraph' && player.awakened ? 1 : 0),
        bounces: 0,
        enemy: false,
        chain: weapon.chain + rank(player, 'static-link') * 2 + rank(player, 'ricochet-oath') * 2
          + (player.character === 'tempest' ? 1 : 0) + rank(player, 'stormchain') * 2,
        burn: player.character === 'cinder' || rank(player, 'combustion') > 0,
        color: critical ? '#fff2ad' : player.color,
      }
      this.snapshot.projectiles.push(projectile)
      this.projectileHits.set(projectile.id, new Set())
    }
    this.pushEvent('shot', player.x, player.y)
    if (player.ammo === 0) this.startReload(player)
  }

  private startReload(player: PlayerState) {
    const weapon = weaponById(player.weapon)
    player.reloadDuration = weapon.reload * Math.pow(0.58, rank(player, 'quick-hands')) * Math.pow(0.88, this.snapshot.teamBuffs['quicksilver-bell'] ?? 0)
    player.reloadRemaining = player.reloadDuration
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
      companion.x += companion.vx * dt
      companion.y += companion.vy * dt

      const attack = COMPANION_ATTACKS[companion.kind]
      const target = this.nearestEnemy(companion.x, companion.y, attack.range)
      if (!target) {
        if (Math.hypot(companion.vx, companion.vy) > 1) companion.aim = Math.atan2(companion.vy, companion.vx)
        continue
      }
      companion.aim = Math.atan2(target.y - companion.y, target.x - companion.x)
      if (companion.attackCooldown > 0) continue
      if (companion.kind === 'mercy-moth') this.heal(owner, 3)
      if (companion.kind === 'thornling') this.heal(owner, 2)
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
      if (structure.type === 'moonwell') {
        for (const player of this.snapshot.players) {
          if (!player.downed && !player.eliminated && distanceSquared(player.x, player.y, structure.x, structure.y) < structure.radius * structure.radius) player.health = Math.min(player.maxHealth, player.health + dt * 2.2)
        }
      }
      if (structure.type === 'ward-tower') {
        structure.cooldown -= dt
        if (structure.cooldown <= 0) {
          const target = this.nearestEnemy(structure.x, structure.y, 360)
          const owner = this.snapshot.players.find((player) => !player.eliminated)
          if (target && owner) {
            const angle = Math.atan2(target.y - structure.y, target.x - structure.x)
            const projectile: ProjectileState = { id: this.entityId++, ownerId: owner.id, x: structure.x, y: structure.y, vx: Math.cos(angle) * 545, vy: Math.sin(angle) * 545, radius: 5.2, damage: 22, life: 0.9, pierce: 0, bounces: 0, enemy: false, chain: 0, burn: false, color: '#74d8c2' }
            this.snapshot.projectiles.push(projectile)
            this.projectileHits.set(projectile.id, new Set())
            structure.cooldown = 1.1
          }
        }
      }
    }
  }

  private handleSpawns(dt: number, inputs: ReadonlyMap<string, InputState>) {
    const progress = 1 - this.snapshot.timeRemaining / this.snapshot.duration
    const scheduled = BOSS_SCHEDULE[this.nextBossIndex]
    if (scheduled && progress >= scheduled.at && !this.snapshot.enemies.some((enemy) => isBoss(enemy.type))) {
      this.nextBossIndex += 1
      this.spawnEnemy(scheduled.type, inputs)
      this.pushEvent('boss', undefined, undefined, `${BOSS_NAMES[scheduled.type]} HAS ENTERED THE HUNT`)
    }

    this.spawnTimer -= dt
    if (this.spawnTimer > 0 || this.snapshot.enemies.length >= 230) return
    const playerScale = 0.75 + this.snapshot.players.length * 0.44
    const bossPressure = this.snapshot.enemies.some((enemy) => isBoss(enemy.type)) ? 0.72 : 1
    const count = Math.min(8, Math.max(2, Math.floor((playerScale + progress * 5) * bossPressure)))
    const pool: EnemyType[] = ['thrall', 'thrall']
    if (progress > 0.08) pool.push('skitter', 'leech')
    if (progress > 0.2) pool.push('spitter', 'wraith')
    if (progress > 0.34) pool.push('charger')
    if (progress > 0.48) pool.push('hexer')
    if (progress > 0.62) pool.push('bulwark')
    for (let index = 0; index < count; index += 1) this.spawnEnemy(this.random.pick(pool), inputs)
    this.spawnTimer = Math.max(0.1, 0.62 - progress * 0.45) / playerScale
  }

  private findOffscreenSpawn(inputs: ReadonlyMap<string, InputState>): { x: number; y: number } {
    const living = this.snapshot.players.filter((player) => !player.eliminated)
    const centerX = living.reduce((sum, player) => sum + player.x, 0) / Math.max(1, living.length)
    const centerY = living.reduce((sum, player) => sum + player.y, 0) / Math.max(1, living.length)
    const angle = this.random.range(0, Math.PI * 2)
    const squadRadius = living.reduce((furthest, player) => Math.max(furthest, Math.hypot(player.x - centerX, player.y - centerY)), 0)
    const largestViewportRadius = living.reduce((largest, player) => {
      const input = inputs.get(player.id)
      const width = clamp(input?.viewportWidth ?? 1280, 320, 2560)
      const height = clamp(input?.viewportHeight ?? 720, 240, 1440)
      return Math.max(largest, Math.hypot(width / 2, height / 2))
    }, Math.hypot(640, 360))
    const range = squadRadius + largestViewportRadius + SPAWN_PADDING + this.random.range(0, 150)
    return { x: centerX + Math.cos(angle) * range, y: centerY + Math.sin(angle) * range }
  }

  private spawnEnemy(type: EnemyType, inputs: ReadonlyMap<string, InputState>) {
    const spawn = this.findOffscreenSpawn(inputs)
    const progress = 1 - this.snapshot.timeRemaining / this.snapshot.duration
    const regularScale = 1 + progress * 1.6 + Math.max(0, this.snapshot.players.length - 1) * 0.34
    const bossScale = (0.72 + this.snapshot.players.length * 0.3) * (1 + progress * 0.38)
    const stats: Record<EnemyType, { hp: number; radius: number; speed: number; damage: number }> = {
      thrall: { hp: 34, radius: 13, speed: 58, damage: 12 },
      skitter: { hp: 22, radius: 9, speed: 106, damage: 9 },
      spitter: { hp: 58, radius: 15, speed: 48, damage: 10 },
      bulwark: { hp: 225, radius: 23, speed: 35, damage: 20 },
      wraith: { hp: 48, radius: 15, speed: 76, damage: 11 },
      charger: { hp: 88, radius: 17, speed: 70, damage: 18 },
      hexer: { hp: 72, radius: 16, speed: 43, damage: 11 },
      leech: { hp: 30, radius: 11, speed: 92, damage: 8 },
      tollkeeper: { hp: 4400, radius: 58, speed: 30, damage: 24 },
      broodmother: { hp: 5000, radius: 62, speed: 34, damage: 22 },
      graveknight: { hp: 5900, radius: 60, speed: 42, damage: 28 },
      'eclipse-eye': { hp: 6800, radius: 64, speed: 36, damage: 26 },
    }
    const base = stats[type]
    const scale = isBoss(type) ? bossScale : regularScale
    this.snapshot.enemies.push({
      id: this.entityId++, type,
      x: spawn.x, y: spawn.y,
      vx: 0, vy: 0, health: base.hp * scale, maxHealth: base.hp * scale, radius: base.radius,
      speed: base.speed, damage: base.damage, attackCooldown: this.random.range(0, 0.45),
      burn: 0, burnTick: 0.5, slow: 0, phase: this.random.range(0, Math.PI * 2),
      abilityCooldown: isBoss(type) ? this.random.range(1, 2) : 0,
      summonCooldown: isBoss(type) ? this.random.range(3.2, 4.8) : 0,
      contactCooldown: 0,
      dashRemaining: 0,
      dashAngle: 0,
      strafeDirection: this.random.next() < 0.5 ? -1 : 1,
    })
  }

  private summonBossAdds(types: EnemyType[], inputs: ReadonlyMap<string, InputState>) {
    if (this.snapshot.enemies.length + types.length >= 230) return
    for (const type of types) this.spawnEnemy(type, inputs)
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
          const burnDamage = (5 + rank(owner, 'combustion') * 9) * Math.pow(2.2, rank(owner, 'white-flame'))
          this.damageEnemy(enemy, burnDamage, enemy.burnOwner)
          enemy.burnTick = 0.5
        }
      }
      if (enemy.health <= 0) continue

      const target = this.nearestLivingPlayer(enemy.x, enemy.y)
      if (!target) continue
      let angle = Math.atan2(target.y - enemy.y, target.x - enemy.x)
      const distance = Math.sqrt(distanceSquared(enemy.x, enemy.y, target.x, target.y))
      let speed = enemy.speed * (enemy.slow > 0 ? 0.48 : 1)
      if (enemy.type === 'wraith') angle += Math.sin(enemy.phase * 3) * 0.32
      if (enemy.type === 'charger' && enemy.phase % 4.2 < 0.9) speed *= 2.25
      if (enemy.type === 'leech') speed *= 1.12

      if ((enemy.type === 'spitter' || enemy.type === 'hexer') && distance < (enemy.type === 'hexer' ? 410 : 335)) {
        speed = distance < 220 ? -enemy.speed * 0.5 : 0
        if (enemy.attackCooldown <= 0) {
          this.spawnEnemyProjectile(enemy, angle, enemy.type === 'hexer' ? 140 : 155, enemy.type === 'hexer' ? 9 : 7)
          enemy.attackCooldown = enemy.type === 'hexer' ? 2.45 : 2.05
        }
      }

      if (enemy.type === 'tollkeeper') {
        if (enemy.attackCooldown <= 0 && distance < 900) {
          for (let shot = 0; shot < 12; shot += 1) this.spawnEnemyProjectile(enemy, shot / 12 * Math.PI * 2 + enemy.phase * 0.42, 118, 9)
          enemy.attackCooldown = 3.3
        }
        if ((enemy.abilityCooldown ?? 0) <= 0) {
          enemy.dashAngle = angle
          enemy.dashRemaining = 0.62
          enemy.abilityCooldown = 5.1
          for (let shot = -1; shot <= 1; shot += 1) this.spawnEnemyProjectile(enemy, angle + shot * 0.18, 128, 10)
        }
        if ((enemy.summonCooldown ?? 0) <= 0) {
          this.summonBossAdds(['thrall', 'thrall', 'wraith'], inputs)
          enemy.summonCooldown = 8.2
        }
      }

      if (enemy.type === 'broodmother') {
        if (distance < 260) angle += Math.PI
        if (enemy.attackCooldown <= 0 && distance < 940) {
          for (let shot = 0; shot < 10; shot += 1) this.spawnEnemyProjectile(enemy, shot / 10 * Math.PI * 2 - enemy.phase * 0.5, 108, 8)
          enemy.attackCooldown = 2.85
        }
        if ((enemy.abilityCooldown ?? 0) <= 0) {
          enemy.dashAngle = angle + (enemy.strafeDirection ?? 1) * Math.PI / 2
          enemy.dashRemaining = 0.5
          enemy.abilityCooldown = 4.6
          enemy.strafeDirection = -(enemy.strafeDirection ?? 1)
        }
        if ((enemy.summonCooldown ?? 0) <= 0) {
          this.summonBossAdds(['skitter', 'skitter', 'skitter', 'skitter', 'skitter', 'leech', 'leech'], inputs)
          enemy.summonCooldown = 5.8
        }
      }

      if (enemy.type === 'graveknight') {
        if (enemy.attackCooldown <= 0 && distance < 850) {
          for (let shot = -2; shot <= 2; shot += 1) this.spawnEnemyProjectile(enemy, angle + shot * 0.16, 145, 11)
          enemy.attackCooldown = 2.4
        }
        if ((enemy.abilityCooldown ?? 0) <= 0) {
          enemy.dashAngle = angle
          enemy.dashRemaining = 0.78
          enemy.abilityCooldown = 4.1
          for (let shot = -3; shot <= 3; shot += 1) this.spawnEnemyProjectile(enemy, angle + shot * 0.09, 150, 12)
        }
        if ((enemy.summonCooldown ?? 0) <= 0) {
          this.summonBossAdds(['wraith', 'wraith', 'wraith'], inputs)
          enemy.summonCooldown = 8.4
        }
      }

      if (enemy.type === 'eclipse-eye') {
        angle += (enemy.strafeDirection ?? 1) * (distance > 520 ? 0.55 : distance < 300 ? 2.2 : 1.35)
        speed *= 1.2
        if (enemy.attackCooldown <= 0 && distance < 980) {
          for (let shot = 0; shot < 16; shot += 1) this.spawnEnemyProjectile(enemy, shot / 16 * Math.PI * 2 + enemy.phase * 0.7, 105, 10)
          enemy.attackCooldown = 2.35
        }
        if ((enemy.abilityCooldown ?? 0) <= 0) {
          enemy.dashAngle = angle
          enemy.dashRemaining = 0.58
          enemy.abilityCooldown = 4.2
          enemy.strafeDirection = -(enemy.strafeDirection ?? 1)
          const aimed = Math.atan2(target.y - enemy.y, target.x - enemy.x)
          for (let shot = -2; shot <= 2; shot += 1) this.spawnEnemyProjectile(enemy, aimed + shot * 0.12, 132, 10)
        }
        if ((enemy.summonCooldown ?? 0) <= 0) {
          this.summonBossAdds(['hexer', 'hexer', 'wraith', 'wraith'], inputs)
          enemy.summonCooldown = 7.2
        }
      }

      if ((enemy.dashRemaining ?? 0) > 0 && isBoss(enemy.type)) {
        angle = enemy.dashAngle ?? angle
        const dashMultiplier = enemy.type === 'graveknight' ? 5.4 : enemy.type === 'tollkeeper' ? 4.8 : enemy.type === 'eclipse-eye' ? 4.3 : 3.6
        speed = enemy.speed * dashMultiplier * (enemy.slow > 0 ? 0.72 : 1)
      }

      enemy.vx = Math.cos(angle) * speed
      enemy.vy = Math.sin(angle) * speed
      enemy.x += enemy.vx * dt
      enemy.y += enemy.vy * dt
      const canContact = isBoss(enemy.type) ? (enemy.contactCooldown ?? 0) <= 0 : enemy.attackCooldown <= 0
      if (distance < enemy.radius + 13 && canContact) {
        this.damagePlayer(target, enemy.damage)
        if (isBoss(enemy.type)) enemy.contactCooldown = 0.72
        else enemy.attackCooldown = 1
      }
    }
    this.snapshot.enemies = this.snapshot.enemies.filter((enemy) => enemy.health > 0)
  }

  private spawnEnemyProjectile(enemy: EnemyState, angle: number, speed: number, damage: number) {
    this.snapshot.projectiles.push({ id: this.entityId++, ownerId: `enemy-${enemy.id}`, x: enemy.x, y: enemy.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, radius: 6.5, damage, life: 4.5, pierce: 0, bounces: 0, enemy: true, chain: 0, burn: false, color: '#ef718e' })
  }

  private updateProjectiles(dt: number) {
    for (const projectile of this.snapshot.projectiles) {
      projectile.life -= dt
      projectile.x += projectile.vx * dt
      projectile.y += projectile.vy * dt
      if (projectile.life <= 0) continue
      if (projectile.enemy) {
        for (const player of this.snapshot.players) {
          if (player.downed || player.eliminated) continue
          if (distanceSquared(projectile.x, projectile.y, player.x, player.y) < Math.pow(projectile.radius + 11, 2)) {
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
        this.damageEnemy(enemy, projectile.damage, projectile.ownerId)
        if (projectile.burn && enemy.health > 0) { enemy.burn = 2.5; enemy.burnOwner = projectile.ownerId }
        const owner = this.snapshot.players.find((player) => player.id === projectile.ownerId)
        const frostRank = rank(owner, 'frostbite')
        if (frostRank > 0) enemy.slow = 2
        if (projectile.chain > 0) this.arcDamage(enemy, projectile, hits)
        projectile.pierce -= 1
        if (projectile.pierce < 0) projectile.life = 0
        break
      }
      this.projectileHits.set(projectile.id, hits)
    }
    for (const projectile of this.snapshot.projectiles) if (projectile.life <= 0) this.projectileHits.delete(projectile.id)
    this.snapshot.projectiles = this.snapshot.projectiles.filter((projectile) => projectile.life > 0).slice(-560)
    this.snapshot.enemies = this.snapshot.enemies.filter((enemy) => enemy.health > 0)
  }

  private arcDamage(origin: EnemyState, projectile: ProjectileState, alreadyHit: Set<number>) {
    const owner = this.snapshot.players.find((player) => player.id === projectile.ownerId)
    const range = owner?.character === 'tempest' && owner.awakened ? 190 : 150
    const retention = 0.52 + rank(owner, 'thunderhead') * 0.28 + (owner?.character === 'tempest' && owner.awakened ? 0.1 : 0)
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
      if (owner.character === 'briar') this.heal(owner, owner.maxHealth * (0.006 + rank(owner, 'bloodbloom') * 0.012) * (owner.awakened ? 2 : 1))
      if (owner.character === 'nyx' && rank(owner, 'night-harvest') > 0 && owner.kills % 8 === 0) { this.heal(owner, 15); owner.hasteRemaining = 5 }
      if (owner.character === 'cinder' && rank(owner, 'phoenix-round') > 0 && owner.kills % 12 === 0) {
        this.heal(owner, 25)
        for (const nearby of [...this.snapshot.enemies]) {
          if (nearby.id !== enemy.id && nearby.health > 0 && distanceSquared(enemy.x, enemy.y, nearby.x, nearby.y) < 170 * 170) this.damageEnemy(nearby, 60, owner.id)
        }
      }
    }
    const values: Record<EnemyType, number> = { thrall: 4, skitter: 3, spitter: 6, bulwark: 10, wraith: 6, charger: 8, hexer: 8, leech: 4, tollkeeper: 75, broodmother: 85, graveknight: 95, 'eclipse-eye': 110 }
    const pickup: PickupState = { id: this.entityId++, x: enemy.x, y: enemy.y, value: values[enemy.type] }
    this.snapshot.pickups.push(pickup)

    if (isBoss(enemy.type)) this.rewardBoss(enemy.type)
    const burnOwner = this.snapshot.players.find((player) => player.id === enemy.burnOwner)
    if (burnOwner && (rank(burnOwner, 'combustion') > 0 || (burnOwner.character === 'cinder' && (burnOwner.awakened || rank(burnOwner, 'flashpoint') > 0)))) {
      const flashpoint = burnOwner.character === 'cinder' && rank(burnOwner, 'flashpoint') > 0
      const explosionRange = flashpoint ? 180 : burnOwner.awakened && burnOwner.character === 'cinder' ? 118 : 95
      const explosionDamage = flashpoint ? 75 : burnOwner.awakened && burnOwner.character === 'cinder' ? 42 : 28
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
    const personalReduction = rank(player, 'steadfast') * 0.2 + rank(player, 'dawn-armor') * 0.2
      + (player.reloadRemaining > 0 ? rank(player, 'shielded-mag') * 0.35 : 0)
    const finalDamage = amount * Math.max(0.3, 1 - auraReduction - personalReduction)
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
    player.downed = true
    player.downTimer = 15 + rank(player, 'unyielding') * 8
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
          if (rank(player, 'red-harvest') > 0) this.heal(player, 2)
          pickup.value = 0
          break
        }
      }
    }
    this.snapshot.pickups = this.snapshot.pickups.filter((pickup) => pickup.value > 0).slice(-320)
  }

  private handleRevives(dt: number, inputs: ReadonlyMap<string, InputState>) {
    for (const downed of this.snapshot.players.filter((player) => player.downed && !player.eliminated)) {
      const reviver = this.snapshot.players.find((player) => {
        const input = inputs.get(player.id) ?? EMPTY_INPUT
        return !player.downed && !player.eliminated && input.interact && distanceSquared(player.x, player.y, downed.x, downed.y) < 68 * 68
      })
      if (!reviver) { downed.reviveProgress = Math.max(0, downed.reviveProgress - dt * 0.35); continue }
      const reviveSpeed = (reviver.character === 'warden' ? 1.5 : 1) * (rank(reviver, 'merciful-hand') > 0 ? 2 : 1)
      downed.reviveProgress += dt * reviveSpeed
      if (downed.reviveProgress >= 2.2) {
        downed.downed = false
        const lastRite = rank(reviver, 'last-rite')
        downed.health = downed.maxHealth * (lastRite > 0 ? 1 : 0.5)
        downed.downTimer = 15 + rank(downed, 'unyielding') * 8
        downed.reviveProgress = 0
        downed.invulnerable = 2 + lastRite
        downed.hasteRemaining = lastRite > 0 ? 6 : 0
        this.pushEvent('revive', downed.x, downed.y, `${reviver.name.toUpperCase()} PULLED ${downed.name.toUpperCase()} BACK`)
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
    const available = (upgrade: (typeof UPGRADES)[number]) => rank(player, upgrade.id) < upgrade.maxLevel && !excludedIds.has(upgrade.id)
    const signaturePool = UPGRADES.filter((upgrade) => upgrade.character === player.character && available(upgrade))
    const commonPool = UPGRADES.filter((upgrade) => upgrade.category === 'common' && available(upgrade))
    const allPool = [...signaturePool, ...commonPool]
    const choices: string[] = []
    const takeUnique = (pool: typeof UPGRADES) => {
      const candidates = pool.filter((candidate) => !choices.includes(candidate.id))
      if (candidates.length > 0) choices.push(this.random.pick(candidates).id)
    }
    takeUnique(signaturePool)
    while (choices.length < 3 && choices.length < allPool.length) takeUnique(choices.length === 1 && commonPool.length > 0 ? commonPool : allPool)
    return choices
  }

  private rewardBoss(type: BossType) {
    const buff = teamBuffByBoss(type)
    this.snapshot.teamBuffs[buff.id] = (this.snapshot.teamBuffs[buff.id] ?? 0) + 1
    if (type === 'broodmother') for (const player of this.snapshot.players) this.addMaximumHealth(player, 25)
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
