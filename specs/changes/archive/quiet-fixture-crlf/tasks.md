# Tasks: quiet-fixture-crlf

Written by hand — there is no `/asmt:plan` yet. Format invented for this
card: one task per unit of test-then-code the build should do in one
`tdd-loop` pass, in order, each naming the requirement(s) it proves and the
files it expects to touch.

## Task 1 — silence the warning at its one call site, prove REQ-1.1 and REQ-1.2

Requirements: REQ-1.1, REQ-1.2

`new_repo()` in `tests/fixtures.sh` inherits the host's global
`core.autocrlf` at `git init`. Root-cause fix: set `core.autocrlf false` on
the fixture repo itself, right after `git init`, before any file is written
or committed. That one line covers both scenarios, since every commit that
happens later in the same fixture repo — inside `new_repo()` and in the
tests that commit additional files into a repo `new_repo()` handed back —
runs against a repo where the config is already off.

- Test file: `tests/test-fixture-crlf` (new)
- Code file: `tests/fixtures.sh` (`new_repo()`)
- Proves: REQ-1.1 (no warning on `new_repo()`'s own init/commit), REQ-1.2 (no
  warning on a later commit into that same repo)

## Task 2 — prove REQ-1.3 against the real full-suite output

Requirements: REQ-1.3

REQ-1.1 and REQ-1.2 test the helper in isolation — they'd stay green even if
some other path started leaking the warning back in, or if `run-all` changed
how it invokes tests. REQ-1.3 is the regression net: it runs the actual
`tests/run-all` end to end and greps its real combined output, so a revert
of the Task 1 fix (or a new fixture-creation path that bypasses
`new_repo()`) still gets caught.

- Test file: `tests/test-fixture-crlf` (same file, new scenario)
- Code file: none expected — this task should already be green from Task 1's
  fix; if it is not, Task 1 was incomplete
- Proves: REQ-1.3 (zero `will be replaced by CRLF` occurrences in a full
  `tests/run-all` run)
- Care: this test file is itself one of `run-all`'s `test-*` files, so
  invoking `run-all` from inside it recurses. Needs an explicit guard
  (documented at the guard) so the nested run executes every other test for
  real — this has to still be the actual suite's output — while not calling
  `run-all` a second time from inside itself.
