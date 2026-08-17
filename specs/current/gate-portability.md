# Capability: gate-portability

The gate runs on machines without GNU coreutils.

## REQ-1: The gate runs the verify command on a machine without GNU coreutils

Requirement: A missing timeout binary must not stand in for a verdict. The gate
resolves one, and when there is none it runs the command anyway and says so.

### REQ-1.1

Given no `timeout` and no `gtimeout` on PATH, when the gate runs, the verify
command is executed and its own exit status decides the receipt's result.

### REQ-1.2

Given no timeout binary is available and a `verify.timeout_seconds` is
configured, when the gate runs, it says on stderr that the run is unbounded —
a dropped timeout is a fact the operator needs, not a silent downgrade.

### REQ-1.3

Given `gtimeout` is present and `timeout` is not, when the gate runs with a
configured timeout, the timeout is enforced.

## REQ-2: The receipt records a timestamp on any POSIX date

Requirement: The receipt's timestamp must not depend on GNU date's `-I`.

### REQ-2.1

Given a `date` implementation without GNU's `-I` flag, when a receipt is
written, its `at` field is a non-empty UTC ISO-8601 timestamp.

Folded from `specs/changes/archive/mac-portability/` (signed off: sano,
2026-08-17). Requirement and scenario IDs are frozen as of that sign-off — see
`spec-grammar/references/living.md`.

Known limitation: REQ-1.3's resolution *order* is not exercised by the suite.
Proving it needs a machine without `timeout`, and on Cygwin a stripped PATH
prevents bash from loading its own DLLs. What is tested is that the resolved
binary is the one that runs and its verdict is honoured.
