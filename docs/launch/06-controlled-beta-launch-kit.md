# Hypher Controlled Beta Launch Kit

**Goal:** founder-led private beta push this week, optimized for 10 great users.

**Launch mode:** visible on X, manually approved access.

**Main asset:** 60-90 second founder demo video.

## Positioning

### One-liner

The project context layer for AI builders and agents.

### Short description

Hypher is a private-beta context layer for builders. Drop in notes, links, agent output, build logs, and project fragments. Hypher turns them into project memory, Builder Briefs, and next actions so humans and agents can resume work with the right context.

### Supporting line

Capture first. Hypher turns it into context.

### Audience

- Solo builders juggling several active projects
- Designer-developers
- AI builders using tools like Cursor, Claude, or Codex
- Indie hackers
- Researchers and writers with messy project context
- Creative operators carrying too many threads

### CTA

Request beta access.

### Guardrails

- Do not frame this as a broad public launch.
- Do not lead with Product Hunt, pricing, full MCP, GitHub Build Overseer, Mac app, or Project Agent.
- Do lead with the current context loop: capture -> project memory -> Builder Brief -> agent writeback.
- Do not promise automated access. The beta is manually approved.
- Do not approve users who are only curious. Approve people likely to test with real project context.
- Do not imply the assistant/reminder/native vision is gone. Say those features come after the context loop is trusted.

## This Week Checklist

### Product Readiness

- [ ] Deploy/sync latest `main` so Convex has `betaRequests` schema and functions.
- [ ] Submit a test beta request from the live site.
- [ ] Approve it from `/app/settings/beta`.
- [ ] Copy the generated invite code.
- [ ] Redeem the invite through `/app`.
- [ ] Complete onboarding as a fresh user.
- [ ] Create 5 realistic captures.
- [ ] Accept or correct at least 3 sort suggestions.
- [ ] Open project memory.
- [ ] Inspect or accept one next action.
- [ ] Submit in-app feedback.
- [ ] Fix any P0 blocker before public posting.

### Site

- [x] Homepage primary CTA points to `/beta/request`.
- [x] Secondary CTA stays "I have an invite" and points to `/app`.
- [x] Request form explains that access is reviewed manually.
- [x] Homepage sells the current loop instead of the long-term roadmap.
- [ ] Confirm production homepage and request form match local behavior.

### X Profile

- [ ] Name: `Hypher`
- [ ] Bio line 1: `Project context for builders and agents.`
- [ ] Bio line 2: `Capture first. Builder Briefs, memory, and writeback after.`
- [ ] Link: `https://hypher.app/beta/request`
- [ ] Pinned post: founder demo video post
- [ ] Visual: clean product screenshot or short canvas/memory frame

### Demo Assets

- [ ] Record one main 60-90 second MP4 for X.
- [ ] Cut 2-3 short clips: capture, sorting, project memory.
- [ ] Take 3 still screenshots: landing page, capture/sort, project memory.
- [ ] Verify no real user/private project data appears.

### Outreach

- [ ] Make a list of 20 high-signal people.
- [ ] DM 10-15 likely-fit builders.
- [ ] Approve up to 10 users for Cohort 0.
- [ ] Track every approved user in `docs/launch/beta-ops-tracker-template.csv` or a copied spreadsheet.
- [ ] Ask each approved user for feedback within 7 days.

## Founder Demo Video

### Format

- 60-90 seconds.
- Founder face + screen is best. Screen-only with voice is acceptable.
- Use a realistic demo workspace, not private data.
- Keep the product visible for most of the video.

### Script

**0-8s: Hook**

"I'm building Hypher, a project context layer for builders and their AI agents."

**8-18s: Problem**

"Project context is scattered across notes, chats, repos, and agent sessions. Every new assistant starts cold."

**18-35s: Capture**

Show typing or pasting 2-3 messy fragments:

- product idea
- research link or note
- code/build thought

**35-50s: Sort**

Show Hypher suggesting projects.

Say:

"Hypher suggests where each fragment belongs, but you stay in control."

**50-65s: Memory**

Open a project and show project memory: summary, current direction, open questions.

**65-78s: Action**

Show a Builder Brief or suggested next action.

Say:

"The goal is not another place to organize. The goal is to recover context, brief your agents, and know what to do next."

**78-90s: CTA**

"I'm opening a small private beta for builders with messy active projects. Request access."

### Shot List

- [ ] Homepage with "The project context layer for AI builders and agents."
- [ ] Capture input with 2-3 fragments.
- [ ] Sorting suggestion with confidence/reasoning.
- [ ] Inbox review or project assignment.
- [ ] Project memory snapshot.
- [ ] Builder Brief or suggested next action.
- [ ] Beta request CTA.

## X Content Runway

### Day 1: Founder Demo / Beta Open

Post with demo video:

> I'm opening a small private beta for Hypher.
>
> Hypher is a project context layer for builders and their AI agents.
>
> Dump in notes, links, code thoughts, build logs, and agent output. Hypher turns them into project memory, Builder Briefs, and next actions.
>
> I'm approving the first 10 people manually.
>
> Request access: [link]

### Day 2: Problem

> A lot of useful work starts before it has a format.
>
> Not a task.
> Not a ticket.
> Not a polished doc.
> Not a clean note.
>
> Just a fragment:
>
> a thought, reference, bug, quote, decision, link, or half-formed direction.
>
> Hypher is built for that layer.

### Day 3: Product Loop

> The current Hypher loop:
>
> 1. Capture anything.
> 2. Hypher suggests where it belongs.
> 3. Build reviewable project memory.
> 4. Generate a Builder Brief.
> 5. Let agents write useful results back.
>
> The goal is not more organization.
>
> The goal is less context reconstruction around active work.

### Day 4: Founder Note

> I built Hypher because my project context kept scattering across notes, repos, chats, docs, and half-finished ideas.
>
> Project managers start too late.
>
> Notes apps capture things, but they do not give agents a clean understanding of what the project is, what changed, and what to avoid.
>
> Hypher starts with project memory and turns it into context.

### Day 5: Future Vision / Early Learnings

> The first Hypher beta is focused on the core loop:
>
> capture -> remember -> brief -> write back
>
> The longer-term direction is broader: proactive reminders, native capture, GitHub-aware project memory, and a real agentic assistant.
>
> But first I want to prove one thing:
>
> Will builders trust Hypher as the source of context for their projects and agents?

## Direct Outreach

### Who To Invite First

Prioritize people who:

- have 2+ active projects
- already use Notion, Obsidian, Linear, GitHub, Cursor, Claude, or Codex
- complain about scattered context
- would give direct feedback
- can test with real work this week

Avoid people who:

- only want to browse
- need a polished enterprise workflow
- are unlikely to respond after access

### DM Template

> Hey, I'm opening a small private beta for Hypher and thought you'd be a strong fit.
>
> It's a project context layer for builders: you dump in notes, links, code thoughts, build logs, and agent output, then Hypher turns them into project memory, Builder Briefs, and next actions.
>
> I'm looking for honest feedback from people with real messy workflows, not polished testimonials.
>
> Want an invite?

### Invite Delivery Template

> Amazing. Here is your Hypher beta invite:
>
> `[invite code]`
>
> Start here: https://hypher.app/app
>
> The most useful test is to capture 5 real fragments from an active project, open Project Pulse, and tell me whether the memory/brief helped you or an agent resume.

### Day 1 Check-In

> Hey, did you get into Hypher okay?
>
> No need for polished feedback yet. I mainly want to catch any onboarding or invite friction quickly.

### Day 3 Check-In

> Quick question: what did you try to capture first?
>
> I'm watching for whether Hypher fits real messy project material or only feels good in a demo.

### Day 7 Feedback Ask

> Wanted to ask for honest feedback now that you've had a chance to try Hypher.
>
> The most useful thing would be your reaction to:
>
> 1. What did you try to capture?
> 2. Did Hypher sort it in a way that made sense?
> 3. Did project memory, Builder Briefs, or next actions help you do anything useful?

## Beta Ops

Use the request admin page for request review, then copy approved users into the tracker template.

Minimum tracker fields:

- name
- email
- source
- archetype
- requested date
- approved date
- invite sent date
- activated
- first capture
- 5 captures
- returned after 7 days
- feedback received
- strongest use case
- biggest friction
- retention likelihood
- next follow-up date

## Success Criteria

- 10 high-quality users approved.
- 5 users complete the core loop.
- 3 users give specific feedback on sorting, memory, or next actions.
- 1-2 users say they would use Hypher again for a real active project.

## Go / No-Go Before Posting

Post publicly only if:

- [ ] Live request form submits successfully.
- [ ] Admin can approve a request.
- [ ] Generated invite redeems successfully.
- [ ] Fresh user onboarding works.
- [ ] Core capture flow works.
- [ ] Project memory can be opened.
- [ ] Feedback can be submitted.
- [ ] Demo video has no private data.

If any item fails, delay the public X post and use only direct DMs until fixed.
