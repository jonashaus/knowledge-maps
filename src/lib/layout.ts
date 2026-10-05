/**
 * Radial tree layout for nodes of arbitrary size.
 *
 * 1. Every subtree gets an angular sector proportional to its weight
 *    (number of leaves, wide nodes count a bit more).
 * 2. Every depth gets a ring. The ring radius is the smallest radius at which
 *    (a) the ring doesn't collide with the previous ring and
 *    (b) neighbouring nodes on the ring don't collide with each other.
 */

export interface Size {
  w: number;
  h: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface LayoutResult {
  /** Center point of every node. */
  centers: Record<string, Point>;
  /** Angle (radians, screen coordinates) of every non-root node. */
  angles: Record<string, number>;
}

const RING_GAP = 64;
const SIBLING_GAP = 24;
/** Angle (radians) a child with weight 1 may use at most, divided by its depth. */
const MAX_ANGLE_PER_WEIGHT = 1.1;
/** Root children start at the top and go clockwise. */
export const START_ANGLE = -Math.PI / 2;

export function radialLayout(
  rootId: string,
  children: Record<string, string[]>,
  depth: Record<string, number>,
  sizeOf: (id: string) => Size,
): LayoutResult {
  const weight: Record<string, number> = {};
  const computeWeight = (id: string): number => {
    const own = Math.max(1, sizeOf(id).w / 260);
    const sum = (children[id] ?? []).reduce((s, c) => s + computeWeight(c), 0);
    return (weight[id] = Math.max(own, sum));
  };
  computeWeight(rootId);

  const angles: Record<string, number> = {};
  const assign = (id: string, from: number, to: number) => {
    const kids = children[id] ?? [];
    if (!kids.length) return;
    const total = kids.reduce((s, c) => s + weight[c], 0);
    let start = from;
    let span = to - from;
    if (id !== rootId) {
      // Don't fan children out more than they need: keep them close to the parent.
      const maxSpan = (total * MAX_ANGLE_PER_WEIGHT) / (depth[id] + 1);
      if (maxSpan < span) {
        start = (from + to) / 2 - maxSpan / 2;
        span = maxSpan;
      }
    }
    for (const c of kids) {
      const sector = (span * weight[c]) / total;
      angles[c] = start + sector / 2;
      assign(c, start, start + sector);
      start += sector;
    }
  };
  const rootKids = children[rootId] ?? [];
  if (rootKids.length === 1) {
    // A single branch points to the right and may use the right half.
    assign(rootId, -Math.PI / 2, Math.PI / 2);
  } else {
    assign(rootId, START_ANGLE, START_ANGLE + 2 * Math.PI);
  }

  // Group nodes by depth.
  const rings: string[][] = [];
  for (const id in depth) {
    (rings[depth[id]] ??= []).push(id);
  }

  const radialHalf = (id: string, theta: number) => {
    const { w, h } = sizeOf(id);
    return (w * Math.abs(Math.cos(theta)) + h * Math.abs(Math.sin(theta))) / 2;
  };
  const tangential = (id: string, theta: number) => {
    const { w, h } = sizeOf(id);
    return w * Math.abs(Math.sin(theta)) + h * Math.abs(Math.cos(theta));
  };

  const radius: number[] = [0];
  let prevMaxHalf = 0;
  for (let d = 1; d < rings.length; d++) {
    const ring = (rings[d] ?? []).slice().sort((a, b) => angles[a] - angles[b]);
    if (!ring.length) break;

    let maxHalf = 0;
    for (const id of ring) maxHalf = Math.max(maxHalf, radialHalf(id, angles[id]));
    if (d === 1) {
      for (const id of ring) prevMaxHalf = Math.max(prevMaxHalf, radialHalf(rootId, angles[id]));
    }
    let r = radius[d - 1] + prevMaxHalf + maxHalf + RING_GAP;

    if (ring.length > 1) {
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i];
        const b = ring[(i + 1) % ring.length];
        let delta = angles[b] - angles[a];
        if (i === ring.length - 1) delta += 2 * Math.PI;
        delta = Math.max(delta, 0.001);
        const need =
          (tangential(a, angles[a]) + tangential(b, angles[b])) / 2 + SIBLING_GAP;
        const chord = 2 * Math.sin(Math.min(delta, Math.PI) / 2);
        r = Math.max(r, need / chord);
      }
    }

    radius[d] = r;
    prevMaxHalf = maxHalf;
  }

  const centers: Record<string, Point> = { [rootId]: { x: 0, y: 0 } };
  for (const id in angles) {
    const r = radius[depth[id]] ?? 0;
    centers[id] = { x: r * Math.cos(angles[id]), y: r * Math.sin(angles[id]) };
  }
  return { centers, angles };
}

/**
 * Angle of `theta` relative to the start of the parent's sector,
 * used to work out where a dragged node should be inserted among its siblings.
 */
export function relativeAngle(theta: number, parentAngle: number | undefined) {
  const twoPi = 2 * Math.PI;
  if (parentAngle === undefined) {
    return (((theta - START_ANGLE) % twoPi) + twoPi) % twoPi;
  }
  let d = (theta - parentAngle) % twoPi;
  if (d > Math.PI) d -= twoPi;
  if (d < -Math.PI) d += twoPi;
  return d;
}
