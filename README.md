# ASMT-CC-plugin

A Claude Code plugin marketplace (`effectz`) containing one plugin, `asmt` —
the Effectz.AI standard AI-assisted development workflow. It is a fork of
[Superpowers](https://github.com/obra/superpowers) 7.0.2 (MIT) under ASMT
command names, plus a verification gate and a PR guard.

## Install

```
claude plugin marketplace add effectz-ai/asmt-cc-plugin
claude plugin install asmt@effectz --scope project
```

## Commands

| Command | What it does |
|---|---|
| `/asmt:spec` | Talk the change through and write a design you approve |
| `/asmt:plan` | Turn the design into small tasks |
| `/asmt:build` | Build the plan task by task (subagents, or inline) |
| `/asmt:tdd` | Test-first, for what the repo's `tests` mode covers |
| `/asmt:verify` | Run the gate and write a receipt for HEAD |
| `/asmt:review` | Get the work reviewed, or act on review feedback |
| `/asmt:land` | Open the PR with the design and the check-by-hand list |
| `/asmt:debug` | Find the root cause before fixing |
| `/asmt:worktrees` | Work in an isolated git worktree |
| `/asmt:parallel` | Split independent problems across agents |

The skills also fire on their own when a request matches. Opening a PR
(`gh pr create`) is blocked until HEAD has a passing gate receipt.

## Configure a target repo

Every repo needs `.asmt/config.yml` at its root:

```yaml
version: 2

docs: pr          # pr   = design lives in .asmt/work/ and goes into the PR description
                  # repo = design committed to docs/asmt/specs/YYYY-MM-DD-<topic>.md
tests: focused    # strict  = test-first for every behaviour change
                  # focused = business rules, bug fixes, branching logic; UI and glue checked by hand
                  # light   = bug-fix regressions and money/security rules only

verify:
  command: "npm test"      # whatever proves the repo is green
  timeout_seconds: 900
```

Add `.asmt/receipts/` to the repo's `.gitignore`. `.asmt/work/` ignores
itself.

### Moving from v1

Set `version: 2`, delete `modes`, `size_classes`, `default_size_class` and
`paths`, and add `docs` / `tests` if the defaults (`pr`, `focused`) don't
suit. Old `specs/changes/` folders are not read by v2; delete them when you
like.

## Develop

```
claude --plugin-dir ./plugins/asmt
```

## Test

```
tests/run-all
```
