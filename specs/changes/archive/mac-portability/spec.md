Signed off: sano, 2026-08-17 (chore hotfix, approved in session with the failing macOS output attached)

# Spec: gate portability

Size class: `chore` — lite spec, requirements only, no proposal, `verify` the
only gate.

Capability: `gate-portability`. New capability — numbering starts at `REQ-1`.

Observed on macOS 2026-08-17:

    asmt-gate: line 52: timeout: command not found
    asmt-gate: FAILED — receipt .asmt/receipts/dadbb2c9….json
    {"result":"fail","seconds":0}

The verify command never ran. `timeout` is GNU coreutils and macOS does not
ship it. The gate failed closed rather than open — a false `fail`, never a
false `pass` — so no receipt ever certified an unverified tree.

## ADDED REQ-1: The gate runs the verify command on a machine without GNU coreutils

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

## ADDED REQ-2: The receipt records a timestamp on any POSIX date

### REQ-2.1

Given a `date` implementation without GNU's `-I` flag, when a receipt is
written, its `at` field is a non-empty UTC ISO-8601 timestamp.
