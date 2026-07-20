# ASMT release qualification

This is the merge and tag gate for the dual-platform ASMT plugin. A release is ready only when
every required row passes against the release commit. A skipped, unavailable, or unauthenticated
check is not a pass.

## Automated contract

Run `npm ci && npm test`. The suite must pass all packaging assertions and all 20 temporary-
repository scenarios:

| Area | Scenarios |
| :-- | :-- |
| Claude regression | Fresh initialization, explicit rerun, existing `CLAUDE.md`, settings deep merge, complete existing OpenSpec, custom `config.yml`, approved verification replacement, declined verification replacement |
| Codex and cross-platform | Codex-only, both hosts, Claude then Codex, Codex then Claude, incomplete OpenSpec integrations |
| Detection and failure | Conflicting lockfiles, missing scripts, malformed ASMT markers, OpenSpec failure |
| Codex policy decisions | Legacy sandbox settings, existing `default_permissions`, declined profile activation |

Every successful scenario asserts the common and requested host files, preserves fixture-owned
content, checks the stable invocation map, rejects secrets-policy overclaiming, commits the first
run, and requires the identical second run to leave zero Git diff. Cross-platform order scenarios
also require the shared process, verification workflow, and OpenSpec config hashes to remain
unchanged when the second host is added.

## Packaging and capabilities

Run:

```bash
node scripts/verify-openspec-capabilities.mjs
npx --yes @anthropic-ai/claude-code@2.1.215 plugin validate .
```

Required results:

- Every JSON, YAML, rendered YAML template, TOML file, and skill frontmatter parses.
- Claude and Codex marketplace sources resolve to the same `asmt/` plugin root.
- Claude's manifest has no version; Codex has strict release semver and no local cachebuster.
- Exactly one initializer implementation exists and rendered outputs have no placeholders.
- `@fission-ai/openspec@1.6.0` exposes `--profile`, `--tools`, `core`, `claude`, and `codex`.

## Installed hosts

Install the release candidate in both hosts, start fresh sessions, then run:

```bash
npm run test:live -- --codex --claude --permissions
npm run test:live -- --invoke-codex --allow-unsandboxed-fixture
npm run test:live -- --invoke-claude
```

The Codex installation check requires exactly one `asmt-cc-plugin` marketplace, exactly one
installed/enabled `asmt` entry, enabled `asmt:workflow-init` and `asmt:lanes` skills, and no
`skills/list` errors. The Claude check requires the installed `asmt@asmt-cc-plugin` inventory to
contain `workflow-init` and `lanes`.

The generic Codex-only `validate_plugin.py` helper currently rejects Claude's
`disable-model-invocation: true` frontmatter. That field is required to preserve Claude's explicit-
only initializer. For this dual-host skill, the release authority is the repository packaging
validator plus a successful installed Codex `skills/list` result with no load errors.

The invocation checks start new temporary projects and explicitly call both host initializers and
lane skills. The Codex opt-in flag disables the inner sandbox only for its disposable initializer
fixture because default `workspace-write` protects `.codex/` recursively. Never use that flag on
a real project.

The permission check loads `asmt-workspace` in this trusted repository, restores the exact prior
project config afterward, and proves:

- an ordinary workspace write succeeds;
- representative `.env`, `.env.*`, key, certificate, `secrets/`, and `*.local` reads fail;
- writes to those same sensitive paths fail.

## Release record

Record the date, commit, host versions, OpenSpec version, and each command's result in the pull
request. The candidate must remain blocked if Claude or Codex authentication is unavailable, a
fresh-session invocation was skipped, the Codex profile only parsed but was not sandbox-tested, or
an identical initializer rerun creates a diff.

Uninstall validation removes only the plugin package. It must not delete `openspec/`, guidance,
workflow, process, or policy files previously generated in user repositories.
