import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { Point } from "@/lib/layout";

const DURATION = 280;
const ease = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Tweens node positions towards their layout targets. Animating the positions
 * themselves (instead of using CSS transitions) keeps edges attached.
 */
export function useAnimatedPositions(
  target: Record<string, Point>,
  options: { animate: boolean; spawnFrom: (id: string) => Point | undefined },
) {
  const [display, setDisplay] = useState(target);
  const [nonce, setNonce] = useState(0);
  const current = useRef(target);
  const frame = useRef(0);
  const opts = useRef(options);
  useLayoutEffect(() => {
    opts.current = options;
  });

  useLayoutEffect(() => {
    cancelAnimationFrame(frame.current);
    const from: Record<string, Point> = {};
    let moving = false;
    for (const id in target) {
      const start = current.current[id] ?? opts.current.spawnFrom(id) ?? target[id];
      from[id] = start;
      if (Math.abs(start.x - target[id].x) > 0.5 || Math.abs(start.y - target[id].y) > 0.5) {
        moving = true;
      }
    }
    if (!moving || !opts.current.animate) {
      current.current = target;
      setDisplay(target);
      return;
    }
    const startTime = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - startTime) / DURATION);
      const e = ease(t);
      const next: Record<string, Point> = {};
      for (const id in target) {
        const a = from[id];
        const b = target[id];
        next[id] = { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e };
      }
      current.current = next;
      setDisplay(next);
      if (t < 1) frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame.current);
  }, [target, nonce]);

  /** Moves a node's current position (e.g. to where it was dropped) so it animates from there. */
  const setCurrent = useCallback((id: string, p: Point) => {
    current.current = { ...current.current, [id]: p };
    setNonce((n) => n + 1);
  }, []);

  return [display, setCurrent] as const;
}
