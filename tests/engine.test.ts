import { describe, expect, it } from 'vitest'
import { GameEngine } from '../src/game/engine'
import { uprightSpriteTransform } from '../src/game/renderer'
import type { InputState, PlayerConfig } from '../src/game/types'

const player: PlayerConfig = {
  id: 'test-player', name: 'Tester', character: 'vesper', weapon: 'revolver', color: '#f2d479',
}
const idle: InputState = { up: false, down: false, left: false, right: false, firing: false, interact: false, aim: 0 }

describe('GameEngine', () => {
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
    expect(solo.snapshot.players[0].xpToNext).toBeGreaterThanOrEqual(75)
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
    const signatureIds = new Set(['stormchain', 'thunderhead', 'charged-mag', 'ball-lightning'])
    expect(engine.snapshot.upgrade?.offers[0].ids.some((id) => signatureIds.has(id))).toBe(true)
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
    expect(Math.hypot(hostile!.vx, hostile!.vy)).toBeLessThanOrEqual(185)
  })

  it('schedules four distinct bosses and turns each kill into a squad relic', () => {
    const engine = new GameEngine([player], 240, 707)
    const milestones = [0.25, 0.49, 0.72, 0.9]
    const expectedBosses = ['tollkeeper', 'broodmother', 'graveknight', 'eclipse-eye']
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
    expect(Object.keys(engine.snapshot.teamBuffs)).toHaveLength(4)
    expect(engine.snapshot.players[0].awakened).toBe(true)
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
