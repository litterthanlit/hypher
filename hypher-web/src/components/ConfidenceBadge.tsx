"use client";

export function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const color = confidence >= 0.7
    ? "var(--accent)"
    : confidence >= 0.55
    ? "var(--amber)"
    : "var(--text-tertiary)";
  const bg = confidence >= 0.7
    ? "var(--accent-subtle)"
    : confidence >= 0.55
    ? "rgba(255, 178, 36, 0.1)"
    : "rgba(255, 255, 255, 0.04)";

  return (
    <span className="confidence-badge" style={{ background: bg, color }}>
      {pct}%
    </span>
  );
}
