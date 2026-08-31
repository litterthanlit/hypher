import Link from "next/link";
import { MarketingBrand } from "./MarketingBrand";
import { MarketingProductVisual } from "./MarketingProductVisual";

export function LandingPage() {
  return (
    <div className="marketing-root tw-min-h-screen tw-text-[var(--text-primary)]">
      <header className="tw-sticky tw-top-0 tw-z-50 tw-border-b tw-border-[var(--border-default)] tw-bg-[var(--bg-primary)]/90 tw-backdrop-blur-md">
        <div className="tw-mx-auto tw-flex tw-max-w-6xl tw-items-center tw-px-4 tw-py-3 sm:tw-px-6 lg:tw-px-8">
          <MarketingBrand className="tw-shrink-0" />
        </div>
      </header>

      <main>
        <section className="marketing-hero">
          <div className="tw-mx-auto tw-max-w-3xl tw-px-4 tw-py-16 sm:tw-px-6 sm:tw-py-24 lg:tw-px-8 lg:tw-py-28">
            <h1 className="tw-m-0 tw-text-balance tw-font-wordmark tw-text-[2rem] tw-font-medium tw-leading-[1.1] tw-tracking-[0.04em] sm:tw-text-[2.35rem] lg:tw-text-[2.65rem] lg:tw-leading-[1.08]">
              dump your project. agents write back.
            </h1>
            <p className="tw-mt-6 tw-max-w-lg tw-text-pretty tw-text-base tw-font-normal tw-leading-relaxed tw-text-[var(--text-secondary)] sm:tw-mt-7 sm:tw-text-[17px]">
              they read one note. that&apos;s the product.
            </p>

            <div className="tw-mt-10 tw-w-full sm:tw-mt-12">
              <MarketingProductVisual />
            </div>

            <div className="tw-mt-10">
              <Link
                href="/app"
                className="tw-inline-flex tw-items-center tw-justify-center tw-rounded-[var(--radius-sm)] tw-bg-electric tw-px-5 tw-py-2.5 tw-text-sm tw-font-medium tw-text-white tw-no-underline tw-shadow-sm tw-transition tw-duration-150 hover:tw-bg-electric-dim hover:tw-text-white hover:tw-no-underline active:tw-scale-[0.99]"
              >
                dump yours
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
