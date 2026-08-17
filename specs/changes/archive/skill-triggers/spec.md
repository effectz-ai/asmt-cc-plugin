Signed off: sano, 2026-08-07

# Spec: skill trigger tests

Capability: `skill-triggers`. New capability — numbering starts at `REQ-1`, no
existing file under `specs/current/` to continue from.

## ADDED REQ-1: An entry point fires on phrasings that should invoke it

### REQ-1.1

Given a prompt describing a situation the skill exists for, without naming the
skill or any file path, when the runner executes that case, it reports a pass
only if the nested session invoked that skill.

### REQ-1.2

Given a prompt naming the skill directly, when the runner executes that case, it
reports a pass only if the nested session invoked that skill.

### REQ-1.3

Given a prompt that pressures against process — asking to skip ceremony and get
straight to the work — when the runner executes that case, it reports a pass
only if the skill fired anyway.

## ADDED REQ-2: An entry point stays out of work that is not its own

### REQ-2.1

Given a prompt a named skill must not claim, when the runner executes that case,
it reports a pass only if that skill was not invoked.

### REQ-2.2

Given a negative case in which some other skill fired, when the runner reports
it, the case still passes — the assertion is about the named skill only.

## ADDED REQ-3: Each case runs isolated and leaves nothing behind

### REQ-3.1

Given any case, when the runner executes it, the nested session runs with a HOME
that contains no plugin other than the one under test.

### REQ-3.2

Given any case, when the runner executes it, the nested session's working
directory is a throwaway directory, never the repository under test.

### REQ-3.3

Given a completed run of the whole suite, when the repository under test is
inspected, its tracked files and working tree are unchanged.

## ADDED REQ-4: The suite is not part of the verification gate

### REQ-4.1

Given the trigger suite exists, when `tests/run-all` runs, it does not execute
any nested session and its runtime is unchanged.

### REQ-4.2

Given a developer wants to run the trigger suite, when they invoke its own
command, every case runs and the command exits non-zero if any case failed.

## ADDED REQ-5: Absent tooling skips rather than fails

### REQ-5.1

Given a machine with no `claude` executable on PATH, when the trigger suite
runs, it reports a skip naming the reason and exits zero.

### REQ-5.2

Given a machine where the nested session cannot authenticate, when a case runs,
it reports a skip naming the reason rather than a failure.

## ADDED REQ-6: A failure can be diagnosed without re-running it

### REQ-6.1

Given a case that fails, when the runner reports it, the report names the path
to that case's captured session output.

### REQ-6.2

Given any case, when the runner reports it, the report lists which skills the
nested session actually invoked, including none.

## ADDED REQ-7: A case that only sometimes passes is reported as flaky, not hidden

### REQ-7.1

Given a case that fails on its first attempt and passes on a retry within its
budget, when the runner reports it, the case is reported as flaky, names how
many attempts it took, and does not fail the suite.

### REQ-7.2

Given a case that fails every attempt within its retry budget, when the runner
reports it, the case is reported as a failure and the suite exits non-zero.

### REQ-7.3

Given a case that passes on its first attempt, when the runner executes it, no
retry is spawned — a clean pass costs exactly one nested session.