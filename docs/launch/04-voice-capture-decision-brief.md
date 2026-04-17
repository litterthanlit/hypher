# Decision Brief: Voice Capture Before or After Beta Launch?

**Decision owner:** Nick (sole decision-maker)
**Deadline:** Before tech-debt cleanup starts (any later and the sequencing breaks)
**Framing:** This is a launch-timing decision, not a feature decision. Voice is being built either way.

---

## The question in one line

**Do we delay beta by 3–4 days to ship voice capture as a launch feature, or launch lean now and add voice as a "big update" in Week 3?**

---

## What "voice capture" means here

From the playbook's bleeding-edge bets section:
> Voice capture → Whisper + Claude structuring (playbook flagged as highest viral potential)

**The pitch:** Solo developer talks at their laptop mid-thought ("okay, the new auth flow needs rate limiting, and I should look at that Stripe webhook issue, and remember to ship the digest redesign Thursday"). Hypher records, Whisper transcribes, Claude structures into discrete capturables on the spatial canvas. No typing, no clicking, no app switching.

**Why it's the viral hook:** It's the single feature that generates a shareable 15-second demo. "Watch me plan a sprint by talking." That video does rounds on X/Twitter in a way that "organized spatial canvas" does not.

---

## Option A — Launch lean, add voice in Week 3

**Pros:**
- **Preserves launch momentum.** Every day you hold is a day the orchestrator pattern could break, motivation dips, or a competitor ships.
- **De-risks the launch.** Voice is a stack you haven't built. Whisper latency, audio permissions, streaming transcription, error states, mobile browser mic support — all unknowns. A failed feature during launch is worse than a missing feature.
- **Creates a natural Week 3 content beat.** "Hypher can do this now" relaunch posts get their own PH moment (PH allows re-launches for major features) and their own Twitter cycle.
- **Gets real users onto the product sooner.** Their feedback shapes voice, rather than you speccing voice in a vacuum.
- **Shorter feedback loop on all existing features.** You learn whether Ambient Ask is actually the hook you think it is.
- **Zero risk of the "we shipped voice but it's flaky" version.** Nothing damages trust faster than a headline feature that fails in the demo.

**Cons:**
- **You launch without your strongest demo.** The spatial canvas + Ambient Ask story is good but not *unmissable*. You're competing for attention with a merely strong hook instead of a great one.
- **Launch reach is a one-shot weapon.** Product Hunt #1 once. Twitter launch thread gets one peak. You're using that ammo on a lean story.
- **Relaunches get diminishing returns.** The Week 3 voice relaunch will trend smaller than a combined launch.
- **Competitors could ship voice first.** Low but non-zero — voice-to-structure-to-canvas is a hot area. Linear, Notion, Reflect have all gestured at it.

---

## Option B — Delay beta 3–4 days, launch with voice

**Pros:**
- **Strongest possible launch narrative.** "Solo devs: talk to your laptop, get an organized project brain" is a one-sentence hook that sells itself. Current pitch is "spatial project brain for solo devs" — accurate, less magnetic.
- **Viral demo asset.** A 15-second video of voice-to-canvas is a significantly more shareable piece of content than any static screenshot or Ambient Ask GIF.
- **Differentiation is harder for competitors.** Voice + Claude structuring + spatial canvas is a defensible combination. Just "organized capture" is not.
- **Single PH moment > two smaller ones.** Consolidating launch firepower into one bigger day usually beats splitting.

**Cons:**
- **Scope creep risk.** "3–4 days" rarely ships in 3–4 days. Audio permissions, mic selection UI, streaming vs batch Whisper, Claude prompt design for structuring, error states when mic is blocked or Whisper fails, browser compatibility (Safari), mobile browser mic — realistic range is 4–7 days.
- **You haven't built any of this stack yet.** Every Week 2 spec you shipped was architecturally an extension of existing patterns (route handler + Convex + Claude). Voice adds a new media stack (MediaRecorder API, file uploads, Whisper API, audio UX).
- **Launch fatigue.** You've been running on adrenaline through Week 2. Extending by 4 days is 4 more days of "not launching" after you've been "about to launch" for two weeks.
- **Env-var rollout is still blocking.** You still haven't validated that *existing* features work end-to-end in prod. Adding voice before you've even verified Ambient Ask in production is stacking risk.
- **If voice is flaky on launch day, it becomes the headline.** "Cool idea, doesn't work" is a much worse outcome than "cool product, they'll probably add voice later."

---

## What changes the decision

The deciding factor is not which option is "better" — it's **your confidence in shipping voice to a 9/10 polish level in 4 calendar days, starting after env-vars + tech-debt cleanup complete.**

**Pick Option B if:**
- You've shipped voice-input features before and the stack is familiar
- You have existing Whisper + audio recording code you can port
- Your launch date is flexible (no external commitments, events, scheduled interviews)
- You can honestly say "I can ship this to the same quality bar as Ambient Ask in 4 days"

**Pick Option A if:**
- This is your first time integrating Whisper or handling microphone UX
- You have any launch commitments tied to a specific date (investor update, conference, etc.)
- The answer to "can I ship this polished in 4 days" is anything other than a confident yes
- You've been in build mode for 2+ weeks and are closer to burnout than to a second wind

---

## My read

**Option A (launch lean) is the higher-expected-value play** for these specific reasons:

1. **Your current stack is proven, voice is not.** Every Week 2 spec shipped clean because you'd built the pattern before. Voice is net-new stack. The variance on "how long will this take" is much higher than for a typical spec.

2. **Your current launch is already strong.** Ambient Ask is a real differentiator. Drop-to-suggest is novel. Daily digest + reply-to-add is a sticky-engagement loop competitors don't have. You're not launching with a weak hand.

3. **Launch-day bugs in a voice demo would be catastrophic in a way that no other feature would be.** Voice failing on stage is the one thing that becomes a screenshot'd meme.

4. **Week 3 relaunch of voice is genuinely the second-best content moment** you have in your backlog. Doesn't beat a combined launch in theory, but in practice: PH allows major-update re-submissions, and "Hypher now does X" posts can outperform original launches if X is strong.

5. **You need the gap between launches to stress-test production.** The first 72 hours of real users will surface bugs you can't predict. You want to fix those before stacking new features.

**Decision heuristic:** Can you, right now, tell me with 8/10 confidence that voice capture will be shipped, tested, and polished in 4 calendar days with no scope compromises? If yes → Option B. If any hesitation → Option A.

---

## Strategic execution if you pick A

- [ ] Launch beta with current feature set
- [ ] Spec voice in Week 3 with full scope (mic permission flow, streaming transcription, Claude prompt design, error states, mobile/desktop compat)
- [ ] Dispatch as 2–3 specs (recording UI, transcription pipeline, structuring) to let them parallelize
- [ ] Target relaunch: Week 3 Tuesday. Call it "Hypher now listens."
- [ ] Frame the original launch as "what Hypher is" and the relaunch as "where Hypher is going" — two narratives, both earned

## Strategic execution if you pick B

- [ ] Complete env-var setup + smoke test (non-negotiable, comes first)
- [ ] Spec voice capture as a single stretch-spec with honest scope (2 days minimum for spec alone, 2 days buffer)
- [ ] Dispatch on Day 1 of the 4-day window, not Day 2
- [ ] Set a hard cutoff: if voice isn't feature-complete by end of Day 3, you cut it and launch lean on Day 5 with voice in Week 3 anyway
- [ ] Don't dispatch tech-debt cleanup during the voice sprint — it fragments orchestrator attention

---

## What I actually need from you

Not the answer. Just tell me: **what's your honest confidence that you can ship polished voice in 4 days?**

If you say "6/10," I'll tell you Option A. If you say "9/10," I'll help you scope voice right now. Don't overthink this — the right answer is the one that matches your honest self-assessment, not the one that optimizes for the theoretical best outcome.
