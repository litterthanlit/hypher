import Link from "next/link";
import { SignInButton, SignUpButton } from "@clerk/nextjs";
import { PricingCards } from "@/components/marketing/PricingCards";

export default function PricingPage() {
  return (
    <div className="tw-min-h-screen tw-bg-[var(--bg-root)] tw-text-[var(--text-primary)]">
      <header className="tw-mx-auto tw-flex tw-max-w-5xl tw-items-center tw-justify-between tw-px-6 tw-py-8 md:tw-px-10">
        <Link href="/" className="tw-font-mono tw-text-sm tw-tracking-tight tw-text-[var(--text-primary)] hover:tw-text-electric">
          Hypher
        </Link>
        <nav className="tw-flex tw-items-center tw-gap-6">
          <SignInButton mode="modal">
            <button type="button" className="tw-text-sm tw-text-[var(--text-secondary)] tw-transition hover:tw-text-[var(--text-primary)]">
              Sign in
            </button>
          </SignInButton>
          <SignUpButton mode="modal">
            <button
              type="button"
              className="tw-rounded-full tw-bg-electric tw-px-4 tw-py-2 tw-text-sm tw-font-medium tw-text-[var(--text-on-accent)] tw-shadow-sm tw-transition hover:tw-bg-electric-dim"
            >
              Sign up
            </button>
          </SignUpButton>
        </nav>
      </header>

      <main className="tw-mx-auto tw-max-w-5xl tw-px-6 tw-pb-24 md:tw-px-10">
        <h1 className="tw-font-sans tw-text-3xl tw-font-medium tw-tracking-tight md:tw-text-4xl">Pricing</h1>
        <p className="tw-mt-4 tw-max-w-2xl tw-text-lg tw-leading-relaxed tw-text-[var(--text-secondary)]">
          Fourteen days on the house, then choose monthly Pro or a one-time lifetime license. Checkout is handled by Stripe; subscription state syncs to your account for the product.
        </p>
        <div className="tw-mt-14">
          <PricingCards variant="expanded" />
        </div>
        <p className="tw-mt-12 tw-text-sm tw-text-[var(--text-tertiary)]">
          <Link href="/" className="tw-text-electric hover:tw-underline">
            ← Back to home
          </Link>
        </p>
      </main>
    </div>
  );
}
