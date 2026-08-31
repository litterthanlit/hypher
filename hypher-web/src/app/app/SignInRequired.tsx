"use client";

import { HypherLockup } from "@/components/HypherLockup";

export function SignInRequired() {
  return (
    <div className="marketing-root beta-gate-root">
      <div className="beta-gate-card">
        <div className="beta-gate-top">
          <span className="logo logo--with-mark">
            <HypherLockup />
          </span>
        </div>
        <p className="launch-eyebrow">Sign in required</p>
        <h1>Sign in to create projects.</h1>
        <p>Hypher needs an account before it can save captures, project memory, and settings.</p>
        <div className="auth-required-actions">
          <a className="btn-primary" href="/sign-in?redirect_url=/app">Sign in</a>
          <a className="btn-secondary auth-required-secondary" href="/beta/request">Request beta</a>
        </div>
      </div>
    </div>
  );
}
