# ASMT-CC-plugin

A Claude Code plugin marketplace (`effectz`) containing one plugin, `asmt` —
the Effectz.AI standard AI-assisted development workflow. Ships today:
`spec`, `build`, `verify`. Planned, not yet implemented: `plan`, `review`,
`land`.

## Install

```
claude plugin marketplace add effectz-ai/asmt-cc-plugin
claude plugin install asmt@effectz --scope project
```

## Develop

```
claude --plugin-dir ./plugins/asmt
```

## Test

```
tests/run-all
```

## Configure a target repo

Every repo the plugin runs against needs `.asmt/config.yml` at its root, with
at minimum a `verify.command` — the command `asmt-gate` runs to produce a
receipt:

```yaml
version: 1

modes:
  artifacts: living        # living | ephemeral (ephemeral not implemented yet)
  loop: tdd                # tdd | code-then-test (code-then-test not implemented yet)
  topology: sequential     # sequential | subagent (subagent not implemented yet)

verify:
  command: "npm test"      # whatever proves the repo is green

paths:
  changes: "specs/changes"
  living:  "specs/current"
```

There is no `/asmt:start` — this file is created by hand, once, per repo.
Add `.asmt/receipts/` to that repo's `.gitignore`; receipts are regenerated
per commit and are not meant to be versioned.
