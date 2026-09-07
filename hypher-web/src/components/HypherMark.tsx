import { HYPHER_MARK_PATH, HYPHER_MARK_VIEWBOX } from "./hypherMarkPath";

type HypherMarkSize = "default" | "sm" | "lg";

const SIZE_CLASS: Record<HypherMarkSize, string> = {
  default: "hypher-signal-mark",
  sm: "hypher-signal-mark hypher-signal-mark--sm",
  lg: "hypher-signal-mark hypher-signal-mark--lg",
};

export function HypherMark({
  className = "",
  size = "default",
}: {
  className?: string;
  size?: HypherMarkSize;
}) {
  const markClass = `${SIZE_CLASS[size]}${className ? ` ${className}` : ""}`;
  return (
    <svg
      className={markClass}
      viewBox={HYPHER_MARK_VIEWBOX}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path fill="currentColor" d={HYPHER_MARK_PATH} />
    </svg>
  );
}
