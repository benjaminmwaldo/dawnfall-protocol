import { isBoss } from './data'
import { bossWarningStrength, bossWeakPointAngle, bossWeakPointIsOpen } from './boss'
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
export const WORLD_Y_SCALE = 0.72
export const PIXEL_SCALE = 6
const CHARACTER_SPRITE_INDEX: Record<PlayerState['character'], number> = { vesper: 0, cinder: 1, bastion: 2, warden: 3, nyx: 4, tempest: 5, briar: 6, seraph: 7, rapunsel: 8, eira: 9, mara: 10, zahra: 11 }
const PIXEL_HUNTER_INDEX: Partial<Record<PlayerState['character'], number>> = {
  vesper: 0, cinder: 1, warden: 2, nyx: 3, tempest: 4, briar: 5, seraph: 6, rapunsel: 7,
}
const WEAPON_SPRITE_INDEX: Record<PlayerState['weapon'], number> = {
  revolver: 0, scattergun: 1, 'arc-rifle': 2, 'burst-carbine': 3, railgun: 4,
  'grenade-launcher': 5, flamethrower: 6, 'frost-cannon': 7, seeker: 8, sword: 9,
}
const COMPANION_SPRITE_INDEX: Record<CompanionState['kind'], number> = { gravewing: 0, ashkit: 1, 'aegis-hound': 2, 'mercy-moth': 3, shadecat: 4, 'storm-wisp': 5, thornling: 6, sunbird: 7 }
const AMBIENT_ENEMY_INDEX: Partial<Record<EnemyState['type'], number>> = {
  thrall: 0, skitter: 1, spitter: 2, bulwark: 3, wraith: 4, charger: 5, hexer: 6, leech: 7,
}
const BOSS_SPRITE_INDEX: Partial<Record<EnemyState['type'], number>> = {
  tollkeeper: 0, broodmother: 1, graveknight: 2, 'eclipse-eye': 3,
  'void-hart': 4, 'prism-witch': 5, 'iron-choir': 6, 'star-eater': 7,
}
const BOSS_COLORS: Partial<Record<EnemyState['type'], string>> = {
  tollkeeper: '#ef718e', broodmother: '#e45d82', graveknight: '#f2d479', 'eclipse-eye': '#aa86ff',
  'void-hart': '#48e1d0', 'prism-witch': '#ef8dff', 'iron-choir': '#d69468', 'star-eater': '#7f5cff',
}
const HUNTER_VISUALS: Record<PlayerState['character'], { skin: string; hair: string; coat: string; accent: string; build: number; height: number; hairLength: number; style: 'long' | 'bob' | 'braid' | 'ponytail' | 'shaved' | 'waves' }> = {
  vesper: { skin: '#e8c7b2', hair: '#303142', coat: '#34304c', accent: '#d6bcff', build: 0.88, height: 1.04, hairLength: 16, style: 'long' },
  cinder: { skin: '#d7a17c', hair: '#71312a', coat: '#642d28', accent: '#ff8265', build: 0.98, height: 1.01, hairLength: 11, style: 'waves' },
  bastion: { skin: '#9b5f43', hair: '#39282f', coat: '#304941', accent: '#74d8c2', build: 0.86, height: 1.01, hairLength: 14, style: 'ponytail' },
  warden: { skin: '#d9aa91', hair: '#29283a', coat: '#30304f', accent: '#b6a5ff', build: 0.82, height: 0.98, hairLength: 25, style: 'long' },
  nyx: { skin: '#8e5d49', hair: '#352a42', coat: '#342747', accent: '#9587ff', build: 0.9, height: 1.02, hairLength: 6, style: 'shaved' },
  tempest: { skin: '#e5b99d', hair: '#d8dce7', coat: '#29465a', accent: '#69c9ff', build: 0.86, height: 1.06, hairLength: 14, style: 'ponytail' },
  briar: { skin: '#dca17f', hair: '#6a353d', coat: '#6a2944', accent: '#e45d82', build: 1.05, height: 0.99, hairLength: 18, style: 'waves' },
  seraph: { skin: '#f2cfb5', hair: '#e7c779', coat: '#59543a', accent: '#ffd783', build: 0.84, height: 1.08, hairLength: 17, style: 'braid' },
  rapunsel: { skin: '#f1cfb7', hair: '#5b321e', coat: '#385445', accent: '#f1c48d', build: 0.75, height: 0.96, hairLength: 36, style: 'long' },
  eira: { skin: '#efd2bf', hair: '#e6d6c0', coat: '#354e61', accent: '#a9efff', build: 0.9, height: 1.08, hairLength: 14, style: 'braid' },
  mara: { skin: '#dfb39a', hair: '#24151c', coat: '#49334f', accent: '#c6a8ff', build: 0.96, height: 1, hairLength: 16, style: 'waves' },
  zahra: { skin: '#c78b68', hair: '#161217', coat: '#3d334c', accent: '#efb06e', build: 0.9, height: 1.05, hairLength: 12, style: 'ponytail' },
}
const STRUCTURE_ART: Record<StructureType, { index: number; size: number; label: string; color: string }> = {
  moonwell: { index: 0, size: 168, label: 'MOONWELL · HEART CRYSTAL', color: '116, 216, 194' },
  'ward-tower': { index: 1, size: 168, label: 'WARD TOWER · FIRES', color: '116, 216, 194' },
  'ritual-stone': { index: 2, size: 168, label: 'RITUAL STONE · RAPID FIRE', color: '242, 212, 121' },
  'sun-forge': { index: 3, size: 168, label: 'SUN FORGE · HEART CRYSTAL', color: '255, 121, 93' },
  'cinder-ballista': { index: 4, size: 168, label: 'CINDER BALLISTA · FIRES', color: '255, 121, 93' },
  'ember-altar': { index: 5, size: 168, label: 'EMBER ALTAR · RAPID FIRE', color: '255, 168, 76' },
  'reliquary-font': { index: 6, size: 168, label: 'RELIQUARY FONT · HEART CRYSTAL', color: '137, 201, 255' },
  'ossuary-sentry': { index: 7, size: 168, label: 'OSSUARY SENTRY · FIRES', color: '201, 185, 255' },
  'echo-seal': { index: 8, size: 168, label: 'ECHO SEAL · RAPID FIRE', color: '201, 185, 255' },
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
  private cssWidth = 0
  private cssHeight = 0
  private displayScale = PIXEL_SCALE
  private cameraX = 0
  private cameraY = 0
  private renderCameraX = 0
  private renderCameraY = 0
  private lastFrame = performance.now()
  private lastEventId = 0
  private effects: Effect[] = []
  private readonly enemyFacing = new Map<number, number>()
  private readonly hunterSpriteAtlas = new Image()
  private readonly weaponSpriteAtlas = new Image()
  private readonly companionSpriteAtlas = new Image()
  private readonly enemySpriteAtlas = new Image()
  private readonly bossSpriteAtlas = new Image()
  private readonly structureAtlas = new Image()
  private readonly terrainPropAtlas = new Image()

  constructor(canvas: HTMLCanvasElement, artBase: string) {
    this.canvas = canvas
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas rendering is not supported in this browser.')
    this.context = context
    this.companionSpriteAtlas.src = `${artBase}pixel-companions-v1.webp`
    this.hunterSpriteAtlas.src = `${artBase}pixel-hunters-v1.webp`
    this.weaponSpriteAtlas.src = `${artBase}pixel-weapons-v1.webp`
    this.enemySpriteAtlas.src = `${artBase}pixel-enemies-v1.webp`
    this.bossSpriteAtlas.src = `${artBase}pixel-bosses-v1.webp`
    this.structureAtlas.src = `${artBase}pixel-structures-v1.webp`
    this.terrainPropAtlas.src = `${artBase}pixel-terrain-props-v1.webp`
    this.resize()
  }

  resize() {
    this.cssWidth = Math.max(320, window.innerWidth)
    this.cssHeight = Math.max(240, window.innerHeight)
    this.displayScale = this.cssWidth <= 760 ? 4 : PIXEL_SCALE
    this.width = Math.max(80, Math.ceil(this.cssWidth / this.displayScale))
    this.height = Math.max(64, Math.ceil(this.cssHeight / this.displayScale))
    this.canvas.width = this.width
    this.canvas.height = this.height
    this.canvas.style.width = `${this.width * this.displayScale}px`
    this.canvas.style.height = `${this.height * this.displayScale}px`
    this.context.setTransform(1, 0, 0, 1, 0, 0)
    this.context.imageSmoothingEnabled = false
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
    this.renderCameraX = Math.round(this.cameraX / this.displayScale) * this.displayScale
    this.renderCameraY = Math.round(this.cameraY * WORLD_Y_SCALE / this.displayScale) * this.displayScale / WORLD_Y_SCALE

    this.captureEffects(snapshot.events)
    const map = mapById(snapshot.mapId)
    const context = this.context
    context.save()
    context.setTransform(1, 0, 0, 1, 0, 0)
    context.imageSmoothingEnabled = false
    this.drawGround(map)
    context.translate(this.width / 2, this.height / 2)
    context.scale(1 / this.displayScale, WORLD_Y_SCALE / this.displayScale)
    context.translate(-this.renderCameraX, -this.renderCameraY)
    this.drawTerrainDetails(map)
    this.drawWalls(map)
    this.drawStructures(snapshot.structures)
    this.drawPickups(snapshot)
    this.drawBossWarnings(snapshot.enemies, predictionSeconds)
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
    return this.aimFromVector(clientX - bounds.left - bounds.width / 2, clientY - bounds.top - bounds.height / 2)
  }

  aimFromVector(x: number, y: number): number { return Math.atan2(y / WORLD_Y_SCALE, x) }

  viewportSize(): { width: number; height: number } {
    return { width: this.cssWidth, height: this.cssHeight }
  }

  private snapX(x: number): number {
    return this.renderCameraX + Math.round((x - this.renderCameraX) / this.displayScale) * this.displayScale
  }

  private snapY(y: number): number {
    return this.renderCameraY + Math.round((y - this.renderCameraY) * WORLD_Y_SCALE / this.displayScale) * this.displayScale / WORLD_Y_SCALE
  }

  private drawGround(map: MapDefinition) {
    const context = this.context
    const palette = map.id === 'emberfall'
      ? { base: '#180c09', dark: '#0c0706', mid: '#492019', light: '#8a3824', accent: '#d85a32' }
      : map.id === 'reliquary'
        ? { base: '#101117', dark: '#08090d', mid: '#272936', light: '#55586c', accent: '#8b80ba' }
        : { base: '#062d24', dark: '#031914', mid: '#174a36', light: '#487047', accent: '#79a53f' }
    context.fillStyle = palette.base
    context.fillRect(0, 0, this.width, this.height)
    const tile = 8
    const cameraPixelX = this.renderCameraX / this.displayScale
    const cameraPixelY = this.renderCameraY * WORLD_Y_SCALE / this.displayScale
    const offsetX = ((-cameraPixelX % tile) + tile) % tile - tile
    const offsetY = ((-cameraPixelY % tile) + tile) % tile - tile
    for (let x = offsetX; x < this.width + tile; x += tile) {
      for (let y = offsetY; y < this.height + tile; y += tile) {
        const gx = Math.floor((x + cameraPixelX) / tile)
        const gy = Math.floor((y + cameraPixelY) / tile)
        const hash = Math.abs(Math.imul(gx + 8191, 374761393) ^ Math.imul(gy + 131, 668265263)) % 97
        if (hash % 17 === 0) {
          context.fillStyle = palette.dark
          context.fillRect(Math.round(x + 2), Math.round(y + 2), 4, 4)
        } else if (hash % 11 === 0) {
          context.fillStyle = palette.mid
          context.fillRect(Math.round(x + 2), Math.round(y + 3), 3, 2)
        }
        if (map.id === 'reliquary') {
          if (hash % 5 === 0) {
            context.fillStyle = palette.light
            context.fillRect(Math.round(x + 2), Math.round(y + 2), 4, 1)
            context.fillRect(Math.round(x + 5), Math.round(y + 3), 1, 3)
          } else if (hash % 3 === 0) {
            context.fillStyle = palette.mid
            context.fillRect(Math.round(x + 1), Math.round(y + 5), 3, 1)
          }
        } else if (hash % 19 === 0) {
          context.fillStyle = palette.accent
          if (hash % 2 === 0) {
            context.fillRect(Math.round(x + 3), Math.round(y + 2), 1, 4)
            context.fillRect(Math.round(x + 1), Math.round(y + 5), 5, 1)
          } else {
            context.fillRect(Math.round(x + 2), Math.round(y + 3), 4, 1)
            context.fillRect(Math.round(x + 5), Math.round(y + 1), 1, 4)
          }
        } else if (hash % 5 === 0) {
          context.fillStyle = palette.light
          context.fillRect(Math.round(x + 2), Math.round(y + 4), 2, 1)
          context.fillRect(Math.round(x + 5), Math.round(y + 2), 1, 1)
        }
      }
    }
    context.fillStyle = 'rgba(0, 0, 0, .16)'
    context.fillRect(0, 0, this.width, 2)
    context.fillRect(0, this.height - 2, this.width, 2)
    context.fillRect(0, 0, 2, this.height)
    context.fillRect(this.width - 2, 0, 2, this.height)
  }

  private drawTerrainDetails(map: MapDefinition) {
    const left = this.renderCameraX - this.width * this.displayScale / 2 - 180
    const top = this.renderCameraY - this.height * this.displayScale / WORLD_Y_SCALE / 2 - 180
    const grid = 180
    const startX = Math.floor(left / grid) * grid
    const startY = Math.floor(top / grid) * grid
    for (let x = startX; x < left + this.width * this.displayScale + 360; x += grid) {
      for (let y = startY; y < top + this.height * this.displayScale / WORLD_Y_SCALE + 360; y += grid) {
        const hash = Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1
        const jitterX = (Math.floor(hash * 11) % 3 - 1) * 30
        const jitterY = (Math.floor(hash * 23) % 3 - 1) * 30
        const kind = hash > 0.978 ? 'tree' : hash > 0.945 ? 'thorn' : hash > 0.865 ? 'ruin' : hash > 0.64 ? 'grass' : hash > 0.54 ? 'stones' : null
        if (kind) {
          const propX = this.snapX(x + jitterX)
          const propY = this.snapY(y + jitterY)
          if (map.id === 'gloamreach' && this.terrainPropAtlas.complete && this.terrainPropAtlas.naturalWidth > 0) {
            this.drawAuthoredTerrainProp(propX, propY, kind, hash)
          } else {
            this.drawTerrainProp(map.id, propX, propY, kind, hash)
          }
        }
      }
    }
  }

  private drawAuthoredTerrainProp(x: number, y: number, kind: 'tree' | 'thorn' | 'ruin' | 'grass' | 'stones', seed: number) {
    const context = this.context
    const index = kind === 'tree' ? 0
      : kind === 'thorn' ? 1
        : kind === 'ruin' ? (seed > 0.89 ? 2 : 5)
          : kind === 'grass' ? 3
            : seed > 0.525 ? 4 : 6
    const size = index === 0 ? 216
      : index === 1 ? 192
        : index === 2 || index === 5 || index === 4 ? 132
          : 78
    context.save()
    context.translate(x, y)
    context.scale(1, 1 / WORLD_Y_SCALE)
    this.drawAtlasSprite(this.terrainPropAtlas, 4, 2, index, 0, -size / 2, size, size, 0, true, seed < 0.5)
    context.restore()
  }

  private drawTerrainProp(mapId: MapDefinition['id'], x: number, y: number, kind: 'tree' | 'thorn' | 'ruin' | 'grass' | 'stones', seed: number) {
    const context = this.context
    const u = PIXEL_SCALE
    const ember = mapId === 'emberfall'
    const dungeon = mapId === 'reliquary'
    const shadow = dungeon ? '#05060a' : ember ? '#090403' : '#010b08'
    const greenDark = ember ? '#4b2018' : dungeon ? '#242633' : '#294f18'
    const green = ember ? '#8b3825' : dungeon ? '#4b4e62' : '#5f8c1d'
    const greenLight = ember ? '#c45230' : dungeon ? '#76798c' : '#86aa25'
    const barkDark = ember ? '#381611' : '#42281d'
    const bark = ember ? '#7a2c1f' : '#74432b'
    const barkLight = ember ? '#b2472d' : '#a66a3d'
    const block = (left: number, top: number, width: number, height: number, color: string, outline = false) => {
      if (outline) {
        context.fillStyle = shadow
        context.fillRect((left - 1) * u, (top - 1) * u, (width + 2) * u, (height + 2) * u)
      }
      context.fillStyle = color
      context.fillRect(left * u, top * u, width * u, height * u)
    }
    context.save()
    context.translate(x, y)
    context.scale(1, 1 / WORLD_Y_SCALE)
    if (kind === 'grass') {
      block(-4, 1, 9, 2, shadow)
      block(-3, -3, 1, 5, greenDark)
      block(-1, -6, 1, 8, green)
      block(1, -4, 1, 6, greenLight)
      block(3, -2, 1, 4, greenDark)
      block(-4, -2, 2, 1, green)
      block(1, -3, 3, 1, green)
    } else if (kind === 'stones') {
      const pale = dungeon ? '#737685' : '#68776e'
      block(-4, 0, 3, 2, pale, true)
      block(1, -2, 4, 2, pale, true)
      if (seed > 0.49) block(-1, -4, 2, 2, dungeon ? '#9999a4' : '#859188', true)
    } else if (kind === 'ruin') {
      const mid = dungeon ? '#525566' : '#525a56'
      const high = dungeon ? '#8b8d99' : '#858b83'
      block(-7, 2, 15, 2, shadow)
      block(-6, -2, 5, 4, mid, true)
      block(-5, -2, 3, 1, high)
      block(0, 0, 7, 2, mid, true)
      block(1, 0, 4, 1, high)
      block(3, -4, 3, 4, mid, true)
      block(4, -4, 2, 1, high)
    } else if (kind === 'thorn') {
      block(-9, 2, 19, 2, shadow)
      const thorn = ember ? '#9c3525' : '#8f3b29'
      const thornLight = ember ? '#f06436' : '#d95737'
      for (let step = -8; step <= 7; step += 3) {
        block(step, -1 - Math.abs(step % 4), 4, 1, barkDark, true)
        block(step + 1, -4 - Math.abs(step % 3), 1, 4, thorn)
        block(step + 1, -5 - Math.abs(step % 3), 1, 1, thornLight)
      }
      block(-7, -7, 14, 1, thorn)
      block(-8, -7, 1, 2, thornLight)
      block(7, -7, 1, 2, thornLight)
    } else {
      block(-8, 3, 17, 3, shadow)
      block(-2, -15, 4, 18, barkDark, true)
      block(-1, -14, 2, 15, bark)
      block(-8, -11, 8, 3, barkDark, true)
      block(-7, -11, 6, 1, barkLight)
      block(1, -9, 8, 3, barkDark, true)
      block(2, -9, 6, 1, barkLight)
      block(-6, -17, 2, 7, barkDark)
      block(5, -15, 2, 7, barkDark)
      block(-2, -20, 2, 7, bark)
    }
    context.restore()
  }

  private drawWalls(map: MapDefinition) {
    if (map.walls.length === 0) return
    const context = this.context
    for (const wall of map.walls) {
      const left = wall.x - wall.width / 2
      const top = wall.y - wall.height / 2
      context.fillStyle = '#030408'
      context.fillRect(left + 18, top + 18, wall.width, wall.height)
      context.fillStyle = '#171920'
      context.fillRect(left, top, wall.width, wall.height)
      context.save()
      context.beginPath()
      context.rect(left, top, wall.width, wall.height)
      context.clip()
      const brickWidth = 54
      const brickHeight = 36
      for (let row = 0, y = top; y < top + wall.height; row += 1, y += brickHeight) {
        const offset = row % 2 === 0 ? 0 : -brickWidth / 2
        for (let x = left + offset; x < left + wall.width; x += brickWidth) {
          context.fillStyle = '#05060a'
          context.fillRect(x + 3, y + 3, brickWidth - 6, brickHeight - 6)
          context.fillStyle = row % 3 === 0 ? '#4d4f58' : '#3b3d47'
          context.fillRect(x + 6, y + 6, brickWidth - 12, brickHeight - 12)
          context.fillStyle = '#777983'
          context.fillRect(x + 6, y + 6, brickWidth - 18, PIXEL_SCALE)
        }
      }
      context.restore()
      context.fillStyle = '#090a0f'
      context.fillRect(left, top, wall.width, PIXEL_SCALE)
      context.fillRect(left, top, PIXEL_SCALE, wall.height)
      context.fillStyle = '#8b8d97'
      context.fillRect(left + PIXEL_SCALE, top + PIXEL_SCALE, Math.max(0, wall.width - PIXEL_SCALE * 2), PIXEL_SCALE)
    }
  }

  private drawStructures(structures: StructureState[]) {
    const context = this.context
    for (const originalStructure of structures) {
      const structure = { ...originalStructure, x: this.snapX(originalStructure.x), y: this.snapY(originalStructure.y) }
      const pulse = 0.5 + Math.sin(performance.now() / 620 + structure.id) * 0.5
      const art = STRUCTURE_ART[structure.type]
      if (this.structureAtlas.complete && this.structureAtlas.naturalWidth > 0) {
        context.fillStyle = 'rgba(0,0,0,.55)'
        context.fillRect(structure.x - art.size * 0.25, structure.y, art.size * 0.5, 12)
        context.save()
        context.translate(structure.x, structure.y)
        context.scale(1, 1 / WORLD_Y_SCALE)
        this.drawAtlasSprite(this.structureAtlas, 3, 3, art.index, 0, -art.size / 2, art.size, art.size, 0, true)
        context.restore()
        if (structure.effect === 'heal') this.drawHeartCrystal(structure, art.color, pulse)
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
    }
  }

  private drawHeartCrystal(structure: StructureState, color: string, pulse: number) {
    const context = this.context
    const progress = structure.crystalReady ? 1 : Math.max(0, Math.min(1, (structure.crystalCharge ?? 0) / HEAL_CRYSTAL_SECONDS))
    const ringRadius = structure.radius * 0.72
    context.save()
    const segments = 16
    for (let segment = 0; segment < segments; segment += 1) {
      const angle = -Math.PI / 2 + segment / segments * TAU
      const active = segment / segments <= progress
      context.fillStyle = active ? (structure.crystalReady ? '#ef718e' : `rgb(${color})`) : 'rgba(3,8,7,.72)'
      context.fillRect(
        Math.round((structure.x + Math.cos(angle) * ringRadius) / PIXEL_SCALE) * PIXEL_SCALE - PIXEL_SCALE / 2,
        Math.round((structure.y + Math.sin(angle) * ringRadius) / PIXEL_SCALE) * PIXEL_SCALE - PIXEL_SCALE / 2,
        PIXEL_SCALE,
        PIXEL_SCALE,
      )
    }
    this.drawHeartIcon(
      structure.x,
      structure.y - 66 - (structure.crystalReady ? pulse * 3 : 0),
      structure.crystalReady ? 22 : 14,
      structure.crystalReady ? 1 : progress,
      structure.crystalReady ? '#ef718e' : `rgb(${color})`,
    )
    context.restore()
  }

  private drawPickups(snapshot: GameSnapshot) {
    const context = this.context
    for (const pickup of snapshot.pickups) {
      const pulse = 3 + Math.sin(performance.now() / 180 + pickup.id) * 1.2
      const x = this.snapX(pickup.x)
      const y = this.snapY(pickup.y)
      context.save()
      context.translate(x, y)
      context.rotate(Math.PI / 4)
      context.fillStyle = '#b6a5ff'
      context.fillRect(-pulse, -pulse, pulse * 2, pulse * 2)
      context.restore()
    }
  }

  private drawProjectiles(snapshot: GameSnapshot, predictionSeconds: number) {
    const context = this.context
    for (const projectile of snapshot.projectiles) {
      const x = this.snapX(projectile.x + projectile.vx * predictionSeconds)
      const y = this.snapY(projectile.y + projectile.vy * predictionSeconds)
      const angle = Math.atan2(projectile.vy * WORLD_Y_SCALE, projectile.vx)
      const block = PIXEL_SCALE
      context.save()
      context.translate(x, y)
      context.scale(1, 1 / WORLD_Y_SCALE)
      context.fillStyle = projectile.color
      if (projectile.melee) {
        for (let spark = -3; spark <= 3; spark += 1) {
          const slashAngle = angle + spark * 0.22
          const radius = projectile.radius * (1.25 + Math.abs(spark) * 0.12)
          context.fillRect(Math.round(Math.cos(slashAngle) * radius / block) * block - block / 2, Math.round(Math.sin(slashAngle) * radius / block) * block - block / 2, block, block)
        }
      } else {
        context.rotate(angle)
        if (projectile.enemy) {
          const size = projectile.radius >= 9 ? block * 3 : block * 2
          context.fillRect(-size / 2, -block / 2, size, block)
          context.fillRect(-block / 2, -size / 2, block, size)
        } else {
          const length = projectile.radius >= 8 ? block * 4 : block * 3
          context.fillRect(-length / 2, -block / 2, length, block)
          context.fillStyle = '#fff4c7'
          context.fillRect(length / 2 - block, -block / 2, block, block)
        }
      }
      context.restore()
    }
  }

  private drawBossWarnings(enemies: EnemyState[], predictionSeconds: number) {
    const context = this.context
    for (const enemy of enemies) {
      const strength = bossWarningStrength(enemy)
      if (strength <= 0) continue
      const x = this.snapX(enemy.x + enemy.vx * predictionSeconds)
      const y = this.snapY(enemy.y + enemy.vy * predictionSeconds)
      const facing = Math.hypot(enemy.vx, enemy.vy) > 1 ? Math.atan2(enemy.vy, enemy.vx) : (enemy.dashAngle ?? 0)
      const color = BOSS_COLORS[enemy.type] ?? '#ef718e'
      const pulse = 0.45 + Math.sin(performance.now() / 65) * 0.18
      context.save()
      context.translate(x, y)
      context.rotate(facing)
      context.globalAlpha = Math.min(0.9, 0.25 + strength * 0.6)
      context.fillStyle = `${color}22`
      context.strokeStyle = color
      context.lineWidth = 2 + strength * 2
      context.setLineDash([10, 7])
      if (enemy.type === 'broodmother' || enemy.type === 'iron-choir') {
        for (let ring = 1; ring <= 3; ring += 1) {
          context.beginPath(); context.arc(0, 0, ring * 70 * (0.82 + strength * 0.18), 0, TAU); context.stroke()
        }
      } else if (enemy.type === 'eclipse-eye' || enemy.type === 'prism-witch') {
        context.beginPath(); context.moveTo(0, 0); context.arc(0, 0, 390, -0.45, 0.45); context.closePath(); context.fill(); context.stroke()
      } else if (enemy.type === 'star-eater') {
        for (const offset of [-0.28, 0, 0.28]) {
          context.save(); context.rotate(offset); context.fillRect(0, -16 - pulse * 6, 520, 32 + pulse * 12); context.strokeRect(0, -16 - pulse * 6, 520, 32 + pulse * 12); context.restore()
        }
      } else {
        context.beginPath(); context.moveTo(0, -38); context.lineTo(480, -70); context.lineTo(480, 70); context.lineTo(0, 38); context.closePath(); context.fill(); context.stroke()
      }
      context.setLineDash([])
      context.restore()
    }
  }

  private drawEnemies(enemies: EnemyState[], predictionSeconds: number) {
    const context = this.context
    for (const enemy of enemies) {
      const x = this.snapX(enemy.x + enemy.vx * predictionSeconds)
      const y = this.snapY(enemy.y + enemy.vy * predictionSeconds)
      const burning = enemy.burn > 0
      const color = burning ? '#ff735c' : enemy.slow > 0 ? '#9bd6ff' : '#e8eee7'
      const boss = isBoss(enemy.type)
      const movement = Math.hypot(enemy.vx, enemy.vy)
      const facing = movement > 0.1 ? Math.atan2(enemy.vy, enemy.vx) : (this.enemyFacing.get(enemy.id) ?? 0)
      if (movement > 0.1) this.enemyFacing.set(enemy.id, facing)
      const stride = Math.sin(performance.now() / 105 + enemy.id * 1.73)
      const bob = movement > 1 ? (stride > 0 ? PIXEL_SCALE : 0) : 0
      const visualHeight = boss
        ? this.drawBossEnemy(enemy, x, y - bob, facing)
        : this.drawAmbientEnemy(enemy, x, y - bob, facing)
      if (boss) this.drawBossIdentity(enemy, x, y, facing)
      if (boss) {
        context.fillStyle = BOSS_COLORS[enemy.type] ?? '#ef718e'
        const bossMarker = enemy.finale ? 12 : 6
        context.fillRect(x - bossMarker / 2, y - (visualHeight + 15) / WORLD_Y_SCALE, bossMarker, PIXEL_SCALE)
        if (bossWeakPointIsOpen(enemy)) {
          const weakAngle = bossWeakPointAngle(enemy)
          const weakX = x + Math.cos(weakAngle) * enemy.radius * 0.82
          const weakY = y + Math.sin(weakAngle) * enemy.radius * 0.82
          context.fillStyle = '#fff4af'
          context.strokeStyle = color
          const weakSize = PIXEL_SCALE * (1 + (Math.sin(performance.now() / 90) > 0 ? 1 : 0))
          context.fillRect(weakX - weakSize / 2, weakY - weakSize / 2, weakSize, weakSize)
          context.strokeRect(weakX - weakSize / 2, weakY - weakSize / 2, weakSize, weakSize)
        }
      }
      if (boss || (enemy.type === 'bulwark' && enemy.maxHealth > 500)) {
        const barWidth = boss ? 130 : 92
        this.drawBar(x - barWidth / 2, y - (visualHeight + 7) / WORLD_Y_SCALE, barWidth, 5, enemy.health / enemy.maxHealth, BOSS_COLORS[enemy.type] ?? '#ef718e')
      }
    }
  }

  private drawAmbientEnemy(enemy: EnemyState, x: number, y: number, facing: number): number {
    const index = AMBIENT_ENEMY_INDEX[enemy.type]
    if (index === undefined || !this.enemySpriteAtlas.complete || this.enemySpriteAtlas.naturalWidth <= 0) {
      return this.drawPixelEnemy(enemy, x, y, facing)
    }
    const context = this.context
    const spriteSize = 96
    context.fillStyle = 'rgba(0,0,0,.72)'
    context.fillRect(x - 24, y, 48, PIXEL_SCALE)
    context.save()
    context.translate(x, y)
    context.scale(1, 1 / WORLD_Y_SCALE)
    this.drawAtlasSprite(this.enemySpriteAtlas, 4, 2, index, 0, -spriteSize / 2, spriteSize, spriteSize, 0, true, Math.cos(facing) < 0)
    if (enemy.burn > 0) {
      context.fillStyle = '#ff633f'
      context.fillRect(-18, -72, 6, 12)
      context.fillStyle = '#ffb14b'
      context.fillRect(12, -66, 6, 6)
    }
    if (enemy.slow > 0) {
      context.fillStyle = '#9bdcff'
      context.fillRect(-24, -6, 12, 6)
      context.fillRect(12, -6, 12, 6)
    }
    context.restore()
    return 90
  }

  private drawBossEnemy(enemy: EnemyState, x: number, y: number, facing: number): number {
    const index = BOSS_SPRITE_INDEX[enemy.type]
    if (index === undefined || !this.bossSpriteAtlas.complete || this.bossSpriteAtlas.naturalWidth <= 0) {
      return this.drawPixelEnemy(enemy, x, y, facing)
    }
    const context = this.context
    const spriteSize = enemy.finale ? 168 : 144
    context.fillStyle = 'rgba(0,0,0,.78)'
    context.fillRect(x - spriteSize * 0.34, y, spriteSize * 0.68, PIXEL_SCALE * 2)
    context.save()
    context.translate(x, y)
    context.scale(1, 1 / WORLD_Y_SCALE)
    this.drawAtlasSprite(this.bossSpriteAtlas, 4, 2, index, 0, -spriteSize / 2, spriteSize, spriteSize, 0, true, Math.cos(facing) < 0)
    if (enemy.burn > 0) {
      context.fillStyle = '#ff633f'
      context.fillRect(-36, -spriteSize + 6, 12, 18)
      context.fillStyle = '#ffb14b'
      context.fillRect(24, -spriteSize + 18, 6, 12)
    }
    if (enemy.slow > 0) {
      context.fillStyle = '#9bdcff'
      context.fillRect(-42, -6, 24, 6)
      context.fillRect(18, -6, 24, 6)
    }
    context.restore()
    return spriteSize - 12
  }

  private drawPixelEnemy(enemy: EnemyState, x: number, y: number, facing: number): number {
    const context = this.context
    const u = PIXEL_SCALE
    const boss = isBoss(enemy.type)
    const flip = Math.cos(facing) < 0 ? -1 : 1
    const visualHeight = boss ? 108 : enemy.type === 'bulwark' ? 72 : 60
    context.save()
    context.fillStyle = 'rgba(0,0,0,.62)'
    context.fillRect(x - (boss ? 9 : 4) * u, y + u, (boss ? 18 : 8) * u, boss ? 2 * u : u)
    context.translate(x, y)
    context.scale(1, 1 / WORLD_Y_SCALE)
    context.scale(flip, 1)
    const rect = (color: string, left: number, top: number, width: number, height: number) => {
      context.fillStyle = color
      context.fillRect(left * u, top * u, width * u, height * u)
    }

    if (enemy.type === 'thrall') {
      rect('#161716', -2, -3, 2, 3); rect('#161716', 1, -3, 2, 3)
      rect('#4c3528', -3, -7, 5, 4); rect('#7a5437', -2, -7, 3, 1)
      rect('#c8b78e', -2, -10, 3, 3); rect('#887b60', -2, -10, 3, 1)
      rect('#1a1715', 0, -9, 1, 1); rect('#c8b78e', 2, -6, 3, 1); rect('#8e7655', 4, -5, 1, 2)
    } else if (enemy.type === 'skitter') {
      rect('#171218', -5, -5, 10, 1); rect('#171218', -4, -7, 1, 5); rect('#171218', 3, -7, 1, 5)
      rect('#29182f', -3, -6, 6, 4); rect('#743a83', -2, -7, 4, 4); rect('#b258b2', -1, -6, 2, 1)
      rect('#f0d180', 1, -5, 1, 1)
    } else if (enemy.type === 'spitter') {
      rect('#5b1722', -4, -7, 8, 6); rect('#a83343', -3, -8, 6, 8)
      rect('#ead9bb', -2, -6, 4, 4); rect('#5b1020', -1, -6, 2, 4); rect('#fff1d0', 0, -5, 1, 2)
      rect('#7d202b', -5, -6, 2, 1); rect('#7d202b', 3, -3, 2, 1)
    } else if (enemy.type === 'bulwark') {
      rect('#292b2d', -4, -4, 3, 4); rect('#292b2d', 2, -4, 3, 4)
      rect('#4b4e4e', -5, -10, 10, 7); rect('#77796f', -3, -12, 6, 4)
      rect('#a0a38e', -2, -11, 2, 1); rect('#202124', 1, -10, 1, 1)
      rect('#666961', -6, -9, 2, 6); rect('#666961', 4, -8, 3, 5)
    } else if (enemy.type === 'wraith') {
      rect('#0b2528', -4, -7, 8, 6); rect('#0e525a', -3, -10, 6, 8); rect('#167a7d', -2, -11, 4, 3)
      rect('#b9d6c9', -1, -9, 2, 2); rect('#071415', 0, -9, 1, 1)
      rect('#16454b', -5, -5, 2, 3); rect('#16454b', 3, -4, 3, 2)
    } else if (enemy.type === 'charger') {
      rect('#3a1717', -5, -5, 8, 5); rect('#8a2c29', -4, -7, 8, 5); rect('#b85b3e', 2, -8, 4, 4)
      rect('#e2c58b', 4, -10, 1, 2); rect('#e2c58b', 6, -9, 2, 1); rect('#1b1514', 4, -7, 1, 1)
      rect('#211717', -4, -2, 2, 2); rect('#211717', 1, -2, 2, 2)
    } else if (enemy.type === 'hexer') {
      rect('#16121c', -3, -3, 2, 3); rect('#16121c', 1, -3, 2, 3)
      rect('#36234f', -4, -8, 8, 6); rect('#67438c', -3, -11, 6, 5); rect('#17121e', -2, -9, 4, 3)
      rect('#d8b989', 0, -8, 1, 1); rect('#b986ff', 4, -7, 1, 7); rect('#e0c2ff', 3, -7, 3, 2)
    } else if (enemy.type === 'leech') {
      rect('#491622', -4, -7, 8, 7); rect('#842438', -3, -8, 6, 8); rect('#d65b63', -2, -6, 4, 4)
      rect('#221318', -1, -5, 2, 2); rect('#e8c7a1', -2, -6, 1, 1); rect('#e8c7a1', 1, -3, 1, 1)
    } else if (enemy.type === 'tollkeeper') {
      rect('#241d18', -6, -4, 4, 4); rect('#241d18', 2, -4, 4, 4)
      rect('#5c4327', -7, -12, 14, 9); rect('#c18736', -5, -14, 10, 9); rect('#f0bf52', -4, -13, 8, 2)
      rect('#2a2020', -3, -11, 6, 5); rect('#f4dc8c', 1, -10, 1, 1); rect('#b47a2a', -9, -11, 3, 8)
    } else if (enemy.type === 'broodmother') {
      rect('#161118', -12, -7, 24, 2); rect('#161118', -10, -11, 3, 10); rect('#161118', 7, -11, 3, 10)
      rect('#331a3a', -8, -11, 16, 9); rect('#773a85', -5, -14, 10, 10); rect('#b558ad', -3, -13, 6, 3)
      rect('#e7cb77', -2, -10, 1, 1); rect('#e7cb77', 2, -10, 1, 1)
    } else if (enemy.type === 'graveknight') {
      rect('#17191c', -5, -5, 4, 5); rect('#17191c', 2, -5, 4, 5)
      rect('#343a42', -7, -14, 14, 10); rect('#626a72', -5, -17, 10, 6); rect('#24272d', -4, -15, 8, 3)
      rect('#72d8d3', 1, -14, 2, 1); rect('#b98f45', -7, -10, 14, 2)
    } else if (enemy.type === 'eclipse-eye') {
      rect('#29143c', -9, -14, 18, 14); rect('#67428f', -7, -16, 14, 16); rect('#d8c3e5', -4, -12, 8, 8)
      rect('#8d36c8', -2, -12, 4, 8); rect('#fff0bb', 0, -10, 1, 4)
      rect('#2d1740', -11, -10, 3, 3); rect('#2d1740', 8, -6, 3, 3)
    } else if (enemy.type === 'void-hart') {
      rect('#111819', -5, -5, 4, 5); rect('#111819', 2, -5, 4, 5); rect('#17383b', -7, -14, 14, 10)
      rect('#266b68', -5, -17, 10, 5); rect('#68d8cb', -4, -19, 2, 4); rect('#68d8cb', 3, -19, 2, 4)
      rect('#e4d8a3', 1, -15, 1, 1)
    } else if (enemy.type === 'prism-witch') {
      rect('#191221', -5, -4, 4, 4); rect('#191221', 2, -4, 4, 4); rect('#43245c', -8, -13, 16, 10)
      rect('#7b4195', -5, -17, 10, 7); rect('#1c1422', -3, -14, 6, 4); rect('#ff8be9', 1, -13, 1, 1)
      rect('#efcc75', 8, -15, 1, 15); rect('#8cd8ff', 7, -17, 3, 3)
    } else if (enemy.type === 'iron-choir') {
      rect('#27201a', -7, -5, 5, 5); rect('#27201a', 3, -5, 5, 5); rect('#6a472d', -9, -13, 18, 9)
      rect('#c17b45', -7, -17, 5, 7); rect('#d99a59', -2, -19, 5, 9); rect('#b66a3f', 4, -16, 5, 6)
      rect('#211818', -5, -14, 1, 1); rect('#211818', 0, -16, 1, 1); rect('#211818', 6, -13, 1, 1)
    } else if (enemy.type === 'star-eater') {
      rect('#120e1d', -10, -15, 20, 15); rect('#3d2364', -8, -17, 16, 17); rect('#7d4ac1', -5, -13, 10, 9)
      rect('#e8d7ee', -3, -11, 6, 6); rect('#321049', -1, -11, 3, 6); rect('#fff3ad', 0, -10, 1, 4)
      rect('#9b65ed', -12, -12, 3, 3); rect('#9b65ed', 9, -6, 3, 3)
    }

    if (enemy.burn > 0) {
      rect('#ff633f', -3, boss ? -20 : -12, 1, 2); rect('#ffb14b', 2, boss ? -18 : -11, 1, 1)
    }
    if (enemy.slow > 0) {
      rect('#9bdcff', -4, -2, 2, 1); rect('#d8f6ff', 2, -1, 2, 1)
    }
    context.restore()
    return visualHeight
  }

  private drawBossIdentity(enemy: EnemyState, x: number, y: number, facing: number) {
    const context = this.context
    context.save()
    context.translate(x, y)
    const pulse = Math.sin(enemy.phase * 3) * 3
    // Graveknight's complete blade is authored inside the atlas cell so it can
    // never be clipped or detach from the body as the boss changes direction.
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
      const x = this.snapX(companion.x + companion.vx * predictionSeconds)
      const y = this.snapY(companion.y + companion.vy * predictionSeconds)
      const size = companion.kind === 'mercy-moth' || companion.kind === 'sunbird' || companion.kind === 'gravewing' ? 72
        : companion.kind === 'aegis-hound' || companion.kind === 'thornling' ? 96 : 84
      context.save()
      context.fillStyle = 'rgba(0,0,0,.38)'
      context.beginPath()
      context.ellipse(x, y + PIXEL_SCALE, size * 0.24, size * 0.08, 0, 0, TAU)
      context.fill()
      context.translate(x, y)
      context.scale(1, 1 / WORLD_Y_SCALE)
      this.drawAtlasSprite(
        this.companionSpriteAtlas, 4, 2, COMPANION_SPRITE_INDEX[companion.kind],
        0, -size / 2, size, size, 0, true, Math.cos(companion.aim) < 0,
      )
      context.restore()
    }
  }

  private drawPlayers(players: PlayerState[], localPlayerId: string, predictionSeconds: number) {
    const context = this.context
    for (const player of players) {
      if (player.eliminated) continue
      const prediction = player.downed ? 0 : predictionSeconds
      const x = this.snapX(player.x + player.vx * prediction)
      const y = this.snapY(player.y + player.vy * prediction)
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
      }
      if (player.specialPulse > 0 && !player.downed) this.drawSpecialPulse(player, x, y)

      if (this.drawAuthoredHunter(player, x, y, localPlayerId)) continue
      if (this.drawStylizedHunter(player, x, y, localPlayerId)) continue

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

  private drawAuthoredHunter(player: PlayerState, x: number, y: number, localPlayerId: string): boolean {
    const index = PIXEL_HUNTER_INDEX[player.character]
    if (index === undefined || !this.hunterSpriteAtlas.complete || this.hunterSpriteAtlas.naturalWidth <= 0) return false
    const context = this.context
    const local = player.id === localPlayerId
    const moving = !player.downed && Math.hypot(player.vx, player.vy) > 8
    const stride = moving && Math.sin(performance.now() / 92 + index * 1.71) > 0 ? PIXEL_SCALE : 0
    const recoil = player.fireCooldown > 0 && !player.downed ? PIXEL_SCALE : 0
    const screenAim = Math.atan2(Math.sin(player.aim) * WORLD_Y_SCALE, Math.cos(player.aim))
    const flip = Math.cos(screenAim) < 0
    const spriteX = x - Math.cos(player.aim) * recoil
    const spriteY = y - Math.sin(player.aim) * recoil - stride

    context.fillStyle = 'rgba(0,0,0,.72)'
    context.fillRect(x - 30, y, 60, PIXEL_SCALE)
    if (local && !player.downed) {
      context.fillStyle = player.color
      context.fillRect(x - PIXEL_SCALE / 2, y + PIXEL_SCALE, PIXEL_SCALE, PIXEL_SCALE)
    }

    context.save()
    context.translate(spriteX, spriteY)
    context.scale(1, 1 / WORLD_Y_SCALE)
    context.globalAlpha = player.downed ? 0.45 : 1
    this.drawAtlasSprite(this.hunterSpriteAtlas, 4, 2, index, 0, -60, 96, 120, 0, true, flip)

    if (!player.downed && this.weaponSpriteAtlas.complete && this.weaponSpriteAtlas.naturalWidth > 0) {
      context.save()
      context.translate(0, -45)
      context.rotate(screenAim)
      context.translate(21 - recoil, 0)
      this.drawAtlasSprite(this.weaponSpriteAtlas, 5, 2, WEAPON_SPRITE_INDEX[player.weapon], 0, 0, 72, 36, 0, true)
      if (player.fireCooldown > 0 && player.weapon !== 'sword') {
        context.fillStyle = '#ffad3f'
        context.fillRect(32, -6, 12, 12)
        context.fillStyle = '#fff0a8'
        context.fillRect(38, -3, 12, 6)
      }
      context.restore()
    }
    context.restore()

    if (player.downed) {
      context.strokeStyle = '#ef718e'
      context.lineWidth = PIXEL_SCALE
      context.beginPath()
      context.moveTo(x - 12, y - 36)
      context.lineTo(x + 12, y - 12)
      context.moveTo(x + 12, y - 36)
      context.lineTo(x - 12, y - 12)
      context.stroke()
      this.drawBar(x - 24, y - 78, 48, PIXEL_SCALE, player.reviveProgress / 2.2, '#f2d479')
    }
    return true
  }

  private drawStylizedHunter(player: PlayerState, x: number, y: number, localPlayerId: string): boolean {
    const context = this.context
    const visual = HUNTER_VISUALS[player.character]
    const local = player.id === localPlayerId
    const moving = !player.downed && Math.hypot(player.vx, player.vy) > 8
    const phase = performance.now() / 92 + CHARACTER_SPRITE_INDEX[player.character] * 1.71
    const stride = moving ? (Math.sin(phase) >= 0 ? 1 : -1) : 0
    const screenAim = Math.atan2(Math.sin(player.aim) * WORLD_Y_SCALE, Math.cos(player.aim))
    const direction = Math.round(screenAim / (Math.PI / 4)) * (Math.PI / 4)
    const directionX = Math.round(Math.cos(direction))
    const directionY = Math.round(Math.sin(direction))
    const facing = directionX < 0 ? -1 : 1
    const u = PIXEL_SCALE
    const build = visual.build
    const recoil = player.fireCooldown > 0 && !player.downed ? u : 0

    context.save()
    context.fillStyle = 'rgba(0,0,0,.62)'
    context.fillRect(x - 3 * u * build, y + 4 * u, 6 * u * build, u)
    if (local && !player.downed) {
      context.strokeStyle = player.color
      context.lineWidth = u
      const ring = 6 * u
      context.strokeRect(x - ring / 2, y - ring * 0.28, ring, ring * 0.72)
    }
    context.restore()

    context.save()
    context.translate(x, y)
    context.scale(1, 1 / WORLD_Y_SCALE)
    context.globalAlpha = player.downed ? 0.5 : 1
    if (player.downed) {
      context.fillStyle = visual.hair
      context.fillRect(-4 * u, -2 * u, 3 * u, 3 * u)
      context.fillStyle = visual.skin
      context.fillRect(-u, -u, 2 * u, 2 * u)
      context.fillStyle = visual.coat
      context.fillRect(u, -u, 5 * u * build, 2 * u)
      context.fillStyle = '#171820'
      context.fillRect(4 * u, u, 3 * u, u)
      context.restore()
      context.save()
      context.strokeStyle = '#ef718e'
      context.lineWidth = u
      context.beginPath(); context.moveTo(x - 2 * u, y - 2 * u); context.lineTo(x + 2 * u, y + 2 * u); context.moveTo(x + 2 * u, y - 2 * u); context.lineTo(x - 2 * u, y + 2 * u); context.stroke()
      context.restore()
      this.drawBar(x - 4 * u, y - 5 * u, 8 * u, u, player.reviveProgress / 2.2, '#f2d479')
      return true
    }

    const stepLeft = stride < 0 ? u : 0
    const stepRight = stride > 0 ? u : 0
    const bodyShift = directionX * u * 0.5
    const headShift = directionX * u
    const hairTrailX = -directionX || -facing
    const hairTrailY = directionY < 0 ? 1 : 0

    // Hair is laid down first so the upright body reads as a genuine 3/4 figure.
    if (visual.style === 'long' || visual.style === 'waves' || visual.style === 'braid' || visual.style === 'ponytail') {
      context.fillStyle = visual.hair
      context.fillRect(headShift - 2 * u, -12 * u, 4 * u, 4 * u)
      context.fillRect(headShift + hairTrailX * 2 * u, (-9 + hairTrailY) * u, 2 * u, 4 * u)
      if (visual.hairLength >= 16) context.fillRect(headShift + hairTrailX * 3 * u, (-6 + hairTrailY) * u, 2 * u, 3 * u)
      if (player.character === 'rapunsel') context.fillRect(headShift + hairTrailX * 4 * u, -3 * u, 2 * u, 7 * u)
      context.fillRect(headShift - 2 * u, -10 * u, u, 4 * u)
      context.fillRect(headShift + u, -10 * u, u, 3 * u)
      context.globalAlpha *= 0.55
      context.fillStyle = visual.accent
      context.fillRect(headShift + hairTrailX * 2 * u, (-8 + hairTrailY) * u, u, 2 * u)
      context.globalAlpha = player.downed ? 0.5 : 1
    } else {
      context.fillStyle = visual.hair
      context.fillRect(headShift - 2 * u, -12 * u, 4 * u, 3 * u)
    }

    // Two offset legs and a short torso keep the approved top-facing/3/4 stance.
    context.fillStyle = visual.coat
    context.fillRect(bodyShift - 2 * u, -u + stepLeft, 2 * u, 6 * u)
    context.fillRect(bodyShift + u, -u + stepRight, 2 * u, 6 * u)
    context.fillStyle = '#090b10'
    context.fillRect(bodyShift - 2 * u, 4 * u + stepLeft, 2 * u, 2 * u)
    context.fillRect(bodyShift + u, 4 * u + stepRight, 2 * u, 2 * u)
    context.fillStyle = '#121419'
    context.fillRect(bodyShift - 2.5 * u * build, -7 * u, 5 * u * build, 7 * u)
    context.fillRect(bodyShift - 3 * u * build, -6 * u, 6 * u * build, 2 * u)
    context.fillStyle = visual.coat
    context.fillRect(bodyShift - 1.5 * u, -6 * u, 3 * u, 4 * u)
    context.fillStyle = visual.accent
    context.fillRect(bodyShift - 2 * u * build, -2 * u, 4 * u * build, u)
    if (player.awakened) context.fillRect(bodyShift - u / 2, -7 * u, u, u)

    context.fillStyle = visual.skin
    context.fillRect(bodyShift - 3 * u * build, -5 * u, u, 3 * u)
    context.fillRect(bodyShift + (2 * u * build), -5 * u, u, 2 * u)
    context.fillRect(headShift - u / 2, -8 * u, u, u)

    // Face, fringe, and eye move between eight discrete look directions without rotating upside down.
    context.fillStyle = visual.skin
    context.fillRect(headShift - 1.5 * u, -11 * u, 3 * u, 3 * u)
    context.fillStyle = visual.hair
    context.fillRect(headShift - 2 * u, -12 * u, 4 * u, u)
    context.fillRect(headShift - 2 * u, -11 * u, u, 2 * u)
    if (facing < 0) context.fillRect(headShift + u, -11 * u, u, u)
    context.fillStyle = '#edf7ee'
    const eyeX = headShift + (directionX > 0 ? u / 2 : directionX < 0 ? -u : -u / 2)
    const eyeY = directionY > 0 ? -9 * u : -10 * u
    context.fillRect(eyeX, eyeY, u / 2, u / 2)

    // Aim is exact, while the body remains upright and uses the closest 8-way pose.
    context.save()
    context.translate(bodyShift + directionX * u, -6 * u + directionY * u * 0.5)
    context.rotate(screenAim)
    context.fillStyle = visual.skin
    context.fillRect(-u, -u / 2, 2 * u, u)
    context.translate(u - recoil, 0)
    this.drawHunterWeapon(player.weapon, visual.accent, recoil > 0)
    context.restore()
    context.restore()
    return true
  }

  private drawHunterWeapon(weapon: PlayerState['weapon'], accent: string, firing = false) {
    const context = this.context
    const u = PIXEL_SCALE
    context.fillStyle = '#20242a'
    if (weapon === 'sword') {
      context.fillStyle = '#8c6139'
      context.fillRect(-u, -u / 2, 2 * u, u)
      context.fillStyle = '#fff0bd'
      context.fillRect(u, -u / 2, 6 * u, u)
      context.fillStyle = accent
      context.fillRect(6 * u, -u / 2, u, u)
      context.fillStyle = '#b98f45'
      context.fillRect(0, -1.5 * u, u, 3 * u)
      return
    }
    const length = weapon === 'railgun' ? 6 : weapon === 'scattergun' || weapon === 'frost-cannon' ? 5 : weapon === 'revolver' ? 3 : 4
    context.fillRect(0, -u / 2, length * u, u)
    context.fillStyle = '#080b0e'
    context.fillRect(u, u / 2, u, u)
    context.fillStyle = accent
    if (weapon === 'grenade-launcher' || weapon === 'seeker') context.fillRect(2 * u, -u, 2 * u, 2 * u)
    else context.fillRect((length - 1) * u, -u / 2, u, u)
    if (firing) {
      context.fillStyle = '#ffb348'
      context.fillRect(length * u, -u, u, 2 * u)
      context.fillStyle = '#fff2a8'
      context.fillRect((length + 1) * u, -u / 2, u, u)
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
      const x = this.snapX(effect.x)
      const y = this.snapY(effect.y)
      const progress = Math.max(0, effect.life) / (effect.type === 'hurt' ? 0.32 : 0.2)
      const color = effect.type === 'hurt' ? '239, 113, 142' : '242, 212, 121'
      context.strokeStyle = `rgba(${color}, ${progress})`
      context.lineWidth = 2
      context.beginPath()
      context.arc(x, y, 9 + (1 - progress) * 14, 0, TAU)
      context.stroke()
      for (let spark = 0; spark < 5; spark += 1) {
        const angle = (spark / 5) * TAU + effect.x * 0.013
        const inner = 5 + (1 - progress) * 7
        const outer = inner + 6 * progress
        context.beginPath()
        context.moveTo(x + Math.cos(angle) * inner, y + Math.sin(angle) * inner)
        context.lineTo(x + Math.cos(angle) * outer, y + Math.sin(angle) * outer)
        context.stroke()
      }
    }
    this.effects = this.effects.filter((effect) => effect.life > 0)
  }

  private drawVignette() {
    const context = this.context
    context.fillStyle = 'rgba(0,3,2,.18)'
    context.fillRect(0, 0, this.width, 1)
    context.fillRect(0, this.height - 1, this.width, 1)
    context.fillRect(0, 0, 1, this.height)
    context.fillRect(this.width - 1, 0, 1, this.height)
  }

  private drawEdgeMarkers(players: PlayerState[], localPlayerId: string) {
    const context = this.context
    for (const player of players) {
      if (player.id === localPlayerId || player.eliminated) continue
      const sx = (player.x - this.renderCameraX) / this.displayScale + this.width / 2
      const sy = (player.y - this.renderCameraY) * WORLD_Y_SCALE / this.displayScale + this.height / 2
      if (sx > 8 && sx < this.width - 8 && sy > 8 && sy < this.height - 8) continue
      const angle = Math.atan2(sy - this.height / 2, sx - this.width / 2)
      const radiusX = this.width / 2 - 6
      const radiusY = this.height / 2 - 6
      const scale = Math.min(Math.abs(radiusX / (Math.cos(angle) || 0.001)), Math.abs(radiusY / (Math.sin(angle) || 0.001)))
      const x = this.width / 2 + Math.cos(angle) * scale
      const y = this.height / 2 + Math.sin(angle) * scale
      context.fillStyle = player.color
      context.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3)
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
