# ASMT plugin for Claude Code and Codex

[![repo](https://img.shields.io/badge/github-effectz--ai%2Fasmt--cc--plugin-blue)](https://github.com/effectz-ai/asmt-cc-plugin)

The **ASMT** plugin packages a spec-before-code, lane-sized AI development workflow for
Claude Code and Codex. It is a thin opinionated layer over
[OpenSpec](https://github.com/Fission-AI/OpenSpec) and your coding agent, not a framework.

ASMT components are namespaced by the plugin: `/asmt:*` in Claude Code and `$asmt:*` in Codex.

## What you get

- **Three lanes** (Fast / Standard / Deep) so a doc fix doesn't pay the same ceremony as a
  new subsystem. Enforced by the bundled `asmt:lanes` skill.
- **A hard verification gate** in two places: locally before a PR, and in CI (`verify.yml`).
  No PR merges red.
- **Archive-on-merge living specs** and a **feedback loop** (recurring review findings become
  `openspec/config.yaml` rules or skills).
- **Claude security defaults**: a `.claude/settings.json` deny-list blocking `.env*`, `*.pem`,
  `*.key`, `secrets/`, etc. at the tool level. Codex security policy support arrives with the
  shared initializer migration.

## Install

### Claude Code

```
/plugin marketplace add effectz-ai/asmt-cc-plugin
/plugin install asmt@asmt-cc-plugin
/asmt:workflow-init
```

### Codex

```bash
codex plugin marketplace add effectz-ai/asmt-cc-plugin
codex plugin add asmt@asmt-cc-plugin
```

Start a new Codex task after installation, then invoke `$asmt:lanes`. The project initializer
remains Claude-only until it is migrated to a shared skill.

`/asmt:workflow-init` detects your stack (package manager, monorepo tool, lint/typecheck/test
scripts), asks for the few things it can't infer (gate command, branches, card tool), and
writes the config **without clobbering** what's already there. It's safe to re-run.

Workflow prerequisites: a Git repository, Node, and the OpenSpec CLI. Install the **scoped**
package with `npm i -g @fission-ai/openspec` or run it through
`npx @fission-ai/openspec`. The bare `openspec` npm name is unrelated; do not install it.

## What the Claude initializer writes

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

Point Claude Code at your local checkout instead of the remote:

```
/plugin marketplace add <path-to>/asmt-cc-plugin   # local checkout
/plugin install asmt@asmt-cc-plugin
```

Add the same checkout as a local Codex marketplace:

```bash
codex plugin marketplace add <path-to>/asmt-cc-plugin
codex plugin add asmt@asmt-cc-plugin
```

Run the shared packaging contract before platform-specific validation:

```bash
node scripts/validate-packaging.mjs
```

For Claude Code, validate and refresh the cache:

```
claude plugin validate .              # check plugin + marketplace manifests
/plugin marketplace update asmt-cc-plugin
/plugin install asmt@asmt-cc-plugin   # reinstall the refreshed version
/reload-plugins
```

For Codex, use the built-in `$plugin-creator` update flow to apply a temporary build-metadata
cachebuster, reinstall `asmt@asmt-cc-plugin`, and start a new task. Restore the release version
before committing.

### Platform versioning

`asmt/.claude-plugin/plugin.json` deliberately has **no `version` field**, and it should stay
that way. For a git-hosted Claude plugin, omitting it makes every commit a new version, so
`/plugin marketplace update` picks up changes without a manual bump.

Adding a `version` *pins* the plugin: pushing new commits without changing that string does
nothing for existing users — Claude Code sees the same version and keeps the cached copy. Never
set `version` in both `plugin.json` and the marketplace entry either; `plugin.json` silently wins.

`claude plugin validate` emits a "No version specified" **warning** for this. That warning is
expected and safe to ignore.

`asmt/.codex-plugin/plugin.json` follows strict semantic versioning, beginning at `0.1.0`.
Release changes bump that version. Local Codex cachebusters use build metadata and are never
committed.

## Repo layout

```
.claude-plugin/marketplace.json      # marketplace manifest (name: asmt-cc-plugin)
.agents/plugins/marketplace.json     # native Codex marketplace with the same identity
asmt/                                # shared plugin root (name: asmt)
  .claude-plugin/plugin.json         # unversioned Claude manifest
  .codex-plugin/plugin.json          # semver Codex manifest
  commands/workflow-init.md          # -> /asmt:workflow-init
  skills/lanes/SKILL.md              # -> /asmt:lanes and $asmt:lanes
  templates/                         # files /asmt:workflow-init copies in
scripts/validate-packaging.mjs       # cross-platform packaging contract
```
