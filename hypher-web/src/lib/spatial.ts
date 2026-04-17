import type { AnyObject } from "@/types";

/**
 * Returns up to `k` items nearest to (x, y) in canvas space,
 * within `maxRadius` canvas pixels. Projects are excluded — they
 * are containers, not content; Claude reasons about notes and artifacts.
 */
export function computeNearby(
  items: AnyObject[],
  x: number,
  y: number,
  k = 5,
  maxRadius = 1500,
): AnyObject[] {
  return items
    .filter((o) => o.canvasPosition && o.kind !== "project")
    .map((o) => ({
      o,
      d2: (o.canvasPosition!.x - x) ** 2 + (o.canvasPosition!.y - y) ** 2,
    }))
    .filter((p) => p.d2 <= maxRadius * maxRadius)
    .sort((a, b) => a.d2 - b.d2)
    .slice(0, k)
    .map((p) => p.o);
}
