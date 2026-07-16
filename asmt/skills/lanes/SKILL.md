---
name: lanes
description: Size an AI-dev change into a Fast / Standard / Deep lane and follow that lane's spec-before-code flow with a hard verification gate. Use when starting a card, feature, bug fix, or any change, or when deciding how much process a change needs, or when opening a PR under this workflow.
---

# ASMT workflow discipline

Every change is sized into a **lane** before work starts. The lane sets how much process
the change pays for. Don't push a doc fix through the same ceremony as a new subsystem, and
don't sneak a subsystem through the Fast lane.

## Pick the lane

| Lane | Use when | Flow |
| :-- | :-- | :-- |
| **Fast** | Docs, config, deps, small fixes with **no spec delta** | implement → gate → self-review → PR → CI gate → human review → merge |
| **Standard** (default) | One capability / spec area; the design is obvious | `/opsx:propose` → **one combined human review** → `/opsx:apply` → gate → self-review → PR → CI gate → model review → human review → merge → archive |
| **Deep** | New subsystem, cross-cutting, or guardrail-adjacent | Standard **plus** a separate design review before tasks are approved |

If unsure between two lanes, take the higher one. Any reviewer can bump a mislabeled card up a lane.

## Non-negotiables (every lane)

1. **Spec before code** (Standard/Deep): no implementation until `/opsx:propose` output
   (proposal + design + delta spec + tasks) is human-approved.
2. **The gate is hard.** Before opening a PR, the project's gate command must be green
   locally, and for any change with a runtime surface, drive the real flow to confirm it
   works (evidence over claims — not just tests passing). **No PR merges red** — the same
   gate runs in CI as the enforcement copy.
3. **Archive on merge.** After merge, run `openspec archive <change-id>` so the delta folds
   into `openspec/specs/` (living specs). A merged-but-unarchived change is a bug.
4. **Feed the loop.** If human review catches something the spec/model review should have,
   encode it — a `rules:` entry in `openspec/config.yaml`, a line in `CLAUDE.md`, or a
   review-skill check — so it doesn't recur. Don't re-litigate the same finding in PRs.

## Roles
- **Card creator** owns the combined review (Standard) / spec review.
- **Senior engineer (SSE)** owns the Deep-lane design review and the final code review.
- **Developer** drives the agent and owns the result — the agent types, the human is accountable.

The gate command, branch names, and card tool are project-specific — see the generated
`docs/process/ai-dev-workflow-standard.md`.