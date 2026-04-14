"use client";

import type { Connection, AnyObject } from "@/types";

interface ConnectionLinesProps {
  connections: Connection[];
  objectMap: Map<string, AnyObject>;
  onConnectionClick: (e: React.MouseEvent, conn: Connection) => void;
}

export function ConnectionLines({ connections, objectMap, onConnectionClick }: ConnectionLinesProps) {
  return (
    <>
      <defs>
        {/* Solid arrowhead for confirmed/manual connections */}
        <marker
          id="arrow-solid"
          viewBox="0 0 10 8"
          refX="10"
          refY="4"
          markerWidth="8"
          markerHeight="8"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 4 L 0 8 Z" fill="var(--accent)" opacity={0.6} />
        </marker>

        {/* Open arrowhead for suggested connections */}
        <marker
          id="arrow-open"
          viewBox="0 0 10 8"
          refX="10"
          refY="4"
          markerWidth="8"
          markerHeight="8"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 4 L 0 8" fill="none" stroke="var(--accent)" strokeWidth={1.5} opacity={0.4} />
        </marker>
      </defs>

      {connections.map((conn) => {
        const source = objectMap.get(conn.sourceId);
        const target = objectMap.get(conn.targetId);
        if (!source?.canvasPosition || !target?.canvasPosition) return null;

        const sp = source.canvasPosition;
        const tp = target.canvasPosition;
        const isSuggested = conn.type === "ai_suggested";
        const isManual = conn.type === "manual";

        // Cubic bezier control points (smoother than quadratic)
        const dx = tp.x - sp.x;
        const dy = tp.y - sp.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const offset = Math.min(dist * 0.15, 60);
        // Perpendicular offset for curve
        const nx = -dy / (dist || 1);
        const ny = dx / (dist || 1);
        const cp1x = sp.x + dx * 0.33 + nx * offset;
        const cp1y = sp.y + dy * 0.33 + ny * offset;
        const cp2x = sp.x + dx * 0.67 + nx * offset;
        const cp2y = sp.y + dy * 0.67 + ny * offset;

        const pathD = `M ${sp.x} ${sp.y} C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${tp.x} ${tp.y}`;

        // Line style per type
        const style = isSuggested
          ? { strokeWidth: 1, dasharray: "6 4", opacity: 0.25, marker: "url(#arrow-open)" }
          : isManual
            ? { strokeWidth: 2, dasharray: "none", opacity: 0.6, marker: "url(#arrow-solid)" }
            : { strokeWidth: 1.5, dasharray: "none", opacity: 0.4, marker: "url(#arrow-solid)" };

        return (
          <g key={conn.id} className="connection-line-group">
            {/* Invisible hit area */}
            <path
              d={pathD}
              fill="none"
              stroke="transparent"
              strokeWidth={12}
              style={{ cursor: isSuggested ? "pointer" : "default" }}
              onClick={(e) => onConnectionClick(e as any, conn)}
            />
            {/* Visible line */}
            <path
              d={pathD}
              fill="none"
              stroke="var(--accent)"
              strokeWidth={style.strokeWidth}
              strokeDasharray={style.dasharray}
              opacity={style.opacity}
              markerEnd={style.marker}
              pointerEvents="none"
              className="connection-line"
            />
          </g>
        );
      })}
    </>
  );
}
