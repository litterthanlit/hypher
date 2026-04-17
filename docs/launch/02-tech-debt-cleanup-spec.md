# Spec: Tech-Debt Cleanup — Remove `(api as any)` Casts

**Owner:** Orchestrator (Opus) → delegates to Sonnet
**Type:** Cleanup PR, no new features
**Scope:** Single PR, single concern
**Blocks:** Nothing — but should land before Spec #10 to avoid compounding debt
**Prereq:** Section 2 of env-vars punch list complete (`npx convex dev` regenerates `api.d.ts`)

---

## Orchestrator briefing (paste to Opus)

> **Cleanup spec — `(api as any)` removal**
>
> **Context:** ~6 files carry `(api as any)` / `(internal as any)` casts because Convex type regen was blocked during Week 2. Nick has completed env-var setup; `npx convex dev --once` now regenerates `convex/_generated/api.d.ts` cleanly with all current mutations/queries/actions typed.
>
> **Goal:** Remove every `(api as any)` and `(internal as any)` cast in `hypher-web/src/`. Replace with proper typed references. No behavior changes. No new features. No refactors beyond what's required to restore types.
>
> **Dispatch to Sonnet with these rules:**
> 1. Run `npx convex dev --once` first to confirm `api.d.ts` is current.
> 2. Grep the entire `hypher-web/src/` tree for `(api as any)` and `(internal as any)`. Enumerate every match in the PR description.
> 3. For each match: replace the cast with the properly-typed reference. Do not change the runtime behavior.
> 4. If TypeScript complains that a function doesn't exist on the typed `api`, do NOT add the cast back. Stop, flag the file, and report — the Convex function may need to be added or renamed.
> 5. Run `npm run build` and `npm run test` (Vitest). Both must be green.
> 6. Run `npm run typecheck` if it exists, or `tsc --noEmit` from `hypher-web/`. Zero errors.
>
> **Do not:**
> - Add any new `any` or `unknown` casts
> - Touch any `.tsx` layout or styling
> - Touch any test files unless the test itself references a cast
> - Modify `convex/` source files (only consumers in `src/`)
> - Open a PR that changes more than the cast removals + any imports the removals require
>
> **PR title:** `chore: remove (api as any) casts after convex type regen`
>
> **PR body must include:**
> - Bullet list of every file + line touched
> - Count: "Before: N casts across M files. After: 0."
> - Build + test status
> - Any file where the cast couldn't be cleanly removed, with an explanation (flag for Nick to review)

---

## Why this matters (for your reference, not the orchestrator)

**Technical explanation:** Convex generates TypeScript types for your backend functions at `convex/_generated/api.d.ts`. When that file is out of date, TypeScript doesn't know your functions exist, so the code was written with `(api as any).yourFunction` to suppress the type error. That works at runtime (Convex still dispatches the call), but it means:

1. **You lose autocomplete and type-check on every Convex call.** A renamed function won't trip TS — it'll fail silently at runtime.
2. **Every new spec inherits the same escape hatch.** Sonnet has been copy-pasting the pattern because the file it's editing already uses it. This compounds.
3. **Refactors are dangerous.** If you rename a Convex query, the frontend callers won't flag as errors — you'll discover the break in production.

**Simple version:** Your frontend is "typed but lying." It says it's type-safe but has `any` escape hatches at every Convex boundary. Cleanup restores actual type safety.

**Longterm solution:** Add a CI step that fails the build if any `(api as any)` or `(internal as any)` appears in the diff. You can do this with a one-line `grep -rn` check in a GitHub Actions workflow step. That prevents regression — any future code that introduces the pattern gets caught at PR review. Add this as a follow-up to the cleanup PR, not in it.

---

## Pre-dispatch checklist (for Nick)

- [ ] Env vars Section 2 (Convex) is complete
- [ ] `cd hypher-web && npx convex dev --once` runs cleanly
- [ ] `git status` shows no uncommitted changes
- [ ] On `main`, pulled latest
- [ ] `main` is at the commit matching PR #30 (Chrome extension) merge — or whatever the latest merged state is

Once all checked, paste the "Orchestrator briefing" above to Opus.

---

## Acceptance criteria

PR passes review when:

- [ ] `git grep -n 'as any' hypher-web/src/ | grep -iE '(api|internal)'` returns zero lines
- [ ] `npm run build` green
- [ ] `npm run test` green (34/34)
- [ ] `tsc --noEmit` zero errors
- [ ] PR description enumerates every file changed
- [ ] No spec behavior changed (spot-check: Ambient Ask still works, digest still renders, health ring still animates)

---

## Follow-up PR (separate, after this lands)

Add CI guard. Create `.github/workflows/no-any-casts.yml`:

```yaml
name: No any casts on Convex boundary
on: [pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Fail if (api as any) or (internal as any) appears
        run: |
          if git grep -nE '\((api|internal) as any\)' hypher-web/src/; then
            echo "::error::(api as any) / (internal as any) casts are banned. Regenerate Convex types instead."
            exit 1
          fi
```

Dispatch to Sonnet as a separate one-file PR after cleanup lands. Keeps scope tight.
