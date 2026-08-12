---
name: plan
description: Turn a signed-off spec into an executable task list before any code is written. Use whenever a spec exists and the work needs breaking down — including "plan this out", "what are the tasks", "how do we build this", or when someone asks to start building a change that has no tasks.md yet. Do not use before a spec is signed off; use /asmt:spec first.
---

# Plan a change

1. Read `.asmt/config.yml`. If it is missing, stop and tell the user: no
   `.asmt/config.yml` in this repo. Create one with a `verify.command` (see
   README).
2. Read the `task-grammar` skill, then the `house-rules` skill.
3. Run `asmt-plan precheck <paths.changes>/<change-id>`. If it refuses, stop
   and report what it said. It refuses for two reasons and both are real: the
   spec is not signed off, or the existing plan has completed work that a
   rewrite would orphan. Do not work around either.
4. Read `proposal.md` and `spec.md`. The proposal's non-goals matter as much as
   the requirements — a task that implements a non-goal is a defect the spec
   already warned about.
5. Decompose per `task-grammar`: each task is one red-green-commit cycle. Group
   scenarios that one test cycle proves; split a scenario that honestly needs
   two. Do not aim for one task per scenario.
6. Write `tasks.md`. Every task carries `T-<n>` in order, a completion box, a
   `Satisfies:` line, and enough prose that someone who did not write the plan
   knows what done means.
7. Run `asmt-plan cover <paths.changes>/<change-id>`. If it fails, fix the
   plan — never the check, and never the spec.
8. Never edit `spec.md`. If planning shows the spec is wrong — a requirement
   that cannot be built, a scenario that is not testable — stop and say so. A
   signed-off spec is frozen; amending it is a new change with its own
   sign-off, not a side effect of planning.
9. Report back: the task count, which scenarios needed splitting or grouping
   and why, and anything you noticed about the spec but did not act on.
   Building is a separate step — run `/asmt:build` when the user asks.
