"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getUnsignedAppSignInHref } from "@/lib/activation";
import { MarketingBrand } from "@/components/marketing/MarketingBrand";

export function SignInRequired() {
  const router = useRouter();
  const href = getUnsignedAppSignInHref("/app");

  useEffect(() => {
    router.replace(href);
  }, [href, router]);

  return (
    <div className="marketing-root beta-gate-root">
      <div className="marketing-atmosphere" aria-hidden />
      <div className="beta-gate-card">
        <div className="beta-gate-top">
          <MarketingBrand />
        </div>
        <p className="launch-eyebrow">Sign in required</p>
        <h1>Sign in to open Hypher.</h1>
        <p>An account is needed before Hypher can keep context, briefs, and writebacks.</p>
        <div className="auth-required-actions">
          <a className="btn-primary" href={href}>Sign in</a>
          <a className="btn-secondary auth-required-secondary" href="/beta/request">Request beta</a>
        </div>
      </div>
    </div>
  );
}
