export interface SpatialEntity {
  x: number;
  y: number;
  radius: number;
  active: boolean;
}

export class SpatialGrid<T extends SpatialEntity> {
  private readonly cellSize: number;
  private readonly cells = new Map<number, T[]>();
  private readonly dirtyBuckets: T[][] = [];
  private readonly nearestScratch: T[] = [];

  constructor(cellSize = 96) {
    this.cellSize = cellSize;
  }

  clear(): void {
    // Only reset buckets that actually received entities this frame (O(occupied cells) instead of O(entire map history))
    for (let i = 0; i < this.dirtyBuckets.length; i++) {
      this.dirtyBuckets[i].length = 0;
    }
    this.dirtyBuckets.length = 0;

    // Periodically prune far-away empty buckets during long 40-minute runs
    if (this.cells.size > 2048) {
      this.cells.clear();
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
    if (bucket.length === 0) {
      this.dirtyBuckets.push(bucket);
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
        if (!bucket || bucket.length === 0) continue;
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
    const candidates = this.queryRadius(x, y, maxRange, this.nearestScratch);
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
