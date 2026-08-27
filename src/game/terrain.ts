import type { MapDefinition } from './maps'

export type TerrainPropKind = 'tree' | 'thorn' | 'ruin' | 'grass' | 'stones'

export interface TerrainProp {
  id: string
  x: number
  y: number
  kind: TerrainPropKind
  seed: number
  solidRadius: number
  hazardRadius: number
}

export const TERRAIN_GRID = 180

const fract = (value: number) => value - Math.floor(value)
const terrainHash = (cellX: number, cellY: number, salt: number) => fract(
  Math.sin(cellX * 12.9898 + cellY * 78.233 + salt * 41.713) * 43758.5453,
)

const nearestPixelStep = (value: number) => Math.round(value / 6) * 6

const propKind = (seed: number): TerrainPropKind | undefined => seed > 0.978 ? 'tree'
  : seed > 0.945 ? 'thorn'
    : seed > 0.865 ? 'ruin'
      : seed > 0.64 ? 'grass'
        : seed > 0.54 ? 'stones'
          : undefined

const propRadii = (kind: TerrainPropKind): Pick<TerrainProp, 'solidRadius' | 'hazardRadius'> => {
  if (kind === 'tree') return { solidRadius: 31, hazardRadius: 0 }
  if (kind === 'ruin') return { solidRadius: 43, hazardRadius: 0 }
  if (kind === 'thorn') return { solidRadius: 0, hazardRadius: 62 }
  return { solidRadius: 0, hazardRadius: 0 }
}

const overlapsProtectedArea = (map: MapDefinition, x: number, y: number): boolean => {
  if (x * x + y * y < 155 * 155) return true
  return map.structures.some((structure) => {
    const dx = x - structure.x
    const dy = y - structure.y
    const clearance = structure.radius + 105
    return dx * dx + dy * dy < clearance * clearance
  })
}

export const terrainPropAt = (map: MapDefinition, cellX: number, cellY: number): TerrainProp | undefined => {
  const seed = terrainHash(cellX, cellY, 0)
  let kind = propKind(seed)
  if (!kind) return undefined

  // Reliquary masonry is the dungeon's navigation layer. Keep its room dressing
  // decorative so a random prop can never silently seal a doorway.
  if (map.id === 'reliquary' && (kind === 'tree' || kind === 'thorn' || kind === 'ruin')) {
    kind = seed > 0.95 ? 'stones' : 'grass'
  }

  const x = cellX + nearestPixelStep((terrainHash(cellX, cellY, 1) - 0.5) * 144)
  const y = cellY + nearestPixelStep((terrainHash(cellX, cellY, 2) - 0.5) * 144)
  if (x < map.bounds.minX + 80 || x > map.bounds.maxX - 80 || y < map.bounds.minY + 80 || y > map.bounds.maxY - 80) return undefined
  if (overlapsProtectedArea(map, x, y)) return undefined
  return { id: `${cellX}:${cellY}`, x, y, kind, seed, ...propRadii(kind) }
}

export const terrainPropsInBounds = (
  map: MapDefinition,
  left: number,
  top: number,
  right: number,
  bottom: number,
): TerrainProp[] => {
  const props: TerrainProp[] = []
  const startX = Math.floor(left / TERRAIN_GRID) * TERRAIN_GRID
  const startY = Math.floor(top / TERRAIN_GRID) * TERRAIN_GRID
  for (let cellX = startX; cellX <= right + TERRAIN_GRID; cellX += TERRAIN_GRID) {
    for (let cellY = startY; cellY <= bottom + TERRAIN_GRID; cellY += TERRAIN_GRID) {
      const prop = terrainPropAt(map, cellX, cellY)
      if (prop && prop.x >= left - 120 && prop.x <= right + 120 && prop.y >= top - 120 && prop.y <= bottom + 120) props.push(prop)
    }
  }
  return props
}

export const terrainPropsNear = (map: MapDefinition, x: number, y: number, radius = 120): TerrainProp[] => terrainPropsInBounds(
  map, x - radius, y - radius, x + radius, y + radius,
)

export const pointTouchesThorns = (map: MapDefinition, x: number, y: number, radius = 0): TerrainProp | undefined => terrainPropsNear(map, x, y, 100)
  .find((prop) => prop.hazardRadius > 0 && Math.hypot(x - prop.x, y - prop.y) < prop.hazardRadius + radius)

export const circleHitsSolidTerrain = (map: MapDefinition, x: number, y: number, radius: number): boolean => terrainPropsNear(map, x, y, 120)
  .some((prop) => prop.solidRadius > 0 && Math.hypot(x - prop.x, y - prop.y) < prop.solidRadius + radius)

export const segmentHitsSolidTerrain = (
  map: MapDefinition,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  padding = 0,
): boolean => {
  const left = Math.min(ax, bx) - padding - 70
  const top = Math.min(ay, by) - padding - 70
  const right = Math.max(ax, bx) + padding + 70
  const bottom = Math.max(ay, by) + padding + 70
  const dx = bx - ax
  const dy = by - ay
  const lengthSquared = dx * dx + dy * dy
  return terrainPropsInBounds(map, left, top, right, bottom).some((prop) => {
    if (prop.solidRadius <= 0) return false
    const t = lengthSquared <= 0.00001 ? 0 : Math.max(0, Math.min(1, ((prop.x - ax) * dx + (prop.y - ay) * dy) / lengthSquared))
    const closestX = ax + dx * t
    const closestY = ay + dy * t
    const radius = prop.solidRadius + padding
    return (closestX - prop.x) ** 2 + (closestY - prop.y) ** 2 < radius * radius
  })
}
