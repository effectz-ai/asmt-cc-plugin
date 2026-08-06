---
name: house-rules
description: Effectz.AI engineering conventions — repository layout, contracts-first data modelling, naming, error handling, and dependency rules. Read this before writing or reviewing any code in an Effectz.AI repository, including when the task seems too small to need conventions. If code you are about to write contradicts a rule here, stop and raise it rather than quietly following the surrounding code.
---

# House rules

## Repository layout

<!-- Turborepo package boundaries: what goes in apps/ vs packages/, what may
     depend on what. Ask the user. -->

## Contracts first

<!-- The Zod-schema-before-implementation rule. Where schemas live, who owns
     them, how they are shared between packages. Ask the user. -->

## Naming

<!-- Files, exports, test names. Ask the user. -->

## Error handling

<!-- Thrown vs returned errors, what may be swallowed, logging expectations.
     Ask the user. -->

## Dependencies

<!-- What may be added without discussion, what may not. Ask the user. -->

## When a rule and the surrounding code disagree

Say so. Do not silently follow either one. A rule that no longer matches the
code is either a rule to change or code to fix, and only the team decides which.
