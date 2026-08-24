import { describe, expect, it } from 'vitest'
import { GameEngine } from '../src/game/engine'
import { spriteRotationForDirection } from '../src/game/renderer'
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

  it('pauses for a rotating squad upgrade and applies the chosen perk to everyone', () => {
    const ally = { ...player, id: 'ally', name: 'Ally', character: 'warden' as const, color: '#74d8c2' }
    const engine = new GameEngine([player, ally], 240, 99)
    engine.snapshot.xp = engine.snapshot.xpToNext
    engine.step(1 / 60, new Map([[player.id, idle], [ally.id, idle]]))
    expect(engine.snapshot.phase).toBe('upgrade')
    const offer = engine.snapshot.upgrade
    expect(offer?.ids).toHaveLength(3)
    expect(engine.chooseUpgrade(offer!.ids[0], offer!.chooserId)).toBe(true)
    expect(engine.snapshot.phase).toBe('playing')
    expect(engine.snapshot.players.every((entry) => entry.perks[offer!.ids[0]] === 1)).toBe(true)
  })
})

describe('top-down sprite rotation', () => {
  it.each([
    ['east', 0, 0],
    ['south', Math.PI / 2, Math.PI / 2],
    ['west', Math.PI, Math.PI],
    ['north', -Math.PI / 2, -Math.PI / 2],
  ])('rotates an east-facing atlas sprite toward %s', (_label, direction, expected) => {
    expect(spriteRotationForDirection(direction)).toBeCloseTo(expected)
  })

  it('preserves arbitrary analog aim angles without snapping', () => {
    expect(spriteRotationForDirection(0.731)).toBeCloseTo(0.731)
  })
})
