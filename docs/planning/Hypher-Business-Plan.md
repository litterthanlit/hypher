# Hypher business plan

September 21, 2026 · Proposed operating plan · [Technical plan](Hypher-Implementation-Plan.md) · [Astra strategy](Astra-Plan.md)

## The business in one sentence

Sell reliable continuation between coding agents: **switch agents without starting over.**

The first customer is an independent developer or small studio already switching between Codex and Claude Code on the same repository. They pay to avoid reconstructing decisions, losing unfinished work, and repeating mistakes. The first product is a handoff layer; a full application that hosts both agents is a later possibility, not a launch requirement.

Start with local workflows on macOS, subject to the integration spike. Do not advertise arbitrary desktop, browser, or cloud session compatibility until demonstrated. The broader visual assistant remains parked.

## The offer

“Your next agent knows what you decided, what changed, and what to do next.”

A successful switch carries the current goal, active constraints, decisions and reasons, verified versus unverified work, blockers, and the next task. Each important claim has a source or is clearly labeled an agent report. Hypher checks repository state before delivering the brief. It does not transfer code or uncommitted files.

The first experience can be a short handoff command followed by a resume command. The user should never have to compose the recap. Automatic checkpoints come after the intentional flow works reliably.

## Pricing: my recommendation

Run a small, free, time-limited assisted pilot. If users repeatedly return, test **$79 for the local product**, with the purchased version usable indefinitely and 12 months of updates and support. Future major upgrades are optional. Explain that compatibility with future agent releases may require an updated version.

The customer's existing agent prepares the handoff through a supported integration. This consumes their normal agent allowance; it does not mean unlimited inference or general API access is included with a subscription. Hypher must not depend on collecting provider session credentials.

| Option | What the customer buys | Decision |
|---|---|---|
| $79 one-time Core | Local memory, two supported adapters, handoffs, history, export | Preferred paid offer, after local storage works |
| $5–9/month optional sync | Hosted backup and cross-device memory sync | Test later; not included indefinitely in Core |
| $15/month hosted alternative | Hosted memory and a clearly bounded inference allowance | Keep as an alternative if customers prefer managed convenience |
| Customer API key | Optional independent extraction when their active agent cannot do it | Later capability, billed by their provider |

These are price hypotheses, not validated willingness to pay. Do not build and market all four offers at once. During the cloud-backed pilot, disclose where memory is stored; do not call it local-first yet. Honor any existing paid commitments before changing billing.

## Costs and sustainability

A one-time product still has ongoing costs: support, adapter maintenance, regression testing, releases, website and domain, payment processing, refunds, and any cloud operations. Your development subscriptions and time are also real business expenses. Optional hosted AI adds usage costs; local storage does not remove support costs.

Start with a discretionary infrastructure and API budget ceiling of **$100/month**, excluding your labor, development subscriptions, taxes, and payment fees. This is a planning constraint, not a vendor quote. Track actual spend weekly and stop optional inference at the configured cap.

For illustration, 25 licenses at $79 produce $1,975 gross revenue, not recurring revenue. Reserve cash for future support rather than treating it all as profit. If you provisionally reserve $20 per sale, the remaining $59 still has to cover payment costs, refunds, acquisition, and development. Measure whether that reserve is sufficient.

Use these equations:

- Contribution per sale = price − payment costs − refunds − attributable service costs − support reserve.
- Monthly cash result = sales contribution + recurring contribution − fixed expenses.
- For hosted service, measure cost per active customer at median and heavy usage; price against the heavy users as well.

The technical plan includes model-only examples. They are not forecasts of total product cost. Do not promise lifetime hosted storage, support, or AI for a single payment.

## Get customers through one proof

Recruit ten people who already use both target agents. Ask them to show their last switch: what they copied, what was lost, how long repair took, and what their current workaround is. Invite five with repeated pain into the assisted pilot.

A useful demo is under two minutes:

1. In the first agent, change a requirement and make a partial implementation.
2. Create the handoff and show the few important facts Hypher captured.
3. Switch to the second agent in the same verified working state.
4. Continue correctly without explaining the project again.
5. Show the source for a decision and then reverse the handoff.

Use an actual recorded run. Say which surfaces and versions were tested. Show failures honestly. Compare against a maintained handoff file as well as native project context; beating a blank new chat is too easy.

Publish the demo and a short explanation in communities where multi-agent builders already work. Personally onboard the first five users, with their permission. Build the landing page around this workflow and a pilot invitation. Paid advertising and broad plugin launches can wait.

## What gives this a chance

The useful advantage is dependable transfer: correct project, current decisions, source evidence, visible failures, and very little maintenance. A large integration count is not enough. Native memory and handoff files are serious substitutes; the earlier Astra plan documents the competitive research.

There is no guaranteed future-proof feature. Keep the memory format exportable and adapters replaceable. Build a regression corpus of real, permissioned handoff failures so improvements survive model and provider changes. Users should keep choosing Hypher because it works, not because their data is trapped.

## Two-week decision gate

These are deliberately small learning targets, not statistically reliable market validation:

| Question | Initial target | If it fails |
|---|---|---|
| Does the pain repeat? | 10 interviews; at least 5 show recent repeated handoff problems | Narrow the customer or stop broad development |
| Does the integration work? | Both directions demonstrated on the supported local surfaces | Narrow support; do not sell universal compatibility |
| Does it become a habit? | 3 of 5 pilots use it on 3 separate days without reminders | Investigate friction and real need |
| Will anyone pay? | 2 pilots buy the working paid version or make a clear purchase commitment | Revisit value and price; distinguish promises from revenue |
| Is it better than a file? | Measurably less recap effort without lower task quality | Improve capture/delivery before expanding |

Continue the next four weeks only if the evidence supports it. Five pilots cannot establish a market, but they can expose a product nobody returns to.

## What you need to own

You own interviews, positioning, pricing decisions, and final product acceptance. Implementation work should follow small reviewable milestones. Maintain one backlog, one supported-version matrix, and one release checklist.

Before charging: have working installation and removal, an honest data-storage explanation, export/delete controls, a support contact, refund and license terms, and a clear statement of included updates. Confirm payment and tax handling for your business before launch. This plan does not assume a particular legal or tax setup.

**Next commercial action:** recruit five builders for a Codex ↔ Claude Code handoff pilot while the first technical round trip is built.
