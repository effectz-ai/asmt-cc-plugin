# Dogfood 01 — one real card through the ASMT plugin

Ran against this repo (`D:\Projects\ASMT-CC-plugin`, branch `v2`), not
`e-flow` — the target-repo substitution documented in task-8-brief.md's
override. `.asmt/config.yml` already existed with `verify.command:
tests/run-all` and `.asmt/receipts/` already gitignored, so Step 2 of the
brief was verification, not setup: `asmt-gate run`, `asmt-gate check`, and
`git status --porcelain` all confirmed clean before the card started.

The card, as handed to the agent (a symptom, not a solution): **`tests/run-all`
output is not pristine** — every fixture repo the suite creates prints git's
CRLF line-ending warning several times per run, and this machine has
`core.autocrlf=true` set globally (confirmed in the system-level gitconfig
at `C:/Users/Sano/scoop/apps/git/2.54.0/etc/gitconfig`).

## What was run, stage by stage

### `/asmt:spec` (`plugins/asmt/skills/spec/SKILL.md`)

Followed literally: read `.asmt/config.yml`, read `spec-grammar` +
`references/living.md` (config's `modes.artifacts: living`), read
`house-rules` (skeleton, left untouched per instructions). Root-caused the
symptom before drafting anything: every fixture repo traces to one call
site, `tests/fixtures.sh`'s `new_repo()`, which inherits the host's global
`core.autocrlf` at `git init` — so every later commit into a repo it hands
back (`test-asmt-gate`'s `new.txt`, its rewritten config fixtures) reprints
the warning too. Wrote `specs/changes/quiet-fixture-crlf/proposal.md` and
`spec.md` (`REQ-1.1`/`REQ-1.2`/`REQ-1.3`), presented both in sections, and
stopped at the sign-off gate — see "The gate that held," below.

Baseline measured before the fix: `tests/run-all` printed the CRLF warning
**24 times** in one run, all tests still passing.

### `tasks.md` (hand-written — no `/asmt:plan`)

Two tasks, invented format (see "What `/asmt:plan`'s absence cost").

### `/asmt:build` (`plugins/asmt/skills/build/SKILL.md`)

Task 1 (`REQ-1.1`, `REQ-1.2`): wrote `tests/test-fixture-crlf`, ran it,
watched it **fail** for the right reason —

    FAIL - REQ-1.1: new_repo() init/commit printed a CRLF warning
    FAIL - REQ-1.2: later commit into a fixture repo printed a CRLF warning

— then added one line to `new_repo()` in `tests/fixtures.sh`:

    git -C "$dir" config core.autocrlf false

Re-ran: both green. Full suite re-run: all tests passed, zero CRLF warnings
anywhere in the output. Committed (`9606bc6`).

Task 2 (`REQ-1.3`): added a third scenario that runs the real
`tests/run-all` end to end and greps its combined output — the stakeholder's
sign-off note explicitly asked for this, since `REQ-1.1`/`REQ-1.2` test the
helper in isolation and would stay green through a regression elsewhere.
Proved RED honestly: temporarily reverted the Task 1 fix, watched all three
scenarios fail (including `REQ-1.3`), restored the fix, watched all three
pass. Guarded the self-referential call (this test file is itself one of
`run-all`'s `test-*` files) with an `ASMT_SUITE_NESTED` env var so the nested
run still executes every other test file for real instead of skipping the
whole suite. Committed (`754a199`).

### `/asmt:verify` (`plugins/asmt/skills/verify/SKILL.md`)

`git status --porcelain` empty → `asmt-gate run` → full suite passed,
**zero** CRLF warnings in the combined output → receipt written at
`.asmt/receipts/754a199fc9adba119c3b076c144c33ea3b7d511a.json`:

    {"sha":"754a199...","result":"pass","command":"tests/run-all","at":"2026-08-06T16:31:15+05:30","seconds":20}

### PR-block attempt

No live Claude Code `PreToolUse` hook is wired into this execution context
(it ran as a plain Bash-tool session, not an interactive Claude Code session
with hooks configured) — so an actual `gh pr create` invocation would not
have been intercepted by anything, live or not, and testing it would have
proven nothing about the guard. Per the task's documented fallback, **piped
crafted `PreToolUse` payloads directly through `plugins/asmt/hooks/pretooluse-guard`**,
the same technique `tests/test-pretooluse-guard` uses:

    printf '{"tool_name":"Bash","tool_input":{"command":"gh pr create --fill"}}' \
      | CLAUDE_PLUGIN_ROOT=.../plugins/asmt plugins/asmt/hooks/pretooluse-guard

- With HEAD's receipt present: silent, exit 0 (allow).
- With HEAD's receipt temporarily removed (`.asmt/receipts/<sha>.json` moved
  aside, then restored — never committed, the dir is gitignored): denied,
  exit 0, structured JSON:

  > `asmt: blocked — HEAD has no passing verification receipt. Run
  > /asmt:verify (or asmt-gate run) and do not commit anything afterwards; a
  > new commit invalidates the receipt. Then retry the PR.`

**This is a real limitation of the dogfood, not just a note**: the guard's
logic was exercised directly and correctly denies/allows on the receipt
state, but whether Claude Code's live hook wiring actually invokes this
script on a real `gh pr create` tool call was not re-proven here — that
trust is inherited from `CHANGELOG.md`'s documented empirical finding
(against build 2.1.223) and from `tests/test-pretooluse-guard`, not from
this run.

## Findings

### The gate that held

`/asmt:spec` step 8 is the only step in any of the six skills phrased as an
unambiguous stop, and it held — the run paused exactly there and waited for
an actual reply. The specific sentence that did the work:

> "Stop there. Do not proceed to planning or building on your own — the
> sign-off is a human gate, and a gate you walk through yourself is not one."

Two properties make it work where softer language elsewhere doesn't: the
literal imperative ("Stop there") and the self-justifying clause ("a gate
you walk through yourself is not one") that pre-empts the rationalization a
model would otherwise reach for. Every future human gate (the review agents'
sign-offs, `/asmt:ship`, `/asmt:land`) should reuse this exact construction,
not a paraphrase of it.

### Where wording was ambiguous (not a hard stop, but read like one)

- `spec/SKILL.md` step 4 said "Confirm the size class **with the user**" —
  the same "with the user" phrasing step 7 uses for sign-off, but without
  step 8's "Stop there." I had to decide for myself whether step 4 was a
  second blocking wait or a stated assessment folded into the one sign-off
  the task authorized. I chose the latter (declared `standard`, moved on,
  and the stakeholder didn't object at sign-off) — but a differently-tuned
  model could just as easily have paused twice, or not paused at all.
  **Fixed**: step 4 now explicitly says it is not a second stop and that
  confirmation happens alongside sign-off.
- `spec/SKILL.md` step 5 ("Interview before writing... Ask about the cases
  the card does not mention") has the identical ambiguity — "ask" without
  "stop." I self-interviewed (reasoned through the card-doesn't-mention
  cases myself, using what `fixtures.sh` actually does, rather than pausing
  for a live back-and-forth) and folded the results into the proposal's
  non-goals. **Left unfixed** — a small card lets self-interview work, but a
  card with real ambiguity would need this distinguished from step 4 the
  same way. Worth revisiting once a bigger card is dogfooded.

### Commit-order gap (build step 4 → verify's dirty-tree refusal)

Confirmed twice: once when I hit it directly, once when the coordinator
named it explicitly after the session was interrupted and resumed. Nothing
in `spec/SKILL.md` or the original `build/SKILL.md` said to commit the
signed-off `proposal.md`/`spec.md`/`tasks.md` before building — but
`verify/SKILL.md` step 2 refuses a dirty tree by design, and `/asmt:build`
step 4 (original numbering) told the model to run `/asmt:verify` before
touching anything. Whoever runs this without noticing the refusal message
gets stuck asking a question the skill should have already answered.
**Fixed**: `build/SKILL.md` now has a step 4 that says explicitly: if spec
artifacts are still uncommitted, commit them now, before running verify.

### `REQ-<n>.<m>` IDs: survived, cleanly

All three landed literally in `tests/test-fixture-crlf`'s output strings —
`REQ-1.1: new_repo() init/commit prints no CRLF warning`,
`REQ-1.2: later commit into a fixture repo prints no CRLF warning`,
`REQ-1.3: full tests/run-all output contains no CRLF warning` — each
delimited correctly per `spec-grammar`'s ERE (no `REQ-1.10`-style collision
risk arose with only three low-numbered scenarios, but the IDs were written
with the delimiting rule in mind regardless). No dropped IDs, no drift
between spec and test names. `spec-grammar` and `tdd-loop` needed no edit
here — this is the one mechanism that worked exactly as specified on the
first try.

### `REQ-1.3`'s design needed a second pass the skills gave no guidance on

`tdd-loop` and `spec-grammar` say nothing about a test file that has to
invoke the suite it is itself a member of. Writing `REQ-1.3` (a scenario
that must run the real `tests/run-all` and inspect its real combined
output, per the stakeholder's explicit sign-off note) meant noticing —
before writing code, not after a hang — that `tests/test-fixture-crlf` is
itself one of `run-all`'s `test-*` files, so a naive re-invocation recurses
forever. Solved with a documented `ASMT_SUITE_NESTED` guard local to the one
test file. **Left unfixed as a skill edit** — this is narrow enough (one
meta-test, one card) that baking guidance into the shared `tdd-loop` skill
for every future card would be premature generalization from a sample of
one.

### What `/asmt:plan`'s absence cost

Concretely, three decisions a plan step would normally own, that fell to
the model instead:

1. **The task-breakdown format itself.** No template exists anywhere in the
   plugin. Invented one: one task per `tdd-loop` pass, each naming its
   `REQ-<n>.<m>` IDs, the test file, the code file, and (for task 2) a "care"
   note about the recursion risk. This worked for a 2-task card; nothing
   validates it would hold up for a card with real dependencies between
   tasks, size estimates, or an order that isn't simply "test infra fix,
   then its regression net."
2. **Task granularity.** Whether the whole card was one task or two was a
   judgment call made without any skill's input — `build/SKILL.md` only
   says "take exactly one task... not two," which enforces granularity
   once tasks exist but says nothing about how fine to cut them.
3. **The commit-order gap above.** A real `/asmt:plan` step would likely own
   "commit the signed-off spec artifacts" as its own explicit action before
   handing off to build, rather than leaving it to be discovered via
   `verify`'s dirty-tree refusal.

The cost on this card was small — maybe ten minutes of reasoning, no
wasted work — because the card was genuinely tiny and had no real
dependency structure. It will not stay small on a card with more than one
plausible task ordering, which is exactly what "sizes the next plan"
(brief, Step 6) is asking this document to answer.

### Always-on token cost

The plugin is **not installed** in this session — `claude plugin marketplace
add` / `claude plugin install` were never run here (`claude plugin details
asmt` returns `Plugin "asmt" not found. Run \`claude plugin list\`...`, and
`claude plugin list` shows only `caveman`, `code-review`, `ponytail`,
`superpowers` — all user-scope, none `asmt`). Measured what stays resident
instead: total bytes of all six `SKILL.md` frontmatter blocks (`name:` +
`description:`, the part loaded into every session regardless of whether a
skill ever triggers):

| Skill | Frontmatter bytes |
|---|---|
| `build` | 338 |
| `house-rules` | 433 |
| `spec-grammar` | 454 |
| `spec` | 408 |
| `tdd-loop` | 340 |
| `verify` | 436 |
| **Total** | **2,409** (~600 tokens at ~4 bytes/token) |

Full skill *bodies* total 19,980 bytes but load only on trigger, not
resident. ~600 tokens of always-on frontmatter for six skills is cheap; this
number should be re-measured via `claude plugin details asmt` once the
plugin is actually installed somewhere, since that command may report a
different (possibly more complete, possibly cheaper) figure than a manual
byte count.

### Hesitation, re-reads, and the resume

- Re-read `spec/SKILL.md` steps 4 and 8 side by side to work out whether
  step 4 was a stop — see "Where wording was ambiguous," above. This is the
  finding that produced the step-4 edit.
- Paused before writing `REQ-1.3`'s test to work through the self-reference
  recursion problem, rather than discovering it by hanging the suite. No
  skill flagged the risk; caught it by reading `tests/run-all`'s glob logic
  before writing the new test file.
- **The interruption and resume.** The session was cut off by an API error
  mid-build, after the spec artifacts were written but before they were
  committed. Re-establishing state was easy in this instance — `git log`
  and `git status --porcelain` gave an unambiguous answer (HEAD still at
  `5b0d62c`, `specs/` untracked) in two commands — but that was because I
  happened to check, not because any skill told a resumed session to check.
  Nothing here is `asmt-state` or cross-session resume (both explicitly out
  of this plan's scope per the brief's "Notes on what this plan deliberately
  does not do"), but this is direct evidence for why that item belongs in
  the next plan: a resumed session with no explicit "verify HEAD and
  `git status` before doing anything else" instruction is one bad guess away
  from double-committing or silently redoing work.
- **The stakeholder-is-the-dispatcher limitation.** The "sign-off" in this
  run came from the same agent that dispatched the dogfood task, who
  already knew the intended fix going in. A real sign-off gate gets tested
  by a stakeholder who might reject the size class, ask for a fourth
  scenario, or push back on the non-goals — none of which happened here
  because there was no independent party to do it. The gate's *mechanism*
  (stop, wait, don't proceed) is proven; its *judgment content* (does a real
  human actually catch a wrong scope through this gate) is not, and can't be
  from a single self-dispatched run.

## Skill edits made vs. left

**Made** (both re-verified: `tests/test-plugin-shape` still passes, both
files still 20–40 lines, full suite still green):

- `plugins/asmt/skills/build/SKILL.md` — new step 4: commit spec artifacts
  before running verify, since nothing before this point does and verify's
  gate refuses a dirty tree. Renumbered steps 5–10 accordingly.
- `plugins/asmt/skills/spec/SKILL.md` — step 4 (size class) now states
  explicitly it is not a second stop, confirmed instead alongside the
  sign-off in step 8.

**Left** (named above, with reasoning): the interview-step (step 5)
stop/no-stop ambiguity; the `REQ-1.3`-style self-referential-test guidance;
`asmt-state`/cross-session resume; re-measuring token cost via a real
`claude plugin details asmt` once installed.

## Recommendation for the next plan

**`/asmt:plan` first**, ahead of the brief's Steps 7–11 ordering. The
brief's own tie-breaker rule triggers: "If `/asmt:plan`'s absence dominated
the findings, it comes first regardless of where the spec's build order
puts it." On this card the absence was survivable only because the card was
trivial — one task, no real dependency structure, a commit-order question
resolvable by reading one error message. A card with two tasks that must
land in a specific order, or with a size estimate that matters, would make
every one of the three costs listed above (format, granularity, commit
ordering) actually hurt instead of costing ten minutes. The subagent
topology and review-gate work (Steps 7–8) depend on a stable task
representation to hand to a subagent in the first place; building that
before `/asmt:plan` exists means building it against an invented,
unvalidated format that `/asmt:plan` will likely have to redefine anyway.
