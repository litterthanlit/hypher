import type { ReactNode } from "react";
import { MarketingBrand } from "./MarketingBrand";

export function MarketingHeader({
  nav,
  end,
}: {
  nav: ReactNode;
  end: ReactNode;
}) {
  return (
    <header className="marketing-chrome">
      <div className="marketing-chrome__inner">
        <MarketingBrand className="tw-shrink-0" />
        <nav className="marketing-chrome__nav" aria-label="Primary">
          {nav}
        </nav>
        <div className="marketing-chrome__end">{end}</div>
      </div>
    </header>
  );
}
