---
name: workflow-init
description: Configure or extend the ASMT workflow in a repository for Claude Code, Codex, or both while preserving existing OpenSpec integrations and user-owned configuration. Use only when the user explicitly invokes the initializer.
disable-model-invocation: true
---

# Initialize the ASMT workflow

Configure the current Git repository for the ASMT spec-before-code workflow. Treat the
repository as user-owned: inspect first, preserve unrelated content, preview replacements of
user-authored files, and write only after OpenSpec succeeds.

Interpret invocation arguments as optional explicit inputs. In particular, accept `claude`,
`codex`, or `both` as the target. Claude examples are `/asmt:workflow-init` and
`/asmt:workflow-init both`; Codex examples are `$asmt:workflow-init` and
`$asmt:workflow-init configure both`.

## Invariants

- Keep one shared state machine in this file. Do not move stack detection, input precedence,
  OpenSpec sequencing, merge behavior, or reporting into a host adapter.
- Make no ASMT-owned project write until OpenSpec preflight and any required `openspec init`
  invocation have succeeded and their artifacts have been verified.
- Preserve every existing host integration, including integrations not requested in this run.
- Never run `openspec update` implicitly. Run it only when the user explicitly requests an
  OpenSpec refresh or update.
- Never install or invoke the bare npm package `openspec`. The supported package is
  `@fission-ai/openspec`; its executable is named `openspec`.
- Render deterministically, compare before writing, and leave no `{{PLACEHOLDER}}` behind.
- A repeated run with the same normalized inputs must produce no file diff.

## Resolve bundled templates

Resolve the directory containing this `SKILL.md`, then resolve `../../templates/` from that
directory. This relative path is the primary template location on both hosts and remains valid
inside an installed plugin cache.

Only on Claude Code, if the relative skill path cannot be resolved and
`${CLAUDE_PLUGIN_ROOT}` is available, use `${CLAUDE_PLUGIN_ROOT}/templates/` as the fallback.
Do not construct a Codex-specific absolute path and do not resolve templates from the target
repository's current working directory.

Require these templates before continuing:

- `verify.yml.tmpl`
- `config.rules.yaml`
- `ai-dev-workflow-standard.md`
- `claude-md-section.md`
- `agents-md-section.md`
- `settings.deny.json`
- `codex-permissions.toml`

## Host adapters

This is the complete host-adapter surface. Its cells are mappings only; all decisions and
sequencing are defined in the shared sections below.

| Property | Claude Code | Codex |
| :-- | :-- | :-- |
| Active-host evidence | `${CLAUDE_PLUGIN_ROOT}` is defined or the skill was invoked as `/asmt:workflow-init` | The runtime identifies itself as Codex or the skill was invoked as `$asmt:workflow-init` |
| Target value | `claude` | `codex` |
| Reporting label | `Claude Code` | `Codex` |
| OpenSpec tool ID | `claude` | `codex` |
| Core artifact root | `.claude/skills/` with `.claude/commands/opsx/` as the command-delivery alternative | `.codex/skills/` |
| Integration write approval | Use the active Claude Code project-write policy | `.codex/` is protected by Codex's default workspace sandbox; request scoped approval for the exact OpenSpec init command when required |
| OpenSpec invocations | explore=`/opsx:explore`; propose=`/opsx:propose`; apply=`/opsx:apply`; sync=`/opsx:sync`; archive=`/opsx:archive`; update-change=`/opsx:update` | explore=`$openspec-explore`; propose=`$openspec-propose`; apply=`$openspec-apply-change`; sync=`$openspec-sync-specs`; archive=`$openspec-archive-change`; update-change=`$openspec-update-change` |
| Review command | `/code-review` | `/review` |
| Durable guidance | `CLAUDE.md` from `claude-md-section.md` | `AGENTS.md` from `agents-md-section.md` |
| Security policy | `.claude/settings.json` from `settings.deny.json` | `.codex/config.toml` from `codex-permissions.toml` |

Do not infer the active host from `.claude/` or `.codex/` project files; a repository may contain
both. Prefer explicit runtime evidence. If runtime evidence is ambiguous and no target was
provided, ask which host is running the initializer.

## Normalize inputs

Build one normalized input record before any write:

```text
targets
gate_command
package_manager
integration_branch
release_branch
card_tool
node_source
```

Resolve every field with this precedence:

1. Explicit value supplied with the invocation or in the current conversation.
2. Prior ASMT-generated value recovered from marked guidance, the generated process document,
   or the ASMT-generated verification workflow.
3. Repository detection using the rules below.
4. One concise prompt, or the documented default when a safe default exists.

Normalize target aliases to the ordered set `[claude]`, `[codex]`, or `[claude, codex]`. With no
explicit target, use only the active host. Existing integrations for other hosts are preserved but
do not silently become requested targets.

Always show and confirm the final gate command, even when it came from explicit input or a prior
ASMT run. Do not treat any other inferred field as final when repository evidence conflicts with
it; present the conflict in the same prompt round.

Recover prior ASMT values only from content that is clearly ASMT-owned:

- `<!-- asmt:start -->` through `<!-- asmt:end -->` in `CLAUDE.md` or `AGENTS.md`.
- `docs/process/ai-dev-workflow-standard.md` when its generated notice names ASMT.
- `.github/workflows/verify.yml` when it contains the current
  `Generated by the ASMT workflow initializer` notice or the legacy
  `Generated by the ASMT plugin (/asmt:workflow-init)` notice.

Do not mine arbitrary user prose for old values.

## Inspect the repository

1. Confirm the current directory is inside a Git work tree and resolve its root. Stop if it is not.
2. Parse root `package.json` as JSON when present. Do not use regular expressions to read its
   fields.
3. Resolve the package manager:
   - First parse `package.json#packageManager` and take the name before `@`. Support `pnpm`,
     `npm`, `yarn`, and `bun`.
   - Only when that field is absent, inspect `pnpm-lock.yaml`, `yarn.lock`, `bun.lock`,
     `bun.lockb`, and `package-lock.json`.
   - If more than one lockfile family is present, ask the user to choose. Never pick the first
     lockfile silently.
   - If no supported package manager can be established, ask for it. For a non-JavaScript gate,
     also ask for explicit CI setup instructions instead of inventing them.
4. Parse `turbo.json` and `nx.json` as JSON objects when present. Treat only a valid object as
   detected; report malformed files instead of guessing. If both are valid, ask which orchestrator
   owns the root gate. Record the result for OpenSpec context; do not invent monorepo tasks.
5. Resolve the Node version source in this order: `.nvmrc`, `.node-version`, then the non-empty
   string at `package.json#engines.node`, otherwise the literal default `lts/*`.
6. Parse `package.json#scripts` as an object. A usable gate script is a non-empty string at exactly
   `lint`, `check-types`, `typecheck`, or `test`. Prefer `check-types` over `typecheck` when both
   exist and never fabricate a missing script.
7. Propose the gate by joining only detected scripts in the order lint, typecheck, test with
   `&&`, using `<package-manager> run <script>`. If an existing root script delegates to Turbo or
   Nx, keep that real script invocation. If no usable scripts exist, ask for the full gate command.
8. Detect branch candidates from existing local and remote Git refs. Prefer recovered ASMT values;
   otherwise default the integration branch to `dev` and the release branch to `main`.
9. Detect a card tool only from unambiguous repository configuration or prior ASMT output.
   Otherwise prompt with Jira, Linear, Notion, GitHub Issues, and none; default to none.

Ask once for unresolved/conflicting values, branch confirmation when defaults are being introduced,
and the mandatory gate confirmation. Use the active host's normal user-input mechanism; do not
name or require a host-specific question tool in this shared workflow.

## Prepare OpenSpec

Complete this stage before writing ASMT templates or guidance.

### Resolve one runner

Resolve and retain one command prefix in this order:

1. A global `openspec` executable that successfully runs `--version`.
2. The project executable `node_modules/.bin/openspec` (or its platform equivalent) when it
   successfully runs `--version`.
3. `npx --yes @fission-ai/openspec` when Node and `npx` are available and the scoped package
   successfully runs `--version`.

If none works, stop and offer only supported installation examples, such as
`npm install --global @fission-ai/openspec` or the selected package manager's development-
dependency command for `@fission-ai/openspec`. Never suggest the bare package.

Run `<runner> init --help` and inspect its actual output. Confirm that `--profile`, `--tools`, the
`core` profile, and every requested OpenSpec tool ID from the adapter table are supported. Stop
without ASMT writes if any requested ID or option is absent.

### Determine integration completeness

The core workflow set is `explore`, `propose`, `apply`, `sync`, `archive`, and `update-change`.
The corresponding skill directory names are:

- `openspec-explore`
- `openspec-propose`
- `openspec-apply-change`
- `openspec-sync-specs`
- `openspec-archive-change`
- `openspec-update-change`

The corresponding Claude command filenames are `explore.md`, `propose.md`, `apply.md`, `sync.md`,
`archive.md`, and `update.md` under `.claude/commands/opsx/`.

OpenSpec base content is complete only when `openspec/config.yaml` or `openspec/config.yml` exists
and `openspec/specs/`, `openspec/changes/`, and `openspec/changes/archive/` are directories.

A Claude integration is complete only when base content is complete and every core workflow has
either its `.claude/skills/<skill-name>/SKILL.md` artifact or its corresponding
`.claude/commands/opsx/<command>.md` artifact. A Codex integration is complete only when base
content is complete and all six `.codex/skills/<skill-name>/SKILL.md` artifacts exist. One marker
file is not sufficient.

### Initialize or extend

Before invoking OpenSpec, inventory all OpenSpec-owned paths for both hosts and the base tree.
Record path, type, and content hash so post-run reporting distinguishes created, refreshed,
migrated, and removed files, including untracked files.

Compute `missing_targets` from the requested targets whose integrations are incomplete.

- If `missing_targets` is empty, skip `openspec init`.
- Otherwise, for both a fresh install and extension, run exactly:

  ```text
  <runner> init --profile core --tools <comma-separated-missing-targets>
  ```

If the active host protects a mapped integration root, request its native, narrowly scoped write
approval for that exact command. Never bypass the host sandbox. Treat declined or unavailable
approval as an OpenSpec failure and stop before ASMT-owned writes.

Do not pass `--force`. Preserve complete requested and non-requested integrations. Never delete a
host directory before initialization.

After execution, require a zero exit status, complete OpenSpec base content, complete artifacts for
every requested target, and continued completeness for every host integration that was complete
before the run. If OpenSpec fails, leaves a requested integration incomplete, or removes an
existing integration without a complete migrated replacement, report the OpenSpec delta and stop
before all ASMT-owned writes.

Compare the before/after inventory and report every OpenSpec-created, refreshed, migrated, or
removed file. Treat a CLI-reported migration as a migration only when the inventory supports it.
Do not attribute unrelated pre-existing work-tree changes to OpenSpec.

## Render common files once

Render all outputs in memory, replace known placeholders, and compare bytes before writing.

### Verification workflow

Render `.github/workflows/verify.yml` from `verify.yml.tmpl` with the confirmed gate, branch names,
and a package-manager setup block. Generate setup steps only for the selected supported package
manager:

- pnpm: `pnpm/action-setup@v4`, `actions/setup-node@v4` with `cache: pnpm`, then
  `pnpm install --frozen-lockfile`.
- npm: `actions/setup-node@v4` with `cache: npm`, then `npm ci`.
- yarn: `actions/setup-node@v4` with `cache: yarn`, then `yarn install --immutable`.
- bun: `oven-sh/setup-bun@v2`, then `bun install --frozen-lockfile`.

For `actions/setup-node`, use `node-version-file` with `.nvmrc` or `.node-version`; use
`node-version` with `package.json#engines.node`; otherwise use `node-version: 'lts/*'`.

Replace an existing workflow automatically only when it carries the current ASMT generated notice
or the legacy `Generated by the ASMT plugin (/asmt:workflow-init)` notice. If it is user-authored,
show the proposed diff and ask before replacing it. If replacement is declined, leave it unchanged
and report that the ASMT CI gate is not installed.

### OpenSpec configuration

Use the existing `openspec/config.yaml`, or `openspec/config.yml` only when that is the existing
OpenSpec config. Never create both. Parse YAML structurally when a parser is available.

- If no real top-level `rules` mapping exists, merge the mapping from `config.rules.yaml`.
- If `rules` exists, preserve it exactly and report that ASMT rules were skipped.
- Draft `context` only when it is missing, empty, `TODO`, or clearly an ASMT-generated starter.
  Include project name and description, detected stack, package manager, monorepo tool, Node
  source, and confirmed gate. Leave explicit TODOs only for domain and guardrails that cannot be
  inferred.
- Never overwrite user-authored context or rules.

### Process standard

Render `docs/process/ai-dev-workflow-standard.md` from the shared template with the gate, branches,
and card tool. The document must stay platform-neutral and retain its stable Claude/Codex invocation
map. Replace the prior ASMT-generated document deterministically; preview before replacing a file
at that path that does not identify itself as ASMT-generated.

## Render requested host guidance

Render a host's guidance when it is requested in this run or when its guidance file already has an
ASMT marker block. In both `CLAUDE.md` and `AGENTS.md`, use the exact markers
`<!-- asmt:start -->` and `<!-- asmt:end -->`.

- Replace exactly one existing marked block in place.
- Append one marked block when neither marker exists.
- Stop and ask before editing when markers are unmatched or duplicated.
- Preserve every byte outside the marked block where practical, including the user's final newline
  convention.

### Claude security adapter

When Claude is requested or `.claude/settings.json` already contains the ASMT deny entries, parse
both the project file and `settings.deny.json` as JSON. Deep-merge only the template's
`permissions.deny` entries, deduplicate exact strings, retain the user's entries and every unrelated
key, and keep stable ordering. Never replace the settings object wholesale.

### Codex security adapter

When Codex is requested, prepare the `asmt-workspace` profile from `codex-permissions.toml` in
`.codex/config.toml`:

1. Require Codex `0.138.0` or newer before installing or activating the profile. If the CLI is
   absent or older, leave `.codex/config.toml` unchanged and report the profile as skipped.
2. Parse existing TOML before editing. If the `asmt-workspace` tables have different user-owned
   values, do not overwrite them; report the collision and skip activation.
3. Inspect all known loaded project config layers and current runtime evidence for `sandbox_mode`,
   `[sandbox_workspace_write]`, or a `--sandbox` override. Permission profiles do not compose with
   those legacy settings. If any are active or cannot be ruled out, leave `.codex/config.toml`
   unchanged and report the exact conflict.
4. Never overwrite or rewrite an existing top-level `default_permissions`, even when it selects a
   different profile. If it selects another profile, leave the config unchanged and report that
   activation was skipped. If it already equals `asmt-workspace`, merge only a missing matching
   profile definition and proceed to validation.
5. When no `default_permissions` exists, no legacy override applies, and the profile has no
   collision, explicitly ask whether to activate `asmt-workspace`. If confirmation is declined,
   leave `.codex/config.toml` unchanged. If confirmed, atomically merge the template's top-level
   `default_permissions = "asmt-workspace"` and profile tables without changing unrelated content.
   Codex requires the custom profile and its selecting default to be present together; never leave
   an unselected ASMT profile definition in project config.
6. Validate the resulting file with the strict Codex config loader in the repository, using
   `codex --strict-config -C <repo-root> doctor --json` when `doctor` is available. Inspect the
   `config.load` check rather than the command's unrelated network or authentication checks.
7. If strict validation fails, restore the exact pre-edit `.codex/config.toml` bytes, including
   removing a newly created file, and report the parse/load error.
8. Report the profile as `installed and configured as default` only after strict parsing succeeds,
   and `enforced` only after a fresh trusted Codex session loads the project config and
   `/permissions` shows `asmt-workspace` selected. Otherwise say `activation unverified`; never
   describe an unvalidated template as installed or enforced policy.

Treat the profile merge and activation as one transaction. A declined, blocked, or failed
activation creates no Codex policy diff.

## Final verification and report

1. Confirm all requested host integrations remain complete and no previously complete integration
   became incomplete.
2. Confirm every requested guidance file has exactly one ASMT marker pair.
3. Confirm the verification workflow contains the confirmed gate and no unresolved placeholder.
4. Confirm common outputs are identical regardless of which host ran the initializer.
5. Re-render every ASMT-owned output from the normalized inputs and verify that applying it again
   would write zero bytes. If not, fix the nondeterminism before reporting success.
6. Report normalized inputs; OpenSpec runner and all OpenSpec file changes; ASMT files created,
   merged, replaced, skipped, or unchanged; branch existence; CI installation status; and each
   host's guidance and security status using the adapter labels.
7. If the integration branch is absent, offer to create it and note that CI branch filters do not
   become effective until the branch exists. Do not create it without confirmation.
8. End with the next workflow action for the selected host: review the drafted OpenSpec context,
   fill its TODO domain/guardrails, choose a lane, and invoke that host's OpenSpec propose mapping.
