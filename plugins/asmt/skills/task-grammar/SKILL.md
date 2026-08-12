---
name: task-grammar
description: The grammar for ASMT task lists — what makes one task, how tasks are identified, how a task declares the scenarios it satisfies, and how completion is recorded. Read this before writing or reviewing any tasks.md. Also read it when a task feels too big to finish in one commit, when deciding whether two pieces of work are one task or two, or when a plan and its spec have drifted apart.
---

# Task grammar

A plan turns a signed-off spec into work someone can start. It is the only
artifact between `spec.md` and the commits, so it is where "what are we
building" becomes "what do I do next".

## What makes one task

**A task is the smallest unit that carries its own red-green-commit cycle.**
Write the failing test, watch it fail, write the minimum code, watch it pass,
commit. If that sequence does not fit the piece of work in front of you, it is
not one task.

That rule, and not the shape of the spec, decides the boundaries:

- A task may prove **several scenarios** when one test cycle covers them.
  `REQ-4.1` through `REQ-4.5` are five scenarios and one script; splitting them
  into five tasks would mean four commits that cannot stand alone.
- A single scenario may **split across two tasks** when proving it honestly
  needs two cycles.
- A task may prove **no scenario at all** — scaffolding that makes the next
  task possible. It says so explicitly (see `Satisfies:` below).

Two tempting rules that are wrong. *One task per scenario* makes coverage
arithmetic instead of a check, and produces trivial tasks that fight the way
tests actually group. *One task per requirement* produces tasks spanning
several commits, which breaks the one-task-one-commit mapping everything else
relies on.

## The file

`<paths.changes>/<change-id>/tasks.md`. Written by `/asmt:plan`, never by
`/asmt:spec`.

    ## T-1: asmt-plan cover — scenario coverage

    - [ ] Complete

    Satisfies: REQ-4.1, REQ-4.2, REQ-4.3

    Read the scenario ids from spec.md and the Satisfies: lines from
    tasks.md. Fail on an uncovered scenario, on a claimed id the spec does
    not contain, and on a missing tasks.md.

Four parts, all required: the heading with its id and a title, the completion
box, the `Satisfies:` line, and enough prose that someone who did not write the
plan knows what "done" means.

## Identifiers

Task ids are `T-<n>`, sequential from `T-1`, in the order the tasks are meant to
be done.

**Ids are stable within a plan, not across replans.** A regenerated plan
numbers from `T-1` again, and nothing outside `tasks.md` stores a task id — no
state file, no branch name, no issue tracker field. This is a deliberate
trade: it keeps the plan self-contained and needs no state subsystem to stay
consistent, at the cost that a commit message naming `T-3` can point at a
different task after a replan.

That cost is bounded by the rule that makes replanning safe: a plan with any
completed task cannot be regenerated at all (`asmt-plan precheck` refuses). So
a `T-3` that some commit already names is a `T-3` no replan can move.

## `Satisfies:`

Every task carries exactly one `Satisfies:` line naming the scenarios it
proves, in the exact `REQ-<n>.<m>` form the spec grammar defines:

    Satisfies: REQ-2.1, REQ-3.1, REQ-3.2

A task that proves no scenario writes `Satisfies: none`. **The line is never
omitted.** An absent line is a defect, not an implicit "nothing" — the
difference between "this task proves nothing, deliberately" and "someone forgot
to say" is exactly what the check exists to catch.

Ids are matched as whole tokens, so `REQ-1.10` never satisfies `REQ-1.1`. Same
rule `tdd-loop` applies to test names, for the same reason.

## Completion

    - [ ] Complete     not started, or in progress
    - [x] Complete     the implementing commit has landed

`/asmt:build` ticks the box when the task's commit lands, and resumes at the
first task not ticked. The plan is therefore the answer to "where were we?"
without reading history — and it stays that answer across sessions, machines,
and people, because it is a tracked file rather than anything in a transcript.

Tick it when the commit exists. Not when the code is written, not when the
tests pass locally — the box means a commit, so that it agrees with what the
repository can be asked.

## What a task does not contain

- **Estimates, effort, assignees, dates.** None of it survives contact with the
  work, and the plan is not a project management artifact.
- **A dependency graph.** Tasks are an ordered list. A task that must follow
  another says so in its prose; nothing computes an ordering.
- **File paths and function names**, unless the task genuinely turns on them.
  The spec keeps them out because they belong to the plan; that does not make
  the plan an invitation to design the whole change up front.
- **Requirements.** If the plan wants an obligation the spec does not state,
  the spec is wrong. Stop and say so — a signed-off spec is frozen, and
  amending it is a new change with its own sign-off.

## How a plan is checked

    asmt-plan cover <change-dir>

Fails when a scenario has no task, when a task claims a scenario the spec does
not contain, when task ids are not sequential from `T-1`, and when any task has
no `Satisfies:` line. A plan that passes is one where the spec and the work
agree about what is being built — which is the only thing that makes "the tasks
are done" mean "the spec is satisfied".
