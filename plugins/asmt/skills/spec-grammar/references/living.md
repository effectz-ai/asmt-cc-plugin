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

## In `spec.md`, mark each requirement's disposition

    ## ADDED REQ-4: The guard ignores repositories without .asmt/config.yml
    ## MODIFIED REQ-1: (was: refuses dirty trees) now also refuses a missing config
    ## REMOVED REQ-2

Modified requirements quote the previous text. A reviewer must be able to see
what changed without opening the living spec alongside.

## When the change lands

Fold `spec.md` into `<paths.living>/`, one file per capability rather than one
per change. Requirement IDs stay stable across the fold — the living spec is
where `REQ-1` permanently means what it meant when it was written. Then
archive the change directory.

## Why this way

The living spec is the answer to "what does this system do?" without reading
code or replaying history. That property survives only if IDs are stable and
the fold is not skipped. A change that lands without folding leaves the living
spec quietly wrong, which is worse than not having one.
