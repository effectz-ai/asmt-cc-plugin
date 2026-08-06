# Living artifacts

Used when `modes.artifacts: living`.

Specs are permanent and cumulative. A change proposes a *delta*; once it
lands, the delta is folded into the living spec and the change directory is
archived.

## During a change

Everything lives under `<paths.changes>/<change-id>/`:

    proposal.md   why this change exists, what it changes, what it explicitly
                  does not change (non-goals)
    spec.md       the delta: requirements and scenarios that are new or
                  modified, using the grammar in SKILL.md
    tasks.md      written later by /asmt:plan, not by /asmt:spec

`<change-id>` is short, kebab-case, and derived from the card: `gate-receipts`,
not `EFL-1234-implement-the-gate-receipt-mechanism`.

## Where a new change's requirement numbers come from

Before drafting `spec.md`, read the capability's existing file(s) under
`<paths.living>/` and continue numbering after the highest `REQ-<n>` already
used there — a change never restarts a capability's numbering at `REQ-1`.
If two changes touching the same capability are drafted concurrently,
whichever lands second must renumber its new requirements around the first
before it can fold: numbers are claimed at fold time, not at draft time, so
a collision is caught at review, not discovered later in a test name.

## In `spec.md`, mark each requirement's disposition

    ## ADDED REQ-4: The guard ignores repositories without .asmt/config.yml
    ## MODIFIED REQ-1: (was: refuses dirty trees) now also refuses a missing config
    ## REMOVED REQ-2

Modified requirements quote the previous text. A reviewer must be able to see
what changed without opening the living spec alongside.

## When the change lands

Fold `spec.md` into `<paths.living>/`, one file per capability rather than one
per change. Requirement IDs *and* scenario IDs stay stable across the fold —
the living spec is where `REQ-1` and `REQ-1.1` permanently mean what they
meant when written, since `REQ-1.1` is the literal string `tdd-loop` looks
for in test names. Editing a requirement's prose does not change its
scenarios' IDs. Only a REMOVED requirement retires its scenario IDs, and a
retired ID is never reused. Then archive the change directory.

## Why this way

The living spec is the answer to "what does this system do?" without reading
code or replaying history. That property survives only if IDs are stable and
the fold is not skipped. A change that lands without folding leaves the living
spec quietly wrong, which is worse than not having one.
