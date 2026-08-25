import { isBoss } from './data'
import { HEAL_CRYSTAL_SECONDS } from './health'
import { mapById, type MapDefinition } from './maps'
import type { CompanionState, EnemyState, GameEvent, GameSnapshot, PlayerState, StructureState, StructureType } from './types'

interface Effect {
  x: number
  y: number
  life: number
  type: GameEvent['type']
}

const TAU = Math.PI * 2
const CHARACTER_SPRITE_INDEX: Record<PlayerState['character'], number> = { vesper: 0, cinder: 1, bastion: 2, warden: 3, nyx: 4, tempest: 5, briar: 6, seraph: 7, rapunsel: 8 }
const WEAPON_SPRITE_INDEX: Record<PlayerState['weapon'], number> = {
  revolver: 0, scattergun: 1, 'arc-rifle': 2, 'burst-carbine': 3, railgun: 4,
  'grenade-launcher': 5, flamethrower: 6, 'frost-cannon': 7, seeker: 8, sword: 9,
}
const COMPANION_SPRITE_INDEX: Record<CompanionState['kind'], number> = { gravewing: 0, ashkit: 1, 'aegis-hound': 2, 'mercy-moth': 3, shadecat: 4, 'storm-wisp': 5, thornling: 6, sunbird: 7 }
const ENEMY_SPRITE_INDEX: Record<EnemyState['type'], number> = {
  thrall: 0, skitter: 1, spitter: 2, bulwark: 3,
  wraith: 4, charger: 5, hexer: 6, leech: 7,
  tollkeeper: 8, broodmother: 9, graveknight: 10, 'eclipse-eye': 11,
  'void-hart': 10, 'prism-witch': 11, 'iron-choir': 8, 'star-eater': 11,
}
const BOSS_COLORS: Partial<Record<EnemyState['type'], string>> = {
  tollkeeper: '#ef718e', broodmother: '#e45d82', graveknight: '#f2d479', 'eclipse-eye': '#aa86ff',
  'void-hart': '#48e1d0', 'prism-witch': '#ef8dff', 'iron-choir': '#d69468', 'star-eater': '#7f5cff',
}
const STRUCTURE_ART: Record<StructureType, { index: number; size: number; label: string; color: string }> = {
  moonwell: { index: 0, size: 156, label: 'MOONWELL · HEART CRYSTAL', color: '116, 216, 194' },
  'ward-tower': { index: 1, size: 164, label: 'WARD TOWER · FIRES', color: '116, 216, 194' },
  'ritual-stone': { index: 2, size: 158, label: 'RITUAL STONE · RAPID FIRE', color: '242, 212, 121' },
  'sun-forge': { index: 3, size: 154, label: 'SUN FORGE · HEART CRYSTAL', color: '255, 121, 93' },
  'cinder-ballista': { index: 4, size: 158, label: 'CINDER BALLISTA · FIRES', color: '255, 121, 93' },
  'ember-altar': { index: 5, size: 154, label: 'EMBER ALTAR · RAPID FIRE', color: '255, 168, 76' },
  'reliquary-font': { index: 6, size: 154, label: 'RELIQUARY FONT · HEART CRYSTAL', color: '137, 201, 255' },
  'ossuary-sentry': { index: 7, size: 158, label: 'OSSUARY SENTRY · FIRES', color: '201, 185, 255' },
  'echo-seal': { index: 8, size: 150, label: 'ECHO SEAL · RAPID FIRE', color: '201, 185, 255' },
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
  private readonly weaponSpriteAtlas = new Image()
  private readonly companionSpriteAtlas = new Image()
  private readonly enemySpriteAtlas = new Image()
  private readonly structureAtlas = new Image()
  private readonly biomeTextureAtlas = new Image()

  constructor(canvas: HTMLCanvasElement, artBase: string) {
    this.canvas = canvas
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas rendering is not supported in this browser.')
    this.context = context
    this.hunterSpriteAtlas.src = `${artBase}hunter-sprites-v4.webp`
    this.weaponSpriteAtlas.src = `${artBase}weapon-sprites-v2.webp`
    this.companionSpriteAtlas.src = `${artBase}companion-sprites-v1.webp`
    this.enemySpriteAtlas.src = `${artBase}enemy-sprites.webp`
    this.structureAtlas.src = `${artBase}structure-atlas-v2.webp`
    this.biomeTextureAtlas.src = `${artBase}biome-textures-v1.webp`
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
    const map = mapById(snapshot.mapId)
    const context = this.context
    context.save()
    context.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    this.drawGround(map)
    context.translate(this.width / 2 - this.cameraX, this.height / 2 - this.cameraY)
    this.drawTerrainDetails(map)
    this.drawWalls(map)
    this.drawStructures(snapshot.structures)
    this.drawPickups(snapshot)
    this.drawProjectiles(snapshot, predictionSeconds)
    this.drawEnemies(snapshot.enemies, predictionSeconds)
    this.drawCompanions(snapshot.companions, snapshot.players, predictionSeconds)
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

  viewportSize(): { width: number; height: number } {
    return { width: this.width, height: this.height }
  }

  private drawGround(map: MapDefinition) {
    const context = this.context
    context.fillStyle = map.id === 'emberfall' ? '#100908' : map.id === 'reliquary' ? '#0a0b0e' : '#07100e'
    context.fillRect(0, 0, this.width, this.height)
    if (this.biomeTextureAtlas.complete && this.biomeTextureAtlas.naturalWidth > 0) {
      const tileSize = map.id === 'reliquary' ? 512 : 627
      const offsetX = ((-this.cameraX % tileSize) + tileSize) % tileSize - tileSize
      const offsetY = ((-this.cameraY % tileSize) + tileSize) % tileSize - tileSize
      const sourceWidth = this.biomeTextureAtlas.naturalWidth / 2
      const sourceHeight = this.biomeTextureAtlas.naturalHeight / 2
      const sourceX = (map.textureIndex % 2) * sourceWidth
      const sourceY = Math.floor(map.textureIndex / 2) * sourceHeight
      context.save()
      context.globalAlpha = map.id === 'gloamreach' ? 0.55 : 0.68
      context.imageSmoothingEnabled = false
      for (let x = offsetX; x < this.width + tileSize; x += tileSize) {
        for (let y = offsetY; y < this.height + tileSize; y += tileSize) {
          context.drawImage(this.biomeTextureAtlas, sourceX, sourceY, sourceWidth, sourceHeight, x, y, tileSize, tileSize)
        }
      }
      context.restore()
    }
    const glow = context.createRadialGradient(this.width / 2, this.height / 2, 0, this.width / 2, this.height / 2, this.width * 0.7)
    glow.addColorStop(0, map.id === 'emberfall' ? 'rgba(104, 44, 30, .22)' : map.id === 'reliquary' ? 'rgba(50, 47, 78, .22)' : 'rgba(31, 69, 56, .28)')
    glow.addColorStop(0.55, map.id === 'emberfall' ? 'rgba(26, 12, 9, .12)' : 'rgba(7, 16, 14, .14)')
    glow.addColorStop(1, 'rgba(1, 6, 5, .76)')
    context.fillStyle = glow
    context.fillRect(0, 0, this.width, this.height)
  }

  private drawTerrainDetails(map: MapDefinition) {
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
        if (hash > 0.78 && map.id === 'gloamreach') {
          context.strokeStyle = 'rgba(90, 130, 104, .15)'
          context.beginPath()
          context.moveTo(x - 8, y + 6)
          context.quadraticCurveTo(x, y - 12 - hash * 10, x + 10, y + 4)
          context.stroke()
        } else if (hash < 0.08 && map.id !== 'reliquary') {
          context.fillStyle = map.id === 'emberfall' ? 'rgba(255, 104, 64, .2)' : 'rgba(113, 138, 118, .11)'
          context.beginPath()
          context.arc(x, y, 2 + hash * 18, 0, TAU)
          context.fill()
        }
      }
    }
    context.strokeStyle = map.id === 'emberfall' ? 'rgba(255, 121, 93, .14)' : map.id === 'reliquary' ? 'rgba(201, 185, 255, .09)' : 'rgba(242, 212, 121, .13)'
    context.lineWidth = 3
    context.setLineDash([6, 18])
    context.beginPath()
    context.arc(0, 0, 1500, 0, TAU)
    context.stroke()
    context.setLineDash([])
  }

  private drawWalls(map: MapDefinition) {
    if (map.walls.length === 0) return
    const context = this.context
    const textureReady = this.biomeTextureAtlas.complete && this.biomeTextureAtlas.naturalWidth > 0
    const sourceWidth = this.biomeTextureAtlas.naturalWidth / 2
    const sourceHeight = this.biomeTextureAtlas.naturalHeight / 2
    for (const wall of map.walls) {
      const left = wall.x - wall.width / 2
      const top = wall.y - wall.height / 2
      context.save()
      context.shadowColor = 'rgba(0,0,0,.86)'
      context.shadowBlur = 20
      context.shadowOffsetY = 10
      context.fillStyle = '#111319'
      context.fillRect(left, top, wall.width, wall.height)
      context.restore()
      context.save()
      context.beginPath()
      context.rect(left, top, wall.width, wall.height)
      context.clip()
      if (textureReady) {
        context.globalAlpha = 0.74
        context.imageSmoothingEnabled = false
        for (let x = left; x < left + wall.width; x += 128) {
          for (let y = top; y < top + wall.height; y += 128) {
            context.drawImage(this.biomeTextureAtlas, sourceWidth, sourceHeight, sourceWidth, sourceHeight, x, y, 128, 128)
          }
        }
      }
      context.fillStyle = 'rgba(5,7,10,.3)'
      context.fillRect(left, top, wall.width, wall.height)
      context.restore()
      context.strokeStyle = 'rgba(201,185,255,.32)'
      context.lineWidth = 2
      context.strokeRect(left + 1, top + 1, Math.max(0, wall.width - 2), Math.max(0, wall.height - 2))
      context.strokeStyle = 'rgba(242,212,121,.14)'
      context.lineWidth = 1
      context.strokeRect(left + 5, top + 5, Math.max(0, wall.width - 10), Math.max(0, wall.height - 10))
    }
  }

  private drawStructures(structures: StructureState[]) {
    const context = this.context
    for (const structure of structures) {
      const pulse = 0.5 + Math.sin(performance.now() / 620 + structure.id) * 0.5
      const art = STRUCTURE_ART[structure.type]
      if (this.structureAtlas.complete && this.structureAtlas.naturalWidth > 0) {
        const glow = context.createRadialGradient(structure.x, structure.y, 4, structure.x, structure.y, structure.radius * 1.18)
        glow.addColorStop(0, `rgba(${art.color}, ${0.13 + pulse * 0.06})`)
        glow.addColorStop(1, `rgba(${art.color}, 0)`)
        context.fillStyle = glow
        context.beginPath()
        context.arc(structure.x, structure.y, structure.radius * 1.18, 0, TAU)
        context.fill()
        this.drawAtlasSprite(this.structureAtlas, 3, 3, art.index, structure.x, structure.y, art.size, art.size, 0, true)
        if (structure.effect === 'heal') this.drawHeartCrystal(structure, art.color, pulse)
        else this.drawLabel(structure.x, structure.y + structure.radius + 18, art.label, `rgb(${art.color})`)
        continue
      }
      context.fillStyle = `rgba(${art.color}, ${0.05 + pulse * 0.04})`
      context.strokeStyle = `rgba(${art.color}, .7)`
      context.lineWidth = 2
      context.beginPath()
      context.arc(structure.x, structure.y, 24 + pulse * 3, 0, TAU)
      context.fill()
      context.stroke()
      this.drawGlyph(structure.x, structure.y + 1, structure.effect === 'heal' ? '✚' : structure.effect === 'turret' ? 'ϟ' : '✦', `rgb(${art.color})`, 19)
      if (structure.effect === 'heal') this.drawHeartCrystal(structure, art.color, pulse)
      else this.drawLabel(structure.x, structure.y + 48, art.label, `rgb(${art.color})`)
    }
  }

  private drawHeartCrystal(structure: StructureState, color: string, pulse: number) {
    const context = this.context
    const progress = structure.crystalReady ? 1 : Math.max(0, Math.min(1, (structure.crystalCharge ?? 0) / HEAL_CRYSTAL_SECONDS))
    const ringRadius = structure.radius * 0.72
    context.save()
    context.lineCap = 'square'
    context.lineWidth = 4
    context.strokeStyle = `rgba(${color}, .18)`
    context.beginPath()
    context.arc(structure.x, structure.y, ringRadius, -Math.PI / 2, Math.PI * 1.5)
    context.stroke()
    if (progress > 0) {
      context.strokeStyle = structure.crystalReady ? '#ef718e' : `rgb(${color})`
      context.shadowColor = structure.crystalReady ? '#ef718e' : `rgb(${color})`
      context.shadowBlur = structure.crystalReady ? 16 : 6
      context.beginPath()
      context.arc(structure.x, structure.y, ringRadius, -Math.PI / 2, -Math.PI / 2 + TAU * progress)
      context.stroke()
    }
    context.shadowBlur = structure.crystalReady ? 18 : 0
    this.drawHeartIcon(
      structure.x,
      structure.y - 7 - (structure.crystalReady ? pulse * 3 : 0),
      structure.crystalReady ? 22 : 14,
      structure.crystalReady ? 1 : progress,
      structure.crystalReady ? '#ef718e' : `rgb(${color})`,
    )
    context.restore()
    const status = structure.crystalReady ? 'READY · +1 HEART' : `${Math.ceil(HEAL_CRYSTAL_SECONDS - (structure.crystalCharge ?? 0))}s`
    this.drawLabel(structure.x, structure.y + structure.radius + 18, `${STRUCTURE_ART[structure.type].label} · ${status}`, structure.crystalReady ? '#f3a0b3' : `rgb(${color})`)
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
      context.lineWidth = projectile.radius * 1.7
      context.globalAlpha = projectile.enemy ? 0.8 : 0.95
      context.shadowColor = projectile.color
      context.shadowBlur = projectile.enemy ? 9 : 13
      context.beginPath()
      if (projectile.melee) {
        const angle = Math.atan2(projectile.vy, projectile.vx)
        context.lineWidth = Math.max(4, projectile.radius * 0.72)
        context.arc(x, y, projectile.radius * 1.9, angle - 0.72, angle + 0.72)
      } else {
        context.moveTo(x, y)
        context.lineTo(x - projectile.vx * 0.035, y - projectile.vy * 0.035)
      }
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
        const size = boss ? enemy.finale ? 194 : 174 : enemy.type === 'bulwark' ? 116 : enemy.type === 'spitter' || enemy.type === 'leech' ? 72 : enemy.type === 'charger' ? 94 : 82
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
        context.shadowColor = burning ? '#ff593d' : enemy.slow > 0 ? '#82ceff' : boss ? (BOSS_COLORS[enemy.type] ?? '#ef375e') : 'rgba(0,0,0,0)'
        context.shadowBlur = burning || enemy.slow > 0 ? 20 : enemy.finale ? 28 : boss ? 16 : 0
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
        if (boss) this.drawBossIdentity(enemy, x, y, facing, size)
        if (boss) {
          context.strokeStyle = BOSS_COLORS[enemy.type] ?? '#ef718e'
          context.globalAlpha = 0.28 + Math.sin(enemy.phase * 2) * 0.08
          context.lineWidth = 2
          context.beginPath()
          context.arc(x, y, (enemy.finale ? 80 : 69) + Math.sin(enemy.phase * 2) * 4, 0, TAU)
          context.stroke()
          context.globalAlpha = 1
        }
        if (boss || (enemy.type === 'bulwark' && enemy.maxHealth > 500)) {
          const barWidth = boss ? 130 : 92
          this.drawBar(x - barWidth / 2, y - size * 0.47, barWidth, 5, enemy.health / enemy.maxHealth, BOSS_COLORS[enemy.type] ?? '#ef718e')
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

  private drawBossIdentity(enemy: EnemyState, x: number, y: number, facing: number, size: number) {
    const context = this.context
    context.save()
    context.translate(x, y)
    const pulse = Math.sin(enemy.phase * 3) * 3
    if (enemy.type === 'graveknight') {
      context.rotate(facing)
      context.shadowColor = '#f2d479'
      context.shadowBlur = 8
      context.strokeStyle = '#f8e8ae'
      context.lineWidth = 5
      context.beginPath()
      context.moveTo(size * 0.22, 0)
      context.lineTo(size * 0.62, 0)
      context.stroke()
      context.strokeStyle = '#b98f45'
      context.lineWidth = 3
      context.beginPath()
      context.moveTo(size * 0.2, -13)
      context.lineTo(size * 0.2, 13)
      context.stroke()
    }
    if (enemy.type === 'void-hart') {
      context.rotate(facing)
      context.strokeStyle = '#48e1d0'
      context.lineWidth = 4
      for (const side of [-1, 1]) {
        context.beginPath()
        context.moveTo(18, side * 20)
        context.lineTo(48 + pulse, side * 38)
        context.lineTo(66 + pulse, side * 29)
        context.moveTo(43 + pulse, side * 34)
        context.lineTo(51 + pulse, side * 50)
        context.stroke()
      }
    }
    if (enemy.type === 'prism-witch') {
      const prism = ['#ff5f74', '#ffb454', '#f4e56b', '#6fe0ac', '#69bfff', '#c982ff']
      for (let shard = 0; shard < 6; shard += 1) {
        const angle = enemy.phase * 0.7 + shard / 6 * TAU
        context.save()
        context.translate(Math.cos(angle) * (72 + pulse), Math.sin(angle) * (72 + pulse))
        context.rotate(angle)
        context.fillStyle = prism[shard]
        context.fillRect(-5, -5, 10, 10)
        context.restore()
      }
    }
    if (enemy.type === 'iron-choir') {
      context.strokeStyle = '#d69468'
      context.lineWidth = 3
      for (let ring = 0; ring < 3; ring += 1) {
        context.beginPath()
        context.arc(0, 0, 58 + ring * 11 + pulse, enemy.phase + ring, enemy.phase + ring + 2.2)
        context.stroke()
      }
    }
    if (enemy.type === 'star-eater') {
      context.fillStyle = 'rgba(1, 2, 8, .82)'
      context.beginPath()
      context.arc(0, 0, 31 + pulse, 0, TAU)
      context.fill()
      context.strokeStyle = '#b384ff'
      context.lineWidth = 4
      context.beginPath()
      context.arc(0, 0, 45 + pulse, enemy.phase, enemy.phase + 4.4)
      context.stroke()
    }
    context.restore()
  }

  private drawCompanions(companions: CompanionState[], players: PlayerState[], predictionSeconds: number) {
    if (!this.companionSpriteAtlas.complete || this.companionSpriteAtlas.naturalWidth <= 0) return
    const context = this.context
    for (const companion of companions) {
      const owner = players.find((player) => player.id === companion.ownerId)
      if (!owner || owner.eliminated) continue
      const x = companion.x + companion.vx * predictionSeconds
      const y = companion.y + companion.vy * predictionSeconds
      const size = companion.kind === 'mercy-moth' || companion.kind === 'sunbird' || companion.kind === 'gravewing' ? 58
        : companion.kind === 'aegis-hound' || companion.kind === 'thornling' ? 52 : 46
      context.save()
      context.strokeStyle = `${owner.color}38`
      context.lineWidth = 1
      context.setLineDash([2, 5])
      context.beginPath()
      context.moveTo(owner.x, owner.y)
      context.lineTo(x, y)
      context.stroke()
      context.setLineDash([])
      context.fillStyle = 'rgba(0,0,0,.38)'
      context.beginPath()
      context.ellipse(x, y + size * 0.2, size * 0.22, size * 0.08, 0, 0, TAU)
      context.fill()
      context.shadowColor = owner.color
      context.shadowBlur = 10
      const transform = uprightSpriteTransform(companion.aim)
      this.drawAtlasSprite(
        this.companionSpriteAtlas, 4, 2, COMPANION_SPRITE_INDEX[companion.kind],
        x, y - 3, size, size, transform.rotation, true, transform.flipX,
      )
      context.restore()
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
      if (player.isolatedFor >= 3 && !player.downed) {
        context.save()
        context.strokeStyle = 'rgba(239, 113, 142, .72)'
        context.lineWidth = 1.5
        context.setLineDash([4, 5])
        context.beginPath()
        context.arc(x, y, 29 + Math.sin(performance.now() / 180) * 2, 0, TAU)
        context.stroke()
        context.restore()
        this.drawLabel(x, y + 38, 'SEPARATED', '#ef718e')
      }
      if (player.specialPulse > 0 && !player.downed) this.drawSpecialPulse(player, x, y)

      if (this.hunterSpriteAtlas.complete && this.hunterSpriteAtlas.naturalWidth > 0) {
        const local = player.id === localPlayerId
        const size = player.character === 'bastion' ? 48 : player.character === 'rapunsel' ? 47 : 44
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
          3,
          3,
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
        if (!player.downed && this.weaponSpriteAtlas.complete && this.weaponSpriteAtlas.naturalWidth > 0) {
          const weaponSize = player.weapon === 'railgun' ? 29
            : player.weapon === 'sword' || player.weapon === 'scattergun' || player.weapon === 'seeker' ? 27 : 23
          const weaponOffset = player.weapon === 'sword' ? 15 : 13
          context.save()
          context.shadowColor = player.color
          context.shadowBlur = local ? 9 : 5
          this.drawAtlasSprite(
            this.weaponSpriteAtlas,
            5,
            2,
            WEAPON_SPRITE_INDEX[player.weapon],
            spriteX + Math.cos(player.aim) * weaponOffset,
            spriteY + Math.sin(player.aim) * weaponOffset,
            weaponSize,
            weaponSize,
            player.aim,
            true,
          )
          context.restore()
        }
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
      if (player.downed) this.drawBar(x - 21, y - 20, 42, 3, player.reviveProgress / 2.2, '#f2d479')
      this.drawLabel(x, y + 31, `${player.name}${player.awakened ? ' ✦' : ''}`, player.id === localPlayerId ? '#f5f1de' : '#b8c4bd')
    }
  }

  private drawSpecialPulse(player: PlayerState, x: number, y: number) {
    const context = this.context
    const duration = player.character === 'rapunsel' ? 0.72 : 0.52
    const progress = Math.max(0, Math.min(1, 1 - player.specialPulse / duration))
    const alpha = Math.max(0, 1 - progress)
    context.save()
    context.translate(x, y)
    context.lineCap = 'square'
    if (player.character === 'rapunsel') {
      for (let strand = 0; strand < 4; strand += 1) {
        const radius = 38 + strand * 13 + progress * 48
        const start = player.aim + progress * TAU * 1.7 + strand * 1.5
        context.strokeStyle = strand % 2 === 0 ? `rgba(126, 76, 45, ${alpha * 0.95})` : `rgba(230, 183, 125, ${alpha * 0.75})`
        context.lineWidth = Math.max(2, 7 - strand)
        context.beginPath()
        context.arc(0, 0, radius, start, start + 1.65)
        context.stroke()
      }
      context.strokeStyle = `rgba(246, 218, 172, ${alpha * 0.8})`
      context.lineWidth = 2
      context.beginPath()
      context.arc(0, 0, 124 * (0.65 + progress * 0.35), 0, TAU)
      context.stroke()
    } else {
      context.strokeStyle = player.color
      context.globalAlpha = alpha * 0.8
      context.lineWidth = 2
      context.beginPath()
      context.arc(0, 0, 34 + progress * 118, 0, TAU)
      context.stroke()
      context.globalAlpha = alpha * 0.18
      context.fillStyle = player.color
      context.beginPath()
      context.arc(0, 0, 28 + progress * 88, 0, TAU)
      context.fill()
    }
    context.restore()
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

  private traceHeart(x: number, y: number, size: number) {
    const context = this.context
    const half = size / 2
    context.beginPath()
    context.moveTo(x, y + half)
    context.lineTo(x - half, y)
    context.lineTo(x - half, y - half * 0.45)
    context.lineTo(x - half * 0.72, y - half)
    context.lineTo(x - half * 0.24, y - half)
    context.lineTo(x, y - half * 0.55)
    context.lineTo(x + half * 0.24, y - half)
    context.lineTo(x + half * 0.72, y - half)
    context.lineTo(x + half, y - half * 0.45)
    context.lineTo(x + half, y)
    context.closePath()
  }

  private drawHeartIcon(x: number, y: number, size: number, fill: number, color: string) {
    const context = this.context
    const ratio = Math.max(0, Math.min(1, fill))
    this.traceHeart(x, y, size)
    context.fillStyle = 'rgba(2, 7, 6, .86)'
    context.fill()
    context.save()
    this.traceHeart(x, y, size)
    context.clip()
    context.fillStyle = color
    context.fillRect(x - size / 2, y - size / 2, size * ratio, size)
    context.restore()
    this.traceHeart(x, y, size)
    context.strokeStyle = ratio > 0 ? color : 'rgba(239, 113, 142, .42)'
    context.lineWidth = Math.max(1, size / 9)
    context.stroke()
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
