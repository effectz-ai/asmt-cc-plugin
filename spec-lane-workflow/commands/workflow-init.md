---
name: "workflow-init"
description: Configure the spec-lane AI-dev workflow into the current project (OpenSpec + gate + settings + docs), parameterized to its stack.
---

Scaffold the spec-lane workflow into **this** project. Portable pieces are copied verbatim;
stack-specific pieces are filled from detection + a short prompt. **Never clobber** existing
config — merge into it.

Templates live at `${CLAUDE_PLUGIN_ROOT}/templates/`.

## Steps

1. **Preconditions.** Confirm this is a git repo. Confirm the OpenSpec CLI is reachable
   (`npx openspec --version`); if not, tell the user to `npm i -g openspec` (or use `npx`)
   and stop. Do not proceed without it.

2. **Initialize OpenSpec** (skip if `openspec/` already exists): run `openspec init` with the
   Claude Code profile so `/opsx:*` commands and the `openspec/` tree are installed.

3. **Detect the stack** (read, don't ask what you can infer):
   - Package manager: presence of `pnpm-lock.yaml` / `yarn.lock` / `package-lock.json` / `bun.lockb`.
   - Monorepo tool: `turbo.json` → turbo, `nx.json` → nx, else none.
   - Gate scripts: read root `package.json` `scripts` for lint / typecheck (`check-types`/`typecheck`) / test.
     Propose a **gate command** from them, e.g. `turbo run lint check-types test`,
     `nx run-many -t lint typecheck test`, or `<pm> run lint && <pm> run typecheck && <pm> run test`.

4. **Ask only what you couldn't infer** (AskUserQuestion, one round):
   - Confirm/edit the **gate command** (pre-fill the detected one).
   - Default branches (pre-fill `dev` for integration, `main` for release).
   - Card tool (Jira / Linear / Notion / GitHub Issues / none).

5. **Write files** (substitute `{{GATE_CMD}}`, `{{INTEGRATION_BRANCH}}`, `{{RELEASE_BRANCH}}`, `{{CARD_TOOL}}`):
   - `.github/workflows/verify.yml` ← `templates/verify.yml.tmpl`. If a verify workflow already
     exists, show a diff and ask before overwriting.
   - `.claude/settings.json` — **merge** the deny list from `templates/settings.deny.json` into
     `permissions.deny` (dedupe; keep the user's existing entries).
   - `openspec/config.yaml` — **append** the `rules:` block from `templates/config.rules.yaml` if
     absent, and leave the project `context:` for the user to fill (insert a `# TODO` placeholder if empty).
   - `CLAUDE.md` — append the workflow section from `templates/claude-md-section.md` if not already present.
   - `docs/process/ai-dev-workflow-standard.md` ← copy `templates/ai-dev-workflow-standard.md`,
     replacing the gate/branch/card-tool placeholders.

6. **Summary.** Print what was created/merged/skipped, the chosen gate command, and next steps:
   fill `openspec/config.yaml` `context:` with the project's guardrails, then run a first
   `/opsx:propose` on a real card.

## Guardrails
- Merge, never overwrite, `settings.json`, `config.yaml`, and `CLAUDE.md`.
- Do not invent lint/typecheck/test scripts — if a stack has none, ask the user for the gate command outright.
- The lane discipline itself is enforced by the bundled `lanes` skill; this command only sets up the files.