/**
 * Pool bookkeeping for the tunnel. Pure, no three.js, no DOM.
 *
 * The tunnel never builds a mesh per week. It owns POOL_SIZE card meshes and
 * maps a sliding window of weeks onto them: week i lives in slot i % poolSize.
 * Any contiguous run of ≤ poolSize weeks maps to distinct slots, so a slot is
 * only rewritten when the camera has moved its old week out of the window.
 */

export const POOL_SIZE = 120;
/** Weeks kept materialised behind the camera (wide FOV at warp sees a little behind). */
export const BEHIND = 4;

/** First week index of the window for a camera at `cameraWeek`. */
export function windowStart(
  cameraWeek: number,
  totalWeeks: number,
  poolSize: number,
  behind: number = BEHIND,
): number {
  const n = Math.min(poolSize, totalWeeks);
  const start = Math.floor(cameraWeek) - behind;
  return Math.max(0, Math.min(start, totalWeeks - n));
}

/** The week indices that should hold a mesh right now (≤ poolSize of them). */
export function assignSlots(
  cameraWeek: number,
  totalWeeks: number,
  poolSize: number,
  behind: number = BEHIND,
): number[] {
  const n = Math.max(0, Math.min(poolSize, totalWeeks));
  const start = windowStart(cameraWeek, totalWeeks, poolSize, behind);
  const out = new Array<number>(n);
  for (let k = 0; k < n; k++) out[k] = start + k;
  return out;
}

export function slotOf(week: number, poolSize: number): number {
  return ((week % poolSize) + poolSize) % poolSize;
}

/**
 * Which week each slot currently shows. `sync` walks the window and calls
 * `assign(slot, week)` only for slots whose week changed, so the per-frame cost
 * is the number of weeks the camera crossed, not the window size.
 */
export class SlotTable {
  readonly weekOf: Int32Array;
  constructor(readonly size: number) {
    this.weekOf = new Int32Array(size).fill(-1);
  }
  /** Forget every assignment (layout changed): the next sync rewrites all slots. */
  invalidate(): void {
    this.weekOf.fill(-1);
  }
  sync(start: number, count: number, assign: (slot: number, week: number) => void): number {
    const n = Math.min(count, this.size);
    let changed = 0;
    for (let k = 0; k < n; k++) {
      const week = start + k;
      const slot = slotOf(week, this.size);
      if (this.weekOf[slot] !== week) {
        this.weekOf[slot] = week;
        assign(slot, week);
        changed++;
      }
    }
    // Slots beyond a short window (path shorter than the pool) stay empty.
    return changed;
  }
  /** Slots holding a week outside [start, start + count). */
  stale(start: number, count: number): number[] {
    const out: number[] = [];
    for (let s = 0; s < this.size; s++) {
      const w = this.weekOf[s];
      if (w >= 0 && (w < start || w >= start + count)) out.push(s);
    }
    return out;
  }
}

/**
 * A small LRU keyed by number with explicit "in use this frame" protection:
 * an entry stamped with the current frame is never evicted.
 */
export class Lru<V> {
  private map = new Map<number, { value: V; stamp: number }>();
  constructor(
    readonly capacity: number,
    private onEvict: (key: number, value: V) => void,
  ) {}
  get size(): number {
    return this.map.size;
  }
  has(key: number): boolean {
    return this.map.has(key);
  }
  get(key: number, stamp?: number): V | undefined {
    const e = this.map.get(key);
    if (!e) return undefined;
    if (stamp !== undefined && stamp > e.stamp) e.stamp = stamp;
    return e.value;
  }
  touch(key: number, stamp: number): void {
    const e = this.map.get(key);
    if (e && stamp > e.stamp) e.stamp = stamp;
  }
  set(key: number, value: V, stamp: number): void {
    const old = this.map.get(key);
    if (old && old.value !== value) this.onEvict(key, old.value);
    this.map.set(key, { value, stamp });
    this.evict(stamp);
  }
  /** Evict oldest entries over capacity; entries stamped `protect` or later survive. */
  evict(protect: number): void {
    while (this.map.size > this.capacity) {
      let victim = -1;
      let oldest = Infinity;
      for (const [k, e] of this.map) {
        if (e.stamp < protect && e.stamp < oldest) {
          oldest = e.stamp;
          victim = k;
        }
      }
      if (victim < 0) return; // everything is in use this frame: run over capacity rather than blank a card
      const e = this.map.get(victim)!;
      this.map.delete(victim);
      this.onEvict(victim, e.value);
    }
  }
  clear(): void {
    for (const [k, e] of this.map) this.onEvict(k, e.value);
    this.map.clear();
  }
}
