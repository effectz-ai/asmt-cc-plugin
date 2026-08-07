# Capability: task-planning

Turning a signed-off spec into an executable task list, and keeping that list
honest about what it covers and how far it has got.

## REQ-1: Planning refuses a spec that is not signed off

Requirement: Planning may not begin against a spec that carries no sign-off,
because sign-off is the checkpoint that freezes requirement numbers — planning
without it plans against numbers that can still move.

### REQ-1.1

Given a change directory whose `spec.md` does not carry a `Signed off:` line,
when planning runs, it stops, names the missing line, and writes no `tasks.md`.

### REQ-1.2

Given a change directory whose `spec.md` carries a `Signed off:` line somewhere
other than the first line, when planning runs, it stops — the grammar defines
sign-off as the first line, and a line further down is not a signature.

### REQ-1.3

Given a change directory with no `spec.md` at all, when planning runs, it stops
and says which path it looked for.

## REQ-2: Every task carries a stable identifier

Requirement: Each task in a plan is identified, so that commits, reports, and
resumption can name it.

### REQ-2.1

Given a signed-off spec, when planning writes `tasks.md`, every task carries an
identifier of the form `T-<n>`, sequential within the change, starting at `T-1`.

### REQ-2.2

Given an existing `tasks.md` that is regenerated, when planning writes it again,
identifiers are assigned from `T-1` in the new list's order — task ids are stable
within a plan, not across replans, and nothing outside `tasks.md` stores one.

## REQ-3: Every task names the scenarios it satisfies

Requirement: The link from a task back to the spec is written down, so that
"which requirement is this work for?" has a mechanical answer.

### REQ-3.1

Given a task, when it is written, it carries a `Satisfies:` line listing one or
more scenario ids in exactly the `REQ-<n>.<m>` form.

### REQ-3.2

Given a task that exists only to make later tasks possible and proves no scenario
of its own, when it is written, its `Satisfies:` line reads `none` — the line is
never omitted, so a missing line is a defect rather than a claim.

## REQ-4: The plan is checkable against the spec

Requirement: A plan and its spec can be shown to agree, so that "the tasks are
done" means "the spec is satisfied".

### REQ-4.1

Given a spec scenario that no task names, when the coverage check runs, it fails
and names the uncovered scenario.

### REQ-4.2

Given a spec where every scenario is named by at least one task, when the
coverage check runs, it passes.

### REQ-4.3

Given a task naming a scenario id that does not appear in `spec.md`, when the
coverage check runs, it fails and names the unknown id — a typo in a `Satisfies:`
line must not read as coverage.

### REQ-4.4

Given a spec containing both `REQ-1.1` and `REQ-1.10`, and a task naming only
`REQ-1.10`, when the coverage check runs, it reports `REQ-1.1` as uncovered —
matching is delimited on both sides, exactly as `tdd-loop` matches test names.

### REQ-4.5

Given a change directory with no `tasks.md`, when the coverage check runs, it
fails rather than passing vacuously.

## REQ-5: Replanning cannot orphan work in progress

Requirement: A plan under which work has already been committed may not be
regenerated, because the commits naming its task ids would be left pointing at
tasks that no longer exist.

### REQ-5.1

Given a `tasks.md` in which at least one task is marked complete, when planning
runs again, it stops, names the completed tasks, and leaves `tasks.md`
byte-for-byte unchanged.

### REQ-5.2

Given a `tasks.md` in which no task is marked complete, when planning runs again,
it replaces `tasks.md` with the new plan.

## REQ-6: Completion is recorded in the plan

Requirement: How far the build has got is recorded in the plan itself, so that
resuming needs no state file and no transcript.

### REQ-6.1

Given a task whose implementing commit has landed, when the build finishes that
task, the task is marked complete in `tasks.md`.

### REQ-6.2

Given a `tasks.md` with some tasks complete and some not, when the build runs, it
takes the first task not marked complete.

### REQ-6.3

Given a `tasks.md` in which every task is marked complete, when the build runs, it
reports the plan finished and starts nothing.

Folded from `specs/changes/archive/task-planning/` (signed off: sano,
2026-08-07). Requirement and scenario IDs are frozen as of that sign-off — see
`spec-grammar/references/living.md`.
