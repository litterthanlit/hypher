import { useCallback, useRef } from "react";

interface Transform {
  x: number;
  y: number;
  k: number;
}

interface UseTouchOptions {
  transform: Transform;
  setTransform: (t: Transform | ((prev: Transform) => Transform)) => void;
  onLongPress?: (x: number, y: number) => void;
}

interface TouchState {
  type: "pan" | "pinch";
  startX: number;
  startY: number;
  startDist?: number;
  startK?: number;
  startTransform: Transform;
}

export function useTouchInteraction({ transform, setTransform, onLongPress }: UseTouchOptions) {
  const touchState = useRef<TouchState | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  interface TouchPoint { clientX: number; clientY: number; }

  const getTouchDist = (t1: TouchPoint, t2: TouchPoint) => {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const getTouchCenter = (t1: TouchPoint, t2: TouchPoint) => ({
    x: (t1.clientX + t2.clientX) / 2,
    y: (t1.clientY + t2.clientY) / 2,
  });

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    clearLongPress();

    if (e.touches.length === 2) {
      e.preventDefault();
      const dist = getTouchDist(e.touches[0]!, e.touches[1]!);
      const center = getTouchCenter(e.touches[0]!, e.touches[1]!);
      touchState.current = {
        type: "pinch",
        startX: center.x,
        startY: center.y,
        startDist: dist,
        startK: transform.k,
        startTransform: { ...transform },
      };
    } else if (e.touches.length === 1) {
      const touch = e.touches[0]!;
      touchState.current = {
        type: "pan",
        startX: touch.clientX,
        startY: touch.clientY,
        startTransform: { ...transform },
      };

      if (onLongPress) {
        longPressTimer.current = setTimeout(() => {
          onLongPress(touch.clientX, touch.clientY);
          touchState.current = null;
        }, 500);
      }
    }
  }, [transform, onLongPress]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    clearLongPress();
    if (!touchState.current) return;

    if (touchState.current.type === "pinch" && e.touches.length === 2) {
      e.preventDefault();
      const dist = getTouchDist(e.touches[0]!, e.touches[1]!);
      const center = getTouchCenter(e.touches[0]!, e.touches[1]!);
      const scale = dist / (touchState.current.startDist ?? 1);
      const newK = Math.min(3, Math.max(0.15, (touchState.current.startK ?? 1) * scale));
      const ratio = newK / (touchState.current.startK ?? 1);

      const st = touchState.current.startTransform;
      const rect = (e.target as HTMLElement).closest(".spatial-canvas")?.getBoundingClientRect();
      if (!rect) return;
      const cx = touchState.current.startX - rect.left;
      const cy = touchState.current.startY - rect.top;
      const dx = center.x - touchState.current.startX;
      const dy = center.y - touchState.current.startY;

      setTransform({
        k: newK,
        x: cx - (cx - st.x) * ratio + dx,
        y: cy - (cy - st.y) * ratio + dy,
      });
    } else if (touchState.current.type === "pan" && e.touches.length === 1) {
      const touch = e.touches[0]!;
      const dx = touch.clientX - touchState.current.startX;
      const dy = touch.clientY - touchState.current.startY;
      const st = touchState.current.startTransform;
      setTransform({ ...st, x: st.x + dx, y: st.y + dy });
    }
  }, [setTransform]);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    clearLongPress();
    if (e.touches.length === 0) {
      touchState.current = null;
    } else if (e.touches.length === 1 && touchState.current?.type === "pinch") {
      const touch = e.touches[0]!;
      touchState.current = {
        type: "pan",
        startX: touch.clientX,
        startY: touch.clientY,
        startTransform: { ...transform },
      };
    }
  }, [transform]);

  return { onTouchStart, onTouchMove, onTouchEnd };
}
