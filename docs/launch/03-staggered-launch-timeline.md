# Staggered Launch Timeline — Hypher Public Beta

**Principle:** Each distribution channel has its own review latency and audience timing. Batching them into "launch weekend" wastes the slow-reviewed ones (Chrome Web Store, Raycast) sitting in queue while your fast channels (Twitter, Product Hunt) miss their peak windows.

**Strategy:** Stagger submissions by review-time, coordinate the same-day push for fast channels only.

---

## Timeline — T-minus view

Working backward from **Launch Day (LD)** = day you post the Product Hunt listing + Twitter thread.

### LD − 10 days: Chrome Web Store submission

**Why first:** Google review averages 3–7 days. Can be up to 14 days for first submission. This is your longest tail.

**Actions:**
- [ ] PR #30 must be merged and deployed to prod
- [ ] Build production extension bundle: `cd packages/extension && npm run build`
- [ ] Prepare 5 store screenshots (1280×800 or 640×400):
  - [ ] Extension popup in action
  - [ ] Right-click capture menu
  - [ ] Resulting project canvas after capture
  - [ ] Ambient Ask panel (differentiator hero shot)
  - [ ] Daily digest email screenshot
- [ ] Draft privacy policy — hosted at `hypher.app/privacy`. Must state: what the extension collects, where it's sent, retention, user rights.
- [ ] Write store listing copy:
  - **Short description** (132 chars): Lead with outcome, not feature. "Capture anything on the web into your spatial project brain. Right-click, hotkey, or popup."
  - **Detailed description**: 3 paragraphs max. Opening hook → 3-bullet capability list → closing CTA with marketing site URL.
- [ ] Create Chrome Web Store developer account ($5 one-time fee)
- [ ] Submit for review

**Track:** Check daily in Chrome Web Store Developer Dashboard.

---

### LD − 7 days: Raycast extension submission

**Why second:** Raycast review is 3–5 days, usually faster than Chrome but still a review.

**Actions:**
- [ ] Extension already exists (playbook: "URL scheme already exists")
- [ ] Fork `raycast/extensions` repo
- [ ] Add `extensions/hypher/` with metadata + icon
- [ ] Run `npm run lint` locally to catch issues before PR
- [ ] Open PR to `raycast/extensions` with your extension

**What makes a Raycast extension merge fast:** Clean screenshots in the PR description, working demo video (GIF or mp4), metadata that matches Raycast conventions exactly (they have a style guide — follow it).

---

### LD − 5 days: npm publish `@hypher/core`

**Why:** Playbook lists as a bleeding-edge bet. If you want the "works in your codebase" story for launch, package must be public.

**Actions:**
- [ ] Audit `packages/core/package.json` — remove `"private": true`
- [ ] Pin version to `0.1.0` (beta signal)
- [ ] Verify all dependencies are in `dependencies` not `devDependencies`
- [ ] Add a minimal README with one usage example
- [ ] `npm login` if not already
- [ ] `npm publish --access public`
- [ ] Verify on npmjs.com that the package page renders

**Risk:** Once published, version 0.1.0 is immutable. Make sure the API is stable enough that you won't need to yank — or publish as `0.1.0-beta.1` with `--tag beta` to keep it out of default installs.

---

### LD − 3 days: All demo content finalized

**Actions:**
- [ ] Record primary demo video (60–90 seconds):
  - Scene 1 (10s): Landing page, click "Get started"
  - Scene 2 (15s): Capture 3 items via different methods (paste, extension, keyboard)
  - Scene 3 (20s): Canvas populated, spatial arrangement
  - Scene 4 (20s): Ambient Ask panel — type question, Claude streams answer
  - Scene 5 (15s): Daily digest email arriving, reply-to-add
  - Scene 6 (5s): Wordmark + URL
- [ ] Export at 1920×1080, under 8MB if possible, .mp4
- [ ] Record 3 short GIFs (3–5s each) for Twitter thread:
  - Single capture-to-canvas animation
  - Ambient Ask streaming
  - Drop-to-suggest connection
- [ ] Take 6 high-res screenshots for marketing site social cards
- [ ] Final pass: all demo content uses the seed demo project (no real user data leakage)

---

### LD − 2 days: Product Hunt hunter & asset pack

**Why Product Hunt needs prep:** You need a hunter (someone with a strong PH profile who posts on your behalf), scheduled post time, maker comment ready, and all assets uploaded in advance.

**Actions:**
- [ ] Identify hunter — DM 2-3 candidates, confirm one by this day
- [ ] Schedule post for 12:01 AM Pacific on Launch Day (maximizes 24-hour exposure)
- [ ] Prepare PH-specific assets:
  - Gallery: 4 of the LD − 3 screenshots + demo video
  - Thumbnail (240×240): clean hypher wordmark
  - Tagline (60 chars): something like "the spatial project brain for solo devs"
  - Description (260 chars max): outcome-led opening, 3 concrete capabilities, closing link
- [ ] Pre-write **maker comment** (posts automatically or first-thing morning):
  - 1 paragraph backstory (why you built this)
  - 3 bullets: what's in beta today
  - 2 bullets: what's coming
  - CTA: try it, feedback via reply
- [ ] Pre-write 5 FAQ replies you'll paste during the day (pricing, privacy, open-source question, Mac app question, comparison to X)

---

### LD − 1 day: Pre-flight

**Actions:**
- [ ] Production smoke test — the full 10-step verify list from env-vars punch list
- [ ] Vercel analytics + Sentry dashboards pinned in browser tabs
- [ ] Capacity check: Anthropic usage limit raised if on free tier, Upstash on paid plan, Resend on paid plan (100 emails/day free is not enough for launch day)
- [ ] Rate limits set appropriately on `/api/canvas/ask` — don't let launch traffic rack up $5000 in Claude API calls
- [ ] Status page or Twitter status handle ready for incident comms
- [ ] Sleep before 11pm — launch day is a marathon

---

### LD: Launch Day — coordinated fast-channel push

**Hour 0 (12:01 AM PT):** Product Hunt goes live (hunter posts)
**Hour 0:05:** You post maker comment immediately
**Hour 0:10:** Twitter thread posts (pre-scheduled or manual). Thread structure:
- Tweet 1: Demo video + one-line hook + link
- Tweet 2: Why you built it (personal story, 2–3 sentences)
- Tweet 3: Core differentiator #1 (Ambient Ask) with GIF
- Tweet 4: Core differentiator #2 (Spatial canvas) with GIF
- Tweet 5: Core differentiator #3 (Daily digest + reply-to-add) with GIF
- Tweet 6: What's next (voice, Mac app) — shows roadmap confidence
- Tweet 7: CTA + PH link

**Hour 1–4:** Active engagement window
- Reply to every PH comment within 15 min
- Retweet with value-adds (not just "thanks!")
- DM respond to direct interest

**Hour 4–12:** Secondary pushes
- Post to HN Show HN (if you have karma; if not, skip)
- Post to r/webdev, r/productivity, r/macapps (only if community norms allow)
- LinkedIn post if you have a network there
- Email your personal list (friends, past collaborators)

**Hour 12–24:** Hold position
- Reply to everything
- Capture feedback in a dedicated channel (Slack, Linear, wherever)
- Watch Sentry for production errors — respond same-day

---

### LD + 1: Recovery + momentum

**Actions:**
- [ ] Sleep in
- [ ] Screenshot PH rank at end of day 1 (archive moment)
- [ ] Write a "Day 1 retro" thread on Twitter (numbers, surprises, thank-yous)
- [ ] Triage bug reports — fix P0s same day via orchestrator
- [ ] Update landing page with social proof (PH badge, user count if impressive, quote cards from early users)

---

### LD + 3 to LD + 7: Chrome extension goes live

**Expected window.** Once approved:
- [ ] Add extension install link to marketing site header
- [ ] Post Twitter announcement: "Chrome extension is live — capture anything, anywhere"
- [ ] Update Product Hunt comment thread to reflect availability

---

### LD + 5 to LD + 10: Raycast extension goes live

Same pattern — announce, update site, thread update.

---

## Anti-patterns to avoid

- **Don't launch on a Friday or Monday.** Tuesday–Thursday gets best PH traction. Tuesday has historically highest conversion.
- **Don't launch during a major tech event** (WWDC, Google I/O, OpenAI dev day). Your headline competes with their keynote.
- **Don't submit Chrome Web Store and launch on the same day.** You're gambling that Google reviews in <24 hours. They might not.
- **Don't batch submissions late.** Starting Chrome Web Store at LD − 3 means you're launching without the extension live. Extension is a differentiator — having it in flight is a weakness.
- **Don't pre-launch your Twitter thread to an empty PH listing.** Coordinate the hour, or you'll waste your best tweets.
- **Don't stay up all night.** Burnout launches are worse than delayed launches.

---

## Go/no-go gate — 48 hours before launch

Ship the launch only if:

- [ ] All env vars green
- [ ] All merged specs smoke-tested in prod
- [ ] Zero P0 bugs open
- [ ] Demo video recorded and polished
- [ ] PH listing drafted and hunter confirmed
- [ ] Sentry alerting me personally set up
- [ ] Anthropic + Upstash + Resend on paid plans with raised limits
- [ ] Chrome extension: either approved, or you've decided to launch without it

If any of these fail, slip by 1 week. A slipped launch is fine. A broken launch is permanent.
