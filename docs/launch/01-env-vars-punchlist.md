# Env Vars Punch List — Beta Launch

**Owner:** Nick (human-only track — do not delegate to orchestrator)
**Status:** Blocking end-to-end smoke test of all merged specs
**Target:** Complete in a single ~4-hour sprint
**Last updated:** 2026-04-17

---

## How to use this doc

Work top to bottom. Each section has:
- **What you're getting** — the secret value
- **Where to get it** — the dashboard URL + click path
- **Where to put it** — `.env.local` (dev) and/or Convex env (`npx convex env set`) and/or Vercel env (prod)
- **Verify** — a one-line command or action to confirm it's working

Check each box as you go. Don't skip verifies — that's how you catch paste errors now instead of during launch weekend.

---

## Section 1 — Clerk (auth foundation)

These unblock `/app` sign-in and every authed route.

- [ ] `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- [ ] `CLERK_SECRET_KEY`
- [ ] `CLERK_JWT_ISSUER_DOMAIN`
- [ ] `CLERK_WEBHOOK_SIGNING_SECRET`

**Where to get them:**
1. Clerk dashboard → your claimed app → **API keys** (left sidebar)
2. Copy `Publishable key` and `Secret key`
3. Left sidebar → **JWT templates** → **New template** → select **Convex** preset → name it exactly `convex` → Save
4. Copy the **Issuer URL** shown on the JWT template page — that's `CLERK_JWT_ISSUER_DOMAIN`
5. Left sidebar → **Webhooks** → **Add endpoint** → URL: `https://your-convex-deployment.convex.site/clerk-webhook` → copy the **Signing secret**

**Where to put them:**

`.env.local` (dev):
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_JWT_ISSUER_DOMAIN=https://...clerk.accounts.dev
CLERK_WEBHOOK_SIGNING_SECRET=whsec_...
```

Convex (issuer domain only — server-side JWT verification):
```bash
npx convex env set CLERK_JWT_ISSUER_DOMAIN https://...clerk.accounts.dev
npx convex env set CLERK_WEBHOOK_SIGNING_SECRET whsec_...
```

Vercel (prod — same 4 vars via dashboard or `vercel env add`).

**Verify:**
- [ ] Restart `npm run dev` → visit `/app` → no Clerk 404s in console
- [ ] Sign in successfully → redirected to `/app` with a user button visible
- [ ] `npx convex logs` shows no JWT verification errors when you trigger a mutation

---

## Section 2 — Convex (database)

- [ ] `NEXT_PUBLIC_CONVEX_URL` (dev)
- [ ] `NEXT_PUBLIC_CONVEX_URL` (prod)
- [ ] `CONVEX_DEPLOY_KEY` (for Vercel deploy pipeline)

**Where to get them:**
1. `npx convex dev` in `hypher-web/` → outputs dev deployment URL (looks like `https://grandiose-manatee-518.convex.cloud`)
2. Convex dashboard → **Settings** → **Production** → copy prod URL (`adamant-pheasant-663.convex.cloud`)
3. Convex dashboard → **Settings** → **Deploy keys** → **Generate** → copy (one-time reveal)

**Where to put them:**
```
# .env.local
NEXT_PUBLIC_CONVEX_URL=https://grandiose-manatee-518.convex.cloud

# Vercel (prod)
NEXT_PUBLIC_CONVEX_URL=https://adamant-pheasant-663.convex.cloud
CONVEX_DEPLOY_KEY=prod:adamant-pheasant-663|<generated>
```

**Verify:**
- [ ] `npx convex dev --once` → regenerates `convex/_generated/api.d.ts` without errors
- [ ] Local app can read/write (create a project, see it persist)
- [ ] Vercel build succeeds with deploy key set

---

## Section 3 — Anthropic (AI features)

**Blocks:** Spec #04 (streaming digest), Spec #06a (Ambient Ask), Spec #06b (drop-to-suggest), Spec #07 (digest email generation)

- [ ] `ANTHROPIC_API_KEY`

**Where to get it:**
1. console.anthropic.com → **API Keys** → **Create Key**
2. Name it `hypher-beta`
3. Copy (one-time reveal)
4. Set billing to a funded account — free tier won't last through launch weekend

**Where to put it:**

`.env.local` AND Vercel prod:
```
ANTHROPIC_API_KEY=sk-ant-...
```

**Do not** put in Convex env — AI calls go through Next.js route handlers, not Convex.

**Verify:**
- [ ] Restart `npm run dev` → open a project canvas → trigger Ambient Ask → response streams token-by-token
- [ ] Trigger daily digest manually → digest text appears with Claude-generated summary
- [ ] Check Anthropic usage dashboard — requests should show up within ~30s

---

## Section 4 — Upstash Redis (rate limiting)

**Blocks:** Production-safe rate limiting on `/api/capture`, `/api/canvas/ask`, `/api/digest/stream`. Without this, features work but abuse is trivial.

- [ ] `UPSTASH_REDIS_REST_URL`
- [ ] `UPSTASH_REDIS_REST_TOKEN`

**Where to get them:**
1. console.upstash.com → **Create Database** → **Global** region (low-latency for Vercel edge)
2. Name it `hypher-prod-ratelimit`
3. On the DB page → **REST API** tab → copy `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`

**Where to put them:**

`.env.local` AND Vercel prod:
```
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=...
```

**Verify:**
- [ ] Fire 15 rapid requests to `/api/canvas/ask` → should 429 on request 11+ with a clean error
- [ ] Upstash dashboard shows requests in real-time

---

## Section 5 — Resend (outbound email for digest)

**Blocks:** Spec #07 daily digest email delivery

- [ ] `RESEND_API_KEY`
- [ ] `RESEND_FROM_EMAIL` (e.g. `digest@hypher.app`)

**Where to get them:**
1. resend.com → **API Keys** → **Create**
2. Add and verify your domain under **Domains** (`hypher.app` or similar) — DNS records required
3. Wait for verification (DNS propagation: 5 min to 24 hrs)

**Where to put them:**

`.env.local` AND Vercel prod:
```
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=digest@hypher.app
```

**Verify:**
- [ ] Trigger digest send to your own email → arrives within ~1 minute, not in spam
- [ ] Resend dashboard shows delivery

---

## Section 6 — Svix (inbound digest reply)

**Blocks:** Spec #07 reply-to-add flow

- [ ] `SVIX_WEBHOOK_SECRET`

**Where to get it:**
1. Resend dashboard → **Webhooks** → **Add endpoint** → URL: `https://your-convex-deployment.convex.site/resend-inbound`
2. Copy the signing secret

**Where to put it:**

Convex env (verification happens server-side):
```bash
npx convex env set SVIX_WEBHOOK_SECRET whsec_...
```

**Verify:**
- [ ] Reply to a digest email → new note appears in the associated project within ~30s

---

## Section 7 — Stripe (billing)

**Blocks:** Paid tier checkout, but NOT free-tier beta. Deferrable if beta is free-only.

- [ ] `STRIPE_SECRET_KEY`
- [ ] `STRIPE_WEBHOOK_SECRET`
- [ ] `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

**Where to get them:**
1. Clerk dashboard → **Billing** → Stripe is integrated via Clerk's Stripe app (you're using Clerk Stripe integration per playbook)
2. Stripe dashboard → **Developers** → **API keys** → copy publishable + secret
3. Stripe dashboard → **Webhooks** → **Add endpoint** → URL: `https://yourdomain.com/api/stripe-webhook` → copy signing secret

**Where to put them:**

`.env.local` AND Vercel prod:
```
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_... (or pk_live_... for prod)
STRIPE_SECRET_KEY=sk_test_... (or sk_live_...)
STRIPE_WEBHOOK_SECRET=whsec_...
```

**Verify:**
- [ ] Pricing page loads → "Subscribe" button opens Stripe Checkout
- [ ] Test card `4242 4242 4242 4242` completes → webhook fires → user's `plan` field updates in Convex

---

## Section 8 — Sentry (error tracking)

**Blocks:** Production error visibility. Not feature-blocking but launch-weekend-critical.

- [ ] `NEXT_PUBLIC_SENTRY_DSN`
- [ ] `SENTRY_AUTH_TOKEN` (for source map upload during build)

**Where to get them:**
1. sentry.io → create project `hypher-web` (Next.js platform)
2. Copy the DSN shown during setup
3. **Settings** → **Auth Tokens** → create with `project:releases` + `project:read` scopes

**Where to put them:**

`.env.local` AND Vercel prod:
```
NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
SENTRY_AUTH_TOKEN=sntrys_...
```

**Verify:**
- [ ] Throw a test error in dev → appears in Sentry within ~30s
- [ ] Vercel build logs show "source maps uploaded" step

---

## Section 9 — Seed webhook (demo project provisioning)

**Blocks:** Spec #01 seed demo project on first signup

- [ ] `SEED_WEBHOOK_SECRET`

**Where to get it:**
Generate locally — this is a shared secret between Clerk webhook and Convex:
```bash
openssl rand -hex 32
```

**Where to put it:**

Both sides must match exactly:

Convex env:
```bash
npx convex env set SEED_WEBHOOK_SECRET <generated-value>
```

Clerk webhook config (you already set a webhook endpoint in Section 1) — add custom header:
```
X-Seed-Secret: <generated-value>
```

Or if the implementation uses a different pattern, check `convex/http.ts` and `convex/seed.ts` for what header/query param is expected.

**Verify:**
- [ ] Sign up a brand-new user (use `+test` email alias) → demo project appears in `/app` within ~10s

---

## Section 10 — GitHub (connect flow)

**Blocks:** Connect-to-GitHub feature (per playbook: "GitHub connect flow + server-only PAT handling")

- [ ] `GITHUB_CLIENT_ID`
- [ ] `GITHUB_CLIENT_SECRET`

**Where to get them:**
1. github.com/settings/developers → **OAuth Apps** → **New**
2. Homepage: `https://hypher.app`
3. Authorization callback: `https://hypher.app/api/github/callback`
4. Copy client ID + generate client secret

**Where to put them:**

`.env.local` AND Vercel prod:
```
GITHUB_CLIENT_ID=Iv1....
GITHUB_CLIENT_SECRET=...
```

**Verify:**
- [ ] `/app/settings/integrations` → "Connect GitHub" → OAuth consent screen appears → grant → repos list loads

---

## Final checklist — all green before launch

- [ ] Clerk sign-in works end-to-end
- [ ] Convex dev + prod both provisioned
- [ ] `npx convex dev --once` regenerates types without errors (unblocks `(api as any)` cleanup)
- [ ] Ambient Ask streams real Claude responses
- [ ] Rate limiting 429s at threshold
- [ ] Digest email delivers to real inbox
- [ ] Stripe test checkout completes
- [ ] Sentry receives a test error
- [ ] New signup auto-provisions seed project
- [ ] GitHub OAuth completes

**When all 10 are checked, you're cleared for tech-debt cleanup (next doc) and beta launch prep.**

---

## Things that will trip you up

- **Clerk webhook URL must be the Convex `.convex.site` URL, not `.convex.cloud`.** The `.cloud` is for client connections; `.site` is for HTTP actions.
- **`npx convex env set` only affects the current deployment** (dev vs prod). Run it twice, once per deployment, if you want parity.
- **Vercel env vars are per-environment** (Preview vs Production). Set them for both or preview deploys will silently fail.
- **Restart `npm run dev` after every `.env.local` change.** Next.js only reads on boot.
- **Resend domain verification takes real time.** Don't save this for launch weekend — do it first thing so DNS has time to propagate.
