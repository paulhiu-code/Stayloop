# Autonomous PR workflow

This document describes how StayLoop's PRs move from "opened" to "merged into `main`" with as little manual work as possible while staying safe. It covers both the pieces that live in this repo and the pieces you must configure once in GitHub and the Cursor dashboard.

## How the pieces fit together

```
PR opened / pushed
   ├─▶ CI (.github/workflows/ci.yml): npm audit + lint + typecheck + build
   ├─▶ Cursor Bugbot: automated code review (rules in .cursor/BUGBOT.md)
   └─▶ (optional) Cursor Automation: a Cloud Agent that fixes conflicts,
        addresses review comments, and pushes fixes
                     │
             all required checks green
                     │
                     ▼
     GitHub auto-merge squashes into main
```

Merging itself is done by **GitHub's native auto-merge**, gated on required checks — Cursor agents drive a PR to "green" but do not perform the merge.

## Already in this repo

- **CI** — `.github/workflows/ci.yml` runs `npm audit`, `npm run lint`, `npm run typecheck`, and `npm run build` on every PR to `main`. This is the objective safety gate.
- **Cloud Agent environment** — `.cursor/environment.json` lets Cloud Agents install deps and run the dev server so they can verify changes.
- **Bugbot rules** — `.cursor/BUGBOT.md` focuses reviews on StayLoop's risk areas (secrets, RLS, webhook signatures, money math).
- **PR template** — `.github/pull_request_template.md` includes a merge-safety checklist.
- **Dependabot** — `.github/dependabot.yml` opens grouped, low-noise dependency PRs weekly; they flow through the same gates and auto-merge when green.

## One-time setup you must do (GitHub + Cursor dashboard)

These cannot be committed to the repo — configure them once.

### 1. Branch protection on `main` (GitHub → Settings → Branches)

This is what makes autonomy *safe*: nothing reaches `main` until every gate is green.

- Require a pull request before merging.
- Require status checks to pass. Add as required checks:
  - the CI job (`build`) from `.github/workflows/ci.yml`
  - `Cursor Bugbot`
- Require branches to be up to date before merging.
- Require conversation resolution before merging.
- (Recommended) Require linear history.
- (Recommended) Do not allow bypassing the above; disallow direct pushes to `main`.

> Tip: for Bugbot to actually block on findings, enable "fail on unresolved issues" in Bugbot settings — otherwise its check reports `neutral` and won't stop a merge.

### 2. Enable auto-merge (GitHub → Settings → General)

- Turn on **Allow auto-merge**.
- Turn on **Automatically delete head branches**.
- With auto-merge enabled on a PR, GitHub merges it the moment all required checks pass — no human click needed. For an MVP, choose **squash** merges for a clean history.

### 3. Cursor Bugbot (already enabled)

Bugbot reviews each PR against `.cursor/BUGBOT.md`. Optionally enable its autofix so it can spawn a Cloud Agent to push fixes for issues it finds.

### 4. (Optional but recommended) A PR-triggered Automation

Set up a Cloud Agent Automation at `cursor.com/automations` to actively work stacked PRs toward mergeable state.

- **Triggers:** "Pull request opened", "Pull request pushed", and "CI completed".
- **Repository:** this repo.
- **Tools:** enable *Comment on pull request*; enable approvals if you want it to approve; *Request reviewers* optional.
- **Prompt:** see below.

Paste this as the Automation prompt:

```
You are maintaining the StayLoop repository. For the pull request that triggered you:

1. Check out the PR branch. If it is behind `main`, rebase/merge `main` in and resolve
   any conflicts, preserving the intent of both sides.
2. Run `npm install`, then `npm run lint`, `npm run typecheck`, and `npm run build`
   (build needs VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY — use the configured
   placeholder secrets). Fix any failures you introduced or that block the PR.
3. Address unresolved review comments and Cursor Bugbot findings. Follow the review
   rules in .cursor/BUGBOT.md — treat secret leakage, missing RLS, unverified
   webhooks, and money-handling bugs as blocking; do not "fix" them by weakening a
   check. If a finding needs a human product decision, leave a clear comment instead
   of guessing.
4. Push your fixes to the PR branch.
5. When CI and Bugbot are green and no blocking comments remain, post a concise
   "ready to merge" summary (and approve if approvals are enabled). Do NOT attempt to
   merge — GitHub auto-merge handles the final merge once checks pass.

Never commit secrets. Never disable or weaken a required check to make CI pass.
```

Add the build-time placeholders (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) as Cloud Agent secrets in the dashboard so the agent can run `npm run build`.

### 5. Set a spend limit

Cloud Agents, Automations, and Bugbot are usage-billed. Set a monthly spend limit in the Cursor dashboard so autonomous activity can't run away — sensible for an MVP.

## Ad-hoc control

- To have an agent work a single stuck PR, comment `@cursor <instructions>` on it.
- To pause autonomy, disable the Automation and/or turn off auto-merge; PRs then wait for a human.

## The one manual gate that remains

By design, a human (or Dependabot/Cursor) opens the PR and the checks decide the merge. If you ever want a true human-in-the-loop before `main`, add a required reviewer to branch protection — then auto-merge waits for that approval in addition to the checks.
