import type { EnemyState, GameEvent, GameSnapshot, PlayerState, StructureState } from './types'

interface Effect {
  x: number
  y: number
  life: number
  type: GameEvent['type']
}

const TAU = Math.PI * 2

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

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas rendering is not supported in this browser.')
    this.context = context
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

  render(snapshot: GameSnapshot, localPlayerId: string) {
    const now = performance.now()
    const dt = Math.min(0.05, (now - this.lastFrame) / 1000)
    this.lastFrame = now
    const focus = snapshot.players.find((player) => player.id === localPlayerId) ?? snapshot.players[0]
    if (focus) {
      this.cameraX += (focus.x - this.cameraX) * Math.min(1, dt * 10)
      this.cameraY += (focus.y - this.cameraY) * Math.min(1, dt * 10)
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
    this.drawProjectiles(snapshot)
    this.drawEnemies(snapshot.enemies)
    this.drawPlayers(snapshot.players, localPlayerId)
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
    const glow = context.createRadialGradient(this.width / 2, this.height / 2, 0, this.width / 2, this.height / 2, this.width * 0.7)
    glow.addColorStop(0, 'rgba(27, 57, 48, .45)')
    glow.addColorStop(0.55, 'rgba(7, 16, 14, .18)')
    glow.addColorStop(1, 'rgba(1, 6, 5, .88)')
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

  private drawProjectiles(snapshot: GameSnapshot) {
    const context = this.context
    context.lineCap = 'round'
    for (const projectile of snapshot.projectiles) {
      context.strokeStyle = projectile.color
      context.lineWidth = projectile.radius * 1.4
      context.globalAlpha = projectile.enemy ? 0.8 : 0.95
      context.beginPath()
      context.moveTo(projectile.x, projectile.y)
      context.lineTo(projectile.x - projectile.vx * 0.025, projectile.y - projectile.vy * 0.025)
      context.stroke()
    }
    context.globalAlpha = 1
  }

  private drawEnemies(enemies: EnemyState[]) {
    const context = this.context
    for (const enemy of enemies) {
      const burning = enemy.burn > 0
      const color = burning ? '#ff735c' : enemy.slow > 0 ? '#9bd6ff' : '#e8eee7'
      context.save()
      context.translate(enemy.x, enemy.y)
      context.rotate(Math.atan2(enemy.vy, enemy.vx) + Math.PI / 2)
      context.strokeStyle = color
      context.fillStyle = enemy.type === 'tollkeeper' ? 'rgba(105, 33, 62, .82)' : 'rgba(12, 22, 19, .9)'
      context.lineWidth = enemy.type === 'tollkeeper' ? 4 : 2
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
      } else if (enemy.type === 'tollkeeper') {
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
      if (enemy.type === 'tollkeeper') {
        context.strokeStyle = '#f2d479'
        context.lineWidth = 2
        context.beginPath()
        context.arc(0, 0, enemy.radius * 0.55, 0, TAU)
        context.stroke()
        this.drawGlyph(0, 3, 'Ⅰ', '#f2d479', 24)
      }
      context.restore()

      if ((enemy.type === 'tollkeeper' || enemy.type === 'bulwark') && enemy.maxHealth > 500) {
        this.drawBar(enemy.x - 42, enemy.y - enemy.radius - 14, 84, 5, enemy.health / enemy.maxHealth, '#ef718e')
      }
    }
  }

  private drawPlayers(players: PlayerState[], localPlayerId: string) {
    const context = this.context
    for (const player of players) {
      if (player.eliminated) continue
      if (player.character === 'bastion' && !player.downed) {
        const radius = player.awakened ? 300 : 150
        context.fillStyle = 'rgba(116, 216, 194, .025)'
        context.strokeStyle = 'rgba(116, 216, 194, .16)'
        context.lineWidth = 1
        context.beginPath()
        context.arc(player.x, player.y, radius, 0, TAU)
        context.fill()
        context.stroke()
      }

      context.save()
      context.translate(player.x, player.y)
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
      this.drawBar(player.x - 21, player.y - 27, 42, 4, player.health / player.maxHealth, player.downed ? '#ef718e' : player.color)
      if (player.downed) this.drawBar(player.x - 21, player.y - 20, 42, 3, player.reviveProgress / 2.2, '#f2d479')
      this.drawLabel(player.x, player.y + 31, `${player.name}${player.awakened ? ' ✦' : ''}`, player.id === localPlayerId ? '#f5f1de' : '#b8c4bd')
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
      context.strokeStyle = effect.type === 'hurt' ? `rgba(239, 113, 142, ${progress})` : `rgba(242, 212, 121, ${progress})`
      context.lineWidth = 2
      context.beginPath()
      context.arc(effect.x, effect.y, 9 + (1 - progress) * 14, 0, TAU)
      context.stroke()
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
