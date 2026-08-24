export class SeededRandom {
  private state: number

  constructor(seed: number) {
    this.state = seed >>> 0 || 1
  }

  next(): number {
    let value = this.state
    value ^= value << 13
    value ^= value >>> 17
    value ^= value << 5
    this.state = value >>> 0
    return this.state / 4294967296
  }

  range(min: number, max: number): number {
    return min + (max - min) * this.next()
  }

  integer(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1))
  }

  pick<T>(items: T[]): T {
    return items[Math.floor(this.next() * items.length)]
  }
}

