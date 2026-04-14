"use client";

interface Props {
  rect: { left: number; top: number; width: number; height: number } | null;
}

export function RubberBandSelect({ rect }: Props) {
  if (!rect) return null;
  return (
    <div
      className="rubber-band"
      style={{
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      }}
    />
  );
}
