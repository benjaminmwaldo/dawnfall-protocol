import type { MapId, MapWall, StructureEffect, StructureType } from './types'

export interface MapStructurePlacement {
  type: StructureType
  effect: StructureEffect
  x: number
  y: number
  radius: number
}

export interface MapDefinition {
  id: MapId
  name: string
  epithet: string
  description: string
  accent: string
  textureIndex: number
  bounds: { minX: number; maxX: number; minY: number; maxY: number }
  structures: readonly MapStructurePlacement[]
  walls: readonly MapWall[]
  spawnPoints: readonly { x: number; y: number }[]
}

const wall = (id: string, x: number, y: number, width: number, height: number): MapWall => ({ id, x, y, width, height })

const RELIQUARY_WALLS: MapWall[] = [
  wall('outer-north', 0, -1000, 2800, 100),
  wall('outer-south', 0, 1000, 2800, 100),
  wall('outer-west', -1400, 0, 100, 2100),
  wall('outer-east', 1400, 0, 100, 2100),
]

for (const x of [-450, 450]) {
  const segments = [
    { y: -855, height: 190 },
    { y: -325, height: 430 },
    { y: 325, height: 430 },
    { y: 855, height: 190 },
  ]
  for (const [index, segment] of segments.entries()) {
    RELIQUARY_WALLS.push(wall(`vertical-${x}-${index}`, x, segment.y, 72, segment.height))
  }
}

for (const y of [-325, 325]) {
  const segments = [
    { x: -1180, width: 340 },
    { x: -450, width: 680 },
    { x: 450, width: 680 },
    { x: 1180, width: 340 },
  ]
  for (const [index, segment] of segments.entries()) {
    RELIQUARY_WALLS.push(wall(`horizontal-${y}-${index}`, segment.x, y, segment.width, 72))
  }
}

export const MAPS: readonly MapDefinition[] = [
  {
    id: 'gloamreach',
    name: 'Gloamreach Moor',
    epithet: 'THE OPEN NIGHT',
    description: 'Wide moonlit ground, long sightlines, and dependable sanctuaries.',
    accent: '#74d8c2',
    textureIndex: 0,
    bounds: { minX: -1500, maxX: 1500, minY: -1500, maxY: 1500 },
    structures: [
      { type: 'moonwell', effect: 'heal', x: -330, y: 190, radius: 80 },
      { type: 'ward-tower', effect: 'turret', x: 360, y: -210, radius: 62 },
      { type: 'ritual-stone', effect: 'haste', x: 80, y: 430, radius: 76 },
    ],
    walls: [],
    spawnPoints: [],
  },
  {
    id: 'emberfall',
    name: 'Emberfall Ruins',
    epithet: 'THE BURNING WASTE',
    description: 'Open volcanic ruins with violent sightlines and aggressive fire relics.',
    accent: '#ff795d',
    textureIndex: 1,
    bounds: { minX: -1500, maxX: 1500, minY: -1500, maxY: 1500 },
    structures: [
      { type: 'sun-forge', effect: 'heal', x: -440, y: -240, radius: 76 },
      { type: 'cinder-ballista', effect: 'turret', x: 430, y: 160, radius: 66 },
      { type: 'ember-altar', effect: 'haste', x: -40, y: 520, radius: 82 },
    ],
    walls: [],
    spawnPoints: [],
  },
  {
    id: 'reliquary',
    name: 'The Reliquary',
    epithet: 'NINE ROOMS BELOW',
    description: 'A sealed dungeon of nine chambers. Doors become chokepoints; stone stops bodies and bullets.',
    accent: '#c9b9ff',
    textureIndex: 2,
    bounds: { minX: -1450, maxX: 1450, minY: -1050, maxY: 1050 },
    structures: [
      { type: 'reliquary-font', effect: 'heal', x: -900, y: 0, radius: 76 },
      { type: 'ossuary-sentry', effect: 'turret', x: 900, y: 0, radius: 66 },
      { type: 'echo-seal', effect: 'haste', x: 0, y: 650, radius: 82 },
    ],
    walls: RELIQUARY_WALLS,
    spawnPoints: [
      { x: -1240, y: -650 }, { x: 0, y: -860 }, { x: 1240, y: -650 },
      { x: -1240, y: 0 }, { x: 1240, y: 0 },
      { x: -1240, y: 650 }, { x: 0, y: 860 }, { x: 1240, y: 650 },
    ],
  },
]

export const mapById = (id: MapId): MapDefinition => MAPS.find((map) => map.id === id) ?? MAPS[0]

