# Proposal: task planning

## Why

The workflow runs end to end today — a card becomes a signed-off spec, a build,
a receipt, and a gated PR. One link in that chain is written by hand:
`tasks.md`. `/asmt:build` step 3 stops and says so.

That gap is not a broken chain, it is an undefined interface. Specs have a
grammar: `spec-grammar` states the requirement and scenario forms, fixes
`REQ-<n>.<m>` as the id, and ships the exact `grep -E` a checker runs. Tasks
have nothing — no format, no ids, no rule for what makes one task. The first
dogfood run had to invent all three, and that invention is now the only worked
example in the repo for anyone to copy.

Two consequences make this the next thing to build rather than a later polish:

- **Everything downstream reads `tasks.md`.** Subagent topology dispatches per
  task, `/asmt:status` and cross-session resume need to know which task is
  current, metrics count tasks. Each of those built against an invented format
  is built twice.
- **The traceability chain has a hole in the middle.** `REQ-1.1` reaches test
  names today and `tdd-loop` enforces it. Nothing connects a requirement to the
  work that implements it, so "which requirement is still unimplemented?" has no
  mechanical answer — only "which test names exist".

## What changes

A task grammar, an entry point that applies it, and a coverage check that makes
the spec→task link verifiable rather than aspirational.

- **`task-grammar`** — a knowledge skill, the fat half of this change. What a
  task is, how tasks are identified, how a task cites the scenarios it satisfies,
  how completion is recorded.
- **`/asmt:plan`** — a thin entry point: read the signed-off spec, decompose it,
  write `tasks.md`.
- **A coverage check** — answers "is every signed-off scenario claimed by a
  task?" and "does every scenario a task claims actually exist?", using the same
  delimiter rule `tdd-loop` already uses so `REQ-1.1` is never satisfied by
  `REQ-1.10`.
- **`/asmt:build` learns to record completion** — ticking a task when its commit
  lands, and resuming at the first unticked task.

Decisions taken at interview, recorded here because they are the ones a reviewer
would otherwise have to reconstruct:

- **A task is the smallest unit that carries its own red-green-commit cycle.**
  Not one task per scenario, not one per requirement. A task may prove several
  scenarios if one test cycle covers them; a hairy scenario may split across two
  tasks.
- **Planning requires a signed-off spec.** The `Signed off:` line is already
  greppable and already freezes requirement numbers. Refusing to plan without it
  turns sign-off from a convention into the second mechanically enforced gate.
- **The plan itself gets no approval gate.** The plan is derived work: if the
  spec was right, the tasks follow from it. Two meaningful gates beat three
  rubber-stamped ones.
- **Replanning refuses when work has started.** Regenerating a task list under a
  half-built change orphans committed work silently. With nothing started, it
  regenerates freely.
- **Completion lives in `tasks.md` itself**, as checkboxes, not in a state file.
  It survives any session, is readable without tooling, and does not pull the
  deferred `asmt-state` subsystem into this change.

## What this explicitly does not do

- **No `/asmt:status`, no `asmt-state`, no `SessionStart`/`SubagentStop` hooks.**
  Checkboxes in `tasks.md` are the whole state mechanism. `/asmt:status` can read
  them later without changing anything written here.
- **No plan approval gate.** No `Approved:` line, no third human stop.
- **No dependency graph.** Tasks are an ordered list. A task that must follow
  another says so in prose; nothing computes a DAG or reorders anything.
- **No estimates, effort, assignees, or dates.** A task carries an id, a title,
  the scenarios it satisfies, and its completion state. Nothing else.
- **No subagent dispatch.** `topology: subagent` remains unimplemented and
  `/asmt:build` still stops on it. This change gives that work a stable format to
  build against later; it does not do that work.
- **`/asmt:plan` never edits `spec.md`.** If planning reveals the spec is wrong,
  it stops and says so. A signed-off spec is frozen — amending it is a new change
  with its own sign-off, not a side effect of planning.
- **No retro-planning of the archived change.** `specs/changes/archive/quiet-fixture-crlf/tasks.md`
  keeps the hand-written format it was born with; it is history, not a template.
- **No `/asmt:review`, `/asmt:ship`, `/asmt:land`.** Still out of scope. A review
  skill reviews tasks, so it inherits whatever this change decides — it comes
  after, not alongside.
