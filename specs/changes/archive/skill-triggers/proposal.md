# Proposal: skill trigger tests

## Why

`docs/dogfood-01.md` records under-triggering as structurally untestable: the
run opened each skill by file path, so nothing ever competed for the model's
attention and no phrasing was ever tested. That conclusion was honest about the
method used, but wrong about the world — the harness supports it. A nested
`claude -p` session with `--output-format stream-json` reports every `Skill`
invocation, so "did this phrasing fire this skill?" is a question with a
mechanical answer.

This matters more here than in most plugins. Every entry point is prose whose
only job is to be *found*: a description that never fires is a skill that does
not exist, and one that fires too eagerly hijacks work it should leave alone.
Both failures are invisible from inside the repo. Nothing in `tests/run-all`
touches a description — `test-plugin-shape` checks a description is at least 60
characters long, which is a test that it exists, not that it works.

The dogfood also produced the phrasings worth testing. "Skip the spec, just
build it" is exactly the pressure a real card arrives under, and the moment a
description is weakest.

## What changes

A second test suite, deliberately outside the gate.

- **Prompt fixtures** — one file per case, holding the phrasing a user would
  actually type, grouped by the entry point it should or should not invoke.
- **A runner** — spawns one nested `claude -p` session per case against a
  throwaway project, reads the stream-json, and reports whether the expected
  skill fired.
- **Both directions** — cases that must fire, and cases that must not. A
  description tuned only for firing becomes greedy, and `/asmt:spec` claiming
  "fix this typo" is as broken as it never firing at all.

Decisions taken at interview:

- **It does not run in `tests/run-all`.** Every case costs wall-clock and real
  API tokens, and `tests/run-all` is what the gate executes on every
  `/asmt:verify`. Receipts stay cheap, offline, and fast. The cost is that
  nothing forces anyone to run this — accepted, because a gate that takes
  minutes and needs credentials is a gate people route around.
- **Four entry points only** — `/asmt:spec`, `/asmt:plan`, `/asmt:build`,
  `/asmt:verify`. Knowledge skills are read *by* other skills rather than
  invoked by a phrasing; testing them would test the wrong mechanism.
- **Isolated HOME.** Only the asmt plugin loads in the nested session. This
  tests whether a description *works*, not whether it *wins* against every
  other plugin installed on one developer's machine. Deterministic and
  reproducible, at the price of not reproducing real competition.
- **Missing or unauthenticated CLI skips rather than fails**, the way the
  attribution check already skips when the vendor clone is absent. A machine
  without credentials should not report red for something it cannot fix.
- **Flakiness is retried, then reported — never hidden.** Model behaviour is not
  deterministic, so a case can fail once and pass on the same prompt. A failing
  case is retried within a budget and passes if any attempt passes, but the
  report says it was flaky and how many attempts it took. Retrying only on
  failure keeps a clean pass at exactly one nested session; k-of-n on every case
  would multiply the API cost of the whole suite to learn nothing about the
  cases that already work. A description that needs three attempts is a weak
  description, and the report is where that shows up.

The runner is modelled on the upstream superpowers harness at
`tests/explicit-skill-requests/`, which solves the same problem. Anything
copied from it lands verbatim first and carries an `ATTRIBUTION.md` row, per
the porting policy.

## What this explicitly does not do

- **No change to the gate.** `tests/run-all` does not invoke this suite, and no
  receipt depends on it. The runner is deliberately not named `test-*`, since
  `run-all` globs that pattern.
- **No CI workflow.** Still deferred. This change produces the thing CI would
  eventually call, nothing more.
- **No trigger tests for `spec-grammar`, `task-grammar`, `tdd-loop`, or
  `house-rules`.** They are read on instruction from another skill, so a
  phrasing test says nothing about them.
- **No shellcheck.** Separate card — unrelated mechanism, different risk, and it
  belongs inside the gate where this suite does not.
- **It does not test what a skill does after it fires.** Whether `/asmt:spec`
  then interviews properly, or stops at sign-off, is out of scope; the dogfood
  covers that, and a nested three-turn session cannot.
- **No assertion about model, turn count, or token cost.** Interesting, and a
  different change.
- **No real-HOME competition run.** Considered and rejected: results would move
  whenever anyone installs a plugin, so red would stop meaning anything about
  our code.
- **It does not test installation.** The nested session uses `--plugin-dir`;
  whether `claude plugin install` wires things up correctly is a separate
  question.