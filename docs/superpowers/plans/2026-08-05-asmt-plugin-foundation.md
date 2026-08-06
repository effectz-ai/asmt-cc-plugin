# ASMT Plugin Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the deterministic core of the ASMT Claude Code plugin — a gate that produces commit-keyed receipts, a hook that blocks PR creation without one, and the first three workflow entry points (`verify`, `spec`, `build`) — then dogfood it on one real card.

**Architecture:** A marketplace repo containing one plugin at `plugins/asmt/`. Skills split two ways: thin entry points (20–40 lines, read config and delegate) and fat knowledge skills (the methodology, ported from upstream). Anything that must be *true* rather than *claimed* lives in `bin/` as a real script, callable as a bare command because Claude Code puts plugin `bin/` directories on the Bash tool's PATH. Mode variants live in `references/` files selected by config, never in branching prose.

**Tech Stack:** Bash (POSIX-ish, targeting Cygwin/Git Bash on Windows and any Unix), git, Claude Code plugin manifests (JSON), skills (Markdown + YAML frontmatter). No jq, no node, no runtime dependencies.

**Scope:** Build-order steps 1–6 from `asmt-plugin-bootstrap.md` §14. Steps 7–11 (subagent topology, review agents, `ephemeral`/`code-then-test` variants, ship/land/status, metrics, size classes, CI, rollout) are deliberately **out of scope** and get their own plan after the dogfood run in Task 9 tells us what hurt.

---

## Global Constraints

Every task's requirements implicitly include this section.

**Plugin structure (from spec §1, §16):**
- Only `plugin.json` goes inside `.claude-plugin/`. Every other component (`skills/`, `agents/`, `hooks/`, `bin/`) sits at the plugin root.
- No `version` field in `plugins/asmt/.claude-plugin/plugin.json` while iterating. Claude Code falls back to the git commit SHA, so every push is a new version.
- All manifest paths relative, starting with `./`.
- `vendor/` sits **outside** the plugin directory on purpose. Installed plugins cannot reference files outside their own directory, so vendored upstream code can never load at runtime.
- No state written to `${CLAUDE_PLUGIN_ROOT}` — it changes on every update. Project state belongs in the target repo's `.asmt/`; plugin-owned state goes in `${CLAUDE_PLUGIN_DATA}`.
- A `CLAUDE.md` at the plugin root is **not** loaded as project context. House rules must be a skill.
- Plugin-shipped agents cannot declare `hooks`, `mcpServers`, or `permissionMode`.
- `chmod +x bin/* hooks/<scripts>` — a non-executable hook script is a silent failure.
- `/reload-plugins` or restart after touching `hooks/`, `agents/`, `.mcp.json`, or `output-styles/`. `SKILL.md` edits take effect immediately.

**Workflow semantics (from spec §4, §5, §15):**
- Three independent switches read from `.asmt/config.yml` in the **target** repo: `artifacts: living | ephemeral`, `loop: tdd | code-then-test` (default `tdd`), `topology: sequential | subagent`.
- Entry-point skills are thin, 20–40 lines. Knowledge skills are fat. Keep each `SKILL.md` body under ~500 lines.
- Mode variants live in `references/` files selected by config, never in branching prose.
- All verification logic in `bin/asmt-gate` as a real script. Never a prose instruction the model can claim to have followed.
- Gate receipt keyed to commit SHA, unusable after a new commit.
- Every scenario in a spec carries a stable ID; every test name references one.

**Porting policy (from spec §10):**
- Commit ported upstream files **verbatim** first, rename/adapt in the **next** commit.
- One `ATTRIBUTION.md` row per ported file: our path, upstream project + licence, upstream path, upstream SHA.
- Both upstreams are MIT — copyright notice and permission text travel with the code.

**Environment constraints (verified on this machine, 2026-08-05):**
- Shell is Cygwin bash 5.3.9. `jq` is **not** installed. Scripts must parse with `grep`/`sed`/shell only.
- Claude Code 2.1.222. Verified: `--plugin-dir <path>`, `--debug`, `claude plugin validate <path> --strict`, `claude plugin details <name>`, `claude plugin install --scope user|project|local`.
- Verified: plugin `bin/` directories are appended to the Bash tool's PATH.
- Windows prepends `bash` to any hook command containing `.sh`. Hook scripts are therefore **extensionless** and invoked through a polyglot `run-hook.cmd`, the pattern superpowers 6.2.0 uses (readable at `~/.claude/plugins/cache/claude-plugins-official/superpowers/6.2.0/hooks/run-hook.cmd`).
- Git on Windows does not pick up the exec bit from `chmod` alone. Use `git update-index --add --chmod=+x <path>` so the mode lands in the tree.

---

## File Structure

**Repo root (this repo, branch `v2`):**

| Path | Responsibility |
|---|---|
| `.claude-plugin/marketplace.json` | Makes this repo an installable marketplace. One entry: `asmt` → `./plugins/asmt`. |
| `.asmt/config.yml` | This repo dogfoods its own workflow. `verify.command` runs the test suite. |
| `.gitignore` | Excludes `vendor/upstream/`, `.asmt/receipts/`, editor cruft. |
| `vendor/UPSTREAM_SHAS` | The exact upstream commits ported from. Committed; the clones are not. |
| `tests/fixtures.sh` | Sourced helper that builds throwaway git repos with an `.asmt/config.yml`. Not a test itself. |
| `tests/test-asmt-gate` | Behavioural tests for the gate: receipts, dirty trees, staleness. |
| `tests/test-pretooluse-guard` | Behavioural tests for the hook: what it blocks and what it lets through. |
| `tests/test-plugin-shape` | Structural tests: frontmatter present, bodies under budget, ATTRIBUTION rows resolve. |
| `tests/run-all` | Runs every `tests/test-*`, exits non-zero if any failed. |
| `docs/` | Plans, dogfood findings. |
| `README.md` | What this is, how to install it, how to develop it. |
| `LICENSE` | MIT, ours. |

**Plugin (`plugins/asmt/`):**

| Path | Responsibility |
|---|---|
| `.claude-plugin/plugin.json` | The manifest. Name `asmt` — this is what produces `/asmt:*` namespacing. |
| `bin/asmt-gate` | Runs `verify.command`, writes a SHA-keyed receipt, and answers `check`. The only thing allowed to assert "verified". |
| `hooks/hooks.json` | Registers the `PreToolUse` guard on `Bash`. |
| `hooks/run-hook.cmd` | Polyglot cmd/bash wrapper so hooks run on Windows and Unix from one entry. |
| `hooks/pretooluse-guard` | Reads the tool-call JSON on stdin; blocks `gh pr create` without a fresh receipt. |
| `skills/verify/SKILL.md` | Entry point. Runs the gate, reports honestly. |
| `skills/spec/SKILL.md` | Entry point. Interviews, writes `proposal.md` + `spec.md`. |
| `skills/build/SKILL.md` | Entry point. Executes an approved plan task-by-task, sequentially. |
| `skills/spec-grammar/SKILL.md` | Knowledge. Requirement/scenario grammar, stable IDs. |
| `skills/spec-grammar/references/living.md` | Knowledge. Delta-spec + archive-into-current artifact flow. |
| `skills/tdd-loop/SKILL.md` | Knowledge. Ported from superpowers `test-driven-development`, adapted to require scenario IDs in test names. |
| `skills/house-rules/SKILL.md` | Knowledge. The team's own conventions. Authored by interview, not invented. |
| `NOTICE` | Names both upstream projects and carries their MIT text. |
| `ATTRIBUTION.md` | One row per ported file. Makes `diff-upstream.sh` possible later. |
| `CHANGELOG.md` | Human-readable history. |

**Deliberately not built in this plan** — each is a real thing the spec describes, deferred because nothing in steps 1–6 needs it:
- `bin/asmt-state`, `bin/asmt-metrics`, and the `SessionStart`/`SubagentStop` hooks that call them. Needed by `/asmt:status` and cross-session resume, which are step 9.
- `plugins/asmt/settings.json` (`subagentStatusLine`) — cosmetic.
- `agents/` — step 7, and pointless before `topology: subagent` exists.
- `skills/plan/`, `skills/review/`, `skills/ship/`, `skills/land/`, `skills/status/`, `skills/start/`.
- `references/ephemeral.md` — step 8.
- `scripts/diff-upstream.sh` and `.github/workflows/validate.yml` — steps 9 and 11. `tests/run-all` is the thing CI will eventually call.
- `size_classes` handling in the entry points. The config key gets written in Task 3 so the schema is stable, but no skill branches on it yet.

---

## Task 1: Repo skeleton, manifests, and a plugin that loads

**Files:**
- Delete: the entire v1 layout already staged for deletion (`asmt/`, root `LICENSE`, `README.md`, `.claude-plugin/marketplace.json`)
- Create: `.claude-plugin/marketplace.json`
- Create: `plugins/asmt/.claude-plugin/plugin.json`
- Create: `plugins/asmt/NOTICE`, `plugins/asmt/ATTRIBUTION.md`, `plugins/asmt/CHANGELOG.md`
- Create: `LICENSE`, `README.md`, `vendor/UPSTREAM_SHAS`
- Modify: `.gitignore`
- Test: `claude plugin validate` (the manifests' test is the validator)

**Interfaces:**
- Produces: a marketplace named `effectz` containing a plugin named `asmt`. Every later task adds components under `plugins/asmt/`. The plugin name `asmt` is what gives later tasks `/asmt:verify`, `/asmt:spec`, `/asmt:build`.

- [ ] **Step 1: Remove the colliding local stub**

A previous `claude plugin init` left a plugin at `~/.claude/skills/asmt/`. It auto-loads as `asmt@skills-dir` and already registers a skill named `asmt` and an agent named `asmt:example`. It will shadow or collide with the plugin you are about to build.

```bash
ls ~/.claude/skills/asmt/
rm -rf ~/.claude/skills/asmt/
```

Restart Claude Code (or `/reload-plugins`) and confirm `asmt` and `asmt:example` are gone from the skills/agents listing before continuing. If you skip this, every load test in this plan gives you an ambiguous answer.

- [ ] **Step 2: Commit the v1 teardown on its own**

The deletions are already staged. Land them separately so the diff of the rebuild is readable.

```bash
git status --short
git commit -m "refactor!: clear v1 layout ahead of plugins/asmt rebuild"
```

- [ ] **Step 3: Create the directory skeleton**

```bash
mkdir -p .claude-plugin \
         plugins/asmt/.claude-plugin \
         plugins/asmt/bin \
         plugins/asmt/hooks \
         plugins/asmt/skills \
         vendor/upstream \
         tests docs/superpowers/plans
```

- [ ] **Step 4: Write the marketplace manifest**

`.claude-plugin/marketplace.json`:

```json
{
  "name": "effectz",
  "owner": { "name": "Effectz.AI Platform", "email": "dev@effectz.ai" },
  "plugins": [
    { "name": "asmt", "source": "./plugins/asmt" }
  ]
}
```

- [ ] **Step 5: Write the plugin manifest**

`plugins/asmt/.claude-plugin/plugin.json`. Note the absence of `version` — that is deliberate, not an omission. With it unset, Claude Code falls back to the git commit SHA, so every push is a new version and the team picks changes up automatically. Setting it means hand-bumping on every change or `/plugin update` reports "already at the latest version" and silently serves stale cache.

```json
{
  "$schema": "https://json.schemastore.org/claude-code-plugin-manifest.json",
  "name": "asmt",
  "displayName": "ASMT Dev Workflow",
  "description": "Effectz.AI standard AI-assisted development workflow: spec, plan, build, gate, review, land.",
  "author": { "name": "Effectz.AI Platform" },
  "repository": "https://github.com/effectz-ai/asmt-cc-plugin",
  "license": "MIT",
  "keywords": ["workflow", "sdd", "tdd", "code-review"]
}
```

- [ ] **Step 6: Write `.gitignore`**

`.asmt/receipts/` matters more than it looks. The gate refuses to run on a dirty tree, and it writes its receipt *into* the repo. If receipts are tracked, running the gate dirties the very tree it just certified, and the next commit invalidates the receipt you just earned. Ignore them everywhere.

```gitignore
vendor/upstream/
.asmt/receipts/
node_modules/
.DS_Store
.idea/
```

- [ ] **Step 7: Vendor the upstreams, pinned**

Clones are gitignored; the SHAs are committed. That keeps the repo small while letting anyone restore the exact upstream state you ported from.

```bash
git clone --depth 50 https://github.com/obra/superpowers vendor/upstream/superpowers
git clone --depth 50 https://github.com/Fission-AI/OpenSpec vendor/upstream/openspec

{
  echo "superpowers $(git -C vendor/upstream/superpowers rev-parse HEAD)"
  echo "openspec    $(git -C vendor/upstream/openspec rev-parse HEAD)"
} > vendor/UPSTREAM_SHAS

cat vendor/UPSTREAM_SHAS
```

- [ ] **Step 8: Write the licensing files**

`LICENSE` — standard MIT, `Copyright (c) 2026 Effectz.AI`.

`plugins/asmt/NOTICE`:

```
ASMT Dev Workflow plugin
Copyright (c) 2026 Effectz.AI

This product includes software developed by third parties:

superpowers — https://github.com/obra/superpowers
  Copyright (c) Jesse Vincent. Licensed under the MIT License.

OpenSpec — https://github.com/Fission-AI/OpenSpec
  Licensed under the MIT License.

Full MIT permission text applies to the portions derived from each project.
Ported files are listed in ATTRIBUTION.md with their upstream path and commit.
```

`plugins/asmt/ATTRIBUTION.md` — header only for now; Task 7 adds the first row:

```markdown
# Attribution

Every file in this plugin derived from an upstream project gets a row here.
Ports land verbatim in one commit and are renamed/adapted in the next, so the
git history separates what we inherited from what we changed.

Upstream commits are pinned in `../../vendor/UPSTREAM_SHAS`.

| our file | upstream | upstream path | upstream SHA |
|---|---|---|---|
```

`plugins/asmt/CHANGELOG.md`:

```markdown
# Changelog

## Unreleased

- Initial plugin skeleton: marketplace + plugin manifests.
```

- [ ] **Step 9: Write `README.md`**

Cover four things and nothing else: what the plugin is, how a dev installs it (`claude plugin marketplace add effectz-ai/asmt-cc-plugin` then `claude plugin install asmt@effectz --scope project`), how to develop it (`claude --plugin-dir ./plugins/asmt`), and how to run the tests (`tests/run-all`, once Task 2 creates it).

- [ ] **Step 10: Run the validators — this is the test**

```bash
claude plugin validate ./plugins/asmt
claude plugin validate .
claude plugin validate ./plugins/asmt --strict
claude plugin validate . --strict
```

Expected: the two non-strict runs exit 0 — that is the passing bar. `--strict` treats missing metadata as an error and will exit 1 on `version: No version specified`, which is the deliberate consequence of the no-`version` policy in the Global Constraints, not a defect. Any *other* warning under `--strict` is a real problem: it treats unrecognized fields as errors too, which is exactly the class of typo that otherwise silently disables a component for the whole team.

(Amended during execution, 2026-08-05: the original text expected `--strict` to exit 0. It cannot, given the no-`version` constraint. `marketplace.json` gained a `description` field at the same time — nothing in this plan governed that field and the warning was legitimate.)

- [ ] **Step 11: Confirm it actually loads**

```bash
claude --plugin-dir ./plugins/asmt --debug 2>&1 | grep -i asmt
```

Expected: debug output showing the plugin registered. A plugin that validates but does not load usually means components ended up inside `.claude-plugin/` — everything except `plugin.json` belongs at the plugin root.

- [ ] **Step 12: Commit**

```bash
git add .claude-plugin plugins LICENSE README.md .gitignore vendor/UPSTREAM_SHAS
git commit -m "feat: scaffold asmt plugin marketplace and manifests"
```

---

## Task 2: `bin/asmt-gate` — the receipt

**Files:**
- Create: `plugins/asmt/bin/asmt-gate`
- Create: `tests/fixtures.sh`
- Create: `tests/test-asmt-gate`
- Create: `tests/run-all`
- Create: `.asmt/config.yml` (this repo dogfooding itself)

**Interfaces:**
- Produces: `asmt-gate run` — runs `verify.command` from `.asmt/config.yml`, writes `.asmt/receipts/<HEAD-SHA>.json`, exits 0 on pass and 1 on fail or refusal. `asmt-gate check` — exits 0 iff a receipt exists for the current HEAD *and* records `"result":"pass"`; exits 1 otherwise. Both discover the repo via `git rev-parse --show-toplevel`, so cwd anywhere inside the repo works.
- Produces: receipt JSON shape `{"sha":…,"result":"pass"|"fail","command":…,"at":…,"seconds":…}`. Task 4's guard greps `"result":"pass"`; Task 3's skill reports the path.
- Produces: `tests/fixtures.sh` exporting `new_repo [verify-command]`, which echoes the path of a fresh throwaway git repo with one commit and an `.asmt/config.yml`.
- Produces: `tests/run-all`, which every later task's tests are picked up by automatically (it globs `tests/test-*`).

- [ ] **Step 1: Write the fixture helper**

Not a test — a helper both this task's and Task 4's tests source. `tests/fixtures.sh`:

```bash
# Sourced by tests/test-*. Not executable, not a test itself.

# new_repo [verify-command] -> prints path to a fresh single-commit git repo
# with .asmt/config.yml and .asmt/receipts/ gitignored.
new_repo() {
  local dir cmd
  cmd="${1:-true}"
  dir="$(mktemp -d)"
  git -C "$dir" init -q -b main
  git -C "$dir" config user.email "test@example.com"
  git -C "$dir" config user.name "test"
  mkdir -p "$dir/.asmt"
  cat > "$dir/.asmt/config.yml" <<EOF
version: 1

verify:
  command: "$cmd"
  timeout_seconds: 900
EOF
  printf '.asmt/receipts/\n' > "$dir/.gitignore"
  git -C "$dir" add -A
  git -C "$dir" commit -qm "init"
  printf '%s\n' "$dir"
}

# head_sha <repo>
head_sha() { git -C "$1" rev-parse HEAD; }
```

- [ ] **Step 2: Write the failing test**

Seven behaviours, one file, plain asserts, no framework. `tests/test-asmt-gate`:

```bash
#!/usr/bin/env bash
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
GATE="$HERE/../plugins/asmt/bin/asmt-gate"
# shellcheck source=fixtures.sh
. "$HERE/fixtures.sh"

fails=0
ok()   { printf 'ok   - %s\n' "$1"; }
bad()  { printf 'FAIL - %s\n' "$1"; fails=$((fails + 1)); }
is()   { [ "$2" = "$3" ] && ok "$1" || bad "$1 (expected '$3', got '$2')"; }

run_in() { ( cd "$1" && shift && "$GATE" "$@" >/dev/null 2>&1 ); echo $?; }

# 1. passing verify command exits 0
repo="$(new_repo true)"
is "run: passing command exits 0" "$(run_in "$repo" run)" "0"

# 2. and writes a pass receipt keyed to HEAD
sha="$(head_sha "$repo")"
receipt="$repo/.asmt/receipts/$sha.json"
[ -f "$receipt" ] && ok "run: receipt written at HEAD sha" || bad "run: no receipt at $receipt"
grep -q '"result":"pass"' "$receipt" 2>/dev/null \
  && ok "run: receipt records pass" || bad "run: receipt missing pass result"

# 3. check accepts a fresh pass receipt
is "check: accepts fresh pass receipt" "$(run_in "$repo" check)" "0"

# 4. a new commit invalidates the receipt
( cd "$repo" && echo hi > new.txt && git add -A && git commit -qm "second" )
is "check: rejects receipt after new commit" "$(run_in "$repo" check)" "1"

# 5. failing verify command exits 1 and records the failure
repo_fail="$(new_repo false)"
is "run: failing command exits 1" "$(run_in "$repo_fail" run)" "1"
grep -q '"result":"fail"' "$repo_fail/.asmt/receipts/$(head_sha "$repo_fail").json" 2>/dev/null \
  && ok "run: receipt records fail" || bad "run: receipt missing fail result"

# 6. dirty tree is refused, and no receipt is written
repo_dirty="$(new_repo true)"
echo dirty > "$repo_dirty/uncommitted.txt"
is "run: refuses dirty tree" "$(run_in "$repo_dirty" run)" "1"
[ -f "$repo_dirty/.asmt/receipts/$(head_sha "$repo_dirty").json" ] \
  && bad "run: wrote a receipt for a dirty tree" || ok "run: no receipt for dirty tree"

# 7. check with no receipt at all, and run with no config
repo_bare="$(new_repo true)"
is "check: rejects missing receipt" "$(run_in "$repo_bare" check)" "1"
rm "$repo_bare/.asmt/config.yml"
is "run: rejects missing config" "$(run_in "$repo_bare" run)" "1"

[ "$fails" -eq 0 ] || printf '\n%s assertion(s) failed\n' "$fails"
exit "$((fails > 0))"
```

Make it executable in git, not just on disk:

```bash
chmod +x tests/test-asmt-gate
git update-index --add --chmod=+x tests/test-asmt-gate
```

- [ ] **Step 3: Run it to verify it fails**

Run: `tests/test-asmt-gate`
Expected: every assertion FAILs, because `plugins/asmt/bin/asmt-gate` does not exist yet. You should see `FAIL - run: passing command exits 0 (expected '0', got '127')`.

- [ ] **Step 4: Write the gate**

`plugins/asmt/bin/asmt-gate`:

```bash
#!/usr/bin/env bash
# asmt-gate — run the repo's verification command and write a receipt keyed to
# HEAD. The receipt is the deliverable: it makes "verified" a fact about a
# specific tree rather than a claim in a transcript.
set -euo pipefail

die() { printf 'asmt-gate: %s\n' "$*" >&2; exit 1; }

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || die "not inside a git repository."
CONFIG="$ROOT/.asmt/config.yml"
RECEIPTS="$ROOT/.asmt/receipts"
SHA="$(git -C "$ROOT" rev-parse HEAD)"
RECEIPT="$RECEIPTS/$SHA.json"

# ponytail: line-oriented read of one scalar, not a YAML parser. Requires
# `command:` indented under a top-level `verify:`. Swap for a real parser only
# if the config grows nested structures the gate has to read.
read_verify_command() {
  sed -n '/^verify:/,/^[^[:space:]#]/p' "$CONFIG" \
    | sed -n 's/^[[:space:]]\{1,\}command:[[:space:]]*//p' \
    | head -n 1 \
    | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//"
}

cmd_run() {
  local cmd start result seconds
  [ -f "$CONFIG" ] || die "no .asmt/config.yml in $ROOT. Run /asmt:start."
  cmd="$(read_verify_command)"
  [ -n "$cmd" ] || die "verify.command missing from $CONFIG"
  [ -z "$(git -C "$ROOT" status --porcelain)" ] \
    || die "working tree dirty — commit before gating."

  mkdir -p "$RECEIPTS"
  start="$(date +%s)"
  if ( cd "$ROOT" && eval "$cmd" ); then result=pass; else result=fail; fi
  seconds="$(( $(date +%s) - start ))"

  printf '{"sha":"%s","result":"%s","command":"%s","at":"%s","seconds":%s}\n' \
    "$SHA" "$result" "${cmd//\"/\\\"}" "$(date -Iseconds)" "$seconds" > "$RECEIPT"

  [ "$result" = pass ] || die "FAILED — receipt $RECEIPT"
  printf 'asmt-gate: pass (%s)\n' "$SHA"
}

cmd_check() {
  [ -f "$RECEIPT" ] || die "no receipt for HEAD $SHA. Run asmt-gate run."
  grep -q '"result":"pass"' "$RECEIPT" || die "last gate run on $SHA failed."
  printf 'asmt-gate: receipt ok (%s)\n' "$SHA"
}

case "${1:-run}" in
  run)   cmd_run ;;
  check) cmd_check ;;
  *)     die "usage: asmt-gate [run|check]" ;;
esac
```

```bash
chmod +x plugins/asmt/bin/asmt-gate
git update-index --add --chmod=+x plugins/asmt/bin/asmt-gate
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `tests/test-asmt-gate`
Expected: nine `ok -` lines, exit 0.

If assertion 6 fails with a receipt present for a dirty tree, the dirty check is running after `mkdir`/write — order matters: refuse before touching the filesystem.

- [ ] **Step 6: Write the test runner**

`tests/run-all`:

```bash
#!/usr/bin/env bash
# Runs every tests/test-* file. New test files are picked up automatically.
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
failed=0

for t in "$HERE"/test-*; do
  [ -f "$t" ] || continue
  printf '\n== %s\n' "$(basename "$t")"
  bash "$t" || failed=1
done

[ "$failed" -eq 0 ] && printf '\nall tests passed\n' || printf '\nSOME TESTS FAILED\n'
exit "$failed"
```

```bash
chmod +x tests/run-all
git update-index --add --chmod=+x tests/run-all
```

- [ ] **Step 7: Make this repo dogfood its own gate**

`.asmt/config.yml` at the repo root. The full schema goes in now so it is stable for later tasks, even though only `verify.command` is read in this plan.

```yaml
version: 1

# the three independent switches
modes:
  artifacts: living        # living | ephemeral
  loop: tdd                # tdd | code-then-test
  topology: sequential     # sequential | subagent

# per-card override: chore collapses the human gates
size_classes:
  chore:    { spec: lite,  plan: skip, gates: [verify] }
  standard: { spec: full,  plan: full, gates: [verify, self-review, sse-review] }
  risky:    { spec: full,  plan: full, gates: [verify, self-review, model-review, sse-review] }
default_size_class: standard

verify:
  command: "tests/run-all"
  timeout_seconds: 900

paths:
  changes: "specs/changes"
  living:  "specs/current"

models:
  spec: opus
  plan: opus
  build: sonnet
  self_review: sonnet
  final_review: opus

card_tool: jira            # jira | linear | notion
```

- [ ] **Step 8: Verify the gate end-to-end on this repo**

```bash
tests/run-all
git add -A && git commit -m "feat: add asmt-gate with SHA-keyed verification receipts"
plugins/asmt/bin/asmt-gate run
plugins/asmt/bin/asmt-gate check
```

Expected: `asmt-gate: pass (<sha>)` then `asmt-gate: receipt ok (<sha>)`, and `git status --porcelain` still empty — proving `.asmt/receipts/` is correctly ignored. If the tree is dirty after `run`, fix `.gitignore` before continuing; every later gate run will otherwise refuse.

- [ ] **Step 9: Confirm `bin/` reaches the Bash PATH**

Start a session with the plugin loaded from disk and run `asmt-gate check` as a bare command:

```bash
claude --plugin-dir ./plugins/asmt
```

then in that session ask for `asmt-gate check` to be run. Expected: it resolves without a path. If it does not, `bin/` is misplaced (it belongs at the plugin root, not under `.claude-plugin/`) or the file lacks its exec bit.

---

## Task 3: `/asmt:verify` — the first entry point

**Files:**
- Create: `plugins/asmt/skills/verify/SKILL.md`
- Create: `tests/test-plugin-shape`

**Interfaces:**
- Consumes: `asmt-gate run` / `asmt-gate check` from Task 2, and `.asmt/config.yml` from Task 2 Step 7.
- Produces: the entry-point shape every later skill copies — frontmatter with a deliberately pushy `description`, a numbered body of 20–40 lines, no methodology inline.
- Produces: `tests/test-plugin-shape`, which every later skill and ported file is checked by. Task 7 extends it with ATTRIBUTION row checking.

- [ ] **Step 1: Write the failing structural test**

Descriptions are the whole triggering mechanism, and models tend to *under*-trigger skills — so the test enforces that a description exists and is substantial. It also enforces the ~500-line body budget that keeps knowledge out of entry points.

`tests/test-plugin-shape`:

```bash
#!/usr/bin/env bash
# Structural checks on the plugin: frontmatter present, bodies within budget.
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
PLUGIN="$HERE/../plugins/asmt"

fails=0
ok()  { printf 'ok   - %s\n' "$1"; }
bad() { printf 'FAIL - %s\n' "$1"; fails=$((fails + 1)); }

skills=$(find "$PLUGIN/skills" -name SKILL.md 2>/dev/null | sort)
[ -n "$skills" ] || bad "no SKILL.md files found under $PLUGIN/skills"

for s in $skills; do
  rel="${s#"$PLUGIN"/}"

  head -n 1 "$s" | grep -qx -- '---' \
    && ok "$rel: opens with frontmatter" || bad "$rel: missing opening ---"

  grep -qE '^name: [a-z0-9-]+$' "$s" \
    && ok "$rel: has a kebab-case name" || bad "$rel: missing or malformed name:"

  desc=$(sed -n 's/^description: //p' "$s" | head -n 1)
  [ "${#desc}" -ge 60 ] \
    && ok "$rel: description is substantial" \
    || bad "$rel: description too short (${#desc} chars) — it is the trigger mechanism"

  lines=$(wc -l < "$s")
  [ "$lines" -le 500 ] \
    && ok "$rel: body within budget ($lines lines)" \
    || bad "$rel: $lines lines — split into references/"
done

[ "$fails" -eq 0 ] || printf '\n%s assertion(s) failed\n' "$fails"
exit "$((fails > 0))"
```

```bash
chmod +x tests/test-plugin-shape
git update-index --add --chmod=+x tests/test-plugin-shape
```

- [ ] **Step 2: Run it to verify it fails**

Run: `tests/test-plugin-shape`
Expected: `FAIL - no SKILL.md files found under .../plugins/asmt/skills`, exit 1.

- [ ] **Step 3: Write the skill**

`plugins/asmt/skills/verify/SKILL.md`:

```markdown
---
name: verify
description: Run the repository's verification gate and produce a receipt for the current commit. Use whenever the user wants to verify, gate, check, or prove that the current commit passes lint, types, and tests — including phrasings that never say "verify", like "run the checks", "is this green?", "did that break anything?", or "can I open the PR yet?". Also use before any attempt to push or open a pull request.
---

# Verify

1. Read `.asmt/config.yml`. If it is missing, stop and tell the user to run
   `/asmt:start`. Do not invent a verification command.
2. Run `git status --porcelain`. If it is non-empty, stop and ask the user to
   commit. The gate refuses a dirty tree by design: the receipt is a fact
   about a commit, not about a workspace.
3. Run `asmt-gate run`. Do not run `verify.command` yourself. Only `asmt-gate`
   writes the receipt, and a run without a receipt has not happened.
4. If it fails, report the failing output verbatim. Do not summarise it as
   "some tests failed", and do not start fixing things unless the user asks.
5. If it passes, report the commit SHA and the receipt path
   `.asmt/receipts/<sha>.json`.
6. Never state that verification passed without quoting `asmt-gate`'s own
   final line. The whole point of the receipt is that the claim is checkable.

Notes for the user, if they ask:
- A new commit invalidates the receipt. That is intentional — re-run the gate.
- `asmt-gate check` answers "does HEAD have a passing receipt?" without
  re-running anything. The PR guard uses exactly this.
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `tests/run-all`
Expected: both test files pass. `test-plugin-shape` should report four `ok` lines for `skills/verify/SKILL.md`.

- [ ] **Step 5: Confirm the skill registers and check its token cost**

```bash
claude plugin validate ./plugins/asmt --strict
claude plugin details asmt
```

Expected: `verify` listed as a skill, with an always-on cost equal to its name + description only. Run `claude plugin details asmt` after each batch of skills from here on — the always-on number is what a two-tier split exists to protect.

- [ ] **Step 6: Commit**

```bash
git add plugins/asmt/skills/verify tests/test-plugin-shape
git commit -m "feat: add /asmt:verify entry point and plugin shape tests"
```

---

## Task 4: The PreToolUse guard — making the gate unavoidable

**Files:**
- Create: `plugins/asmt/hooks/hooks.json`
- Create: `plugins/asmt/hooks/run-hook.cmd`
- Create: `plugins/asmt/hooks/pretooluse-guard`
- Create: `tests/test-pretooluse-guard`

**Interfaces:**
- Consumes: `asmt-gate check` from Task 2, `tests/fixtures.sh` from Task 2.
- Produces: a `PreToolUse` hook on `Bash` that exits 2 with an explanation on stderr when a `gh pr create` command is attempted without a passing receipt for HEAD, and exits 0 otherwise.
- Produces: `hooks/run-hook.cmd`, the invocation path every future hook script in this plugin uses. Hook scripts live in `hooks/` and are **extensionless** — Claude Code on Windows prepends `bash` to any command containing `.sh`, which double-invokes the interpreter.

**Design note — why this layout differs from the spec:** the spec puts the guard at `scripts/pretooluse-guard.sh`. On Windows that filename triggers the auto-`bash` rule, and a bare `#!/usr/bin/env bash` command line does not run under cmd.exe. Superpowers solved this with a polyglot `run-hook.cmd` that resolves sibling scripts by name; it is readable at `~/.claude/plugins/cache/claude-plugins-official/superpowers/6.2.0/hooks/run-hook.cmd`. Reusing that pattern means the guard needs to sit next to the runner, so `hooks/` absorbs the `scripts/` directory entirely.

- [ ] **Step 1: Write the failing test**

Four behaviours: ignore unrelated commands, ignore repos that do not use ASMT, block when there is no receipt, allow when there is one.

`tests/test-pretooluse-guard`:

```bash
#!/usr/bin/env bash
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
PLUGIN="$HERE/../plugins/asmt"
GUARD="$PLUGIN/hooks/pretooluse-guard"
# shellcheck source=fixtures.sh
. "$HERE/fixtures.sh"

fails=0
ok()  { printf 'ok   - %s\n' "$1"; }
bad() { printf 'FAIL - %s\n' "$1"; fails=$((fails + 1)); }
is()  { [ "$2" = "$3" ] && ok "$1" || bad "$1 (expected exit $3, got $2)"; }

# guard_in <repo> <command-string> -> exit code
guard_in() {
  local repo="$1" cmd="$2"
  ( cd "$repo" \
    && printf '{"tool_name":"Bash","tool_input":{"command":"%s"}}' "$cmd" \
       | CLAUDE_PLUGIN_ROOT="$PLUGIN" "$GUARD" >/dev/null 2>&1 )
  echo $?
}

repo="$(new_repo true)"

# 1. unrelated commands pass straight through
is "allows unrelated command" "$(guard_in "$repo" 'git status')" "0"

# 2. gh pr create with no receipt is blocked with exit 2
is "blocks gh pr create without receipt" \
   "$(guard_in "$repo" 'gh pr create --fill')" "2"

# 3. once a receipt exists for HEAD, it is allowed
( cd "$repo" && CLAUDE_PLUGIN_ROOT="$PLUGIN" "$PLUGIN/bin/asmt-gate" run >/dev/null 2>&1 )
is "allows gh pr create with fresh receipt" \
   "$(guard_in "$repo" 'gh pr create --fill')" "0"

# 4. repos that do not use ASMT are none of the guard's business
plain="$(mktemp -d)"
git -C "$plain" init -q -b main
git -C "$plain" config user.email "test@example.com"
git -C "$plain" config user.name "test"
( cd "$plain" && git commit -q --allow-empty -m init )
is "ignores repos without .asmt/config.yml" \
   "$(guard_in "$plain" 'gh pr create --fill')" "0"

[ "$fails" -eq 0 ] || printf '\n%s assertion(s) failed\n' "$fails"
exit "$((fails > 0))"
```

```bash
chmod +x tests/test-pretooluse-guard
git update-index --add --chmod=+x tests/test-pretooluse-guard
```

- [ ] **Step 2: Run it to verify it fails**

Run: `tests/test-pretooluse-guard`
Expected: all four FAIL with exit 127 — the guard does not exist.

- [ ] **Step 3: Write the guard**

`plugins/asmt/hooks/pretooluse-guard`:

```bash
#!/usr/bin/env bash
# PreToolUse guard: refuse `gh pr create` unless HEAD has a passing gate
# receipt. Exit 2 blocks the tool call and feeds stderr back to the model.
set -uo pipefail

payload="$(cat)"

# ponytail: substring match on the whole payload rather than parsing JSON —
# jq is not a dependency we want. A false positive only costs an explained
# block. Parse tool_input.command properly if that ever bites.
case "$payload" in
  *"gh pr create"*) ;;
  *) exit 0 ;;
esac

root="$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0
[ -f "$root/.asmt/config.yml" ] || exit 0   # not an ASMT repo; not our business

plugin_root="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"

if ! "$plugin_root/bin/asmt-gate" check >/dev/null 2>&1; then
  cat >&2 <<'EOF'
asmt: blocked — HEAD has no passing verification receipt.

Run /asmt:verify (or `asmt-gate run`) and do not commit anything afterwards;
a new commit invalidates the receipt. Then retry the PR.
EOF
  exit 2
fi

exit 0
```

```bash
chmod +x plugins/asmt/hooks/pretooluse-guard
git update-index --add --chmod=+x plugins/asmt/hooks/pretooluse-guard
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `tests/test-pretooluse-guard`
Expected: four `ok -` lines, exit 0.

- [ ] **Step 5: Write the cross-platform runner**

`plugins/asmt/hooks/run-hook.cmd` — a polyglot file: cmd.exe reads the batch block, bash reads `:` as a no-op and falls through to the last two lines.

```bat
: << 'CMDBLOCK'
@echo off
REM Cross-platform wrapper for hook scripts.
REM Windows: cmd.exe runs this batch portion, which locates bash.
REM Unix: the shell treats `:` as a no-op and reaches the exec below.
REM
REM Hook scripts are extensionless on purpose — Claude Code on Windows
REM prepends "bash" to any command containing .sh, double-invoking it.
REM
REM Usage: run-hook.cmd <script-name> [args...]

if "%~1"=="" (
    echo run-hook.cmd: missing script name >&2
    exit /b 1
)

set "HOOK_DIR=%~dp0"

if exist "C:\Program Files\Git\bin\bash.exe" (
    "C:\Program Files\Git\bin\bash.exe" "%HOOK_DIR%%~1" %2 %3 %4 %5 %6 %7 %8 %9
    exit /b %ERRORLEVEL%
)
if exist "C:\Program Files (x86)\Git\bin\bash.exe" (
    "C:\Program Files (x86)\Git\bin\bash.exe" "%HOOK_DIR%%~1" %2 %3 %4 %5 %6 %7 %8 %9
    exit /b %ERRORLEVEL%
)

where bash >nul 2>nul
if %ERRORLEVEL% equ 0 (
    bash "%HOOK_DIR%%~1" %2 %3 %4 %5 %6 %7 %8 %9
    exit /b %ERRORLEVEL%
)

REM No bash found. Fail open rather than wedging every Bash tool call.
exit /b 0
CMDBLOCK

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SCRIPT_NAME="$1"
shift
exec bash "${SCRIPT_DIR}/${SCRIPT_NAME}" "$@"
```

```bash
chmod +x plugins/asmt/hooks/run-hook.cmd
git update-index --add --chmod=+x plugins/asmt/hooks/run-hook.cmd
```

- [ ] **Step 6: Register the hook**

`plugins/asmt/hooks/hooks.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "\"${CLAUDE_PLUGIN_ROOT}/hooks/run-hook.cmd\" pretooluse-guard",
            "shell": "bash",
            "timeout": 30,
            "statusMessage": "Checking gate receipt"
          }
        ]
      }
    ]
  }
}
```

- [ ] **Step 7: Reload, then test the block for real**

Unit tests prove the script's logic. They do not prove Claude Code honours exit 2 as a block in this version, which is the one thing that actually matters here.

```bash
claude plugin validate ./plugins/asmt --strict
```

Restart Claude Code (or `/reload-plugins` — hook changes do **not** hot-reload, unlike `SKILL.md` edits). Then, in a repo with `.asmt/config.yml` and no receipt for HEAD, deliberately attempt:

```bash
gh pr create --fill --dry-run
```

Expected: the tool call is blocked and the guard's stderr message appears as feedback. Then run `/asmt:verify` and retry — expected: it proceeds.

If exit 2 is *not* honoured in this version, the alternative is the structured form: print
`{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"<message>"}}`
to stdout and exit 0. Try that before anything else, and update `tests/test-pretooluse-guard`'s expected exit codes to match whichever convention you confirm. Record which one worked in `plugins/asmt/CHANGELOG.md` — the next person will ask.

- [ ] **Step 8: Commit**

```bash
git add plugins/asmt/hooks tests/test-pretooluse-guard
git commit -m "feat: block gh pr create without a passing gate receipt"
```

---

## Task 5: `spec-grammar` and `house-rules` — the knowledge behind specs

**Files:**
- Create: `plugins/asmt/skills/spec-grammar/SKILL.md`
- Create: `plugins/asmt/skills/spec-grammar/references/living.md`
- Create: `plugins/asmt/skills/house-rules/SKILL.md`

**Interfaces:**
- Produces: the scenario ID format `REQ-<n>.<m>` (requirement `REQ-<n>`, scenario `REQ-<n>.<m>`). Task 6's `/asmt:spec` writes them; Task 7's `tdd-loop` requires every test name to contain one. This is the single link that makes spec→test traceability real, and it is the difference between a gate that means something and one that confirms an agent's tests pass its own code.
- Produces: `skills/house-rules` — referenced by both `/asmt:spec` (Task 6) and `/asmt:build` (Task 7).
- Consumes: `modes.artifacts` and `paths.changes` / `paths.living` from `.asmt/config.yml`.

- [ ] **Step 1: Write `spec-grammar/SKILL.md`**

Common grammar only. Anything that differs between `living` and `ephemeral` goes in `references/`, per the global constraints.

```markdown
---
name: spec-grammar
description: The grammar for writing ASMT specifications — how to phrase requirements, how to write scenarios that are independently testable, and how scenario IDs link a spec to the tests that prove it. Read this before writing or reviewing any proposal.md or spec.md. Also read it when a spec feels vague, when reviewing whether a requirement is actually testable, or when deciding whether something belongs in the spec at all.
---

# Spec grammar

## Requirements

A requirement states an observable obligation of the system. One obligation
each. If you need "and" between two verbs, it is two requirements.

    REQ-1: The gate refuses to run against a dirty working tree.

Number them `REQ-<n>`, sequential within one change, never renumbered once
the spec is signed off. A stable ID is worth more than a tidy sequence.

Not requirements: implementation choices ("use a bash script"), aspirations
("should be fast"), restatements of the card title.

## Scenarios

Each requirement decomposes into scenarios. A scenario is one concrete case
with one expected outcome, and it must be independently testable — readable
and checkable without any other scenario having run first.

    REQ-1.1: Given a repo with uncommitted changes, when the gate runs,
             it exits non-zero and writes no receipt.
    REQ-1.2: Given a clean repo, when the gate runs and the verify command
             succeeds, it writes a receipt recording "pass".

Scenario IDs are `REQ-<n>.<m>`. They are the contract with the test suite:
`tdd-loop` requires every test name to contain the ID of the scenario it
proves. That is what makes "the tests pass" mean "the spec is satisfied"
rather than "the agent's code satisfies the agent's tests".

A scenario that cannot be phrased as given/when/then is usually a
requirement in disguise, or is not observable — in which case it does not
belong in the spec.

## What a spec does not contain

- Task breakdown. That is the plan's job.
- File paths and function names. Those are the plan's job too.
- Anything the change explicitly does *not* do — that goes in `proposal.md`
  under a non-goals heading, where it is visible during review.

## Interviewing before writing

Never infer requirements from a card title. Ask about the cases the card does
not mention: the empty input, the concurrent second caller, the partial
failure, what happens on retry. Most missing requirements are found by asking
"what happens if this runs twice?".

## Artifact layout

The artifact layout depends on `modes.artifacts` in `.asmt/config.yml`. Read
`references/living.md` when it is `living`. (`ephemeral` is not implemented
yet — if the config says `ephemeral`, stop and tell the user.)
```

- [ ] **Step 2: Write `spec-grammar/references/living.md`**

```markdown
# Living artifacts

Used when `modes.artifacts: living`.

Specs are permanent and cumulative. A change proposes a *delta*; once it
lands, the delta is folded into the living spec and the change directory is
archived.

## During a change

Everything lives under `<paths.changes>/<change-id>/`:

    proposal.md   why this change exists, what it changes, what it explicitly
                  does not change (non-goals)
    spec.md       the delta: requirements and scenarios that are new or
                  modified, using the grammar in SKILL.md
    tasks.md      written later by /asmt:plan, not by /asmt:spec

`<change-id>` is short, kebab-case, and derived from the card: `gate-receipts`,
not `EFL-1234-implement-the-gate-receipt-mechanism`.

## In `spec.md`, mark each requirement's disposition

    ## ADDED REQ-4: The guard ignores repositories without .asmt/config.yml
    ## MODIFIED REQ-1: (was: refuses dirty trees) now also refuses a missing config
    ## REMOVED REQ-2

Modified requirements quote the previous text. A reviewer must be able to see
what changed without opening the living spec alongside.

## When the change lands

Fold `spec.md` into `<paths.living>/`, one file per capability rather than one
per change. Requirement IDs stay stable across the fold — the living spec is
where `REQ-1` permanently means what it meant when it was written. Then
archive the change directory.

## Why this way

The living spec is the answer to "what does this system do?" without reading
code or replaying history. That property survives only if IDs are stable and
the fold is not skipped. A change that lands without folding leaves the living
spec quietly wrong, which is worse than not having one.
```

- [ ] **Step 3: Write `house-rules/SKILL.md` — by interview, not invention**

This is the one skill whose content cannot be derived from the spec document. **Ask the user** for the conventions before writing: Turborepo layout rules, the Zod contracts-first approach the spec mentions in §10, naming, error handling, what belongs in which package, what is banned. Write down what they say, in their words.

Use this skeleton, and replace each example with real answers:

```markdown
---
name: house-rules
description: Effectz.AI engineering conventions — repository layout, contracts-first data modelling, naming, error handling, and dependency rules. Read this before writing or reviewing any code in an Effectz.AI repository, including when the task seems too small to need conventions. If code you are about to write contradicts a rule here, stop and raise it rather than quietly following the surrounding code.
---

# House rules

## Repository layout

<!-- Turborepo package boundaries: what goes in apps/ vs packages/, what may
     depend on what. Ask the user. -->

## Contracts first

<!-- The Zod-schema-before-implementation rule. Where schemas live, who owns
     them, how they are shared between packages. Ask the user. -->

## Naming

<!-- Files, exports, test names. Ask the user. -->

## Error handling

<!-- Thrown vs returned errors, what may be swallowed, logging expectations.
     Ask the user. -->

## Dependencies

<!-- What may be added without discussion, what may not. Ask the user. -->

## When a rule and the surrounding code disagree

Say so. Do not silently follow either one. A rule that no longer matches the
code is either a rule to change or code to fix, and only the team decides which.
```

A CLAUDE.md at the plugin root would be ignored — plugins contribute context through skills, agents, and hooks only. This file is the only place house rules can live.

- [ ] **Step 4: Run the shape tests**

Run: `tests/run-all`
Expected: all pass, with `test-plugin-shape` now reporting on three additional SKILL.md files. If `house-rules` fails the description-length check, the description is too terse — it is the trigger mechanism, so make it list the phrasings a dev would actually use.

- [ ] **Step 5: Check the token cost**

Run: `claude plugin details asmt`
Expected: always-on cost still only the sum of names + descriptions. If a knowledge skill's *body* is showing up as always-on, its frontmatter is malformed.

- [ ] **Step 6: Commit**

```bash
git add plugins/asmt/skills/spec-grammar plugins/asmt/skills/house-rules
git commit -m "feat: add spec-grammar and house-rules knowledge skills"
```

---

## Task 6: `/asmt:spec` — the second entry point

**Files:**
- Create: `plugins/asmt/skills/spec/SKILL.md`

**Interfaces:**
- Consumes: `spec-grammar` + `references/living.md` and `house-rules` from Task 5; `modes.artifacts` and `paths.changes` from `.asmt/config.yml`.
- Produces: `<paths.changes>/<change-id>/proposal.md` and `spec.md`, which Task 7's `/asmt:build` reads.

- [ ] **Step 1: Write the skill**

`plugins/asmt/skills/spec/SKILL.md`:

```markdown
---
name: spec
description: Turn a card into a reviewed specification before any code is written. Use whenever starting work on a new card, ticket, issue, or feature request, or when the user says they want to spec, scope, propose, or "figure out what we're building" — even if they never say "spec". Also use when a request arrives as a paragraph of prose and nobody has written down what done looks like.
---

# Spec a change

1. Read `.asmt/config.yml`. If it is missing, stop and tell the user to run
   `/asmt:start`.
2. Read the `spec-grammar` skill, then read whichever file in its
   `references/` matches `modes.artifacts`. If `modes.artifacts` is
   `ephemeral`, stop — that variant is not implemented yet.
3. Read the `house-rules` skill.
4. Confirm the size class with the user (`chore`, `standard`, `risky`;
   `default_size_class` is the default). If `chore`, write a lite spec — the
   requirements only, no proposal — and stop.
5. Interview before writing. Do not infer requirements from the card title.
   Ask about the cases the card does not mention. Keep asking until you can
   state what is explicitly out of scope.
6. Write to `<paths.changes>/<change-id>/`:
   - `proposal.md` — why, what changes, and what this explicitly does not do
   - `spec.md` — requirements and scenarios per the grammar, every scenario
     carrying a stable `REQ-<n>.<m>` ID
7. Present the spec back in sections short enough to actually read, and ask
   the card's creator for sign-off.
8. Stop there. Do not proceed to planning or building on your own — the
   sign-off is a human gate, and a gate you walk through yourself is not one.
```

- [ ] **Step 2: Run the shape tests**

Run: `tests/run-all`
Expected: all pass. Confirm the body is between 20 and 40 lines — an entry point that grows past that is absorbing methodology that belongs in a knowledge skill.

- [ ] **Step 3: Exercise it once, for real**

In a session with `claude --plugin-dir ./plugins/asmt`, run `/asmt:spec` against a small real card. Watch for two failure modes: it starts writing before interviewing (step 5 is not forceful enough), or it proceeds past sign-off (step 8 is not forceful enough). Fix the wording, not the model.

- [ ] **Step 4: Commit**

```bash
git add plugins/asmt/skills/spec
git commit -m "feat: add /asmt:spec entry point"
```

---

## Task 7: `tdd-loop` and `/asmt:build` — the port and the third entry point

**Files:**
- Create: `plugins/asmt/skills/tdd-loop/SKILL.md` (ported, then adapted — **two commits**)
- Create: `plugins/asmt/skills/build/SKILL.md`
- Modify: `plugins/asmt/ATTRIBUTION.md`
- Modify: `tests/test-plugin-shape`

**Interfaces:**
- Consumes: scenario IDs `REQ-<n>.<m>` from Task 5; `house-rules` from Task 5; `modes.loop` and `modes.topology` from `.asmt/config.yml`.
- Produces: `tdd-loop`, the methodology `/asmt:build` delegates to and — later — the `implementer` agent's `skills:` entry.
- Produces: an ATTRIBUTION row format that `scripts/diff-upstream.sh` will parse in a later plan: `| our file | upstream | upstream path | upstream SHA |`.

- [ ] **Step 1: Port the upstream file verbatim**

Copy it unchanged. Not "mostly unchanged" — byte-for-byte, including its frontmatter, so the next commit's diff shows exactly what you altered.

```bash
cp vendor/upstream/superpowers/skills/test-driven-development/SKILL.md \
   plugins/asmt/skills/tdd-loop/SKILL.md
git add plugins/asmt/skills/tdd-loop/SKILL.md
git commit -m "chore: vendor superpowers test-driven-development verbatim"
```

- [ ] **Step 2: Record the port in ATTRIBUTION.md**

```bash
grep superpowers vendor/UPSTREAM_SHAS
```

Add the row to `plugins/asmt/ATTRIBUTION.md`, substituting the SHA you just read:

```markdown
| skills/tdd-loop/SKILL.md | superpowers (MIT) | skills/test-driven-development/SKILL.md | <sha> |
```

- [ ] **Step 3: Adapt it, in a separate commit**

Now edit `plugins/asmt/skills/tdd-loop/SKILL.md`:

- Change the frontmatter `name:` to `tdd-loop`.
- Rewrite `description:` in the pushy house style, naming the phrasings a dev would use: "implement", "make this work", "add the feature", "fix the bug", plus "before writing any implementation code".
- Add this section, which is the half the upstream skill cannot know about:

```markdown
## Test names carry scenario IDs

Every test must name the scenario it proves. Put the ID in the test name or
its description string:

    test_gate_refuses_dirty_tree_REQ_1_1
    it("REQ-1.2: writes a pass receipt on a clean tree", ...)

Two consequences, and both are the point:

- A test with no scenario ID is testing something nobody asked for. Either
  the spec is missing a scenario — go add it — or the test is scope creep.
- A scenario with no test is unimplemented, and `grep` can prove it. That is
  what makes the verification gate mean "the spec is satisfied" instead of
  "the code passes its own tests".

If the spec is wrong, change the spec. Do not write an unlabelled test
because the ID would be inconvenient.
```

- If `modes.loop` is `code-then-test`, this skill does not apply — note that at the top and stop. (That variant is not implemented yet.)

```bash
git add plugins/asmt/skills/tdd-loop/SKILL.md plugins/asmt/ATTRIBUTION.md
git commit -m "feat: adapt tdd-loop to require scenario IDs in test names"
```

- [ ] **Step 4: Extend the shape test to check ATTRIBUTION rows**

A row pointing at a file that no longer exists is how attribution silently rots. Append to `tests/test-plugin-shape`, before the final `[ "$fails" -eq 0 ]` line:

```bash
# Every ATTRIBUTION.md row must point at a file that exists.
attribution="$PLUGIN/ATTRIBUTION.md"
if [ -f "$attribution" ]; then
  rows=0
  while IFS='|' read -r _ ourfile _ _ _ _; do
    ourfile="$(printf '%s' "$ourfile" | sed 's/^ *//; s/ *$//')"
    case "$ourfile" in
      ''|'our file'|---*|:---*) continue ;;
    esac
    rows=$((rows + 1))
    [ -f "$PLUGIN/$ourfile" ] \
      && ok "attribution: $ourfile exists" \
      || bad "attribution: $ourfile listed but missing"
  done < "$attribution"
  ok "attribution: $rows row(s) checked"
else
  bad "ATTRIBUTION.md missing"
fi
```

- [ ] **Step 5: Run the tests**

Run: `tests/run-all`
Expected: all pass, including `attribution: skills/tdd-loop/SKILL.md exists` and `attribution: 1 row(s) checked`.

Sanity-check the negative: temporarily add a row for `skills/nope/SKILL.md`, re-run, confirm it FAILs, then remove it. A validator that cannot fail is not a validator.

- [ ] **Step 6: Write `/asmt:build`**

`plugins/asmt/skills/build/SKILL.md`:

```markdown
---
name: build
description: Implement an approved plan task by task, with tests. Use whenever the user wants to build, implement, code, or "start on" work that already has a signed-off spec and plan — including "let's do task 3", "carry on with the build", or "make it pass". Do not use this before a spec exists; use /asmt:spec first.
---

# Build a change

1. Read `.asmt/config.yml`. If `modes.topology` is `subagent`, stop — that
   topology is not implemented yet. Sequential is the only supported mode.
2. Read the `tdd-loop` skill and the `house-rules` skill.
3. Read `<paths.changes>/<change-id>/spec.md` and `tasks.md`. If `tasks.md`
   does not exist, stop and say so — there is no `/asmt:plan` yet, so the
   task breakdown has to be written by hand for now. Do not invent one and
   start building from it.
4. Confirm the suite is green before touching anything: run `/asmt:verify`.
   Starting from red means you cannot tell your failures from the existing ones.
5. Take exactly one task from `tasks.md`. Not two. Not "while I was here".
6. Follow `tdd-loop` without exception: write the failing test, run it, watch
   it fail, write the minimum code to pass, run it, watch it pass, commit.
   Code written before its test gets deleted, not retrofitted.
7. Every test name carries the `REQ-<n>.<m>` ID of the scenario it proves.
8. After each task: report the task ID, the files touched, the test names
   added, and anything you noticed but did not fix. Never report success
   without pasting the actual test output.
9. When all tasks are done, run `/asmt:verify` and stop. Opening the PR is a
   separate step, and it is gated.
```

- [ ] **Step 7: Run the tests and check the budget**

```bash
tests/run-all
claude plugin validate ./plugins/asmt --strict
claude plugin details asmt
```

Expected: all green; `details` lists six skills (`verify`, `spec`, `build`, `spec-grammar`, `tdd-loop`, `house-rules`) with only names and descriptions always-on.

- [ ] **Step 8: Commit**

```bash
git add plugins/asmt/skills/build tests/test-plugin-shape
git commit -m "feat: add /asmt:build entry point and attribution checking"
```

---

## Task 8: Dogfood one real card

**Files:**
- Create: `docs/dogfood-01.md`
- Modify: whichever skill files the run proves wrong

This is not a formality. Steps 1–7 encode guesses about what the model needs told; the only way to find the wrong ones is to run the thing. The spec is explicit that three entry points is enough to learn whether the shape is right, and the shape is what is expensive to change later.

- [ ] **Step 1: Install the plugin locally into a target repo**

`local` scope keeps a half-built workflow off colleagues' machines — it is gitignored, unlike `project`.

```bash
claude plugin marketplace add D:/Projects/ASMT-CC-plugin
```

Then in the target repo (the spec names `e-flow`; use a worktree so the pilot is isolated):

```bash
git worktree add ../e-flow-asmt -b pilot/asmt-plugin
cd ../e-flow-asmt
claude plugin install asmt@effectz --scope local
```

- [ ] **Step 2: Configure the target repo**

Copy `.asmt/config.yml` from this repo into the target and set `verify.command` to its real one (`pnpm turbo run lint check-types test` for a Turborepo). Add `.asmt/receipts/` to the target repo's `.gitignore` — this is not optional, see Task 1 Step 6.

Verify the gate works there before running a card:

```bash
asmt-gate run
asmt-gate check
git status --porcelain    # must be empty
```

- [ ] **Step 3: Run one genuinely small card end to end**

`/asmt:spec` → sign-off → write `tasks.md` by hand (there is no `/asmt:plan` yet; note how much that hurts) → `/asmt:build` → `/asmt:verify` → attempt `gh pr create`.

- [ ] **Step 4: Write down every place you had to explain something by hand**

`docs/dogfood-01.md`. Each item is a missing line in a skill. Record specifically:

- Where a skill under-triggered — the request that should have invoked it and did not. That is a description to make pushier.
- Where a skill over-reached — proceeded past a human gate, or did two tasks. That is wording to harden.
- Whether the `REQ-<n>.<m>` IDs actually survived into test names, or quietly got dropped.
- Whether the PR block fired, and whether its message told you what to do next.
- What `/asmt:plan`'s absence cost. That sizes the next plan.
- The always-on token cost from `claude plugin details asmt`.

- [ ] **Step 5: Fix what hurt, then commit**

Apply the skill edits the findings imply — `SKILL.md` changes take effect immediately, no reload needed. Re-run the affected part of the card to confirm.

```bash
tests/run-all
git add docs/dogfood-01.md plugins/asmt/skills
git commit -m "fix: tighten skill wording from first dogfood run"
```

- [ ] **Step 6: Decide the next plan's scope from the findings**

The remaining build-order steps are 7–11: subagent topology + the two review agents, the `ephemeral` and `code-then-test` variants, `/asmt:ship` `/asmt:land` `/asmt:status` + `asmt-state` + `asmt-metrics`, size-class handling, and CI + team rollout. `docs/dogfood-01.md` decides the order. If `/asmt:plan`'s absence dominated the findings, it comes first regardless of where the spec's build order puts it.

---

## Notes on what this plan deliberately does not do

- **No `agents/`.** Nothing in sequential topology dispatches a subagent. The `implementer`, `spec-compliance`, and `code-quality` agents arrive with `topology: subagent`, and they will use `isolation: worktree` rather than hand-rolled git worktree management. They cannot declare `hooks`, `mcpServers`, or `permissionMode`.
- **No `asmt-state` / `asmt-metrics` and no `SessionStart` / `SubagentStop` hooks.** The state file exists to serve `/asmt:status` and cross-session resume; neither is in this scope. Metrics are worth an afternoon *later* — the argument they win is a quarter away.
- **No size-class branching.** The config key is written in Task 2 Step 7 so the schema is stable, but no skill reads it except `/asmt:spec` step 4, which only collapses to a lite spec. Full gate-collapsing arrives with the review gates it would collapse.
- **No `references/ephemeral.md`, no `code-then-test`.** Both entry points stop with an explicit message when the config selects them, which is better than silently doing the wrong variant.
- **No CI.** `tests/run-all` is the thing a workflow will call; adding the workflow file before the test suite has stabilised just means editing it twice.
