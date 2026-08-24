import { UPGRADES, upgradeById, weaponById } from './data'
import { SeededRandom } from './random'
import type {
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

const EMPTY_INPUT: InputState = {
  up: false,
  down: false,
  left: false,
  right: false,
  firing: false,
  interact: false,
  aim: 0,
}

const distanceSquared = (ax: number, ay: number, bx: number, by: number) => {
  const dx = ax - bx
  const dy = ay - by
  return dx * dx + dy * dy
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

export class GameEngine {
  readonly snapshot: GameSnapshot
  private readonly random: SeededRandom
  private entityId = 1
  private eventId = 1
  private spawnTimer = 0.4
  private eliteSpawned = false
  private bossSpawned = false
  private readonly projectileHits = new Map<number, Set<number>>()

  constructor(configs: PlayerConfig[], duration: number, seed = Date.now()) {
    this.random = new SeededRandom(seed)
    const players = configs.map((config, index) => this.createPlayer(config, index))
    this.snapshot = {
      seed,
      phase: 'playing',
      timeRemaining: duration,
      duration,
      level: 1,
      xp: 0,
      xpToNext: 30,
      players,
      enemies: [],
      projectiles: [],
      pickups: [],
      structures: this.createStructures(),
      events: [],
    }
  }

  step(dt: number, inputs: ReadonlyMap<string, InputState>): GameSnapshot {
    const delta = clamp(dt, 0, 0.05)
    this.snapshot.events = this.snapshot.events.slice(-18)

    if (this.snapshot.phase === 'upgrade') {
      if (this.snapshot.upgrade) {
        this.snapshot.upgrade.expiresIn -= delta
        if (this.snapshot.upgrade.expiresIn <= 0) this.chooseUpgrade(this.snapshot.upgrade.ids[0], this.snapshot.upgrade.chooserId)
      }
      return this.snapshot
    }

    if (this.snapshot.phase !== 'playing') return this.snapshot

    this.snapshot.timeRemaining = Math.max(0, this.snapshot.timeRemaining - delta)
    if (this.snapshot.timeRemaining <= 0) {
      this.snapshot.phase = 'victory'
      this.pushEvent('win', undefined, undefined, 'DAWN BROKE. THE SQUAD ENDURED.')
      return this.snapshot
    }

    this.updatePlayers(delta, inputs)
    this.updateStructures(delta)
    this.handleSpawns(delta)
    this.updateEnemies(delta)
    this.updateProjectiles(delta)
    this.updatePickups(delta)
    this.handleRevives(delta, inputs)
    this.checkLevelUp()

    if (this.snapshot.players.every((player) => player.eliminated)) {
      this.snapshot.phase = 'defeat'
      this.pushEvent('lose', undefined, undefined, 'THE NIGHT CLAIMED THE SQUAD.')
    }

    return this.snapshot
  }

  chooseUpgrade(upgradeId: string, chooserId: string): boolean {
    const offer = this.snapshot.upgrade
    if (!offer || this.snapshot.phase !== 'upgrade' || offer.chooserId !== chooserId || !offer.ids.includes(upgradeId)) return false

    for (const player of this.snapshot.players) {
      const current = player.perks[upgradeId] ?? 0
      const definition = upgradeById(upgradeId)
      player.perks[upgradeId] = Math.min(definition.maxLevel, current + 1)
      if (upgradeId === 'vitality') {
        player.maxHealth += 25
        player.health = Math.min(player.maxHealth, player.health + 25)
      }
    }

    this.snapshot.level += 1
    this.snapshot.xp -= this.snapshot.xpToNext
    this.snapshot.xpToNext = Math.floor(30 * Math.pow(1.27, this.snapshot.level - 1))
    this.snapshot.upgrade = undefined
    this.snapshot.phase = 'playing'
    this.pushEvent('level', undefined, undefined, `${upgradeById(upgradeId).name.toUpperCase()} JOINED THE SQUAD BUILD`)
    return true
  }

  private createPlayer(config: PlayerConfig, index: number): PlayerState {
    const weapon = weaponById(config.weapon)
    const maxHealth = config.character === 'bastion' ? 120 : config.character === 'warden' ? 110 : 100
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
      const speed = 176 * Math.pow(1.12, player.perks['fleetfoot'] ?? 0)
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

      const nearAlly = this.snapshot.players.some(
        (ally) => ally.id !== player.id && !ally.downed && !ally.eliminated && distanceSquared(player.x, player.y, ally.x, ally.y) < 150 * 150,
      )
      const sanctuary = player.perks['sanctuary'] ?? 0
      const awakenedWarden = this.snapshot.players.some((ally) => ally.character === 'warden' && ally.awakened && !ally.eliminated)
      if ((nearAlly && sanctuary > 0) || awakenedWarden) {
        player.health = Math.min(player.maxHealth, player.health + dt * (sanctuary * 0.7 + (awakenedWarden ? 0.65 : 0)))
      }
    }
  }

  private tryFire(player: PlayerState) {
    const weapon = weaponById(player.weapon)
    if (player.fireCooldown > 0) return
    if (player.ammo <= 0) {
      player.reloadDuration = weapon.reload * Math.pow(0.82, player.perks['quick-hands'] ?? 0)
      player.reloadRemaining = player.reloadDuration
      return
    }

    const ritualBoost = this.snapshot.structures.some(
      (structure) => structure.type === 'ritual-stone' && distanceSquared(player.x, player.y, structure.x, structure.y) < structure.radius * structure.radius,
    )
    const fireRate = weapon.fireRate * Math.pow(1.15, player.perks.barrage ?? 0) * (ritualBoost ? 1.25 : 1)
    player.fireCooldown = 1 / fireRate
    player.ammo -= 1
    player.shotCount += 1

    const bonusProjectiles = player.perks['double-tap'] ?? 0
    const projectileCount = weapon.projectiles + bonusProjectiles
    const totalSpread = weapon.spread + Math.max(0, projectileCount - weapon.projectiles) * 0.08
    for (let index = 0; index < projectileCount; index += 1) {
      const offset = projectileCount === 1 ? 0 : (index / (projectileCount - 1) - 0.5) * totalSpread
      const jitter = this.random.range(-weapon.spread * 0.08, weapon.spread * 0.08)
      const angle = player.aim + offset + jitter
      const forcedCritical = player.character === 'vesper' && player.shotCount % (player.awakened ? 4 : 6) === 0
      const criticalChance = 0.06 + (player.perks.overcharge ?? 0) * 0.09
      const critical = forcedCritical || this.random.next() < criticalChance
      const damagePenalty = Math.pow(0.88, bonusProjectiles)
      const damage = weapon.damage * Math.pow(1.22, player.perks['heavy-caliber'] ?? 0) * damagePenalty * (critical ? 2.2 : 1)
      const radius = (critical ? 5.2 : 3.5) * Math.pow(1.12, player.perks['heavy-caliber'] ?? 0)
      const projectile: ProjectileState = {
        id: this.entityId++,
        ownerId: player.id,
        x: player.x + Math.cos(angle) * 20,
        y: player.y + Math.sin(angle) * 20,
        vx: Math.cos(angle) * weapon.speed,
        vy: Math.sin(angle) * weapon.speed,
        radius,
        damage,
        life: weapon.id === 'scattergun' ? 0.58 : 1.25,
        pierce: weapon.pierce + (forcedCritical && player.awakened ? 1 : 0),
        bounces: 0,
        enemy: false,
        chain: weapon.chain + (player.perks['static-link'] ?? 0),
        burn: player.character === 'cinder' || (player.perks.combustion ?? 0) > 0,
        color: critical ? '#fff2ad' : player.color,
      }
      this.snapshot.projectiles.push(projectile)
      this.projectileHits.set(projectile.id, new Set())
    }

    this.pushEvent('shot', player.x, player.y)
    if (player.ammo === 0) {
      player.reloadDuration = weapon.reload * Math.pow(0.82, player.perks['quick-hands'] ?? 0)
      player.reloadRemaining = player.reloadDuration
    }
  }

  private updateStructures(dt: number) {
    for (const structure of this.snapshot.structures) {
      if (structure.type === 'moonwell') {
        for (const player of this.snapshot.players) {
          if (!player.downed && !player.eliminated && distanceSquared(player.x, player.y, structure.x, structure.y) < structure.radius * structure.radius) {
            player.health = Math.min(player.maxHealth, player.health + dt * 2.2)
          }
        }
      }

      if (structure.type === 'ward-tower') {
        structure.cooldown -= dt
        if (structure.cooldown <= 0) {
          const target = this.nearestEnemy(structure.x, structure.y, 360)
          const owner = this.snapshot.players.find((player) => !player.eliminated)
          if (target && owner) {
            const angle = Math.atan2(target.y - structure.y, target.x - structure.x)
            const projectile: ProjectileState = {
              id: this.entityId++, ownerId: owner.id, x: structure.x, y: structure.y,
              vx: Math.cos(angle) * 640, vy: Math.sin(angle) * 640, radius: 4, damage: 22,
              life: 0.8, pierce: 0, bounces: 0, enemy: false, chain: 0, burn: false, color: '#74d8c2',
            }
            this.snapshot.projectiles.push(projectile)
            this.projectileHits.set(projectile.id, new Set())
            structure.cooldown = 1.1
          }
        }
      }
    }
  }

  private handleSpawns(dt: number) {
    const elapsed = this.snapshot.duration - this.snapshot.timeRemaining
    const progress = elapsed / this.snapshot.duration

    if (!this.eliteSpawned && progress >= 0.34) {
      this.eliteSpawned = true
      this.spawnEnemy('bulwark', true)
      this.pushEvent('boss', undefined, undefined, 'A BULWARK ENTERS THE HUNT')
    }
    if (!this.bossSpawned && progress >= 0.74) {
      this.bossSpawned = true
      this.spawnEnemy('tollkeeper', true)
      this.pushEvent('boss', undefined, undefined, 'THE TOLLKEEPER HAS FOUND YOU')
    }

    if (this.snapshot.enemies.some((enemy) => enemy.type === 'tollkeeper')) return
    this.spawnTimer -= dt
    if (this.spawnTimer > 0 || this.snapshot.enemies.length >= 170) return

    const playerScale = 0.7 + this.snapshot.players.length * 0.42
    const count = Math.min(5, Math.max(1, Math.floor(playerScale + progress * 3.1)))
    for (let index = 0; index < count; index += 1) {
      const roll = this.random.next()
      let type: EnemyType = 'thrall'
      if (progress > 0.22 && roll < 0.18) type = 'skitter'
      if (progress > 0.4 && roll > 0.78) type = 'spitter'
      if (progress > 0.62 && roll > 0.92) type = 'bulwark'
      this.spawnEnemy(type, false)
    }
    this.spawnTimer = Math.max(0.12, 0.72 - progress * 0.48) / playerScale
  }

  private spawnEnemy(type: EnemyType, staged: boolean) {
    const living = this.snapshot.players.filter((player) => !player.eliminated)
    const centerX = living.reduce((sum, player) => sum + player.x, 0) / Math.max(1, living.length)
    const centerY = living.reduce((sum, player) => sum + player.y, 0) / Math.max(1, living.length)
    const angle = this.random.range(0, Math.PI * 2)
    const range = staged ? 520 : this.random.range(550, 760)
    const progress = 1 - this.snapshot.timeRemaining / this.snapshot.duration
    const scale = 1 + progress * 1.7 + Math.max(0, this.snapshot.players.length - 1) * 0.38
    const stats = {
      thrall: { hp: 34, radius: 13, speed: 56, damage: 12 },
      skitter: { hp: 22, radius: 9, speed: 104, damage: 9 },
      spitter: { hp: 58, radius: 15, speed: 48, damage: 10 },
      bulwark: { hp: staged ? 1450 : 210, radius: staged ? 32 : 23, speed: 34, damage: 20 },
      tollkeeper: { hp: 5400 * (0.7 + this.snapshot.players.length * 0.3), radius: 58, speed: 28, damage: 25 },
    }[type]
    this.snapshot.enemies.push({
      id: this.entityId++, type, x: centerX + Math.cos(angle) * range, y: centerY + Math.sin(angle) * range,
      vx: 0, vy: 0, health: stats.hp * scale, maxHealth: stats.hp * scale, radius: stats.radius,
      speed: stats.speed, damage: stats.damage, attackCooldown: this.random.range(0, 0.4),
      burn: 0, burnTick: 0.5, slow: 0, phase: this.random.range(0, Math.PI * 2),
    })
  }

  private updateEnemies(dt: number) {
    for (const enemy of this.snapshot.enemies) {
      if (enemy.health <= 0) continue
      enemy.attackCooldown = Math.max(0, enemy.attackCooldown - dt)
      enemy.slow = Math.max(0, enemy.slow - dt)
      enemy.phase += dt

      if (enemy.burn > 0) {
        enemy.burn -= dt
        enemy.burnTick -= dt
        if (enemy.burnTick <= 0) {
          const owner = this.snapshot.players.find((player) => player.id === enemy.burnOwner)
          const burnRank = owner?.perks.combustion ?? 0
          this.damageEnemy(enemy, 5 + burnRank * 4, enemy.burnOwner)
          enemy.burnTick = 0.5
        }
      }
      if (enemy.health <= 0) continue

      const target = this.nearestLivingPlayer(enemy.x, enemy.y)
      if (!target) continue
      const angle = Math.atan2(target.y - enemy.y, target.x - enemy.x)
      const distance = Math.sqrt(distanceSquared(enemy.x, enemy.y, target.x, target.y))
      let speed = enemy.speed * (enemy.slow > 0 ? 0.48 : 1)

      if (enemy.type === 'spitter' && distance < 330) {
        speed = distance < 220 ? -enemy.speed * 0.55 : 0
        if (enemy.attackCooldown <= 0) {
          this.spawnEnemyProjectile(enemy, angle, 260, 7)
          enemy.attackCooldown = 2.15
        }
      }
      if (enemy.type === 'tollkeeper' && enemy.phase % 3.4 < dt) {
        for (let index = 0; index < 12; index += 1) this.spawnEnemyProjectile(enemy, (index / 12) * Math.PI * 2 + enemy.phase, 215, 9)
      }

      enemy.vx = Math.cos(angle) * speed
      enemy.vy = Math.sin(angle) * speed
      enemy.x += enemy.vx * dt
      enemy.y += enemy.vy * dt

      if (distance < enemy.radius + 13 && enemy.attackCooldown <= 0) {
        this.damagePlayer(target, enemy.damage)
        enemy.attackCooldown = enemy.type === 'tollkeeper' ? 0.65 : 1.0
      }
    }
    this.snapshot.enemies = this.snapshot.enemies.filter((enemy) => enemy.health > 0)
  }

  private spawnEnemyProjectile(enemy: EnemyState, angle: number, speed: number, damage: number) {
    this.snapshot.projectiles.push({
      id: this.entityId++, ownerId: `enemy-${enemy.id}`, x: enemy.x, y: enemy.y,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, radius: 5, damage,
      life: 3, pierce: 0, bounces: 0, enemy: true, chain: 0, burn: false, color: '#ef718e',
    })
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
        if (projectile.burn && enemy.health > 0) {
          enemy.burn = 2.5
          enemy.burnOwner = projectile.ownerId
        }
        const owner = this.snapshot.players.find((player) => player.id === projectile.ownerId)
        const frostRank = owner?.perks.frostbite ?? 0
        if (frostRank > 0) enemy.slow = 0.8 + frostRank * 0.35
        if (projectile.chain > 0) this.arcDamage(enemy, projectile, hits)
        projectile.pierce -= 1
        if (projectile.pierce < 0) projectile.life = 0
        break
      }
      this.projectileHits.set(projectile.id, hits)
    }

    for (const projectile of this.snapshot.projectiles) {
      if (projectile.life <= 0) this.projectileHits.delete(projectile.id)
    }
    this.snapshot.projectiles = this.snapshot.projectiles.filter((projectile) => projectile.life > 0).slice(-420)
  }

  private arcDamage(origin: EnemyState, projectile: ProjectileState, alreadyHit: Set<number>) {
    const candidates = this.snapshot.enemies
      .filter((enemy) => enemy.health > 0 && !alreadyHit.has(enemy.id) && distanceSquared(origin.x, origin.y, enemy.x, enemy.y) < 145 * 145)
      .sort((a, b) => distanceSquared(origin.x, origin.y, a.x, a.y) - distanceSquared(origin.x, origin.y, b.x, b.y))
      .slice(0, projectile.chain)
    for (const target of candidates) {
      alreadyHit.add(target.id)
      this.damageEnemy(target, projectile.damage * 0.52, projectile.ownerId)
      this.pushEvent('hit', target.x, target.y)
    }
  }

  private damageEnemy(enemy: EnemyState, amount: number, ownerId?: string) {
    if (enemy.health <= 0) return
    enemy.health -= amount
    const owner = this.snapshot.players.find((player) => player.id === ownerId)
    if (owner) owner.damageDealt += amount
    this.pushEvent('hit', enemy.x, enemy.y)
    if (enemy.health > 0) return

    if (owner) owner.kills += 1
    const value = enemy.type === 'tollkeeper' ? 120 : enemy.type === 'bulwark' && enemy.maxHealth > 500 ? 38 : enemy.type === 'bulwark' ? 9 : 4
    const pickup: PickupState = { id: this.entityId++, x: enemy.x, y: enemy.y, value }
    this.snapshot.pickups.push(pickup)

    if (enemy.type === 'tollkeeper') this.awakenSquad()
    const burnOwner = this.snapshot.players.find((player) => player.id === enemy.burnOwner)
    if (burnOwner?.character === 'cinder' && burnOwner.awakened) {
      for (const nearby of this.snapshot.enemies) {
        if (nearby.id !== enemy.id && nearby.health > 0 && distanceSquared(enemy.x, enemy.y, nearby.x, nearby.y) < 90 * 90) {
          this.damageEnemy(nearby, 32, burnOwner.id)
        }
      }
    }
  }

  private damagePlayer(player: PlayerState, amount: number) {
    if (player.invulnerable > 0 || player.downed || player.eliminated) return
    const bastion = this.snapshot.players.find((ally) => {
      if (ally.character !== 'bastion' || ally.downed || ally.eliminated) return false
      const range = ally.awakened ? 300 : 150
      return distanceSquared(player.x, player.y, ally.x, ally.y) < range * range
    })
    const finalDamage = amount * (bastion ? (bastion.awakened ? 0.68 : 0.82) : 1)
    player.health -= finalDamage
    player.invulnerable = 0.58
    this.pushEvent('hurt', player.x, player.y)
    if (player.health > 0) return
    player.health = 0
    player.downed = true
    player.downTimer = 15
    player.reviveProgress = 0
  }

  private updatePickups(dt: number) {
    for (const pickup of this.snapshot.pickups) {
      let collected = false
      for (const player of this.snapshot.players) {
        if (player.downed || player.eliminated) continue
        const magnet = 62 * Math.pow(1.45, player.perks['soul-magnet'] ?? 0)
        const distance = Math.sqrt(distanceSquared(pickup.x, pickup.y, player.x, player.y))
        if (distance < magnet * 2.4 && distance > 1) {
          const speed = 110 + (magnet * 2.4 - distance) * 2.2
          pickup.x += ((player.x - pickup.x) / distance) * speed * dt
          pickup.y += ((player.y - pickup.y) / distance) * speed * dt
        }
        if (distance < 22) {
          this.snapshot.xp += pickup.value
          pickup.value = 0
          collected = true
          break
        }
      }
      if (collected) pickup.value = 0
    }
    this.snapshot.pickups = this.snapshot.pickups.filter((pickup) => pickup.value > 0).slice(-260)
  }

  private handleRevives(dt: number, inputs: ReadonlyMap<string, InputState>) {
    for (const downed of this.snapshot.players.filter((player) => player.downed && !player.eliminated)) {
      const reviver = this.snapshot.players.find((player) => {
        const input = inputs.get(player.id) ?? EMPTY_INPUT
        return !player.downed && !player.eliminated && input.interact && distanceSquared(player.x, player.y, downed.x, downed.y) < 68 * 68
      })
      if (!reviver) {
        downed.reviveProgress = Math.max(0, downed.reviveProgress - dt * 0.35)
        continue
      }
      const speed = reviver.character === 'warden' ? 1.5 : 1
      downed.reviveProgress += dt * speed
      if (downed.reviveProgress >= 2.2) {
        downed.downed = false
        downed.health = downed.maxHealth * 0.5
        downed.downTimer = 15
        downed.reviveProgress = 0
        downed.invulnerable = 2
        this.pushEvent('revive', downed.x, downed.y, `${reviver.name.toUpperCase()} PULLED ${downed.name.toUpperCase()} BACK`)
      }
    }
  }

  private checkLevelUp() {
    if (this.snapshot.phase !== 'playing' || this.snapshot.xp < this.snapshot.xpToNext) return
    const eligible = UPGRADES.filter((upgrade) => (this.snapshot.players[0]?.perks[upgrade.id] ?? 0) < upgrade.maxLevel)
    const pool = eligible.length >= 3 ? eligible : UPGRADES
    const choices: string[] = []
    while (choices.length < 3 && choices.length < pool.length) {
      const id = this.random.pick(pool).id
      if (!choices.includes(id)) choices.push(id)
    }
    const activePlayers = this.snapshot.players.filter((player) => !player.eliminated)
    const chooser = activePlayers[(this.snapshot.level - 1) % Math.max(1, activePlayers.length)] ?? this.snapshot.players[0]
    this.snapshot.upgrade = { ids: choices, chooserId: chooser.id, expiresIn: 12 }
    this.snapshot.phase = 'upgrade'
    this.pushEvent('level', undefined, undefined, `${chooser.name.toUpperCase()} CHOOSES THE NEXT SQUAD PERK`)
  }

  private awakenSquad() {
    for (const player of this.snapshot.players) player.awakened = true
    this.pushEvent('awaken', undefined, undefined, 'THE TOME AWAKENS EVERY HUNTER')
  }

  private nearestLivingPlayer(x: number, y: number): PlayerState | undefined {
    return this.snapshot.players
      .filter((player) => !player.downed && !player.eliminated)
      .sort((a, b) => distanceSquared(x, y, a.x, a.y) - distanceSquared(x, y, b.x, b.y))[0]
  }

  private nearestEnemy(x: number, y: number, range: number): EnemyState | undefined {
    return this.snapshot.enemies
      .filter((enemy) => enemy.health > 0 && distanceSquared(x, y, enemy.x, enemy.y) <= range * range)
      .sort((a, b) => distanceSquared(x, y, a.x, a.y) - distanceSquared(x, y, b.x, b.y))[0]
  }

  private pushEvent(type: GameEvent['type'], x?: number, y?: number, text?: string) {
    this.snapshot.events.push({ id: this.eventId++, type, x, y, text })
  }
}
