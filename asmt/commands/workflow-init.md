---
name: "workflow-init"
description: Configure the ASMT AI-dev workflow into the current project (OpenSpec + gate + settings + docs), parameterized to its stack.
---

Scaffold the ASMT workflow into **this** project. Portable pieces are copied verbatim;
stack-specific pieces are filled from detection + a short prompt. **Never clobber** existing
config — merge into it.

Templates live at `${CLAUDE_PLUGIN_ROOT}/templates/`.

## Steps

1. **Preconditions.** Confirm this is a git repo. Confirm the OpenSpec CLI is reachable —
   try `openspec --version` (global or local dep) and, failing that, `npx @fission-ai/openspec --version`.
   If neither works, tell the user to install it and stop:
   - global: `npm i -g @fission-ai/openspec`
   - per-project: `pnpm add -D @fission-ai/openspec` (or the project's package manager)

   **IMPORTANT:** the package is the scoped **`@fission-ai/openspec`**. The bare `openspec` npm
   name is an unrelated, abandoned 2022 placeholder with no executable — never install it, and
   never run `npm i -g openspec`. (The CLI's own binary is still called `openspec` once installed.)

2. **Initialize OpenSpec** (skip if `openspec/` already exists): run `openspec init --tools claude`
   — pass the tool profile explicitly so it runs non-interactively (a bare `openspec init` may
   prompt, and this shell can't answer). This installs the `/opsx:*` commands + the `openspec/` tree.

3. **Detect the stack** (read, don't ask what you can infer):
   - Package manager: `pnpm-lock.yaml`→pnpm · `yarn.lock`→yarn · `bun.lockb`→bun · `package-lock.json`→npm.
   - Monorepo tool: `turbo.json` → turbo, `nx.json` → nx, else none.
   - Node version source: `.nvmrc` or `.node-version` if present, else `package.json` `engines.node`.
   - Gate scripts: read root `package.json` `scripts` for lint / typecheck (`check-types`/`typecheck`) / test.
     Propose a **gate command** from them, e.g. `turbo run lint check-types test`,
     `nx run-many -t lint typecheck test`, or `<pm> run lint && <pm> run typecheck && <pm> run test`.

4. **Ask only what you couldn't infer** (AskUserQuestion, one round):
   - Confirm/edit the **gate command** (pre-fill the detected one).
   - Default branches (pre-fill `dev` for integration, `main` for release).
   - Card tool (Jira / Linear / Notion / GitHub Issues / none).

5. **Write files.** Substitute `{{GATE_CMD}}`, `{{INTEGRATION_BRANCH}}`, `{{RELEASE_BRANCH}}`, `{{CARD_TOOL}}`
   everywhere, plus the package-manager block below. Every merge is **idempotent** — re-running must
   not duplicate anything.

   - `.github/workflows/verify.yml` ← `templates/verify.yml.tmpl`. Fill `{{PM_SETUP_STEPS}}` from the
     detected package manager (this is the part that must NOT be hardcoded to pnpm):

     | PM | `{{PM_SETUP_STEPS}}` (indented 6 spaces, under `steps:`) |
     | :-- | :-- |
     | **pnpm** | `- uses: pnpm/action-setup@v4` then setup-node with `cache: pnpm`, then `- run: pnpm install --frozen-lockfile` |
     | **npm** | setup-node with `cache: npm`, then `- run: npm ci` |
     | **yarn** | setup-node with `cache: yarn`, then `- run: yarn install --immutable` |
     | **bun** | `- uses: oven-sh/setup-bun@v2`, then `- run: bun install --frozen-lockfile` |

     For the `actions/setup-node@v4` step, use `node-version-file: .nvmrc` (or `.node-version`) if one
     exists; otherwise `node-version:` the `engines.node` value, else `'lts/*'`. If a verify workflow
     already exists, show a diff and ask before overwriting.

   - `.claude/settings.json` — **merge** the deny list from `templates/settings.deny.json` into
     `permissions.deny` (dedupe against existing entries; keep the user's). Report "already present" if all exist.
   - `openspec/config.yaml` — if no `rules:` key exists, **append** the block from
     `templates/config.rules.yaml`; if `rules:` already exists, leave it and report. For `context:`,
     if it's empty/missing/`TODO`, **draft a starter** from what you detected — project name +
     `package.json` `description`, the stack (language, package manager, monorepo tool, framework if
     obvious), and the gate command — leaving explicit `TODO` markers only for domain + guardrails you
     can't infer. Don't overwrite a `context:` the user has already written.
   - `CLAUDE.md` — the section in `templates/claude-md-section.md` is wrapped in
     `<!-- asmt:start -->` … `<!-- asmt:end -->` markers. If those markers
     already exist, **replace between them**; otherwise append the section. Never append a second copy.
   - `docs/process/ai-dev-workflow-standard.md` ← copy `templates/ai-dev-workflow-standard.md`,
     replacing the gate/branch/card-tool placeholders.

6. **Summary.** Print what was created/merged/skipped, the chosen gate command + package manager, and:
   - **Branch check:** report whether the integration/release branches exist. If the integration
     branch is missing, offer to create it (`git branch <integration>`), and note CI won't trigger
     until the branches exist.
   - **Next steps:** review the drafted `openspec/config.yaml` `context:` and fill its `TODO`
     guardrails, then run a first `/opsx:propose` on a real card.

## Guardrails
- Merge, never overwrite, `settings.json`, `config.yaml`, and `CLAUDE.md`; re-runs must be idempotent.
- Never hardcode pnpm in `verify.yml` — always emit the detected package manager's setup + install.
- Do not invent lint/typecheck/test scripts — if a stack has none, ask the user for the gate command outright.
- Leave no `{{...}}` placeholder in any written file.
- The lane discipline itself is enforced by the bundled `lanes` skill; this command only sets up the files.