# spec-lane-workflow

A Claude Code **plugin** that installs a spec-before-code, lane-sized AI development workflow
into any project. It's a thin opinionated layer over two things you already install —
[OpenSpec](https://github.com/Fission-AI/OpenSpec) and Claude Code — not a framework.

## What you get

- **Three lanes** (Fast / Standard / Deep) so a doc fix doesn't pay the same ceremony as a
  new subsystem. Enforced by the bundled `lanes` skill.
- **A hard verification gate** in two places: locally before a PR, and in CI (`verify.yml`).
  No PR merges red.
- **Archive-on-merge living specs** and a **feedback loop** (recurring review findings become
  `openspec/config.yaml` rules or skills).
- **Security defaults**: a `.claude/settings.json` deny-list blocking `.env*`, `*.pem`, `*.key`,
  `secrets/`, etc. at the tool level.

## Install

```
/plugin marketplace add <your-org>/spec-lane-workflow
/plugin install spec-lane-workflow
/workflow-init
```

`/workflow-init` detects your stack (package manager, monorepo tool, lint/typecheck/test
scripts), asks for the few things it can't infer (gate command, branches, card tool), and
writes the config **without clobbering** what's already there.

Prerequisites: a git repo, Node, Claude Code, and the OpenSpec CLI — install the **scoped**
package: `npm i -g @fission-ai/openspec` (or `npx @fission-ai/openspec`). Note the bare
`openspec` npm name is an unrelated, abandoned placeholder — don't install it.

## What `/workflow-init` writes

| File | Action |
| :-- | :-- |
| `openspec/` | `openspec init` (skipped if present) |
| `.github/workflows/verify.yml` | the CI gate, with your gate command |
| `.claude/settings.json` | merges the security deny-list |
| `openspec/config.yaml` | appends the `rules:` block (you fill `context:`) |
| `CLAUDE.md` | appends the workflow section |
| `docs/process/ai-dev-workflow-standard.md` | the full process doc |

## Config surface (the per-project part)

Everything else is copied verbatim. Only these vary by project and are asked/detected at init:

- **Gate command** — e.g. `turbo run lint check-types test`, `nx run-many -t lint typecheck test`,
  or `<pm> run lint && <pm> run typecheck && <pm> run test`.
- **Branches** — integration (default `dev`) and release (default `main`).
- **Card tool** — Jira / Linear / Notion / GitHub Issues / none.

## Caveats

- Assumes a **JS/TS** toolchain for the CI template (Node + the detected package manager —
  pnpm/npm/yarn/bun). For non-JS stacks, supply your own gate command at init and adjust
  `verify.yml`'s setup steps.
- The workflow's *content* (lanes, gate discipline, archive, feedback) is language-agnostic;
  only the gate wiring is stack-specific.

## Developing this plugin

While iterating, refresh the local cache and validate before publishing:

```
claude plugin validate .              # check plugin + marketplace manifests
/plugin marketplace update spec-lane-workflow
/plugin install spec-lane-workflow    # reinstall the refreshed version
```

## Repo layout

```
.claude-plugin/marketplace.json      # marketplace manifest
spec-lane-workflow/
  .claude-plugin/plugin.json         # plugin manifest
  commands/workflow-init.md          # the init command
  skills/lanes/SKILL.md              # lane + gate discipline (model-invoked)
  templates/                         # files /workflow-init copies in
```