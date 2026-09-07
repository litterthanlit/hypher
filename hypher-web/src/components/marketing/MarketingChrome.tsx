import type { ReactNode } from "react";
import Link from "next/link";
import { MarketingBrand } from "./MarketingBrand";

export function MarketingCta({
  href,
  children,
  variant = "solid",
  className = "",
}: {
  href: string;
  children: ReactNode;
  variant?: "solid" | "ghost";
  className?: string;
}) {
  const variantClass = variant === "ghost" ? " marketing-cta--ghost" : "";
  return (
    <Link href={href} className={`marketing-cta${variantClass}${className ? ` ${className}` : ""}`}>
      {children}
    </Link>
  );
}

const navLinkClass = "marketing-nav-link";

function PrimaryNavLinks() {
  return (
    <>
      <a href="/#the-loop" className={navLinkClass}>
        How it works
      </a>
      <a href="/#cursor" className={navLinkClass}>
        Cursor
      </a>
      <Link href="/pricing" className={navLinkClass}>
        Pricing
      </Link>
    </>
  );
}

export function MarketingHeader({
  active,
}: {
  active?: "home" | "pricing";
}) {
  return (
    <header className="marketing-header">
      <div className="marketing-wrap marketing-header__row">
        <MarketingBrand />
        <nav className="marketing-header__nav" aria-label="Primary">
          {active === "pricing" ? (
            <Link href="/" className={navLinkClass}>
              Home
            </Link>
          ) : (
            <PrimaryNavLinks />
          )}
        </nav>
        <div className="marketing-header__actions">
          <Link href="/sign-in" className={navLinkClass}>
            Log in
          </Link>
          <MarketingCta href="/beta/request" className="marketing-cta--header">
            Request beta
          </MarketingCta>
        </div>
      </div>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="marketing-footer">
      <div className="marketing-wrap marketing-footer__row">
        <MarketingBrand size="sm" />
        <p className="marketing-footer__note">You don't explain the project again.</p>
      </div>
    </footer>
  );
}
