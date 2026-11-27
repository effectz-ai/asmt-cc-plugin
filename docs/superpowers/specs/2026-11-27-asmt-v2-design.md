# ASMT v2: a Superpowers fork under ASMT names

Date: 2026-11-27. Status: draft, awaiting approval.

## Why

The deployed plugin produces too much: commits, tests, spec files, docs, and
code comments. Evidence from doc_highlight, the main consumer:

- 602 of 6,645 commits are "tick T-n" commits. Every task costs two commits
  (work, then tick). PC-100 (PR #1376) reached 54 commits, replanning its spec
  three times inside one PR.
- PC-101 (PR #1371, "reviewer can reject any line"): 56 lines of code, 590
  lines of tests, 304 lines of proposal/spec/tasks, 13 commits. Driven by the
  one-test-per-`REQ-n.m`-scenario rule and full-app test harnesses.
- 13–25% of added code lines are comments, many carrying ticket ids
  (`(PC-25b, PC-101)`): a changelog written into the code.
- `specs/changes/` holds 32 change folders; `specs/current/` was never
  created. The living-spec fold never happens, so specs only accumulate.
- Size classes: the team invented a fifth (`minimal`) and made it the default.
  Its gates (`self-review`, `model-review`) are not implemented anywhere.
  Classification became a per-card argument with no mechanism behind it.
- Every plan ends with a "docs for X" task editing `docs/petty-cash/*.md`.

Superpowers (MIT, obra/superpowers) does the same job with less output: a
design doc, a plan, subagent-driven TDD, and progress kept in a git-ignored
ledger instead of commits. The owner uses it personally and wants that
behaviour for the team, without the team learning new commands.

## Goals

- The team keeps typing `/asmt:*` commands.
- Underneath, the workflow is Superpowers': brainstorm a design, write a plan,
  build task by task with subagents, verify, review, land.
- No bookkeeping commits (no tick, plan, or progress commits). A task is one
  commit plus any fix commits its review loop produces.
- Test volume set per repo by config, default `focused`.
- Spec/plan files never accumulate in the repo unless the repo opts in.
- Keep the two mechanisms that worked: `asmt-gate` receipts and the PR-block
  hook.

## Non-goals

- Codex support (the old `codex-support` branch stays parked).
- Migrating doc_highlight's existing `specs/changes/` folders. They are left
  in place; the team deletes them by hand if wanted.
- Tracking upstream Superpowers automatically. Upstream fixes are merged by
  hand when someone chooses to.
- Landing the unmerged skill-triggers work on `feat/asmt-plan`, and the
  unsigned workflow-profiles spec on `feat/workflow-profiles`. Both are
  superseded; neither is a prerequisite.

## Anti-goals (a failure even if it works)

- Any per-card classification written into config or driving gates (size
  classes by another name). Config is per repo, read by skills, never argued
  per task. Superpowers' in-conversation sizing ("small change" vs "project")
  is kept: it is a judgement the developer sees and can overrule on the spot,
  with no config and no gates behind it.
- Commits whose only content is plan/progress bookkeeping.
- Comments that restate code or carry ticket ids.
- A team member needing Superpowers installed, or needing to learn its
  command names.

## Approaches considered

1. **Thin add-on requiring Superpowers.** Smallest. Rejected: the team does
   not use Superpowers, and its command names would replace `/asmt:*`.
2. **Fork Superpowers into ASMT, exposed under ASMT names.** Chosen. Full
   control of wording, familiar commands, no outside dependency. Cost: we
   maintain ~10 skills and merge upstream fixes by hand; the owner accepted
   that.
3. **Rewrite in Superpowers' style.** Most work, re-derives what Superpowers
   already does well, and is how the current bloat was produced.

## Design

### Command mapping

Forked from Superpowers 7.0.2 (the version in the owner's plugin cache). The
ASMT name is the skill directory name, so it is the `/asmt:<name>` command.

| ASMT skill | Forked from | Notes |
|---|---|---|
| `spec` | brainstorming | Drop the visual-companion server. Keep "Size the Work" (small change vs project) and the quick-task bypass. Design goes to the location `docs` selects (below). The developer in the session approves the design; no sign-off line, no second approver. |
| `plan` | writing-plans | Plan goes to `.asmt/work/<topic>/plan.md`. No "docs for X" task unless the design asks for doc changes. Test steps follow `tests` mode. Keeps the subagent-vs-inline execution question. |
| `build` | subagent-driven-development (+ its prompts, scripts, references) and executing-plans | Ledger at `.asmt/work/<topic>/progress.md`, git-ignored. No bookkeeping commits. Collects a "check by hand" list (below). |
| `tdd` | test-driven-development | Rewritten to be mode-aware (below). Replaces `tdd-loop`. |
| `verify` | verification-before-completion | Runs `asmt-gate run`; quotes its final line. Keeps today's dirty-tree rule. |
| `review` | requesting-code-review + receiving-code-review | Reviewer prompt adds: comment rule, test-mode overreach, bookkeeping commits. |
| `land` | finishing-a-development-branch | Only opens the PR (no local-merge option). PR body carries the "check by hand" list, and with `docs: pr` the design. Suggests squash merge. Then deletes `.asmt/work/<topic>/`. |
| `debug` | systematic-debugging | Verbatim apart from renames. |
| `worktrees` | using-git-worktrees | Verbatim apart from renames. |
| `parallel` | dispatching-parallel-agents | Verbatim apart from renames. |
| `house-rules` | (ours) | Adds the comment rule. Team sections stay as skeleton to fill. |
| `using-asmt` | using-superpowers | Injected by a SessionStart hook, as Superpowers does, so skills fire reliably. Trimmed to ASMT skill names. States that in a repo with `.asmt/config.yml`, ASMT skills take precedence over Superpowers' when both are installed. |

Not forked: diagnosing-superpowers, writing-skills.

### Config (`.asmt/config.yml`, version 2)

```yaml
version: 2

docs: pr          # pr   = design lives in .asmt/work/, pasted into the PR body at land
                  # repo = design committed to docs/asmt/specs/YYYY-MM-DD-<topic>.md
tests: focused    # strict | focused | light

verify:
  command: "npm test"
  timeout_seconds: 900
```

Removed: `modes`, `size_classes`, `default_size_class`, `paths`.

Per repo, not per developer, not per card. A missing `docs` or `tests` key
means its default (`pr`, `focused`). An unknown value: the skill stops and
says so. A `version: 1` config: the skill stops and prints what to change
(set `version: 2`, delete `modes`, `size_classes`, `default_size_class`,
`paths`). No migration shim. (Checked doc_highlight: no v1 change is
genuinely mid-build; three old changes each have one stale unticked task.)

### Test modes

| Mode | Gets a test |
|---|---|
| `strict` | Test-first for every behaviour change (Superpowers TDD as written). |
| `focused` | Test-first for business rules, bug fixes, and branching logic. UI wiring, glue, and config are checked by running the app. |
| `light` | Only regression tests for bug fixes, and money/security rules. |

Whatever the mode leaves untested is not left unverified. `build` records,
per task, a short "check by hand" item (what to click or run, what to see).
The developer who builds it runs that list before `land`; `land` writes it
into the PR body so the reviewer can repeat it. No `run:` config key; the
agent does not try to drive the app.

In every mode: one test per behaviour, at the cheapest level that proves it
(unit before route before end-to-end). No file-per-scenario. No `REQ-n.m`
ids in test names. Test-first still applies to whatever the mode says gets a
test.

### Comment rule (in `house-rules`, checked by `review`)

A comment says *why*, only when the code cannot. Never restate the code,
never carry a ticket id or change history (that is what git and the PR are
for).

### Ephemeral work folder

`.asmt/work/<topic>/` holds `design.md` (when `docs: pr`), `plan.md`, and
`progress.md`. Git-ignored. `land` deletes it after the PR opens. Losing it
mid-build (machine wipe, `git clean -fdx`) is recovered from `git log`, as
Superpowers' ledger is.

`<topic>` is `YYYY-MM-DD-<kebab-topic>`. The folder lives in the main
checkout, never inside a git worktree (it is git-ignored, so a worktree would
not see it); every skill resolves it from the main checkout's root. Since
every plan is named `plan.md`, the forked `sdd-workspace` script keys the
ledger by the topic folder, not the plan's basename.

### Kept as-is

- `bin/asmt-gate` (still reads only `verify.command` / `timeout_seconds`).
- `hooks/pretooluse-guard` and `hooks/run-hook.cmd`.
- `tests/test-asmt-gate`, `tests/test-pretooluse-guard`,
  `tests/test-fixture-crlf`, `tests/fixtures.sh`, `tests/run-all`.

### Removed

- Skills: `spec-grammar`, `task-grammar`, `tdd-loop`, and the current `spec`,
  `plan`, `build`, `verify` (replaced by forks).
- `bin/asmt-plan` and `tests/test-asmt-plan`.
- This repo's own `specs/` tree. It documents the removed workflow; git
  history keeps it.

### Attribution

Forked files are ported verbatim in one commit and adapted in the next, as
`ATTRIBUTION.md` already requires, with a row per file and the upstream SHA
in `vendor/UPSTREAM_SHAS`. NOTICE drops the OpenSpec paragraph.

### This repo

`.asmt/config.yml` moves to version 2 (`docs: repo`, `tests: focused`) so the
plugin dogfoods itself. `.asmt/work/` is git-ignored. README and
`plugin.json` describe the new commands and config.

## Left to the builder

- Exact wording edits inside each forked skill beyond the renames and the
  changes listed above.
- Whether `tests/test-plugin-shape` needs new assertions for the new skill
  set and SessionStart hook.
- The upstream SHA to pin (resolve 7.0.2's commit).
