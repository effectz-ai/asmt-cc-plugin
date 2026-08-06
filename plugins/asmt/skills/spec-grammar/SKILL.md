---
name: spec-grammar
description: The grammar for writing ASMT specifications — how to phrase requirements, how to write scenarios that are independently testable, and how scenario IDs link a spec to the tests that prove it. Read this before writing or reviewing any proposal.md or spec.md. Also read it when a spec feels vague, when reviewing whether a requirement is actually testable, or when deciding whether something belongs in the spec at all.
---

# Spec grammar

## Requirements

A requirement states an observable obligation of the system. One obligation
each. If you need "and" between two verbs, it is two requirements.

    REQ-1: The gate refuses to run against a dirty working tree.

Number them `REQ-<n>`, sequential within one change, never renumbered once
the spec is signed off. A stable ID is worth more than a tidy sequence.

Not requirements: implementation choices ("use a bash script"), aspirations
("should be fast"), restatements of the card title.

## Scenarios

Each requirement decomposes into scenarios. A scenario is one concrete case
with one expected outcome, and it must be independently testable — readable
and checkable without any other scenario having run first.

    REQ-1.1: Given a repo with uncommitted changes, when the gate runs,
             it exits non-zero and writes no receipt.
    REQ-1.2: Given a clean repo, when the gate runs and the verify command
             succeeds, it writes a receipt recording "pass".

Scenario IDs are `REQ-<n>.<m>`. They are the contract with the test suite:
`tdd-loop` requires every test name to contain the ID of the scenario it
proves. That is what makes "the tests pass" mean "the spec is satisfied"
rather than "the agent's code satisfies the agent's tests".

A scenario that cannot be phrased as given/when/then is usually a
requirement in disguise, or is not observable — in which case it does not
belong in the spec.

## What a spec does not contain

- Task breakdown. That is the plan's job.
- File paths and function names. Those are the plan's job too.
- Anything the change explicitly does *not* do — that goes in `proposal.md`
  under a non-goals heading, where it is visible during review.

## Interviewing before writing

Never infer requirements from a card title. Ask about the cases the card does
not mention: the empty input, the concurrent second caller, the partial
failure, what happens on retry. Most missing requirements are found by asking
"what happens if this runs twice?".

## Artifact layout

The artifact layout depends on `modes.artifacts` in `.asmt/config.yml`. Read
`references/living.md` when it is `living`. (`ephemeral` is not implemented
yet — if the config says `ephemeral`, stop and tell the user.)
