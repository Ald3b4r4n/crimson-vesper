export interface SpatialEntity {
  x: number;
  y: number;
  radius: number;
  active: boolean;
}

export class SpatialGrid<T extends SpatialEntity> {
  private readonly cellSize: number;
  private readonly cells = new Map<number, T[]>();

  constructor(cellSize = 96) {
    this.cellSize = cellSize;
  }

  clear(): void {
    for (const bucket of this.cells.values()) {
      bucket.length = 0;
    }
  }

  private hash(cx: number, cy: number): number {
    // Pack signed 16-bit cell coordinates into a single integer key
    return ((cx + 32768) << 16) | ((cy + 32768) & 0xffff);
  }

  insert(entity: T): void {
    if (!entity.active) return;
    const cx = Math.floor(entity.x / this.cellSize);
    const cy = Math.floor(entity.y / this.cellSize);
    const key = this.hash(cx, cy);
    let bucket = this.cells.get(key);
    if (!bucket) {
      bucket = [];
      this.cells.set(key, bucket);
    }
    bucket.push(entity);
  }

  queryRadius(x: number, y: number, radius: number, out: T[] = []): T[] {
    out.length = 0;
    const minCx = Math.floor((x - radius) / this.cellSize);
    const maxCx = Math.floor((x + radius) / this.cellSize);
    const minCy = Math.floor((y - radius) / this.cellSize);
    const maxCy = Math.floor((y + radius) / this.cellSize);

    for (let cy = minCy; cy <= maxCy; cy++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        const bucket = this.cells.get(this.hash(cx, cy));
        if (!bucket) continue;
        for (let i = 0; i < bucket.length; i++) {
          const item = bucket[i];
          if (!item.active) continue;
          const dx = item.x - x;
          const dy = item.y - y;
          const limit = radius + item.radius;
          if (dx * dx + dy * dy <= limit * limit) {
            out.push(item);
          }
        }
      }
    }
    return out;
  }

  findNearest(x: number, y: number, maxRange: number): T | null {
    const candidates = this.queryRadius(x, y, maxRange);
    let best: T | null = null;
    let bestDistSq = maxRange * maxRange;
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      const dx = c.x - x;
      const dy = c.y - y;
      const dSq = dx * dx + dy * dy;
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        best = c;
      }
    }
    return best;
  }
}
