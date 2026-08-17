# Capability: skill-triggers

Do the entry-point skills actually fire on the phrasings a person would
type? Tested by nested sessions, deliberately outside the verification gate.

## REQ-1: An entry point fires on phrasings that should invoke it

Requirement: An entry point fires on phrasings a person would actually type — whether they describe the situation, name the skill, or push back on the process.

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

## REQ-2: An entry point stays out of work that is not its own

Requirement: An entry point stays out of work that is not its own, and a negative case asserts about the named skill only.

### REQ-2.1

Given a prompt a named skill must not claim, when the runner executes that case,
it reports a pass only if that skill was not invoked.

### REQ-2.2

Given a negative case in which some other skill fired, when the runner reports
it, the case still passes — the assertion is about the named skill only.

## REQ-3: Each case runs isolated and leaves nothing behind

Requirement: Each case runs against a profile with no other plugin installed and a throwaway working directory, and leaves the repository under test unchanged.

### REQ-3.1

Given any case, when the runner executes it, the nested session runs with a HOME
that contains no plugin other than the one under test.

### REQ-3.2

Given any case, when the runner executes it, the nested session's working
directory is a throwaway directory, never the repository under test.

### REQ-3.3

Given a completed run of the whole suite, when the repository under test is
inspected, its tracked files and working tree are unchanged.

## REQ-4: The suite is not part of the verification gate

Requirement: The suite is not part of the verification gate: no receipt depends on it, and `tests/run-all` spawns no nested session.

### REQ-4.1

Given the trigger suite exists, when `tests/run-all` runs, it does not execute
any nested session and its runtime is unchanged.

### REQ-4.2

Given a developer wants to run the trigger suite, when they invoke its own
command, every case runs and the command exits non-zero if any case failed.

## REQ-5: Absent tooling skips rather than fails

Requirement: Absent or unauthenticated tooling skips rather than fails — a machine that cannot run the tests has learned nothing about the descriptions.

### REQ-5.1

Given a machine with no `claude` executable on PATH, when the trigger suite
runs, it reports a skip naming the reason and exits zero.

### REQ-5.2

Given a machine where the nested session cannot authenticate, when a case runs,
it reports a skip naming the reason rather than a failure.

## REQ-6: A failure can be diagnosed without re-running it

Requirement: A failure can be diagnosed without spending another session to reproduce it.

### REQ-6.1

Given a case that fails, when the runner reports it, the report names the path
to that case's captured session output.

### REQ-6.2

Given any case, when the runner reports it, the report lists which skills the
nested session actually invoked, including none.

## REQ-7: A case that only sometimes passes is reported as flaky, not hidden

Requirement: A case that passes only after a retry is reported as flaky, with its attempt count, rather than hidden behind a pass.

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

Folded from `specs/changes/archive/skill-triggers/` (signed off: sano,
2026-08-07). Requirement and scenario IDs are frozen as of that sign-off —
see `spec-grammar/references/living.md`.
