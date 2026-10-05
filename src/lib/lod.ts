/**
 * Level of detail ("semantic zoom").
 *
 * Every ring is drawn a bit smaller than the previous one. When zooming out,
 * the deepest rings fade out first, one level at a time. Hidden nodes keep
 * their space, so the layout never moves while zooming.
 */

const DEPTH_SCALES = [1, 0.85, 0.72];
export const depthScale = (depth: number) => DEPTH_SCALES[depth] ?? 0.6;

/** Below this zoom level, nodes at `depth` are hidden. */
export const hideBelowZoom = (depth: number) =>
  depth <= 1 ? 0 : Math.min(0.62, 0.1 + 0.13 * (depth - 2));

/** Deepest depth that is visible at the given zoom. */
export function maxVisibleDepth(zoom: number) {
  let d = 1;
  while (d < 50 && hideBelowZoom(d + 1) <= zoom) d++;
  return d;
}

export type Lod = "title" | "summary" | "full";

export function lodFor(zoom: number, depth: number): Lod {
  const effective = zoom * depthScale(depth);
  if (effective >= 0.5) return "full";
  if (effective >= 0.27) return "summary";
  return "title";
}

/** Edge labels are only shown once they are readable. */
export const edgeLabelVisible = (zoom: number, depth: number) =>
  zoom * depthScale(depth) >= 0.35;

export const BASE_FONT = 16;
export const MAX_AUTO_WIDTH = 400;
