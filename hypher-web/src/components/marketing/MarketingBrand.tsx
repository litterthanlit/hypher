import Link from "next/link";
import { HypherLockup, HypherMark } from "@/components/HypherLockup";

export type MarketingBrandVariant = "lockup" | "wordmark" | "mark";
type MarketingBrandSize = "default" | "sm";

export function MarketingBrand({
  className = "",
  size = "default",
  variant = "lockup",
}: {
  className?: string;
  size?: MarketingBrandSize;
  variant?: MarketingBrandVariant;
}) {
  const classes = [
    "marketing-brand",
    `marketing-brand--${variant}`,
    size === "sm" ? "marketing-brand--sm" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Link href="/" className={classes} aria-label="Hypher home">
      {variant === "lockup" ? (
        <HypherLockup size={size} />
      ) : variant === "mark" ? (
        <HypherMark className="hypher-signal-mark hypher-signal-mark--marketing" />
      ) : (
        <span className="marketing-brand__wordmark">hypher</span>
      )}
    </Link>
  );
}
