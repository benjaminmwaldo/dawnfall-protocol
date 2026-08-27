import { describe, expect, it } from 'vitest'
import { CHARACTERS, PLAYABLE_CHARACTERS, UPGRADES, WEAPONS } from '../src/game/data'
import { bossWarningStrength, bossWeakPointIsOpen } from '../src/game/boss'
import { DIFFICULTIES } from '../src/game/difficulty'
import { GameEngine } from '../src/game/engine'
import { HALF_HEART_VALUE, HEAL_CRYSTAL_SECONDS, HEART_REGEN_SECONDS, HEART_VALUE } from '../src/game/health'
import { MAPS, mapById } from '../src/game/maps'
import { PERSONALITY_FACTS } from '../src/game/personality'
import { uprightSpriteTransform } from '../src/game/renderer'
import type { EnemyState, InputState, PlayerConfig } from '../src/game/types'

const player: PlayerConfig = {
  id: 'test-player', name: 'Tester', character: 'vesper', weapon: 'revolver', color: '#f2d479',
}
const idle: InputState = { up: false, down: false, left: false, right: false, firing: false, interact: false, special: false, aim: 0 }
const clearDraftInputDelay = (engine: GameEngine, inputs: ReadonlyMap<string, InputState>) => {
  for (let tick = 0; tick < 11; tick += 1) engine.step(0.05, inputs)
}

describe('GameEngine', () => {
  it('keeps the approved cast selectable while preserving retired character data', () => {
    expect(PLAYABLE_CHARACTERS.map((character) => character.id)).toEqual([
      'vesper', 'cinder', 'warden', 'nyx', 'tempest', 'briar', 'seraph',
    ])
    expect(CHARACTERS.map((character) => character.id)).toEqual([
      'vesper', 'cinder', 'bastion', 'warden', 'nyx', 'tempest', 'briar', 'seraph',
      'rapunsel', 'eira', 'mara', 'zahra',
    ])
  })

  it('supports four distinct synchronized threat levels', () => {
    expect(DIFFICULTIES.map((difficulty) => difficulty.id)).toEqual(['story', 'standard', 'nightmare', 'apocalypse'])
    const story = new GameEngine([player], 240, 88, 'gloamreach', 'story')
    const apocalypse = new GameEngine([player], 240, 88, 'gloamreach', 'apocalypse')
    for (let tick = 0; tick < 7; tick += 1) { story.step(0.05, new Map([[player.id, idle]])); apocalypse.step(0.05, new Map([[player.id, idle]])) }
    expect(story.snapshot.difficulty).toBe('story')
    expect(apocalypse.snapshot.difficulty).toBe('apocalypse')
    expect(apocalypse.snapshot.enemies[0].maxHealth).toBeGreaterThan(story.snapshot.enemies[0].maxHealth)
    expect(apocalypse.snapshot.enemies.length).toBeGreaterThanOrEqual(story.snapshot.enemies.length)
  })

  it('preserves partial analog movement for a mobile stick', () => {
    const engine = new GameEngine([player], 240, 89)
    engine.step(0.05, new Map([[player.id, { ...idle, moveX: 0.5, moveY: 0 }]]))
    expect(engine.snapshot.players[0].vx).toBeCloseTo(88)
    expect(engine.snapshot.players[0].vy).toBe(0)
  })

  it('opens boss weak points during readable pre-attack warnings', () => {
    const boss: EnemyState = { id: 7, type: 'graveknight', x: 0, y: 0, vx: 0, vy: 0, health: 100, maxHealth: 100, radius: 60, speed: 30, damage: 25, attackCooldown: 2, burn: 0, burnTick: 0.5, slow: 0, phase: 1, abilityCooldown: 0.7 }
    expect(bossWeakPointIsOpen(boss)).toBe(true)
    expect(bossWarningStrength(boss)).toBeGreaterThan(0)
    boss.abilityCooldown = 2
    expect(bossWeakPointIsOpen(boss)).toBe(false)
    expect(bossWarningStrength(boss)).toBe(0)
  })

  it('keeps every rare upgrade one-of-one with five signatures per hunter and two perks per armament', () => {
    expect(UPGRADES.every((upgrade) => upgrade.maxLevel === 1)).toBe(true)
    for (const character of CHARACTERS) {
      expect(UPGRADES.filter((upgrade) => upgrade.character === character.id)).toHaveLength(5)
    }
    for (const weapon of WEAPONS) {
      expect(UPGRADES.filter((upgrade) => upgrade.weapon === weapon.id)).toHaveLength(2)
    }
  })

  it('offers ten weapons with distinct firing signatures and special payloads', () => {
    expect(WEAPONS).toHaveLength(10)
    expect(new Set(WEAPONS.map((weapon) => weapon.id)).size).toBe(10)
    const signatures = WEAPONS.map((weapon) => [
      weapon.damage, weapon.fireRate, weapon.projectiles, weapon.magazine, weapon.speed, weapon.spread,
      weapon.pierce, weapon.chain, weapon.life, weapon.radius, weapon.blastRadius ?? 0,
      weapon.homing ?? 0, weapon.slowDuration ?? 0, Number(Boolean(weapon.alwaysBurn)),
      Number(Boolean(weapon.infiniteAmmo)), Number(Boolean(weapon.melee)),
    ].join(':'))
    expect(new Set(signatures).size).toBe(10)

    for (const weapon of WEAPONS) {
      const armedPlayer = { ...player, weapon: weapon.id }
      const engine = new GameEngine([armedPlayer], 240, 40 + weapon.magazine)
      engine.step(1 / 60, new Map([[player.id, { ...idle, firing: true }]]))
      expect(engine.snapshot.projectiles.filter((projectile) => projectile.ownerId === player.id)).toHaveLength(weapon.projectiles)
    }

    const burst = new GameEngine([{ ...player, weapon: 'burst-carbine' }], 240, 51)
    burst.step(1 / 60, new Map([[player.id, { ...idle, firing: true }]]))
    expect(burst.snapshot.projectiles).toHaveLength(3)

    const rail = new GameEngine([{ ...player, weapon: 'railgun' }], 240, 52)
    rail.step(1 / 60, new Map([[player.id, { ...idle, firing: true }]]))
    expect(rail.snapshot.projectiles[0].pierce).toBeGreaterThanOrEqual(5)

    const flame = new GameEngine([{ ...player, weapon: 'flamethrower' }], 240, 53)
    flame.step(1 / 60, new Map([[player.id, { ...idle, firing: true }]]))
    expect(flame.snapshot.projectiles.every((projectile) => projectile.burn && projectile.life < 0.4)).toBe(true)

    const frost = new GameEngine([{ ...player, weapon: 'frost-cannon' }], 240, 54)
    frost.step(1 / 60, new Map([[player.id, { ...idle, firing: true }]]))
    expect(frost.snapshot.projectiles[0].slowDuration).toBe(4)

    const seeker = new GameEngine([{ ...player, weapon: 'seeker' }], 240, 55)
    seeker.snapshot.enemies.push({
      id: 81_100, type: 'thrall', x: 180, y: 140, vx: 0, vy: 0, health: 500, maxHealth: 500,
      radius: 13, speed: 0, damage: 0, attackCooldown: 9, burn: 0, burnTick: 0.5, slow: 0, phase: 0,
    })
    seeker.step(0.05, new Map([[player.id, { ...idle, firing: true }]]))
    expect(seeker.snapshot.projectiles.every((projectile) => projectile.homing === 3.8 && projectile.vy > 0)).toBe(true)

    const sword = new GameEngine([{ ...player, weapon: 'sword' }], 240, 56)
    sword.step(0.05, new Map([[player.id, { ...idle, firing: true }]]))
    expect(sword.snapshot.players[0].ammo).toBe(1)
    expect(sword.snapshot.projectiles).toHaveLength(3)
    expect(sword.snapshot.projectiles.every((projectile) => projectile.melee && projectile.life < 0.3)).toBe(true)
  })

  it('turns weapon-specific perks into dramatic armament changes', () => {
    const revolver = new GameEngine([player], 240, 57)
    revolver.snapshot.players[0].perks['last-chamber'] = 1
    revolver.snapshot.players[0].ammo = 1
    revolver.step(0.05, new Map([[player.id, { ...idle, firing: true }]]))
    expect(revolver.snapshot.projectiles[0].damage).toBeGreaterThan(WEAPONS.find((weapon) => weapon.id === 'revolver')!.damage * 2)
    expect(revolver.snapshot.projectiles[0].pierce).toBeGreaterThanOrEqual(2)

    const grenade = new GameEngine([{ ...player, weapon: 'grenade-launcher' }], 240, 58)
    grenade.snapshot.players[0].perks['cluster-heaven'] = 1
    grenade.snapshot.players[0].perks['black-powder-sun'] = 1
    grenade.step(0.05, new Map([[player.id, { ...idle, firing: true }]]))
    expect(grenade.snapshot.projectiles[0].blastRadius).toBe(190)
    expect(grenade.snapshot.projectiles[0].blastDamage).toBeGreaterThanOrEqual(64)

    const sword = new GameEngine([{ ...player, weapon: 'sword' }], 240, 59)
    sword.snapshot.players[0].perks['whirling-dawn'] = 1
    sword.step(0.05, new Map([[player.id, { ...idle, firing: true }]]))
    expect(sword.snapshot.projectiles).toHaveLength(9)
    const directions = new Set(sword.snapshot.projectiles.map((projectile) => Math.round(Math.atan2(projectile.vy, projectile.vx) * 100)))
    expect(directions.size).toBe(9)
  })

  it('detonates Starfall shells across clustered enemies', () => {
    const engine = new GameEngine([{ ...player, weapon: 'grenade-launcher' }], 240, 61)
    engine.snapshot.enemies.push(
      { id: 82_001, type: 'thrall', x: 150, y: 0, vx: 0, vy: 0, health: 500, maxHealth: 500, radius: 13, speed: 0, damage: 0, attackCooldown: 9, burn: 0, burnTick: 0.5, slow: 0, phase: 0 },
      { id: 82_002, type: 'thrall', x: 220, y: 0, vx: 0, vy: 0, health: 500, maxHealth: 500, radius: 13, speed: 0, damage: 0, attackCooldown: 9, burn: 0, burnTick: 0.5, slow: 0, phase: 0 },
    )
    engine.step(0.05, new Map([[player.id, { ...idle, firing: true }]]))
    for (let tick = 0; tick < 8; tick += 1) engine.step(0.05, new Map([[player.id, idle]]))
    expect(engine.snapshot.enemies.find((enemy) => enemy.id === 82_001)!.health).toBeLessThan(500)
    expect(engine.snapshot.enemies.find((enemy) => enemy.id === 82_002)!.health).toBeLessThan(500)
  })

  it('repeats the same combat state from the same seed and inputs', () => {
    const first = new GameEngine([player], 240, 4242)
    const second = new GameEngine([player], 240, 4242)
    const inputs = new Map([[player.id, idle]])
    for (let step = 0; step < 220; step += 1) {
      first.step(1 / 60, inputs)
      second.step(1 / 60, inputs)
    }
    expect(first.snapshot.enemies.length).toBeGreaterThan(0)
    expect(first.snapshot.enemies.map(({ type, x, y }) => [type, x, y]))
      .toEqual(second.snapshot.enemies.map(({ type, x, y }) => [type, x, y]))
  })

  it('uses active fire, ammunition, and reload state', () => {
    const engine = new GameEngine([player], 240, 7)
    const firing = { ...idle, firing: true }
    engine.step(1 / 60, new Map([[player.id, firing]]))
    expect(engine.snapshot.players[0].ammo).toBe(5)
    expect(engine.snapshot.projectiles.length).toBe(1)
    expect(Math.hypot(engine.snapshot.projectiles[0].vx, engine.snapshot.projectiles[0].vy)).toBeLessThan(700)
    expect(engine.snapshot.projectiles[0].radius).toBeGreaterThan(4)
    for (let shot = 0; shot < 400; shot += 1) engine.step(1 / 60, new Map([[player.id, firing]]))
    expect(engine.snapshot.players[0].ammo).toBeLessThanOrEqual(engine.snapshot.players[0].maxAmmo)
  })

  it('levels the squad together after every active hunter locks a personal upgrade', () => {
    const ally = { ...player, id: 'ally', name: 'Ally', character: 'warden' as const, color: '#74d8c2' }
    const engine = new GameEngine([player, ally], 240, 99)
    for (const squadmate of engine.snapshot.players) squadmate.xp = squadmate.xpToNext
    engine.step(1 / 60, new Map([[player.id, idle], [ally.id, idle]]))
    expect(engine.snapshot.phase).toBe('upgrade')
    const draft = engine.snapshot.upgrade
    expect(draft?.offers).toHaveLength(2)
    expect(draft?.offers.every((offer) => offer.ids.length === 3)).toBe(true)
    const playerOffer = draft!.offers.find((offer) => offer.chooserId === player.id)!
    const allyOffer = draft!.offers.find((offer) => offer.chooserId === ally.id)!
    expect(engine.chooseUpgrade(playerOffer.ids[0], player.id)).toBe(false)
    clearDraftInputDelay(engine, new Map([[player.id, idle], [ally.id, idle]]))
    expect(engine.chooseUpgrade(playerOffer.ids[0], player.id)).toBe(true)
    expect(engine.snapshot.phase).toBe('upgrade')
    expect(engine.snapshot.players.every((squadmate) => squadmate.level === 1)).toBe(true)
    expect(engine.chooseUpgrade(allyOffer.ids[0], ally.id)).toBe(true)
    expect(engine.snapshot.phase).toBe('playing')
    expect(engine.snapshot.players[0].perks[playerOffer.ids[0]]).toBe(1)
    expect(engine.snapshot.players[1].perks[allyOffer.ids[0]]).toBe(1)
    expect(engine.snapshot.players.every((squadmate) => squadmate.level === 2)).toBe(true)
    expect(engine.snapshot.players[0].xp).toBe(engine.snapshot.players[1].xp)
  })

  it('starts with a slower shared upgrade cadence that scales with party size', () => {
    const solo = new GameEngine([player], 240, 11)
    const ally = { ...player, id: 'ally', name: 'Ally', character: 'warden' as const }
    const duo = new GameEngine([player, ally], 240, 11)
    expect(solo.snapshot.players[0].xpToNext).toBeGreaterThanOrEqual(115)
    expect(duo.snapshot.players[0].xpToNext).toBeGreaterThan(solo.snapshot.players[0].xpToNext)
    expect(duo.snapshot.players[0].xpToNext).toBe(duo.snapshot.players[1].xpToNext)
  })

  it('adds every collected soul shard to the whole squad XP track', () => {
    const ally = { ...player, id: 'ally', name: 'Ally', character: 'warden' as const }
    const engine = new GameEngine([player, ally], 240, 12)
    engine.snapshot.pickups.push({
      id: 90_001,
      x: engine.snapshot.players[0].x,
      y: engine.snapshot.players[0].y,
      value: 10,
    })
    engine.step(1 / 60, new Map([[player.id, idle], [ally.id, idle]]))
    expect(engine.snapshot.players[0].xp).toBe(10)
    expect(engine.snapshot.players[1].xp).toBe(10)
  })

  it('auto-locks every remaining squad choice when the draft timer expires', () => {
    const ally = { ...player, id: 'ally', name: 'Ally', character: 'warden' as const }
    const engine = new GameEngine([player, ally], 240, 15)
    for (const squadmate of engine.snapshot.players) squadmate.xp = squadmate.xpToNext
    engine.step(1 / 60, new Map([[player.id, idle], [ally.id, idle]]))
    for (let tick = 0; tick < 410; tick += 1) engine.step(0.05, new Map([[player.id, idle], [ally.id, idle]]))
    expect(engine.snapshot.phase).toBe('playing')
    expect(engine.snapshot.players.every((squadmate) => squadmate.level === 2)).toBe(true)
    expect(engine.snapshot.players.every((squadmate) => Object.keys(squadmate.perks).length === 1)).toBe(true)
  })

  it('always offers at least one signature upgrade for that hunter while available', () => {
    const engine = new GameEngine([{ ...player, character: 'tempest' }], 240, 101)
    engine.snapshot.players[0].xp = engine.snapshot.players[0].xpToNext
    engine.step(1 / 60, new Map([[player.id, idle]]))
    const signatureIds = new Set(['stormchain', 'thunderhead', 'charged-mag', 'ball-lightning', 'storm-wisp'])
    expect(engine.snapshot.upgrade?.offers[0].ids.some((id) => signatureIds.has(id))).toBe(true)
  })

  it('never offers ally-dependent upgrades to a solo hunter', () => {
    const engine = new GameEngine([{ ...player, character: 'warden' }], 240, 103)
    const forbidden = new Set(['sanctuary', 'merciful-hand', 'last-rite'])
    for (let level = 0; level < 3; level += 1) {
      engine.snapshot.players[0].xp = engine.snapshot.players[0].xpToNext
      engine.step(0.05, new Map([[player.id, idle]]))
      expect(engine.snapshot.upgrade?.offers[0].ids.some((id) => forbidden.has(id))).toBe(false)
      const offered = engine.snapshot.upgrade!.offers[0].ids[0]
      clearDraftInputDelay(engine, new Map([[player.id, idle]]))
      engine.chooseUpgrade(offered, player.id)
    }
  })

  it('drafts one character perk, one current-weapon perk, and one common power', () => {
    const engine = new GameEngine([{ ...player, character: 'tempest', weapon: 'arc-rifle' }], 240, 102)
    engine.snapshot.players[0].xp = engine.snapshot.players[0].xpToNext
    engine.step(1 / 60, new Map([[player.id, idle]]))
    const choices = engine.snapshot.upgrade!.offers[0].ids.map((id) => UPGRADES.find((upgrade) => upgrade.id === id)!)
    expect(choices.map((upgrade) => upgrade.category).sort()).toEqual(['common', 'signature', 'weapon'])
    expect(choices.find((upgrade) => upgrade.category === 'signature')?.character).toBe('tempest')
    expect(choices.find((upgrade) => upgrade.category === 'weapon')?.weapon).toBe('arc-rifle')
  })

  it('gives every hunter three personal rerolls without changing the other draft', () => {
    const ally = { ...player, id: 'ally', name: 'Ally', character: 'warden' as const }
    const engine = new GameEngine([player, ally], 240, 202)
    for (const squadmate of engine.snapshot.players) squadmate.xp = squadmate.xpToNext
    engine.step(1 / 60, new Map([[player.id, idle], [ally.id, idle]]))
    const playerOffer = engine.snapshot.upgrade!.offers.find((offer) => offer.chooserId === player.id)!
    const allyOffer = engine.snapshot.upgrade!.offers.find((offer) => offer.chooserId === ally.id)!
    const allyChoices = [...allyOffer.ids]
    expect(engine.rerollUpgrade(player.id)).toBe(false)
    clearDraftInputDelay(engine, new Map([[player.id, idle], [ally.id, idle]]))
    for (let reroll = 2; reroll >= 0; reroll -= 1) {
      const previousChoices = [...playerOffer.ids]
      expect(engine.rerollUpgrade(player.id)).toBe(true)
      expect(playerOffer.ids).toHaveLength(3)
      expect(playerOffer.ids.some((id) => previousChoices.includes(id))).toBe(false)
      expect(playerOffer.rerollsLeft).toBe(reroll)
      expect(allyOffer.ids).toEqual(allyChoices)
    }
    expect(engine.rerollUpgrade(player.id)).toBe(false)
  })

  it('turns a companion upgrade into an attacking persistent pet', () => {
    const engine = new GameEngine([player], 240, 303)
    engine.snapshot.phase = 'upgrade'
    engine.snapshot.upgrade = { level: 1, expiresIn: 20, acceptsInputIn: 0, offers: [{ chooserId: player.id, ids: ['gravewing', 'quick-hands', 'fleetfoot'], rerollsLeft: 3 }] }
    expect(engine.chooseUpgrade('gravewing', player.id)).toBe(true)
    expect(engine.snapshot.companions).toHaveLength(1)
    expect(engine.snapshot.companions[0]).toMatchObject({ ownerId: player.id, kind: 'gravewing' })
    engine.snapshot.enemies.push({
      id: 99_001, type: 'thrall', x: 180, y: 0, vx: 0, vy: 0, health: 300, maxHealth: 300,
      radius: 13, speed: 0, damage: 0, attackCooldown: 9, burn: 0, burnTick: 0.5, slow: 0, phase: 0,
    })
    for (let tick = 0; tick < 30; tick += 1) engine.step(0.05, new Map([[player.id, idle]]))
    expect(engine.snapshot.players[0].damageDealt).toBeGreaterThan(0)
  })

  it('fires slower, readable enemy projectiles', () => {
    const engine = new GameEngine([player], 240, 313)
    engine.snapshot.enemies.push({
      id: 9001, type: 'spitter', x: 200, y: 0, vx: 0, vy: 0, health: 100, maxHealth: 100,
      radius: 15, speed: 48, damage: 10, attackCooldown: 0, burn: 0, burnTick: 0.5, slow: 0, phase: 0,
    })
    engine.step(1 / 60, new Map([[player.id, idle]]))
    const hostile = engine.snapshot.projectiles.find((projectile) => projectile.enemy)
    expect(hostile).toBeDefined()
    expect(Math.hypot(hostile!.vx, hostile!.vy)).toBeLessThanOrEqual(155)
    expect(hostile!.radius).toBeGreaterThan(6)
  })

  it('keeps post-hit immunity brief even with Kinetic Shell', () => {
    const engine = new GameEngine([player], 240, 317)
    const target = engine.snapshot.players[0]
    let projectileId = 81_000
    const dealHit = () => {
      engine.snapshot.projectiles.push({
        id: projectileId++, ownerId: 'enemy-test', x: target.x, y: target.y, vx: 0, vy: 0,
        radius: 8, damage: 10, life: 1, pierce: 0, bounces: 0, enemy: true,
        chain: 0, burn: false, color: '#ef718e',
      })
      engine.step(0, new Map([[player.id, idle]]))
    }

    dealHit()
    expect(target.health).toBe(112.5)
    expect(target.invulnerable).toBeCloseTo(0.42)
    dealHit()
    expect(target.health).toBe(112.5)

    target.invulnerable = 0
    target.perks['kinetic-shell'] = 1
    dealHit()
    expect(target.health).toBe(100)
    expect(target.invulnerable).toBeCloseTo(0.7)
  })

  it('starts every hunter with five hearts plus Bastion’s sixth-heart identity', () => {
    for (const character of CHARACTERS) {
      const engine = new GameEngine([{ ...player, character: character.id }], 240, 320)
      const hunter = engine.snapshot.players[0]
      expect(hunter.maxHealth / HEART_VALUE).toBe(character.id === 'bastion' ? 6 : 5)
      expect(hunter.health).toBe(hunter.maxHealth)
    }
  })

  it('turns maximum-health powers into whole-heart upgrades', () => {
    const engine = new GameEngine([player], 240, 321)
    const hunter = engine.snapshot.players[0]
    hunter.health -= HEART_VALUE
    engine.snapshot.phase = 'upgrade'
    engine.snapshot.upgrade = { level: 1, expiresIn: 20, acceptsInputIn: 0, offers: [{ chooserId: player.id, ids: ['vitality'], rerollsLeft: 3 }] }
    expect(engine.chooseUpgrade('vitality', player.id)).toBe(true)
    expect(hunter.maxHealth).toBe(HEART_VALUE * 6)
    expect(hunter.health).toBe(HEART_VALUE * 5)
  })

  it('fires Rapsy’s circular hair slash from the shared ability input', () => {
    const engine = new GameEngine([{ ...player, character: 'rapunsel' }], 240, 1_207)
    const hunter = engine.snapshot.players[0]
    engine.snapshot.enemies.push({
      id: 91_207, type: 'bulwark', x: hunter.x + 80, y: hunter.y, vx: 0, vy: 0,
      health: 500, maxHealth: 500, radius: 23, speed: 0, damage: 0, attackCooldown: 9,
      burn: 0, burnTick: 0.5, slow: 0, phase: 0,
    })
    engine.step(0.05, new Map([[player.id, { ...idle, special: true }]]))
    expect(engine.snapshot.enemies[0].health).toBeLessThan(500)
    expect(hunter.specialCooldown).toBeGreaterThan(7)
    expect(hunter.specialPulse).toBeGreaterThan(0)
  })

  it('keeps kill-based lifesteal to small fractions of a heart', () => {
    const engine = new GameEngine([{ ...player, character: 'briar', weapon: 'sword' }], 240, 1_208)
    const hunter = engine.snapshot.players[0]
    hunter.health = HEART_VALUE * 2
    hunter.perks.bloodbloom = 1
    hunter.perks['blood-edge'] = 1
    const target = {
      id: 91_208, type: 'thrall' as const, x: 80, y: 0, vx: 0, vy: 0,
      health: 1, maxHealth: 1, radius: 13, speed: 0, damage: 0, attackCooldown: 9,
      burn: 0, burnTick: 0.5, slow: 0, phase: 0,
    }
    engine.snapshot.enemies.push(target)
    const healthBefore = hunter.health
    ;(engine as unknown as { damageEnemy(enemy: typeof target, amount: number, ownerId: string): void }).damageEnemy(target, 2, hunter.id)
    expect(hunter.health - healthBefore).toBeGreaterThan(0)
    expect(hunter.health - healthBefore).toBeLessThan(1)
  })

  it('keeps common Combustion eruptions modest', () => {
    const engine = new GameEngine([player], 240, 1_209)
    const hunter = engine.snapshot.players[0]
    hunter.perks.combustion = 1
    const burning = {
      id: 91_209, type: 'thrall' as const, x: 80, y: 0, vx: 0, vy: 0,
      health: 1, maxHealth: 1, radius: 13, speed: 0, damage: 0, attackCooldown: 9,
      burn: 1, burnTick: 0.5, burnOwner: hunter.id, slow: 0, phase: 0,
    }
    const nearby = { ...burning, id: 91_210, x: 120, health: 100, maxHealth: 100, burnOwner: undefined }
    engine.snapshot.enemies.push(burning, nearby)
    ;(engine as unknown as { damageEnemy(enemy: typeof burning, amount: number, ownerId: string): void }).damageEnemy(burning, 2, hunter.id)
    expect(nearby.health).toBe(84)
  })

  it('regenerates one personal heart every minute', () => {
    const engine = new GameEngine([player], 240, 322)
    const hunter = engine.snapshot.players[0]
    hunter.health -= HEART_VALUE
    hunter.heartRegen = HEART_REGEN_SECONDS - 0.02
    engine.step(0.05, new Map([[player.id, idle]]))
    expect(hunter.health).toBe(hunter.maxHealth)
    expect(hunter.heartRegen).toBeLessThan(0.1)
  })

  it('charges a one-heart crystal for a minute and only spends it on a wounded hunter', () => {
    const engine = new GameEngine([player], 240, 323)
    const hunter = engine.snapshot.players[0]
    const station = engine.snapshot.structures.find((structure) => structure.effect === 'heal')!
    hunter.x = station.x
    hunter.y = station.y
    hunter.health -= HEART_VALUE
    station.crystalCharge = HEAL_CRYSTAL_SECONDS / 2
    engine.step(0.05, new Map([[player.id, idle]]))
    expect(hunter.health).toBe(hunter.maxHealth - HEART_VALUE)
    expect(station.crystalReady).toBe(false)

    station.crystalCharge = HEAL_CRYSTAL_SECONDS - 0.02
    engine.step(0.05, new Map([[player.id, idle]]))
    expect(hunter.health).toBe(hunter.maxHealth)
    expect(station.crystalReady).toBe(false)
    expect(station.crystalCharge).toBe(0)
  })

  it('keeps all hostile damage in readable half-heart units', () => {
    const engine = new GameEngine([player], 240, 324)
    engine.snapshot.enemies.push({
      id: 90_324, type: 'spitter', x: 200, y: 0, vx: 0, vy: 0, health: 100, maxHealth: 100,
      radius: 15, speed: 0, damage: HALF_HEART_VALUE, attackCooldown: 0, burn: 0, burnTick: 0.5, slow: 0, phase: 0,
    })
    engine.step(0.05, new Map([[player.id, idle]]))
    const hostile = engine.snapshot.projectiles.find((projectile) => projectile.enemy)!
    expect(hostile.damage).toBe(HALF_HEART_VALUE)
    expect(hostile.damage % HALF_HEART_VALUE).toBe(0)
  })

  it('makes multiplayer denser and punishes hunters who abandon formation', () => {
    const ally = { ...player, id: 'ally', name: 'Ally', character: 'warden' as const }
    const solo = new GameEngine([player], 240, 325)
    const duo = new GameEngine([player, ally], 240, 325)
    const soloInputs = new Map([[player.id, idle]])
    const duoInputs = new Map([[player.id, idle], [ally.id, idle]])
    for (let tick = 0; tick < 50; tick += 1) {
      solo.step(0.05, soloInputs)
      duo.step(0.05, duoInputs)
    }
    expect(duo.snapshot.enemies.length).toBeGreaterThan(solo.snapshot.enemies.length)

    const isolated = duo.snapshot.players[0]
    const teammate = duo.snapshot.players[1]
    isolated.x = -500
    teammate.x = 500
    isolated.isolatedFor = 3
    const before = isolated.health
    duo.snapshot.projectiles.push({
      id: 90_325, ownerId: 'enemy-test', x: isolated.x, y: isolated.y, vx: 0, vy: 0,
      radius: 8, damage: HALF_HEART_VALUE, life: 1, pierce: 0, bounces: 0, enemy: true,
      chain: 0, burn: false, color: '#ef718e',
    })
    duo.step(0, duoInputs)
    expect(before - isolated.health).toBe(HEART_VALUE)
  })

  it('skips unwinnable solo bleedout but grants multiplayer a long rescue window', () => {
    const solo = new GameEngine([player], 240, 326)
    const soloHunter = solo.snapshot.players[0]
    soloHunter.health = HALF_HEART_VALUE
    solo.snapshot.projectiles.push({
      id: 90_326, ownerId: 'enemy-test', x: soloHunter.x, y: soloHunter.y, vx: 0, vy: 0,
      radius: 8, damage: HALF_HEART_VALUE, life: 1, pierce: 0, bounces: 0, enemy: true,
      chain: 0, burn: false, color: '#ef718e',
    })
    solo.step(0, new Map([[player.id, idle]]))
    expect(soloHunter.eliminated).toBe(true)
    expect(soloHunter.downed).toBe(false)
    expect(solo.snapshot.phase).toBe('defeat')

    const ally = { ...player, id: 'ally', name: 'Ally', character: 'warden' as const }
    const duo = new GameEngine([player, ally], 240, 327)
    const downed = duo.snapshot.players[0]
    duo.snapshot.players[1].x = 500
    downed.health = HALF_HEART_VALUE
    duo.snapshot.projectiles.push({
      id: 90_327, ownerId: 'enemy-test', x: downed.x, y: downed.y, vx: 0, vy: 0,
      radius: 8, damage: HALF_HEART_VALUE, life: 1, pierce: 0, bounces: 0, enemy: true,
      chain: 0, burn: false, color: '#ef718e',
    })
    duo.step(0, new Map([[player.id, idle], [ally.id, idle]]))
    expect(downed.downed).toBe(true)
    expect(downed.eliminated).toBe(false)
    expect(downed.downTimer).toBe(24)
  })

  it('ships fifty rotating personality details for every hunter', () => {
    for (const character of CHARACTERS) {
      expect(PERSONALITY_FACTS[character.id]).toHaveLength(50)
      expect(new Set(PERSONALITY_FACTS[character.id]).size).toBe(50)
      expect(PERSONALITY_FACTS[character.id].every((fact) => /^I(?:\b|['’])/.test(fact))).toBe(true)
    }
    const scarletCivicFacts = PERSONALITY_FACTS.cinder.filter((fact) => /climate|human-rights|protest|march|mutual-aid|vote|justice|community|refugee/i.test(fact)).length
    expect(scarletCivicFacts).toBeGreaterThanOrEqual(4)
    expect(scarletCivicFacts).toBeLessThan(15)
    expect(PERSONALITY_FACTS.cinder.some((fact) => /single|dating/i.test(fact))).toBe(true)
    expect(PERSONALITY_FACTS.cinder.some((fact) => /dad/i.test(fact))).toBe(true)
  })

  it('spawns every ambient enemy beyond every living player viewport', () => {
    const ally = { ...player, id: 'ally', name: 'Ally', character: 'warden' as const }
    const engine = new GameEngine([player, ally], 240, 414)
    engine.snapshot.players[0].x = -420
    engine.snapshot.players[0].y = 180
    engine.snapshot.players[1].x = 510
    engine.snapshot.players[1].y = -160
    const viewports = new Map<string, InputState>([
      [player.id, { ...idle, viewportWidth: 1600, viewportHeight: 900 }],
      [ally.id, { ...idle, viewportWidth: 1280, viewportHeight: 720 }],
    ])
    for (let tick = 0; tick < 6; tick += 1) engine.step(0.05, viewports)
    expect(engine.snapshot.enemies.length).toBeGreaterThan(0)
    for (const enemy of engine.snapshot.enemies) {
      for (const hunter of engine.snapshot.players) {
        const viewport = viewports.get(hunter.id)!
        const beyondHorizontalEdge = Math.abs(enemy.x - hunter.x) > viewport.viewportWidth! / 2
        const beyondVerticalEdge = Math.abs(enemy.y - hunter.y) > viewport.viewportHeight! / 2
        expect(beyondHorizontalEdge || beyondVerticalEdge).toBe(true)
      }
    }
  })

  it('gives all eight bosses distinct barrages, movement powers, and reinforcement patterns', () => {
    const patterns = [
      { type: 'tollkeeper' as const, hostileShots: 15, adds: 3, dashes: true },
      { type: 'broodmother' as const, hostileShots: 10, adds: 7, dashes: true },
      { type: 'graveknight' as const, hostileShots: 12, adds: 3, dashes: true },
      { type: 'eclipse-eye' as const, hostileShots: 21, adds: 4, dashes: true },
      { type: 'void-hart' as const, hostileShots: 15, adds: 3, dashes: true },
      { type: 'prism-witch' as const, hostileShots: 27, adds: 4, dashes: false },
      { type: 'iron-choir' as const, hostileShots: 36, adds: 5, dashes: false },
      { type: 'star-eater' as const, hostileShots: 60, adds: 4, dashes: false },
    ]
    for (const pattern of patterns) {
      const engine = new GameEngine([player], 240, 500 + pattern.hostileShots)
      engine.snapshot.enemies.push({
        id: 90_000, type: pattern.type, x: 300, y: 0, vx: 0, vy: 0, health: 5_000, maxHealth: 5_000,
        radius: 60, speed: 40, damage: 20, attackCooldown: 0, abilityCooldown: 0, summonCooldown: 0,
        contactCooldown: 0, dashRemaining: 0, dashAngle: 0, strafeDirection: 1,
        burn: 0, burnTick: 0.5, slow: 0, phase: 0,
      })
      engine.step(0.05, new Map([[player.id, { ...idle, viewportWidth: 1280, viewportHeight: 720 }]]))
      const boss = engine.snapshot.enemies.find((enemy) => enemy.type === pattern.type)!
      if (pattern.dashes) expect(boss.dashRemaining).toBeGreaterThan(0)
      expect(engine.snapshot.projectiles.filter((projectile) => projectile.enemy)).toHaveLength(pattern.hostileShots)
      expect(engine.snapshot.enemies.filter((enemy) => enemy.id !== boss.id)).toHaveLength(pattern.adds)
    }
  })

  it('schedules seven pre-finale bosses and turns each kill into a squad relic', () => {
    const engine = new GameEngine([player], 240, 707)
    const milestones = [0.125, 0.245, 0.365, 0.485, 0.605, 0.715, 0.815]
    const expectedBosses = ['void-hart', 'tollkeeper', 'prism-witch', 'broodmother', 'iron-choir', 'graveknight', 'star-eater']
    for (let index = 0; index < milestones.length; index += 1) {
      engine.snapshot.timeRemaining = engine.snapshot.duration * (1 - milestones[index])
      engine.step(1 / 60, new Map([[player.id, idle]]))
      const boss = engine.snapshot.enemies.find((enemy) => enemy.type === expectedBosses[index])
      expect(boss).toBeDefined()
      engine.snapshot.projectiles.push({
        id: 50_000 + index, ownerId: player.id, x: boss!.x, y: boss!.y, vx: 0, vy: 0,
        radius: 100, damage: 1_000_000, life: 1, pierce: 0, bounces: 0, enemy: false,
        chain: 0, burn: false, color: '#fff',
      })
      engine.step(1 / 60, new Map([[player.id, idle]]))
      engine.step(1 / 60, new Map([[player.id, idle]]))
      expect(engine.snapshot.enemies.some((enemy) => enemy.type === expectedBosses[index])).toBe(false)
    }
    expect(Object.keys(engine.snapshot.teamBuffs)).toHaveLength(7)
    expect(engine.snapshot.players[0].awakened).toBe(true)
  })

  it('forces an empowered three-boss finale and continues into overtime until all three die', () => {
    const engine = new GameEngine([player], 240, 909)
    const viewportInput = { ...idle, viewportWidth: 1280, viewportHeight: 720 }
    engine.snapshot.timeRemaining = engine.snapshot.duration * 0.12
    engine.step(0.05, new Map([[player.id, viewportInput]]))

    const finale = engine.snapshot.enemies.filter((enemy) => enemy.finale)
    expect(engine.snapshot.timeRemaining).toBeGreaterThan(0)
    expect(finale.map((enemy) => enemy.type).sort()).toEqual(['broodmother', 'eclipse-eye', 'graveknight'])
    expect(finale.reduce((total, enemy) => total + enemy.maxHealth, 0)).toBeGreaterThan(30_000)

    engine.snapshot.timeRemaining = 0.01
    engine.step(0.05, new Map([[player.id, viewportInput]]))
    expect(engine.snapshot.timeRemaining).toBeLessThan(0)
    expect(engine.snapshot.phase).toBe('playing')

    for (const boss of finale) boss.health = 0
    engine.step(0, new Map([[player.id, viewportInput]]))
    expect(engine.snapshot.phase).toBe('victory')
  })

  it('keeps the hunt running for surviving allies after one player is eliminated', () => {
    const ally = { ...player, id: 'ally', name: 'Ally', character: 'seraph' as const, color: '#ffd783' }
    const engine = new GameEngine([player, ally], 240, 808)
    engine.snapshot.players[0].eliminated = true
    engine.snapshot.players[0].health = 0
    engine.step(1 / 60, new Map([[ally.id, idle]]))
    expect(engine.snapshot.phase).toBe('playing')
    expect(engine.snapshot.players[1].eliminated).toBe(false)
  })

  it('ships three battlefields with distinct terrain and structure sets', () => {
    expect(MAPS).toHaveLength(3)
    expect(new Set(MAPS.map((map) => map.textureIndex)).size).toBe(3)
    expect(new Set(MAPS.map((map) => map.structures.map((structure) => structure.type).join('|'))).size).toBe(3)
    expect(mapById('reliquary').walls.length).toBeGreaterThanOrEqual(20)
    for (const map of MAPS) expect(map.structures.map((structure) => structure.effect).sort()).toEqual(['haste', 'heal', 'turret'])
  })

  it('stops hunters at Reliquary walls instead of letting them phase through', () => {
    const engine = new GameEngine([player], 240, 1_111, 'reliquary')
    const hunter = engine.snapshot.players[0]
    hunter.x = -540
    hunter.y = -200
    const movingRight = { ...idle, right: true }
    for (let tick = 0; tick < 30; tick += 1) engine.step(0.05, new Map([[player.id, movingRight]]))
    expect(hunter.x).toBeLessThanOrEqual(-497)
    expect(hunter.y).toBeCloseTo(-200)
  })

  it('routes monsters through dungeon doors without intersecting solid masonry', () => {
    const engine = new GameEngine([player], 240, 1_112, 'reliquary')
    const hunter = engine.snapshot.players[0]
    hunter.x = 0
    hunter.y = 650
    engine.snapshot.enemies.push({
      id: 92_000, type: 'thrall', x: -900, y: -650, vx: 0, vy: 0, health: 500, maxHealth: 500,
      radius: 13, speed: 210, damage: 0, attackCooldown: 9, burn: 0, burnTick: 0.5, slow: 0, phase: 0,
    })
    const walls = mapById('reliquary').walls
    const intersectsWall = (x: number, y: number, radius: number) => walls.some((wall) => {
      const closestX = Math.max(wall.x - wall.width / 2, Math.min(x, wall.x + wall.width / 2))
      const closestY = Math.max(wall.y - wall.height / 2, Math.min(y, wall.y + wall.height / 2))
      return Math.pow(x - closestX, 2) + Math.pow(y - closestY, 2) < radius * radius
    })
    for (let tick = 0; tick < 180; tick += 1) {
      engine.step(0.05, new Map([[player.id, idle]]))
      const monster = engine.snapshot.enemies.find((enemy) => enemy.id === 92_000)
      if (!monster) break
      expect(intersectsWall(monster.x, monster.y, monster.radius)).toBe(false)
    }
    const monster = engine.snapshot.enemies.find((enemy) => enemy.id === 92_000)
    expect(monster).toBeDefined()
    expect(monster!.x).toBeGreaterThan(-700)
  })

  it('lets dungeon walls absorb gunfire', () => {
    const engine = new GameEngine([player], 240, 1_113, 'reliquary')
    const hunter = engine.snapshot.players[0]
    hunter.x = -540
    hunter.y = -200
    hunter.aim = 0
    engine.step(0.05, new Map([[player.id, { ...idle, firing: true, aim: 0 }]]))
    expect(engine.snapshot.projectiles).toHaveLength(0)

    const openField = new GameEngine([player], 240, 1_113, 'gloamreach')
    openField.step(0.05, new Map([[player.id, { ...idle, firing: true, aim: 0 }]]))
    expect(openField.snapshot.projectiles).toHaveLength(1)
  })
})

describe('top-down sprite rotation', () => {
  it.each([
    ['east', 0, 0, false],
    ['south', Math.PI / 2, Math.PI / 2, false],
    ['west', Math.PI, 0, true],
    ['north', -Math.PI / 2, -Math.PI / 2, false],
    ['northwest', -Math.PI * 0.75, Math.PI * 0.25, true],
    ['southwest', Math.PI * 0.75, -Math.PI * 0.25, true],
  ])('keeps an east-facing atlas sprite upright while aiming %s', (_label, direction, expectedRotation, expectedFlip) => {
    const transform = uprightSpriteTransform(direction)
    expect(transform.rotation).toBeCloseTo(expectedRotation)
    expect(transform.flipX).toBe(expectedFlip)
  })

  it('preserves arbitrary analog aim angles without snapping', () => {
    const transform = uprightSpriteTransform(0.731)
    expect(transform.rotation).toBeCloseTo(0.731)
    expect(transform.flipX).toBe(false)
  })
})
