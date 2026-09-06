import Link from "next/link";
import { HypherMark } from "@/components/HypherMark";

type MarketingBrandSize = "default" | "sm";

export function MarketingBrand({
  className = "",
  size = "default",
  markOnly = false,
}: {
  className?: string;
  size?: MarketingBrandSize;
  markOnly?: boolean;
}) {
  const markClass =
    size === "sm"
      ? "hypher-signal-mark--marketing hypher-signal-mark--marketing-sm"
      : "hypher-signal-mark--marketing";

  return (
    <Link
      href="/"
      className={`marketing-brand${size === "sm" ? " marketing-brand--sm" : ""}${className ? ` ${className}` : ""}`}
      aria-label="Hypher home"
    >
      <HypherMark className={markClass} size={size} />
      {markOnly ? null : <span className="marketing-brand__word">hypher</span>}
    </Link>
  );
}
