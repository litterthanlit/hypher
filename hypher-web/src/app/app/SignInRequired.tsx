"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getUnsignedAppSignInHref } from "@/lib/activation";

export function SignInRequired() {
  const router = useRouter();
  const href = getUnsignedAppSignInHref("/app");

  useEffect(() => {
    router.replace(href);
  }, [href, router]);

  return (
    <div className="marketing-root beta-gate-root">
      <div className="beta-gate-card">
        <div className="beta-gate-top">
          <span className="logo logo--with-mark">
            <img className="hypher-signal-mark hypher-signal-mark--sidebar" src="/hypher-logo.svg" alt="Hypher" />
          </span>
        </div>
        <p className="launch-eyebrow">Sign in required</p>
        <h1>Sign in to create projects.</h1>
        <p>Hypher needs an account before it can save captures, project memory, and settings.</p>
        <div className="auth-required-actions">
          <a className="btn-primary" href={href}>Sign in</a>
          <a className="btn-secondary auth-required-secondary" href="/beta/request">Request beta</a>
        </div>
      </div>
    </div>
  );
}
