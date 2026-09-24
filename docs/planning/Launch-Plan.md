# Launch plan: Hypher with Baton

September 24, 2026 · Proposal · [Baton plan](Baton-Implementation-Plan.md) · [Business plan](Hypher-Business-Plan.md) · [Gap analysis](Handoff-Gap-Analysis.md)

[`docs/PRODUCT.md`](../PRODUCT.md) and [`docs/PLAN.md`](../PLAN.md) still win. This is a proposal for how and when to launch. Nothing here is shipped, priced, or published. `PRODUCT.md` currently refuses pricing changes and launch theater; the pricing below is a hypothesis to decide after the pilot gate, and changing it needs a `PRODUCT.md` edit first.

## Launch gates

Launch only after each gate passes, in order. A missed gate moves the date, not the bar.

| # | Gate | Evidence |
|---|---|---|
| 1 | Backend deployed | Convex deploys on every merge to `main`, alongside Vercel |
| 2 | The explicit proof | Mac recording: Codex → Claude Code → Codex and Claude Code → Claude Code, named versions, stored handoff JSON |
| 3 | Pilots return | 5 assisted pilots on their own repositories; 3 of 5 use it on 3 separate days without reminders |
| 4 | The Baton proof | "Pull the plug" recorded in both directions, one honest failure shown |
| 5 | Safe for cloud keys | Project-scoped API keys and the "Hypher unavailable" notice shipped |
| 6 | Numbers | Harness results against the maintained-file baseline, with sample size and failures |

Pricing is decided at gate 3. Public copy that claims Baton works waits for gate 4.

## Positioning

**Category:** continuity for coding agents. Not memory, not notes, not an agent host.

**One line:** Switch agents without starting over.

**Why us:** vendor-neutral, verified continuity. Decisions with owners, evidence tied to the exact files, and a truth check on every resume, across Claude Code, Codex, and Cursor, local or cloud. A single vendor's native memory, or an app that hosts agents, has little reason to build that across rivals.

**First customer:** an independent builder or small studio switching between Claude Code and Codex on the same repository, who can show a recent costly handoff.

## Messaging

### Before gate 4 (pilot)

> **Stop re-explaining your project to every agent.**
> Hypher carries decisions and next steps between Claude Code and Codex. Join the pilot.

Show a "what's automatic / what's manual" table under it. Say "pilot."

### After gate 4 (launch)

> **Pull the plug. Open another agent. It already knows.**
> Hypher records your project's decisions, progress, and test results while your agent works, then hands them to the next one — Claude Code, Codex, or Cursor — checked against the code on your disk. Your code never leaves your machine.

Three supporting points:

- **Never explain twice.** Decisions, the reasons behind them, and the next step carry over, between agents and between sessions.
- **Checked, not trusted.** "Tests pass" means a captured result tied to the exact files, and the next agent names anything you edited in between.
- **Works where your agents work.** Your laptop or cloud agents. One install, or a few repo files.

**Always say:** tested tools and versions, what is automatic versus manual, what leaves the machine.

**Never say:** "never forgets," "works everywhere," "X% better," "AI memory for all your chats," or anything the recordings do not show.

**Naming:** Hypher is the product; Baton is the handoff feature. "Hypher, now with Baton."

## Pricing hypothesis

Baton depends on the hosted core — cloud agents must reach it — so its cost is recurring. That favors a subscription over the $79 one-time local Core in the business plan. Hypher does not run models; customers' agents do the reasoning. Cost is hosting, so margins stay wide.

| Plan | Price | Includes |
|---|---|---|
| Free | $0 | 1 project, explicit save and resume, 14-day history |
| Pro | $12/month or $120/year | Unlimited projects, automatic Baton, cloud agents, truth check and evidence, one-tap approval, full history |
| Team (later) | About $20/seat | Shared projects and handoffs between people; needs shared projects built first |

- **Existing customers:** keep current $10/month subscribers at their price. Honor every lifetime purchase as permanent Pro.
- **Stop selling lifetime** to new buyers. Unbounded hosting for one payment is the risk the business plan warns about.
- **Founding offer:** $8/month locked for 12 months, first 50 paying users.
- **Validate at gate 3:** ask pilots to pick a plan and pay; count payments, not compliments.
- **Change order:** decide → update `PRODUCT.md` → Stripe products and webhook tests (duplicate, out-of-order, refund, cancel) → pricing page. Never relabel the old lifetime plan.

## Before launch: checklist

### Product

- [ ] `npx hypher init` installs on a pilot's own repository in under 2 minutes; `hypher uninstall` reverses it
- [ ] `hypher init --repo` kit for cloud sessions
- [ ] Project-scoped API keys with revoke and last-used
- [ ] "Hypher unavailable" notice when the network blocks Hypher
- [ ] Export and delete that cascade to derived records
- [ ] Security review of cross-agent content: data framing, precedence, secret scan, destructive-command flags

### Trust

- [ ] Trust page: what leaves the machine (hashes, file names, commit IDs, decisions) and what never does (code, diffs, transcripts)
- [ ] Retention, hosting location, subprocessors (Vercel, Convex, Clerk, Stripe, Upstash, Sentry)
- [ ] Analytics and logs never contain raw project text
- [ ] Terms, privacy policy, refund policy

### Docs

- [ ] One page per door: Claude Code, Codex, Cursor, cloud agents, any shell
- [ ] A dated compatibility matrix: tool, version, automatic, manual, known limits
- [ ] Troubleshooting: network allowlist, keys, unmatched repository

### Ops

- [ ] Convex and Vercel deploy together from `main`
- [ ] Sentry alerts routed; a status page; a support email with a reply-time promise
- [ ] Changelog page, updated per release
- [ ] Rollback steps written down for Convex schema changes

### Assets

- [ ] 90-second "Pull the plug" video, real run, named versions
- [ ] One clip of a failure and how Hypher reports it
- [ ] A methods post: scenarios, conditions, sample size, failures
- [ ] Landing page with the support table directly under the demo

## Channels and sequence

| Week | Action |
|---|---|
| Pilot (gate 3) | Personally onboard 5 builders from Claude Code and Codex communities; watch real switches; collect quotes with permission |
| Soft launch (gate 4) | Waitlist opens with the video; post the methods write-up and the failure clip on X and in the Claude Code and Codex communities |
| Public launch (gate 6) | Show HN with the demo, the methods, and the numbers; r/ClaudeAI and r/ChatGPTCoding posts that follow each community's rules |
| After | One technical post per real failure fixed; a monthly changelog |

No paid ads until people return without reminders. No launch-weekend theater. Every public claim links to its recording or method.

## Metrics to watch

| Stage | Metric | Target |
|---|---|---|
| Activation | Installed and one handoff delivered within 24 hours | 60% of signups |
| Magic | Human commands to switch; recap words typed | 0 and 0 on supported paths |
| Trust | Repository false alarms; active decisions with a source | Under 5%; 100% |
| Habit | Switches per active user per week; week-2 return without reminders | Watch; 3 of 5 pilots |
| Revenue | Free → Pro conversion; founding seats filled | Watch; 50 |
| Support | Tickets per 10 active users per week; install failures | Watch; trend down |

## Risks

| Risk | Response |
|---|---|
| A native vendor ships cross-session handoff | Lead with what they will not do: cross-vendor, verified, approvals, cloud and local |
| Hook payloads change in a client release | Version fixtures, dated matrix, degrade to explicit resume |
| Keys leak from cloud environments | Project-scoped keys before recommending cloud setup; revoke in one click |
| Launch hype outruns the proof | Gates above; claims link to recordings |
| Support load from installs | Two-minute installer, per-door docs, `hypher status` for diagnosis |

## In plain words

Launch in steps, each proven before the next: deploy, record the switch, get five builders using it, record the "pull the plug" demo, make cloud keys safe, then publish numbers. The message is "pull the plug, open another agent, it already knows" — only once it's recorded. Price around $12 a month with a free tier, keeping everyone who already paid. No hype: every claim links to a real run.
