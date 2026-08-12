Signed off: sano, 2026-08-06

# Spec: quiet-fixture-crlf

Capability: test-fixtures. No living spec exists yet for this capability, so
numbering starts at `REQ-1`.

## ADDED REQ-1: Fixture repos created by the test suite do not emit git
line-ending warnings

Requirement: On a host with `core.autocrlf=true` set globally, no fixture
repo created through `tests/fixtures.sh`'s `new_repo()` prints a "will be
replaced by CRLF" warning during suite setup or during any subsequent commit
the suite makes into that repo.

### REQ-1.1

Given a host with `core.autocrlf=true` set globally, when `new_repo()`
creates a fixture repo and commits its initial `.asmt/config.yml` and
`.gitignore`, then the `git init`/`git add`/`git commit` sequence prints no
line-ending warning on stderr.

### REQ-1.2

Given a fixture repo already created by `new_repo()`, when a test adds and
commits an additional file into that same repo (as `test-asmt-gate` does
with `new.txt`, `uncommitted.txt`, and rewritten `.asmt/config.yml`
fixtures), then that commit also prints no line-ending warning.

### REQ-1.3

Given a host with `core.autocrlf=true` set globally, when `tests/run-all`
executes the full suite, then the suite's combined stdout+stderr contains
zero occurrences of the string `will be replaced by CRLF`.
