---
name: build
description: Implement an approved plan task by task, with tests. Use whenever the user wants to build, implement, code, or "start on" work that already has a signed-off spec and plan — including "let's do task 3", "carry on with the build", or "make it pass". Do not use this before a spec exists; use /asmt:spec first.
---

# Build a change

1. Read `.asmt/config.yml`. If `modes.topology` is `subagent`, stop — that
   topology is not implemented yet. Sequential is the only supported mode.
2. Read the `tdd-loop` skill and the `house-rules` skill.
3. Read `<paths.changes>/<change-id>/spec.md` and `tasks.md`. If `tasks.md`
   does not exist, stop and say so — there is no `/asmt:plan` yet, so the
   task breakdown has to be written by hand for now. Do not invent one and
   start building from it.
4. Confirm the suite is green before touching anything: run `/asmt:verify`.
   Starting from red means you cannot tell your failures from the existing ones.
5. Take exactly one task from `tasks.md`. Not two. Not "while I was here".
6. Follow `tdd-loop` without exception: write the failing test, run it, watch
   it fail, write the minimum code to pass, run it, watch it pass, commit.
   Code written before its test gets deleted, not retrofitted.
7. Every test name carries the `REQ-<n>.<m>` ID of the scenario it proves.
8. After each task: report the task ID, the files touched, the test names
   added, and anything you noticed but did not fix. Never report success
   without pasting the actual test output.
9. When all tasks are done, run `/asmt:verify` and stop. Opening the PR is a
   separate step, and it is gated.
