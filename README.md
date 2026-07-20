# ASMT plugin for Claude Code and Codex

[![repo](https://img.shields.io/badge/github-effectz--ai%2Fasmt--cc--plugin-blue)](https://github.com/effectz-ai/asmt-cc-plugin)

The **ASMT** plugin packages one spec-before-code, lane-sized AI development workflow for
Claude Code and Codex. It is a thin opinionated layer over
[OpenSpec](https://github.com/Fission-AI/OpenSpec) and the active coding agent, not a framework.

ASMT components keep the plugin namespace: `/asmt:*` in Claude Code and `$asmt:*` in Codex.
Both hosts load the same workflow skills and templates.

## What you get

- **Three lanes** (Fast / Standard / Deep) so a documentation fix does not pay the same ceremony
  as a new subsystem. The shared `asmt:lanes` skill applies the discipline on both hosts.
- **One initializer** exposed as `/asmt:workflow-init` in Claude Code and
  `$asmt:workflow-init` in Codex.
- **Additive OpenSpec setup** for Claude, Codex, or both without removing an existing host
  integration.
- **A hard verification gate** locally before a PR and in `.github/workflows/verify.yml`.
- **Archive-on-merge living specs** and a feedback loop that turns recurring review findings into
  OpenSpec rules or durable agent guidance.
- **Host-native security adapters**: a deep-merged Claude deny list and an optional Codex
  `asmt-workspace` permission profile.

## Install

### Claude Code

```text
/plugin marketplace add effectz-ai/asmt-cc-plugin
/plugin install asmt@asmt-cc-plugin
/asmt:workflow-init
```

### Codex

```bash
codex plugin marketplace add effectz-ai/asmt-cc-plugin
codex plugin add asmt@asmt-cc-plugin
```

Start a new Codex task after installation, then invoke:

```text
$asmt:workflow-init
```

The initializer is explicit-only on both hosts because it writes repository files. Lane selection
remains eligible for implicit invocation.

## Choose the target

With no target argument, the initializer configures the active host and preserves any other
OpenSpec integration already present. Configure both hosts explicitly with:

| Intent | Claude Code | Codex |
| :-- | :-- | :-- |
| Active host | `/asmt:workflow-init` | `$asmt:workflow-init` |
| Both hosts | `/asmt:workflow-init both` | `$asmt:workflow-init configure both` |

The initializer detects the package manager, Turbo/Nx, Node version source, and real
lint/typecheck/test scripts. It recovers prior ASMT values on reruns and asks only for unresolved
or conflicting inputs. The final gate command is always confirmed and is never fabricated from a
missing package script.

## OpenSpec behavior

Workflow prerequisites are a Git repository, Node.js, and a reachable OpenSpec CLI. ASMT resolves
the global executable, the project's `node_modules/.bin/openspec`, then the scoped
`npx --yes @fission-ai/openspec` runner.

Install only the supported scoped package:

```bash
npm install --global @fission-ai/openspec
```

The bare `openspec` npm package is unrelated and must not be installed.

Before writing ASMT-owned files, the initializer checks `openspec init --help`, verifies the
requested `claude` and/or `codex` tool IDs, and checks the complete core artifact set. Missing hosts
are added with:

```text
openspec init --profile core --tools <comma-separated-missing-targets>
```

Existing host integrations are preserved and reverified after the command. ASMT reports every
OpenSpec-created, refreshed, migrated, or removed file. It never runs `openspec update` unless the
user explicitly requests an OpenSpec refresh.

## Files written in a project

Common outputs are rendered once and stay platform-neutral:

| File | Action |
| :-- | :-- |
| `openspec/` | Created or extended by OpenSpec for the missing requested hosts |
| `.github/workflows/verify.yml` | Installs the confirmed CI gate and detected package-manager setup |
| `openspec/config.yaml` or existing `config.yml` | Preserves user context/rules and fills only missing ASMT content |
| `docs/process/ai-dev-workflow-standard.md` | Documents one workflow with a stable Claude/Codex invocation map |

Host-specific outputs are thin adapters:

| Host | Guidance | Security |
| :-- | :-- | :-- |
| Claude Code | `CLAUDE.md` ASMT marker block | Deep-merges deny entries into `.claude/settings.json` |
| Codex | `AGENTS.md` ASMT marker block | Adds the optional `asmt-workspace` profile to `.codex/config.toml` |

Both guidance files use `<!-- asmt:start -->` and `<!-- asmt:end -->`. Reruns replace only the
marked block and preserve surrounding user content.

## Codex permission profile

The `asmt-workspace` profile extends Codex's `:workspace` profile and denies environment files,
private keys, certificates, `secrets/`, and `*.local` files. The initializer never overwrites an
existing `default_permissions` value and asks before activating the profile.

Activation is skipped when Codex is older than `0.138.0` or legacy `sandbox_mode` /
`sandbox_workspace_write` settings would take precedence. Because Codex requires a custom profile
and its selecting default together, a declined or blocked activation leaves `.codex/config.toml`
unchanged. The profile is reported as installed only after strict config validation; enforcement is
reported only after a fresh trusted Codex session loads the project config and `/permissions` shows
`asmt-workspace` selected. Permission profiles are a beta Codex feature; review the current
[Codex permissions documentation](https://learn.chatgpt.com/docs/permissions).

## Project inputs

Only these values vary by project:

- **Target** - Claude Code, Codex, or both.
- **Gate command** - built only from real repository scripts or supplied explicitly.
- **Package manager** - `package.json#packageManager` wins over lockfiles; conflicting lockfiles
  require a choice.
- **Branches** - integration defaults to `dev`; release defaults to `main`.
- **Card tool** - Jira, Linear, Notion, GitHub Issues, or none.
- **Node source** - `.nvmrc`, `.node-version`, `package.json#engines.node`, or `lts/*`.

The initializer applies explicit input first, then prior ASMT-generated values, repository
detection, and finally a prompt/default. A repeated run with identical answers must create no diff.

## Caveats

- Automatic CI setup supports JavaScript/TypeScript projects using pnpm, npm, yarn, or bun. A
  non-JavaScript project must supply its gate and CI setup explicitly.
- The workflow content is language-agnostic; only the verification wiring is stack-specific.
- Project `.codex/config.toml` is loaded only for trusted repositories.
- Codex's default workspace sandbox protects `.codex/` recursively. During Codex initialization,
  OpenSpec may therefore request approval before it can create `.codex/skills/`; declining that
  approval stops the initializer before ASMT-owned writes.
- Plugin removal does not remove files the initializer previously wrote into a project.

## Tested compatibility

The `0.1.0` release candidate uses this qualification baseline:

| Component | Tested version | Qualification |
| :-- | :-- | :-- |
| Claude Code | Claude Code 2.1.215 | Manifest validation, local marketplace installation, and both shared skills in the installed inventory pass. Authenticated invocation remains a required release gate. |
| Codex | Codex CLI 0.145.0-alpha.18 | Local marketplace installation, one-entry deduplication, `skills/list`, explicit initializer/lanes invocation, and permission-profile enforcement pass. |
| OpenSpec | OpenSpec 1.6.0 | The pinned scoped package advertises the `core` profile plus the `claude` and `codex` tool IDs. |
| Node.js | Node.js 20.19.0 | Minimum release-test and OpenSpec baseline; CI runs the contract matrix on this version. |

Codex marketplace plugins are supported in the ChatGPT desktop app and Codex CLI. Plugin
installation is **not available in the Codex IDE extension**; use the desktop app or CLI and start
a new task/session after installing. See the official
[Codex plugins documentation](https://learn.chatgpt.com/docs/plugins).

Permission profiles require Codex `0.138.0` or newer and remain beta. The profile is optional,
must be explicitly activated, and cannot compose with legacy `sandbox_mode` or
`sandbox_workspace_write` settings.

## Developing this plugin

```bash
git clone https://github.com/effectz-ai/asmt-cc-plugin.git
cd asmt-cc-plugin
```

Point each host at the local checkout:

```text
/plugin marketplace add <path-to>/asmt-cc-plugin
/plugin install asmt@asmt-cc-plugin
```

```bash
codex plugin marketplace add <path-to>/asmt-cc-plugin
codex plugin add asmt@asmt-cc-plugin
```

Install the pinned test parsers and run the packaging plus 20-scenario initialization matrix:

```bash
npm ci
npm test
```

The matrix creates temporary Git repositories for fresh, rerun, merge, decline, malformed-input,
OpenSpec-failure, and both cross-platform ordering cases. Every successful case commits its first
result, reruns with identical answers, and requires a clean Git work tree.

Run the external capability and installed-host checks before a release:

```bash
node scripts/verify-openspec-capabilities.mjs
npx --yes @anthropic-ai/claude-code@2.1.215 plugin validate .
npm run test:live -- --codex --claude --permissions
```

Authenticated release owners must also run explicit fresh-session invocations. The Codex
initializer needs the opt-in fixture flag because its noninteractive test must write the normally
protected `.codex/` directory inside a disposable repository:

```bash
npm run test:live -- --invoke-codex --allow-unsandboxed-fixture
npm run test:live -- --invoke-claude
```

Do not merge or tag while either authenticated invocation is unavailable or failing. The complete
acceptance record is in `docs/release-qualification.md`.

The shared initializer intentionally carries Claude's `disable-model-invocation: true` and
Codex's `policy.allow_implicit_invocation: false`. If a Codex-only helper rejects the Claude
frontmatter field, do not remove it. Validate the installed package through Codex `skills/list`;
both `asmt:workflow-init` and `asmt:lanes` must be enabled with no load errors.

For Claude Code, validate and refresh the cache:

```text
claude plugin validate .
/plugin marketplace update asmt-cc-plugin
/plugin install asmt@asmt-cc-plugin
/reload-plugins
```

For Codex, use the built-in `$plugin-creator` update flow to apply a temporary build-metadata
cachebuster, reinstall `asmt@asmt-cc-plugin`, and start a new task. Restore the release version
before committing.

### Platform versioning

`asmt/.claude-plugin/plugin.json` deliberately has **no `version` field**. For a Git-hosted Claude
plugin, omitting it makes every commit a new version, so marketplace refreshes pick up changes.
The expected `claude plugin validate` warning about the missing version can be ignored.

`asmt/.codex-plugin/plugin.json` follows strict semantic versioning, beginning at `0.1.0`.
Release changes bump that version. Local Codex cachebusters use build metadata and are never
committed.

## Repository layout

```text
.claude-plugin/marketplace.json          # Existing Claude marketplace
.agents/plugins/marketplace.json         # Codex marketplace with the same identity
asmt/
  .claude-plugin/plugin.json             # Intentionally unversioned Claude manifest
  .codex-plugin/plugin.json              # Semver Codex manifest
  skills/workflow-init/SKILL.md          # One shared initializer implementation
  skills/workflow-init/agents/openai.yaml
  skills/lanes/SKILL.md                  # Shared lane discipline
  skills/lanes/agents/openai.yaml
  templates/                             # Shared output and thin host adapter templates
scripts/validate-packaging.mjs           # Cross-platform packaging/workflow contract
scripts/verify-live-hosts.mjs            # Installed-host and permission-profile smoke tests
tests/initializer-matrix.test.mjs        # Temporary-repository compatibility matrix
```
