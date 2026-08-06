# asmt-cc-plugin - Bootstrap Guide

Building the in-house AI-dev workflow plugin as its own project.

---

## 0. Yes - a new project. Here's exactly what lives where

Three separate things, and confusing them is the main way this goes wrong:

| Repo | What's in it | Who edits it |
|---|---|---|
| **`asmt-cc-plugin`** (new) | The marketplace manifest + the plugin itself: skills, agents, hooks, scripts | You / the tooling owner |
| **`e-flow`** (existing) | `.asmt/config.yml`, `.claude/settings.json` entry, and the per-change spec artifacts the workflow produces | Every dev, via the workflow |
| **`~/.claude/`** | Nothing you author. Just where Claude Code caches installed plugins | Nobody |

Ignore the `claude plugin init` shortcut I mentioned earlier - it scaffolds into `~/.claude/skills/` for quick throwaway experiments. You're building a versioned team artifact, so start in a git repo and test it with `--plugin-dir`.

**Why a separate repo and not a folder in e-flow:** the plugin needs to be installable into *any* repo (e-flow, the supply-chain work, the petty-cash project). Version it independently, tag it, and let target repos consume it. Putting it inside e-flow makes e-flow's git history the plugin's release channel, which you'll regret the first time another project wants it.

---

## 1. Target layout

```
asmt-cc-plugin/
├── .claude-plugin/
│   └── marketplace.json          # makes this repo an installable marketplace
├── plugins/
│   └── asmt/                     # the plugin. name "asmt" → /asmt:* namespacing
│       ├── .claude-plugin/
│       │   └── plugin.json
│       ├── skills/
│       │   ├── start/SKILL.md          ── entry points (thin)
│       │   ├── spec/SKILL.md
│       │   ├── plan/SKILL.md
│       │   ├── build/SKILL.md
│       │   ├── verify/SKILL.md
│       │   ├── review/SKILL.md
│       │   ├── ship/SKILL.md
│       │   ├── land/SKILL.md
│       │   ├── status/SKILL.md
│       │   ├── spec-grammar/            ── knowledge (fat)
│       │   │   ├── SKILL.md
│       │   │   └── references/{living.md,ephemeral.md}
│       │   ├── tdd-loop/SKILL.md
│       │   ├── review-rubric/SKILL.md
│       │   ├── task-granularity/SKILL.md
│       │   └── house-rules/SKILL.md
│       ├── agents/
│       │   ├── implementer.md
│       │   ├── spec-compliance.md
│       │   └── code-quality.md
│       ├── hooks/
│       │   └── hooks.json
│       ├── bin/                    # on PATH as bare commands when plugin is enabled
│       │   ├── asmt-gate
│       │   ├── asmt-state
│       │   └── asmt-metrics
│       ├── scripts/
│       │   └── pretooluse-guard.sh
│       ├── settings.json
│       ├── LICENSE
│       ├── NOTICE
│       ├── ATTRIBUTION.md
│       └── CHANGELOG.md
├── vendor/upstream/               # pinned upstream clones - dev-time only
│   ├── superpowers/
│   └── openspec/
├── tests/
├── scripts/diff-upstream.sh
├── docs/
├── .github/workflows/validate.yml
└── README.md
```

Two structural rules from the plugin reference:

- **Only `plugin.json` goes inside `.claude-plugin/`.** Everything else (`skills/`, `agents/`, `hooks/`, `bin/`) sits at the plugin root. Putting components inside `.claude-plugin/` is the #1 cause of "plugin loads but nothing shows up".
- **`vendor/` sits outside the plugin dir on purpose.** Installed plugins can't reference files outside their own directory, so vendored upstream code can never be loaded at runtime - which is what you want. It's reference material for you and for diffing.

---

## 2. Phase 1 - create the repo

```bash
mkdir asmt-cc-plugin && cd asmt-cc-plugin
git init -b main

mkdir -p .claude-plugin \
         plugins/asmt/{.claude-plugin,skills,agents,hooks,bin,scripts} \
         vendor/upstream tests docs scripts .github/workflows

# vendor upstream, pinned - do NOT keep these as live submodules you auto-update
git clone --depth 50 https://github.com/obra/superpowers vendor/upstream/superpowers
git clone --depth 50 https://github.com/Fission-AI/OpenSpec vendor/upstream/openspec

# record the exact SHAs you ported from
{
  echo "superpowers $(git -C vendor/upstream/superpowers rev-parse HEAD)"
  echo "openspec    $(git -C vendor/upstream/openspec rev-parse HEAD)"
} > vendor/UPSTREAM_SHAS

cat > .gitignore <<'EOF'
vendor/upstream/
node_modules/
.DS_Store
EOF

git add -A && git commit -m "chore: scaffold plugin repo"
```

Gitignoring `vendor/upstream/` keeps the repo small; `vendor/UPSTREAM_SHAS` + a re-clone script preserves reproducibility. Anyone can restore the exact upstream state you ported from.

---

## 3. Phase 2 - manifests

**`.claude-plugin/marketplace.json`** - turns the repo into something the team installs by name:

```json
{
  "name": "effectz",
  "owner": { "name": "Effectz.AI Platform", "email": "dev@effectz.ai" },
  "plugins": [
    { "name": "asmt", "source": "./plugins/asmt" }
  ]
}
```

**`plugins/asmt/.claude-plugin/plugin.json`**:

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

**Deliberately no `version` field.** With `version` unset, Claude Code falls back to the git commit SHA, so every push is a new version and the team picks up changes automatically. If you set an explicit version you must bump it by hand every single time or `/plugin update` reports "already at the latest version" and silently serves stale cache. Add semver later, when the thing has stopped changing weekly.

Name `asmt` is what gives you `/asmt:spec`, `/asmt:build`, and agents as `asmt:implementer` - namespacing is automatic from the plugin name, so don't build your own prefix scheme.

**`plugins/asmt/settings.json`** - defaults applied when the plugin is enabled (only `agent` and `subagentStatusLine` keys are supported here):

```json
{
  "subagentStatusLine": "asmt · {{agent}} · {{status}}"
}
```

**Licensing files.** Both upstreams are MIT, so you may copy freely provided the copyright notice and permission text travel with it. Keep your own `LICENSE`, add a `NOTICE` naming both projects, and an `ATTRIBUTION.md` with one row per ported file:

```markdown
| our file | upstream | upstream path | upstream SHA |
|---|---|---|---|
| skills/tdd-loop/SKILL.md | superpowers (MIT) | skills/test-driven-development/SKILL.md | a1b2c3d |
```

That table is what makes `diff-upstream.sh` possible, and it's what makes the legal position obvious if anyone ever asks.

---

## 4. Phase 3 - the config schema

Lives in the **target** repo (e-flow), not the plugin. `.asmt/config.yml`:

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
  command: "pnpm turbo run lint check-types test"
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

`size_classes` is the piece that keeps the workflow alive. Thirteen steps and three human gates on a copy change is how a process gets abandoned in week three.

---

## 5. Phase 4 - skills: the two-tier split

This is the core architectural decision. Two kinds of skill, and mixing them is what makes these systems bloat.

**Entry points** (`skills/spec/`, `skills/build/`, …) are thin - 20–40 lines. They read config, decide which knowledge to load, and produce artifacts. They exist to be invoked as `/asmt:spec`.

**Knowledge skills** (`skills/tdd-loop/`, `skills/review-rubric/`, …) are fat and hold the actual methodology. This is where vendored Superpowers content lands.

Why it matters: skills load in three levels - name+description always in context, SKILL.md body when triggered, `references/` only when explicitly read. Keeping methodology out of entry points means a session pays for nine short descriptions, not nine essays. Check the real number with `claude plugin details asmt`, which reports always-on vs on-invoke token cost per component.

**Mode variants go in `references/`, not in `if` statements.** A knowledge skill picks its reference file by config:

```
skills/spec-grammar/
├── SKILL.md                  # requirement/scenario grammar, common to both
└── references/
    ├── living.md             # delta specs + archive-into-current (OpenSpec-ish)
    └── ephemeral.md          # single design doc, discard on merge (Superpowers-ish)
```

**Entry-point template** - `skills/spec/SKILL.md`:

```markdown
---
name: spec
description: Turn a card into a reviewed specification before any code is written. Use this whenever starting work on a new card, ticket, issue, or feature request, or when the user says they want to spec, scope, or propose something - even if they don't say "spec".
---

# Spec a change

1. Read `.asmt/config.yml`. If missing, stop and tell the user to run `/asmt:start`.
2. Read the `spec-grammar` skill. Then read whichever of its
   `references/` files matches `modes.artifacts`.
3. Read the `house-rules` skill.
4. Confirm the size class with the user. If `chore`, produce the lite
   spec only and stop.
5. Interview the user before writing. Do not infer requirements from
   the card title - ask about the cases the card doesn't mention.
6. Write artifacts to `<paths.changes>/<change-id>/`:
   - `proposal.md` - why, what changes, what explicitly does not
   - `spec.md` - requirements as scenarios, each independently testable
7. Run `asmt-state set stage=spec-review`.
8. Present the spec in sections short enough to actually read, and ask
   the card creator for sign-off. Do not proceed to `/asmt:plan` yourself.
```

Note the description style: descriptions are the whole triggering mechanism, and models tend to *under*-trigger skills. Write them a little pushy - list the phrasings a dev would actually use, including the ones that don't contain the skill's name. Keep each SKILL.md body under ~500 lines; past that, split into `references/` with clear pointers on when to read each.

**The one link that makes both modes coherent:** in `spec-grammar`, require every scenario to carry a stable ID, and in `tdd-loop`, require every test name to reference one. That gives you spec→test traceability, which is the difference between a verification gate that means something and one that just confirms the agent's tests pass its own code.

---

## 6. Phase 5 - agents

Plugin agents support `name`, `description`, `model`, `effort`, `maxTurns`, `tools`, `disallowedTools`, `skills`, `memory`, `background`, and `isolation` - where `"worktree"` is the only valid isolation value. So your subagent topology is declarative; don't hand-roll git worktree management.

`agents/implementer.md`:

```markdown
---
name: implementer
description: Implements exactly one task from an approved plan, with tests. Invoked by /asmt:build when topology is subagent.
model: sonnet
effort: medium
maxTurns: 40
isolation: worktree
skills: [tdd-loop, house-rules]
---

You implement exactly one task from tasks.md. Not two. Not "while I was here".

Before starting: confirm the test suite is green. If it isn't, stop and report.

Follow the tdd-loop skill without exception: write the failing test, run
it, watch it fail, write the minimum code to pass, run it, watch it pass,
commit. Code written before its test gets deleted, not retrofitted.

Report back: the task ID, files touched, test names added, and anything
you noticed but did not fix. Never report success without pasting the
actual test output.
```

`agents/spec-compliance.md` and `agents/code-quality.md` are the two-stage review - the first asks only "does this do what the spec said", the second only "is this good code". Separating them is what stops a reviewer from waving through a well-written implementation of the wrong thing.

Two constraints to know: plugin-shipped agents **cannot** declare `hooks`, `mcpServers`, or `permissionMode` (blocked for security), and they appear in @-mention as `asmt:implementer`.

---

## 7. Phase 6 - `bin/`: where determinism lives

Files in `bin/` are added to the Bash tool's PATH and callable as bare commands while the plugin is enabled. Anything that must be *true* rather than *claimed* goes here.

`bin/asmt-gate`:

```bash
#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
SHA="$(git -C "$ROOT" rev-parse HEAD)"
RECEIPTS="$ROOT/.asmt/receipts"
RECEIPT="$RECEIPTS/$SHA.json"
CMD="$(grep -A2 '^verify:' "$ROOT/.asmt/config.yml" | grep 'command:' | sed 's/.*command: *//' | tr -d '"')"

case "${1:-run}" in
  run)
    mkdir -p "$RECEIPTS"
    if [[ -n "$(git -C "$ROOT" status --porcelain)" ]]; then
      echo "asmt-gate: working tree dirty - commit before gating." >&2
      exit 1
    fi
    START=$(date +%s)
    if (cd "$ROOT" && eval "$CMD"); then RESULT=pass; else RESULT=fail; fi
    printf '{"sha":"%s","result":"%s","command":"%s","at":"%s","seconds":%s}\n' \
      "$SHA" "$RESULT" "$CMD" "$(date -Iseconds)" "$(( $(date +%s) - START ))" > "$RECEIPT"
    [[ "$RESULT" == pass ]] || { echo "asmt-gate: FAILED" >&2; exit 1; }
    echo "asmt-gate: pass ($SHA)"
    ;;
  check)
    [[ -f "$RECEIPT" ]] || { echo "asmt-gate: no receipt for HEAD $SHA. Run asmt-gate." >&2; exit 1; }
    grep -q '"result":"pass"' "$RECEIPT" || { echo "asmt-gate: last run failed." >&2; exit 1; }
    ;;
esac
```

`chmod +x bin/*` - a non-executable hook script is a silent failure.

The receipt is keyed to the commit SHA, so it cannot be reused after another commit. That's the whole trick: the gate becomes a fact about a specific tree, not a claim in a transcript.

`asmt-state` manages `.asmt/state.json` (current change, stage, size class) so `/asmt:status` and cross-session resume work. `asmt-metrics` appends one line per event to a JSONL log - cost, wall-clock, gate failures before green, review findings by severity, human gate turnaround. That log is how you win the argument with the CTO in a quarter, and it costs you an afternoon.

---

## 8. Phase 7 - hooks

`hooks/hooks.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          { "type": "command", "command": "\"${CLAUDE_PLUGIN_ROOT}\"/scripts/pretooluse-guard.sh" }
        ]
      }
    ],
    "SessionStart": [
      {
        "hooks": [
          { "type": "command", "command": "\"${CLAUDE_PLUGIN_ROOT}\"/bin/asmt-state banner" }
        ]
      }
    ],
    "SubagentStop": [
      {
        "hooks": [
          { "type": "command", "command": "\"${CLAUDE_PLUGIN_ROOT}\"/bin/asmt-metrics subagent" }
        ]
      }
    ]
  }
}
```

`scripts/pretooluse-guard.sh` reads the tool-call JSON on stdin, and if the command contains `gh pr create`, runs `asmt-gate check` and blocks on failure. **Verify the current blocking convention against the hooks reference before you rely on it** - exit code 2 has long been the blocking signal with stderr fed back to the model, but there's also a structured JSON form for `PreToolUse` decisions, and you want the one the installed Claude Code version actually honours. Test it deliberately: try to open a PR on a dirty tree and confirm you're stopped.

Other events worth knowing about: `PostToolUse`, `PostToolUseFailure`, `TaskCompleted`, `PreCompact`/`PostCompact`, `WorktreeCreate`/`WorktreeRemove`. Hook *types* include `prompt` (evaluate a prompt with an LLM) and `agent` (run an agentic verifier with tools) - which means your model code review can be a hook rather than a GitHub Action, if you'd rather keep it in-harness.

---

## 9. Phase 8 - the dev loop

```bash
# load the plugin from disk for this session only
claude --plugin-dir ./plugins/asmt

# is it actually loading? what registered?
claude --debug

# schema + frontmatter check, warnings as errors
claude plugin validate ./plugins/asmt --strict

# token budget per component
claude plugin details asmt
```

**The single most time-wasting gotcha:** edits to a `SKILL.md` take effect immediately in the running session, but changes to `hooks/`, `agents/`, `.mcp.json`, and `output-styles/` do **not**. Run `/reload-plugins` or restart. You will otherwise spend an hour debugging a hook that was fine.

**Second gotcha:** a `CLAUDE.md` at the plugin root is *not* loaded as project context. Plugins contribute context through skills, agents, and hooks only. Your house rules must be a skill (`skills/house-rules/`), not a CLAUDE.md.

**Third:** don't write state into `${CLAUDE_PLUGIN_ROOT}` - it changes on every update. Project state belongs in the target repo's `.asmt/`; anything the plugin itself needs to persist goes in `${CLAUDE_PLUGIN_DATA}`, which survives updates.

---

## 10. Phase 9 - porting policy

Rename to your vocabulary, but keep a mechanical link home:

```bash
# scripts/diff-upstream.sh
# for each row in ATTRIBUTION.md, diff our file against the pinned upstream version
```

Do the renames as a *separate commit* from the port. Commit the file verbatim first, then rename in the next commit. Your git history then shows exactly what you changed versus what you inherited, which is the difference between "we can pull their improvements" and "we forked and now we're on our own".

What's worth porting more or less as-is: `writing-plans` (task granularity - bite-sized tasks with exact file paths), `subagent-driven-development` (the two-stage review), `test-driven-development`, `systematic-debugging`, `verification-before-completion`. Those encode a lot of expensive trial-and-error.

What to write yourself: the size classes, the gate receipt, `house-rules` (your Turborepo/Zod contracts-first conventions), the card-tool linkage, and the metrics.

---

## 11. Phase 10 - dogfood

```bash
cd ~/work/e-flow
git worktree add ../e-flow-asmt -b pilot/asmt-plugin
cd ../e-flow-asmt

claude plugin marketplace add ~/work/asmt-cc-plugin
claude plugin install asmt@effectz --scope local     # local = just you, gitignored
```

`local` scope keeps a half-built workflow off your colleagues' machines. Then run one real card end to end - a genuinely small one - and note every place you had to explain something to the agent by hand. Each of those is a missing line in a skill.

Do this before building all nine entry points. Three (`spec`, `build`, `verify`) is enough to learn whether the shape is right, and the shape is what's expensive to change.

---

## 12. Phase 11 - team rollout

```bash
# each dev, once
claude plugin marketplace add effectz-ai/asmt-cc-plugin
claude plugin install asmt@effectz --scope project
```

`--scope project` writes to `.claude/settings.json`, so it's committed and reaches everyone who clones. Combined with the no-`version` choice, every dev tracks main automatically.

When it stabilises: add `"version": "1.0.0"`, tag with `claude plugin tag --push`, and switch to deliberate releases. Not before - during the messy phase you want zero friction between a fix and everyone having it.

---

## 13. Phase 12 - CI for the plugin repo

`.github/workflows/validate.yml`: run `claude plugin validate ./plugins/asmt --strict`, `shellcheck bin/* scripts/*`, and confirm every `ATTRIBUTION.md` row points at a file that exists. Cheap, and it catches the manifest typo that would otherwise silently disable a component for the whole team.

---

## 14. Build order

Resist building all nine skills first. The order that surfaces problems earliest:

1. Repo + manifests + `--plugin-dir` loads clean under `--debug`
2. `bin/asmt-gate` + `/asmt:verify` - the deterministic core, before any prose
3. The `PreToolUse` block, tested by deliberately trying to bypass it
4. `spec-grammar` + `/asmt:spec` in one mode only (`living`)
5. `tdd-loop` + `/asmt:build` sequential only
6. **Run a real card.** Fix what hurt.
7. `subagent` topology + the two review agents
8. `ephemeral` artifacts variant, `code-then-test` variant
9. `/asmt:ship`, `/asmt:land`, `/asmt:status`, metrics
10. Size classes + fast lane
11. CI, team rollout

Steps 1–6 are maybe a week of evenings. Everything after is incremental and safe to ship in pieces.

---

## 15. Kickoff prompt

In the plugin repo, in Claude Code:

```
Read vendor/upstream/superpowers/skills/ and vendor/upstream/openspec/.

We're building a Claude Code plugin at plugins/asmt/ that merges both into
one workflow with three independent switches read from .asmt/config.yml in
the target repo:
  artifacts: living | ephemeral
  loop:      tdd | code-then-test     (default tdd)
  topology:  sequential | subagent

Architecture rules:
- Thin entry-point skills (start/spec/plan/build/verify/review/ship/land/
  status) that read config and delegate to fat knowledge skills.
- Mode variants live in references/ files selected by config, never in
  branching prose.
- All verification logic in bin/asmt-gate as a real script. Never a prose
  instruction the model can claim to have followed.
- Agents use isolation: worktree. Don't hand-roll git worktrees.
- Port upstream files verbatim first, rename in a separate commit, record
  every port in ATTRIBUTION.md with upstream path + SHA. Keep MIT notices.

Start with milestone 2 only: bin/asmt-gate, skills/verify, and the
PreToolUse guard that blocks `gh pr create` without a fresh gate receipt
for HEAD. Propose the receipt format before writing code. Don't touch the
spec or build skills yet.
```

Constraining the first session to one milestone is deliberate. An agent given "build the whole plugin" will produce nine plausible skills you then have to read carefully, which is more work than writing three yourself.

---

## 16. Checklist of things that will bite you

- [ ] Components at plugin root, only `plugin.json` inside `.claude-plugin/`
- [ ] `chmod +x bin/* scripts/*`
- [ ] `/reload-plugins` after touching hooks, agents, or `.mcp.json`
- [ ] Plugin-root `CLAUDE.md` is ignored - house rules must be a skill
- [ ] No `version` in `plugin.json` while iterating
- [ ] All manifest paths relative, starting with `./`
- [ ] No state written to `${CLAUDE_PLUGIN_ROOT}`
- [ ] Plugin agents can't declare `hooks`, `mcpServers`, or `permissionMode`
- [ ] Gate receipt keyed to commit SHA, unusable after a new commit
- [ ] `claude plugin details asmt` run after each batch of skills, to watch the always-on token cost
