# Tasks: skill trigger tests

Loop: `tdd` — every task is one red-green-commit cycle, and every test name
carries the id of the scenario it proves.

Shape decided while planning. The suite has two halves, and only one of them
may cost money:

- **`tests/run-triggers`** — orchestration. Spawns nested sessions. Deliberately
  not named `test-*`, so `tests/run-all` never globs it (REQ-4.1).
- **`tests/test-trigger-runner`** — unit tests for that orchestration, offline
  and free, so the gate still covers the logic. Named `test-*` on purpose.

That works because of one seam: the runner takes its attempt command from
`ASMT_TRIGGER_CMD`, defaulting to the real `claude` invocation. Tests inject a
fake that can fail on demand, record the environment it was handed, and emit a
canned stream-json log. Without that seam, retry, isolation, and skip behaviour
could only be tested by spending tokens — which is the thing this change exists
to keep out of the gate.

The judge is a mode of the same script (`run-triggers --judge <log> <skill>
<expectation>`) rather than a second file, so the tests exercise the code that
actually runs, not a copy of it.

---

## T-1: the judge — decide a case from a captured session log

- [x] Complete

Satisfies: REQ-2.2, REQ-6.2

Given a stream-json log and an expectation, decide whether the named skill was
invoked. A `should-fire` case passes when it was; a `should-not-fire` case
passes when it was not, **even if some other skill fired**. Report the skills
that actually fired, including none. Fixture logs live beside the test — no
nested session runs here.

## T-2: case discovery and the prompt fixtures

- [x] Complete

Satisfies: REQ-1.1, REQ-1.2, REQ-1.3, REQ-2.1

Write the fixtures — for each of `spec`, `plan`, `build`, `verify`, a
situational phrasing that never names the skill, a phrasing that names it
directly, a phrasing that pressures against process ("skip the ceremony, just
build it"), and a case the skill must not claim. Discovery derives the
expectation from the directory, so the fixture's location *is* its assertion.
Test discovery offline: the right number of cases, each with the right skill and
expectation.

## T-3: isolation — a nested session touches nothing it shouldn't

- [x] Complete

Satisfies: REQ-3.1, REQ-3.2, REQ-3.3

Every attempt runs with a HOME containing no plugin but ours, and a throwaway
working directory. Assert via the injected fake, which records the environment
and cwd it was called with. Then assert the whole-suite property directly:
`git status --porcelain` in this repo is unchanged after a full run. These
sessions run with permissions skipped, so this is the task that keeps them
harmless.

## T-4: outside the gate, and its own front door

- [x] Complete

Satisfies: REQ-4.1, REQ-4.2

Assert `tests/run-all` spawns no nested session — no `test-*` file invokes the
runner, and run-all's runtime is unchanged. Assert `tests/run-triggers` runs
every case and exits non-zero when any case fails.

## T-5: absent tooling skips rather than fails

- [x] Complete

Satisfies: REQ-5.1, REQ-5.2

No `claude` on PATH: report a skip naming the reason, exit zero. A session that
cannot authenticate: skip that case, not fail it. Detecting auth failure from a
CLI that promises nothing about its error shapes is the risky half — if it
cannot be done reliably, narrow it to what is detectable and say so in the
report rather than pretending.

## T-6: a failure can be diagnosed without re-running it

- [x] Complete

Satisfies: REQ-6.1

Keep each attempt's captured output, and name the path in the failure report.

## T-7: flakiness is retried, then reported

- [x] Complete

Satisfies: REQ-7.1, REQ-7.2, REQ-7.3

Retry a failing case within a budget; pass if any attempt passes, but report it
as flaky with the attempt count. Fail the suite only when every attempt failed.
A first-attempt pass spawns exactly one session — the fake counts invocations,
so that is asserted rather than assumed.

## T-8: run the real suite once and record what it says

- [x] Complete

Satisfies: none

Everything above is proved against a fake. This is the task that finds out
whether the descriptions actually fire. Run `tests/run-triggers` for real,
record the results in `docs/dogfood-01.md` beside the under-triggering
limitation it retires, and fix any description the run proves weak — that fix
is the entire point of building this.
