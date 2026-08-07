# Tasks: task planning

Written by hand — `/asmt:plan` is what this change builds, so it cannot plan
itself. The format below is what the spec requires of a plan (`T-<n>` ids, a
`Satisfies:` line on every task, a completion checkbox), so it doubles as the
worked example `task-grammar` will codify.

Loop: `tdd` — every task is one red-green-commit cycle, and every test name
carries the id of the scenario it proves.

Shape decided while planning: one script, `plugins/asmt/bin/asmt-plan`, with two
subcommands. `precheck` guards what must be true *before* a plan is written
(sign-off, no orphaned work); `cover` checks what must be true *after* (every
scenario claimed, every claim real, the format intact). `/asmt:plan` calls one
before writing and the other after.

---

## T-1: `asmt-plan cover` — scenario coverage

- [x] Complete

Satisfies: REQ-4.1, REQ-4.2, REQ-4.3, REQ-4.4, REQ-4.5

Read the scenario ids from `spec.md` and the `Satisfies:` lines from `tasks.md`.
Fail on an uncovered scenario, on a claimed id that the spec does not contain,
and on a missing `tasks.md`. Match with the delimiter rule from `spec-grammar`
so `REQ-1.10` never satisfies `REQ-1.1`. No `jq`.

## T-2: `asmt-plan cover` — task format

- [x] Complete

Satisfies: REQ-2.1, REQ-3.1, REQ-3.2

Extend `cover` to reject a plan whose tasks are not identified `T-1`, `T-2`, …
in sequence, or where any task lacks a `Satisfies:` line. `Satisfies: none` is
valid and must pass; an omitted line must not.

## T-3: `asmt-plan precheck` — sign-off is required

- [x] Complete

Satisfies: REQ-1.1, REQ-1.2, REQ-1.3

Fail when `spec.md` has no `Signed off:` line, when the line exists but is not
the first line, and when `spec.md` does not exist — naming the path it looked
for in that last case.

## T-4: `asmt-plan precheck` — replanning cannot orphan work

- [ ] Complete

Satisfies: REQ-5.1, REQ-5.2

Fail when any task in an existing `tasks.md` is marked complete, naming which.
Pass when none are, so the caller may replace the file. `precheck` never writes
anything itself.

## T-5: `task-grammar` knowledge skill

- [ ] Complete

Satisfies: REQ-2.2

The methodology half: what makes one task, why a task is a red-green-commit
cycle rather than a scenario or a requirement, the `T-<n>` and `Satisfies:`
forms, the checkbox, and the rule that ids renumber on replan and are never
stored anywhere outside `tasks.md`. Under 500 lines; `tests/test-plugin-shape`
enforces the shape.

## T-6: `/asmt:plan` entry point

- [ ] Complete

Satisfies: none

Thin, 20–40 lines. Read config; read `task-grammar`; run `asmt-plan precheck`
and stop on failure; decompose the signed-off spec; write `tasks.md`; run
`asmt-plan cover` and stop on failure. Never edit `spec.md` — if planning shows
the spec is wrong, stop and say so.

## T-7: `/asmt:build` records completion and resumes

- [ ] Complete

Satisfies: REQ-6.1, REQ-6.2, REQ-6.3

Tick a task when its commit lands, take the first unticked task rather than
always the first, and report the plan finished when none remain.
