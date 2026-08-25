import { isBoss } from './data'
import type { EnemyState, GameEvent, GameSnapshot, PlayerState, StructureState } from './types'

interface Effect {
  x: number
  y: number
  life: number
  type: GameEvent['type']
}

const TAU = Math.PI * 2
const CHARACTER_SPRITE_INDEX: Record<PlayerState['character'], number> = { vesper: 0, cinder: 1, bastion: 2, warden: 3, nyx: 4, tempest: 5, briar: 6, seraph: 7 }
const ENEMY_SPRITE_INDEX: Record<EnemyState['type'], number> = {
  thrall: 0, skitter: 1, spitter: 2, bulwark: 3,
  wraith: 4, charger: 5, hexer: 6, leech: 7,
  tollkeeper: 8, broodmother: 9, graveknight: 10, 'eclipse-eye': 11,
}

// Every runtime sprite is authored facing east. Angles in the left half-plane are
// folded back into an upright range and horizontally mirrored, so nobody rotates
// through an upside-down pose while their weapon still points at the exact aim angle.
export const uprightSpriteTransform = (direction: number): { rotation: number; flipX: boolean } => {
  let normalized = ((direction + Math.PI) % TAU + TAU) % TAU - Math.PI
  if (normalized > Math.PI / 2) return { rotation: normalized - Math.PI, flipX: true }
  if (normalized < -Math.PI / 2) return { rotation: normalized + Math.PI, flipX: true }
  return { rotation: normalized, flipX: false }
}
export const spriteRotationForDirection = (direction: number) => uprightSpriteTransform(direction).rotation

export class GameRenderer {
  private readonly canvas: HTMLCanvasElement
  private readonly context: CanvasRenderingContext2D
  private width = 0
  private height = 0
  private dpr = 1
  private cameraX = 0
  private cameraY = 0
  private lastFrame = performance.now()
  private lastEventId = 0
  private effects: Effect[] = []
  private readonly enemyFacing = new Map<number, number>()
  private readonly hunterSpriteAtlas = new Image()
  private readonly enemySpriteAtlas = new Image()
  private readonly structureAtlas = new Image()
  private readonly groundTexture = new Image()

  constructor(canvas: HTMLCanvasElement, artBase: string) {
    this.canvas = canvas
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas rendering is not supported in this browser.')
    this.context = context
    this.hunterSpriteAtlas.src = `${artBase}hunter-sprites.webp`
    this.enemySpriteAtlas.src = `${artBase}enemy-sprites.webp`
    this.structureAtlas.src = `${artBase}structure-atlas.webp`
    this.groundTexture.src = `${artBase}night-ground.webp`
    this.resize()
  }

  resize() {
    const bounds = this.canvas.getBoundingClientRect()
    this.dpr = Math.min(2, window.devicePixelRatio || 1)
    this.width = Math.max(320, bounds.width)
    this.height = Math.max(240, bounds.height)
    this.canvas.width = Math.floor(this.width * this.dpr)
    this.canvas.height = Math.floor(this.height * this.dpr)
    this.context.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
  }

  render(snapshot: GameSnapshot, localPlayerId: string, focusPlayerId = localPlayerId, predictionSeconds = 0) {
    const now = performance.now()
    const dt = Math.min(0.05, (now - this.lastFrame) / 1000)
    this.lastFrame = now
    const focus = snapshot.players.find((player) => player.id === focusPlayerId) ?? snapshot.players.find((player) => player.id === localPlayerId) ?? snapshot.players[0]
    if (focus) {
      const prediction = focus.downed ? 0 : predictionSeconds
      this.cameraX += (focus.x + focus.vx * prediction - this.cameraX) * Math.min(1, dt * 10)
      this.cameraY += (focus.y + focus.vy * prediction - this.cameraY) * Math.min(1, dt * 10)
    }

    this.captureEffects(snapshot.events)
    const context = this.context
    context.save()
    context.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    this.drawGround()
    context.translate(this.width / 2 - this.cameraX, this.height / 2 - this.cameraY)
    this.drawTerrainDetails()
    this.drawStructures(snapshot.structures)
    this.drawPickups(snapshot)
    this.drawProjectiles(snapshot, predictionSeconds)
    this.drawEnemies(snapshot.enemies, predictionSeconds)
    this.drawPlayers(snapshot.players, localPlayerId, predictionSeconds)
    this.drawEffects(dt)
    context.restore()
    this.drawVignette()
    this.drawEdgeMarkers(snapshot.players, localPlayerId)
  }

  aimFromPointer(clientX: number, clientY: number): number {
    const bounds = this.canvas.getBoundingClientRect()
    return Math.atan2(clientY - bounds.top - bounds.height / 2, clientX - bounds.left - bounds.width / 2)
  }

  private drawGround() {
    const context = this.context
    context.fillStyle = '#07100e'
    context.fillRect(0, 0, this.width, this.height)
    if (this.groundTexture.complete && this.groundTexture.naturalWidth > 0) {
      const tileSize = 627
      const offsetX = ((-this.cameraX % tileSize) + tileSize) % tileSize - tileSize
      const offsetY = ((-this.cameraY % tileSize) + tileSize) % tileSize - tileSize
      context.save()
      context.globalAlpha = 0.48
      for (let x = offsetX; x < this.width + tileSize; x += tileSize) {
        for (let y = offsetY; y < this.height + tileSize; y += tileSize) {
          context.drawImage(this.groundTexture, x, y, tileSize, tileSize)
        }
      }
      context.restore()
    }
    const glow = context.createRadialGradient(this.width / 2, this.height / 2, 0, this.width / 2, this.height / 2, this.width * 0.7)
    glow.addColorStop(0, 'rgba(31, 69, 56, .28)')
    glow.addColorStop(0.55, 'rgba(7, 16, 14, .14)')
    glow.addColorStop(1, 'rgba(1, 6, 5, .76)')
    context.fillStyle = glow
    context.fillRect(0, 0, this.width, this.height)
  }

  private drawTerrainDetails() {
    const context = this.context
    const left = this.cameraX - this.width / 2 - 90
    const top = this.cameraY - this.height / 2 - 90
    const grid = 96
    const startX = Math.floor(left / grid) * grid
    const startY = Math.floor(top / grid) * grid
    context.lineWidth = 1
    for (let x = startX; x < left + this.width + 180; x += grid) {
      for (let y = startY; y < top + this.height + 180; y += grid) {
        const hash = Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1
        if (hash > 0.78) {
          context.strokeStyle = 'rgba(90, 130, 104, .15)'
          context.beginPath()
          context.moveTo(x - 8, y + 6)
          context.quadraticCurveTo(x, y - 12 - hash * 10, x + 10, y + 4)
          context.stroke()
        } else if (hash < 0.08) {
          context.fillStyle = 'rgba(113, 138, 118, .11)'
          context.beginPath()
          context.arc(x, y, 2 + hash * 18, 0, TAU)
          context.fill()
        }
      }
    }
    context.strokeStyle = 'rgba(242, 212, 121, .13)'
    context.lineWidth = 3
    context.setLineDash([6, 18])
    context.beginPath()
    context.arc(0, 0, 1500, 0, TAU)
    context.stroke()
    context.setLineDash([])
  }

  private drawStructures(structures: StructureState[]) {
    const context = this.context
    for (const structure of structures) {
      const pulse = 0.5 + Math.sin(performance.now() / 620 + structure.id) * 0.5
      if (this.structureAtlas.complete && this.structureAtlas.naturalWidth > 0) {
        const art = {
          moonwell: { index: 0, size: 156, label: 'MOONWELL · HEALS', color: '116, 216, 194' },
          'ward-tower': { index: 1, size: 164, label: 'WARD TOWER · FIRES', color: '116, 216, 194' },
          'ritual-stone': { index: 2, size: 158, label: 'RITUAL STONE · RAPID FIRE', color: '242, 212, 121' },
        }[structure.type]
        const glow = context.createRadialGradient(structure.x, structure.y, 4, structure.x, structure.y, structure.radius * 1.18)
        glow.addColorStop(0, `rgba(${art.color}, ${0.13 + pulse * 0.06})`)
        glow.addColorStop(1, `rgba(${art.color}, 0)`)
        context.fillStyle = glow
        context.beginPath()
        context.arc(structure.x, structure.y, structure.radius * 1.18, 0, TAU)
        context.fill()
        this.drawAtlasSprite(this.structureAtlas, 2, 2, art.index, structure.x, structure.y, art.size, art.size, 0, true)
        this.drawLabel(structure.x, structure.y + structure.radius + 18, art.label, structure.type === 'ritual-stone' ? '#e9d68f' : '#9fe4d5')
        continue
      }
      if (structure.type === 'moonwell') {
        context.fillStyle = `rgba(116, 216, 194, ${0.06 + pulse * 0.04})`
        context.beginPath()
        context.arc(structure.x, structure.y, structure.radius, 0, TAU)
        context.fill()
        context.strokeStyle = '#74d8c2'
        context.lineWidth = 2
        context.beginPath()
        context.arc(structure.x, structure.y, 25 + pulse * 3, 0, TAU)
        context.stroke()
        this.drawGlyph(structure.x, structure.y + 1, '✚', '#b8fff0', 19)
        this.drawLabel(structure.x, structure.y + 48, 'MOONWELL · HEALS')
      } else if (structure.type === 'ward-tower') {
        context.strokeStyle = '#74d8c2'
        context.lineWidth = 2
        context.beginPath()
        context.moveTo(structure.x, structure.y - 30)
        context.lineTo(structure.x - 22, structure.y + 24)
        context.lineTo(structure.x + 22, structure.y + 24)
        context.closePath()
        context.stroke()
        this.drawGlyph(structure.x, structure.y + 2, 'ϟ', '#b8fff0', 18)
        this.drawLabel(structure.x, structure.y + 48, 'WARD TOWER · FIRES')
      } else {
        context.fillStyle = `rgba(242, 212, 121, ${0.045 + pulse * 0.035})`
        context.beginPath()
        context.arc(structure.x, structure.y, structure.radius, 0, TAU)
        context.fill()
        context.strokeStyle = 'rgba(242, 212, 121, .6)'
        context.lineWidth = 2
        context.beginPath()
        for (let point = 0; point < 6; point += 1) {
          const angle = (point / 6) * TAU - Math.PI / 2
          const radius = point % 2 === 0 ? 28 : 18
          const x = structure.x + Math.cos(angle) * radius
          const y = structure.y + Math.sin(angle) * radius
          if (point === 0) context.moveTo(x, y)
          else context.lineTo(x, y)
        }
        context.closePath()
        context.stroke()
        this.drawLabel(structure.x, structure.y + 48, 'RITUAL STONE · RAPID FIRE')
      }
    }
  }

  private drawPickups(snapshot: GameSnapshot) {
    const context = this.context
    for (const pickup of snapshot.pickups) {
      const pulse = 3 + Math.sin(performance.now() / 180 + pickup.id) * 1.2
      context.save()
      context.translate(pickup.x, pickup.y)
      context.rotate(Math.PI / 4)
      context.shadowColor = '#b6a5ff'
      context.shadowBlur = 10
      context.fillStyle = '#b6a5ff'
      context.fillRect(-pulse, -pulse, pulse * 2, pulse * 2)
      context.restore()
    }
  }

  private drawProjectiles(snapshot: GameSnapshot, predictionSeconds: number) {
    const context = this.context
    context.lineCap = 'round'
    for (const projectile of snapshot.projectiles) {
      const x = projectile.x + projectile.vx * predictionSeconds
      const y = projectile.y + projectile.vy * predictionSeconds
      context.strokeStyle = projectile.color
      context.lineWidth = projectile.radius * 1.5
      context.globalAlpha = projectile.enemy ? 0.8 : 0.95
      context.shadowColor = projectile.color
      context.shadowBlur = projectile.enemy ? 9 : 13
      context.beginPath()
      context.moveTo(x, y)
      context.lineTo(x - projectile.vx * 0.035, y - projectile.vy * 0.035)
      context.stroke()
    }
    context.shadowBlur = 0
    context.globalAlpha = 1
  }

  private drawEnemies(enemies: EnemyState[], predictionSeconds: number) {
    const context = this.context
    for (const enemy of enemies) {
      const x = enemy.x + enemy.vx * predictionSeconds
      const y = enemy.y + enemy.vy * predictionSeconds
      const burning = enemy.burn > 0
      const color = burning ? '#ff735c' : enemy.slow > 0 ? '#9bd6ff' : '#e8eee7'
      if (this.enemySpriteAtlas.complete && this.enemySpriteAtlas.naturalWidth > 0) {
        const boss = isBoss(enemy.type)
        const size = boss ? 174 : enemy.type === 'bulwark' ? 116 : enemy.type === 'spitter' || enemy.type === 'leech' ? 72 : enemy.type === 'charger' ? 94 : 82
        const movement = Math.hypot(enemy.vx, enemy.vy)
        const facing = movement > 0.1 ? Math.atan2(enemy.vy, enemy.vx) : (this.enemyFacing.get(enemy.id) ?? 0)
        if (movement > 0.1) this.enemyFacing.set(enemy.id, facing)
        const transform = uprightSpriteTransform(facing)
        const motion = Math.min(1, movement / Math.max(1, enemy.speed))
        const stride = Math.sin(performance.now() / 88 + enemy.id * 1.73)
        const bob = motion > 0.04 ? Math.abs(stride) * 1.8 : Math.sin(performance.now() / 310 + enemy.id) * 0.35
        context.save()
        context.fillStyle = 'rgba(0, 0, 0, .46)'
        context.beginPath()
        context.ellipse(x, y + enemy.radius * 0.72, size * 0.28, size * 0.12, 0, 0, TAU)
        context.fill()
        context.shadowColor = burning ? '#ff593d' : enemy.slow > 0 ? '#82ceff' : boss ? '#ef375e' : 'rgba(0,0,0,0)'
        context.shadowBlur = burning || enemy.slow > 0 ? 20 : boss ? 16 : 0
        this.drawAtlasSprite(
          this.enemySpriteAtlas,
          4,
          3,
          ENEMY_SPRITE_INDEX[enemy.type],
          x,
          y - bob,
          size * (1 - stride * 0.016 * motion),
          size * (1 + stride * 0.022 * motion),
          transform.rotation,
          true,
          transform.flipX,
        )
        context.restore()
        if (boss) {
          context.strokeStyle = `rgba(239, 113, 142, ${0.28 + Math.sin(enemy.phase * 2) * 0.08})`
          context.lineWidth = 2
          context.beginPath()
          context.arc(x, y, 69 + Math.sin(enemy.phase * 2) * 4, 0, TAU)
          context.stroke()
        }
        if (boss || (enemy.type === 'bulwark' && enemy.maxHealth > 500)) {
          const barWidth = boss ? 130 : 92
          this.drawBar(x - barWidth / 2, y - size * 0.47, barWidth, 5, enemy.health / enemy.maxHealth, '#ef718e')
        }
        continue
      }
      context.save()
      context.translate(x, y)
      context.rotate(Math.atan2(enemy.vy, enemy.vx) + Math.PI / 2)
      context.strokeStyle = color
      context.fillStyle = isBoss(enemy.type) ? 'rgba(105, 33, 62, .82)' : 'rgba(12, 22, 19, .9)'
      context.lineWidth = isBoss(enemy.type) ? 4 : 2
      context.shadowColor = burning ? '#ff735c' : 'transparent'
      context.shadowBlur = burning ? 12 : 0

      if (enemy.type === 'skitter') {
        context.beginPath()
        context.moveTo(0, -enemy.radius)
        context.lineTo(enemy.radius, enemy.radius)
        context.lineTo(-enemy.radius, enemy.radius)
        context.closePath()
      } else if (enemy.type === 'bulwark') {
        this.polygonPath(6, enemy.radius)
      } else if (isBoss(enemy.type)) {
        this.polygonPath(8, enemy.radius)
      } else {
        context.beginPath()
        context.arc(0, 0, enemy.radius, 0, TAU)
      }
      context.fill()
      context.stroke()

      if (enemy.type === 'spitter') {
        context.fillStyle = '#ef718e'
        context.beginPath()
        context.arc(0, 0, 5, 0, TAU)
        context.fill()
      }
      if (enemy.type === 'thrall') {
        context.beginPath()
        context.moveTo(-enemy.radius * 0.7, -enemy.radius * 0.6)
        context.lineTo(-enemy.radius * 1.1, -enemy.radius * 1.25)
        context.moveTo(enemy.radius * 0.7, -enemy.radius * 0.6)
        context.lineTo(enemy.radius * 1.1, -enemy.radius * 1.25)
        context.stroke()
      }
      if (isBoss(enemy.type)) {
        context.strokeStyle = '#f2d479'
        context.lineWidth = 2
        context.beginPath()
        context.arc(0, 0, enemy.radius * 0.55, 0, TAU)
        context.stroke()
        this.drawGlyph(0, 3, 'Ⅰ', '#f2d479', 24)
      }
      context.restore()

      if (isBoss(enemy.type) || (enemy.type === 'bulwark' && enemy.maxHealth > 500)) {
        this.drawBar(x - 42, y - enemy.radius - 14, 84, 5, enemy.health / enemy.maxHealth, '#ef718e')
      }
    }
  }

  private drawPlayers(players: PlayerState[], localPlayerId: string, predictionSeconds: number) {
    const context = this.context
    for (const player of players) {
      if (player.eliminated) continue
      const prediction = player.downed ? 0 : predictionSeconds
      const x = player.x + player.vx * prediction
      const y = player.y + player.vy * prediction
      if (player.character === 'bastion' && !player.downed) {
        const radius = player.awakened ? 300 : 150
        context.fillStyle = 'rgba(116, 216, 194, .025)'
        context.strokeStyle = 'rgba(116, 216, 194, .16)'
        context.lineWidth = 1
        context.beginPath()
        context.arc(x, y, radius, 0, TAU)
        context.fill()
        context.stroke()
      }

      if (this.hunterSpriteAtlas.complete && this.hunterSpriteAtlas.naturalWidth > 0) {
        const local = player.id === localPlayerId
        const size = player.character === 'bastion' ? 94 : 86
        const motion = Math.min(1, Math.hypot(player.vx, player.vy) / 170)
        const spriteIndex = CHARACTER_SPRITE_INDEX[player.character]
        const stride = Math.sin(performance.now() / 86 + spriteIndex * 1.91)
        const bob = player.downed ? 0 : motion > 0.03 ? Math.abs(stride) * 2 : Math.sin(performance.now() / 340 + spriteIndex) * 0.45
        const recoil = player.fireCooldown > 0 && !player.downed ? Math.min(2.4, player.fireCooldown * 14) : 0
        const spriteX = x - Math.cos(player.aim) * recoil
        const spriteY = y - Math.sin(player.aim) * recoil - bob
        context.save()
        context.fillStyle = 'rgba(0, 0, 0, .48)'
        context.beginPath()
        context.ellipse(x, y + 18, 27, 10, 0, 0, TAU)
        context.fill()
        if (local && !player.downed) {
          context.strokeStyle = player.color
          context.globalAlpha = 0.72
          context.lineWidth = 1.5
          context.setLineDash([3, 5])
          context.beginPath()
          context.arc(x, y, 31 + Math.sin(performance.now() / 180) * 2, 0, TAU)
          context.stroke()
          context.setLineDash([])
          context.beginPath()
          context.moveTo(x + Math.cos(player.aim) * 22, y + Math.sin(player.aim) * 22)
          context.lineTo(x + Math.cos(player.aim) * 44, y + Math.sin(player.aim) * 44)
          context.stroke()
        }
        context.globalAlpha = player.downed ? 0.48 : 1
        context.shadowColor = player.color
        context.shadowBlur = local ? 12 : 6
        const transform = uprightSpriteTransform(player.aim)
        this.drawAtlasSprite(
          this.hunterSpriteAtlas,
          4,
          2,
          spriteIndex,
          spriteX,
          spriteY,
          size * (1 - stride * 0.015 * motion),
          size * (1 + stride * 0.02 * motion),
          transform.rotation,
          true,
          transform.flipX,
        )
        context.restore()
        if (player.downed) {
          context.strokeStyle = '#ef718e'
          context.lineWidth = 2
          context.beginPath()
          context.moveTo(x - 8, y - 8)
          context.lineTo(x + 8, y + 8)
          context.moveTo(x + 8, y - 8)
          context.lineTo(x - 8, y + 8)
          context.stroke()
        }
        this.drawBar(x - 24, y - size * 0.46, 48, 4, player.health / player.maxHealth, player.downed ? '#ef718e' : player.color)
        if (player.downed) this.drawBar(x - 24, y - size * 0.39, 48, 3, player.reviveProgress / 2.2, '#f2d479')
        this.drawLabel(x, y + size * 0.43, `${player.name}${player.awakened ? ' ✦' : ''}`, local ? '#f5f1de' : '#b8c4bd')
        continue
      }

      context.save()
      context.translate(x, y)
      if (player.downed) context.rotate(Math.sin(performance.now() / 120) * 0.05)
      context.fillStyle = player.downed ? 'rgba(55, 48, 48, .9)' : '#0b1512'
      context.strokeStyle = player.color
      context.lineWidth = player.id === localPlayerId ? 3 : 2
      context.shadowColor = player.color
      context.shadowBlur = player.id === localPlayerId ? 14 : 7
      context.beginPath()
      context.arc(0, 0, 13, 0, TAU)
      context.fill()
      context.stroke()
      context.shadowBlur = 0

      if (!player.downed) {
        context.rotate(player.aim)
        context.fillStyle = player.color
        context.beginPath()
        context.moveTo(10, -4)
        context.lineTo(25, 0)
        context.lineTo(10, 4)
        context.closePath()
        context.fill()
      } else {
        context.strokeStyle = '#ef718e'
        context.beginPath()
        context.moveTo(-6, -6)
        context.lineTo(6, 6)
        context.moveTo(6, -6)
        context.lineTo(-6, 6)
        context.stroke()
      }
      context.restore()
      this.drawBar(x - 21, y - 27, 42, 4, player.health / player.maxHealth, player.downed ? '#ef718e' : player.color)
      if (player.downed) this.drawBar(x - 21, y - 20, 42, 3, player.reviveProgress / 2.2, '#f2d479')
      this.drawLabel(x, y + 31, `${player.name}${player.awakened ? ' ✦' : ''}`, player.id === localPlayerId ? '#f5f1de' : '#b8c4bd')
    }
  }

  private captureEffects(events: GameEvent[]) {
    for (const event of events) {
      if (event.id <= this.lastEventId) continue
      this.lastEventId = event.id
      if (event.x !== undefined && event.y !== undefined && event.type !== 'shot') {
        this.effects.push({ x: event.x, y: event.y, life: event.type === 'hurt' ? 0.32 : 0.2, type: event.type })
      }
    }
  }

  private drawEffects(dt: number) {
    const context = this.context
    for (const effect of this.effects) {
      effect.life -= dt
      const progress = Math.max(0, effect.life) / (effect.type === 'hurt' ? 0.32 : 0.2)
      const color = effect.type === 'hurt' ? '239, 113, 142' : '242, 212, 121'
      context.strokeStyle = `rgba(${color}, ${progress})`
      context.lineWidth = 2
      context.beginPath()
      context.arc(effect.x, effect.y, 9 + (1 - progress) * 14, 0, TAU)
      context.stroke()
      for (let spark = 0; spark < 5; spark += 1) {
        const angle = (spark / 5) * TAU + effect.x * 0.013
        const inner = 5 + (1 - progress) * 7
        const outer = inner + 6 * progress
        context.beginPath()
        context.moveTo(effect.x + Math.cos(angle) * inner, effect.y + Math.sin(angle) * inner)
        context.lineTo(effect.x + Math.cos(angle) * outer, effect.y + Math.sin(angle) * outer)
        context.stroke()
      }
    }
    this.effects = this.effects.filter((effect) => effect.life > 0)
  }

  private drawVignette() {
    const context = this.context
    const gradient = context.createRadialGradient(this.width / 2, this.height / 2, Math.min(this.width, this.height) * 0.25, this.width / 2, this.height / 2, Math.max(this.width, this.height) * 0.72)
    gradient.addColorStop(0, 'rgba(0,0,0,0)')
    gradient.addColorStop(1, 'rgba(0,3,2,.7)')
    context.fillStyle = gradient
    context.fillRect(0, 0, this.width, this.height)
  }

  private drawEdgeMarkers(players: PlayerState[], localPlayerId: string) {
    const context = this.context
    for (const player of players) {
      if (player.id === localPlayerId || player.eliminated) continue
      const sx = player.x - this.cameraX + this.width / 2
      const sy = player.y - this.cameraY + this.height / 2
      if (sx > 40 && sx < this.width - 40 && sy > 40 && sy < this.height - 40) continue
      const angle = Math.atan2(sy - this.height / 2, sx - this.width / 2)
      const radiusX = this.width / 2 - 32
      const radiusY = this.height / 2 - 32
      const scale = Math.min(Math.abs(radiusX / (Math.cos(angle) || 0.001)), Math.abs(radiusY / (Math.sin(angle) || 0.001)))
      const x = this.width / 2 + Math.cos(angle) * scale
      const y = this.height / 2 + Math.sin(angle) * scale
      context.fillStyle = player.color
      context.beginPath()
      context.arc(x, y, 5, 0, TAU)
      context.fill()
      context.fillStyle = '#f5f1de'
      context.font = '10px ui-monospace, monospace'
      context.textAlign = 'center'
      context.fillText(player.name.toUpperCase(), x, y - 10)
    }
  }

  private drawAtlasSprite(
    image: HTMLImageElement,
    columns: number,
    rows: number,
    index: number,
    x: number,
    y: number,
    width: number,
    height: number,
    rotation = 0,
    pixelated = false,
    flipX = false,
  ) {
    const context = this.context
    const sourceWidth = image.naturalWidth / columns
    const sourceHeight = image.naturalHeight / rows
    const column = index % columns
    const row = Math.floor(index / columns)
    context.save()
    if (pixelated) context.imageSmoothingEnabled = false
    context.translate(x, y)
    context.rotate(rotation)
    if (flipX) context.scale(-1, 1)
    context.drawImage(
      image,
      column * sourceWidth,
      row * sourceHeight,
      sourceWidth,
      sourceHeight,
      -width / 2,
      -height / 2,
      width,
      height,
    )
    context.restore()
  }

  private polygonPath(sides: number, radius: number) {
    const context = this.context
    context.beginPath()
    for (let point = 0; point < sides; point += 1) {
      const angle = (point / sides) * TAU - Math.PI / 2
      const x = Math.cos(angle) * radius
      const y = Math.sin(angle) * radius
      if (point === 0) context.moveTo(x, y)
      else context.lineTo(x, y)
    }
    context.closePath()
  }

  private drawBar(x: number, y: number, width: number, height: number, ratio: number, color: string) {
    const context = this.context
    context.fillStyle = 'rgba(0,0,0,.65)'
    context.fillRect(x, y, width, height)
    context.fillStyle = color
    context.fillRect(x, y, width * Math.max(0, Math.min(1, ratio)), height)
  }

  private drawGlyph(x: number, y: number, glyph: string, color: string, size: number) {
    const context = this.context
    context.fillStyle = color
    context.font = `700 ${size}px Georgia, serif`
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText(glyph, x, y)
  }

  private drawLabel(x: number, y: number, label: string, color = '#819188') {
    const context = this.context
    context.fillStyle = color
    context.font = '700 9px ui-monospace, monospace'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText(label, x, y)
  }
}
