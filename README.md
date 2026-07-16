# ASMT-CC-plugin

[![repo](https://img.shields.io/badge/github-effectz--ai%2Fasmt--cc--plugin-blue)](https://github.com/effectz-ai/asmt-cc-plugin)

The **ASMT** Claude Code plugin: installs a spec-before-code, lane-sized AI development workflow
into any project. It's a thin opinionated layer over two things you already install —
[OpenSpec](https://github.com/Fission-AI/OpenSpec) and Claude Code — not a framework.

Commands and skills are namespaced under `asmt:` (e.g. `/asmt:workflow-init`).

## What you get

- **Three lanes** (Fast / Standard / Deep) so a doc fix doesn't pay the same ceremony as a
  new subsystem. Enforced by the bundled `asmt:lanes` skill.
- **A hard verification gate** in two places: locally before a PR, and in CI (`verify.yml`).
  No PR merges red.
- **Archive-on-merge living specs** and a **feedback loop** (recurring review findings become
  `openspec/config.yaml` rules or skills).
- **Security defaults**: a `.claude/settings.json` deny-list blocking `.env*`, `*.pem`, `*.key`,
  `secrets/`, etc. at the tool level.

## Install

```
/plugin marketplace add effectz-ai/asmt-cc-plugin
/plugin install asmt@asmt-cc-plugin
/asmt:workflow-init
```

`/asmt:workflow-init` detects your stack (package manager, monorepo tool, lint/typecheck/test
scripts), asks for the few things it can't infer (gate command, branches, card tool), and
writes the config **without clobbering** what's already there. It's safe to re-run.

Prerequisites: a git repo, Node, Claude Code, and the OpenSpec CLI — install the **scoped**
package: `npm i -g @fission-ai/openspec` (or `npx @fission-ai/openspec`). Note the bare
`openspec` npm name is an unrelated, abandoned placeholder — don't install it.

## What `/asmt:workflow-init` writes

| File | Action |
| :-- | :-- |
| `openspec/` | `openspec init --tools claude` (skipped if present) |
| `.github/workflows/verify.yml` | the CI gate, with your gate command + package manager |
| `.claude/settings.json` | merges the security deny-list |
| `openspec/config.yaml` | appends the `rules:` block; drafts a starter `context:` |
| `CLAUDE.md` | inserts the workflow section between `<!-- asmt:start/end -->` markers |
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

```
git clone https://github.com/effectz-ai/asmt-cc-plugin.git
cd asmt-cc-plugin
```

Point Claude Code at your local checkout instead of the remote, then iterate:

```
/plugin marketplace add <path-to>/asmt-cc-plugin   # local checkout
/plugin install asmt@asmt-cc-plugin
```

After editing plugin files, validate and refresh the cache:

```
claude plugin validate .              # check plugin + marketplace manifests
/plugin marketplace update asmt-cc-plugin
/plugin install asmt@asmt-cc-plugin   # reinstall the refreshed version
/reload-plugins
```

### Versioning: intentionally unversioned

`plugin.json` deliberately has **no `version` field**, and it should stay that way. For a
git-hosted plugin, omitting it makes Claude Code treat **every commit as a new version**, so
`/plugin marketplace update` picks up changes with no manual bump.

Adding a `version` *pins* the plugin: pushing new commits without changing that string does
nothing for existing users — Claude Code sees the same version and keeps the cached copy. Never
set `version` in both `plugin.json` and the marketplace entry either; `plugin.json` silently wins.

`claude plugin validate` emits a "No version specified" **warning** for this. That warning is
expected and safe to ignore.

## Repo layout

```
.claude-plugin/marketplace.json      # marketplace manifest (name: asmt-cc-plugin)
asmt/                                # the plugin (name: asmt -> /asmt:* commands)
  .claude-plugin/plugin.json         # plugin manifest
  commands/workflow-init.md          # -> /asmt:workflow-init
  skills/lanes/SKILL.md              # -> asmt:lanes (model-invoked)
  templates/                         # files /asmt:workflow-init copies in
```