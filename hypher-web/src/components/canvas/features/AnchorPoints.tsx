"use client";

interface AnchorPointsProps {
  objId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  onStartDrag: (e: React.MouseEvent, sourceId: string, anchorX: number, anchorY: number) => void;
}

export function AnchorPoints({ objId, x, y, width, height, onStartDrag }: AnchorPointsProps) {
  const halfW = width / 2;
  const halfH = height / 2;

  const anchors = [
    { cx: x, cy: y - halfH, label: "top" },
    { cx: x + halfW, cy: y, label: "right" },
    { cx: x, cy: y + halfH, label: "bottom" },
    { cx: x - halfW, cy: y, label: "left" },
  ];

  return (
    <g className="anchor-points">
      {anchors.map((a) => (
        <circle
          key={a.label}
          cx={a.cx}
          cy={a.cy}
          r={4}
          className="anchor-dot"
          onMouseDown={(e) => {
            e.stopPropagation();
            onStartDrag(e as any, objId, a.cx, a.cy);
          }}
        />
      ))}
    </g>
  );
}
