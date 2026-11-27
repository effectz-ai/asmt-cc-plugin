---
name: land
description: Use when implementation is complete and the work should become a pull request — including "open the PR", "ship it", "we're done, land this". Verifies through the gate, writes the PR description from the design and the check-by-hand list, and cleans up the work folder.
---

# Land a branch

## Overview

**Core principle:** Gate → Detect environment → Present options → Execute choice → Clean up.

**Announce at start:** "I'm using asmt:land to complete this work."

Read `.asmt/config.yml`. If it is missing, stop: this repo needs one (see the plugin README). If `version` is not `2`, stop and tell the user to set `version: 2` and delete `modes`, `size_classes`, `default_size_class`, and `paths`. Missing `docs` means `pr`; missing `tests` means `focused`; any other value for either, stop and name it.

## Step 1: Gate

Run asmt:verify. It needs a clean tree and writes the receipt the PR guard
checks; without a passing receipt for HEAD the PR cannot be opened.

**If it fails**, report the failures verbatim and stop — the menu comes after
a green gate.

## Step 2: Detect Environment

```bash
GIT_DIR=$(cd "$(git rev-parse --git-dir)" 2>/dev/null && pwd -P)
GIT_COMMON=$(cd "$(git rev-parse --git-common-dir)" 2>/dev/null && pwd -P)
# Capture now, while still inside the workspace — cleanup needs this value
WORKTREE_PATH=$(git rev-parse --show-toplevel)
```

| State | Menu | Worktree cleanup |
|-------|------|---------|
| `GIT_DIR == GIT_COMMON` (normal repo) | Standard options | None |
| `GIT_DIR != GIT_COMMON`, named branch | Standard options | Provenance-based (see Step 6) |
| `GIT_DIR != GIT_COMMON`, detached HEAD | Push as new branch | Externally managed — leave in place |

Find the topic folder: `.asmt/work/<topic>/` in the main checkout, the one
holding this work's `plan.md` and `progress.md`.

## Step 3: Determine Base Branch

The base branch is whatever this work forked from — usually named in the
plan, the conversation, or the branch's upstream. If it is not already
known, ask: "This branch split from <your best guess> - is that correct?"

## Step 4: Present Options

```
Implementation complete and gated. What would you like to do?

1. Push and open a pull request
2. Keep the branch as-is (I'll handle it later)

Which option?
```

There is no local merge: work reaches the base branch through a reviewed PR.
Discarding the work happens only when your human partner explicitly asks
(see below). Wait for their answer.

## Step 5: Execute Choice

### Option 1: Push and open a PR

```bash
git push -u origin <feature-branch>
# From a detached HEAD: git push origin HEAD:refs/heads/<new-branch>
```

Then open the PR against <base-branch> (the forge's CLI if available),
following the repo's PR template if one exists. The description holds, in
order:

1. A short summary of what changed and why.
2. `## Check by hand` — every `Check by hand (Task N): ...` line from
   `progress.md`, as a checklist. Ask the developer whether they have run
   them; mark the ones they confirm. If there are none, write "None".
3. Only when `docs: pr`: `## Design` with the contents of
   `.asmt/work/<topic>/design.md`.

Report the PR URL, and add: "Squash merge keeps main to one commit for this
PR."

Then delete `.asmt/work/<topic>/` — the PR and git history are the record
now. Keep the worktree; PR feedback gets fixed there.

### Option 2: Keep As-Is

Report: "Keeping branch <name>." Leave the topic folder and any worktree in
place.

### If your human partner asks to discard the work

This path exists only as a response to an explicit request to throw the
work away. Confirm first:

```
This will permanently delete:
- Branch <name>
- All commits: <commit-list>
- Worktree at <path>
- .asmt/work/<topic>/

Type 'discard' to confirm.
```

Wait for that exact confirmation. When it arrives:

```bash
MAIN_ROOT=$(git -C "$(git rev-parse --git-common-dir)/.." rev-parse --show-toplevel)
cd "$MAIN_ROOT"
```

Clean up the worktree (Step 6), delete the topic folder, and force-delete
the branch:

```bash
git branch -D <feature-branch>
```

## Step 6: Cleanup Worktree

**Runs only for confirmed discards.** Run from the main repo root, using the
values captured in Step 2.

**If `GIT_DIR == GIT_COMMON`:** no worktree. Done.

**If `WORKTREE_PATH` is under `.worktrees/` or `worktrees/`:** asmt:worktrees
created it — we own cleanup:

```bash
git worktree remove "$WORKTREE_PATH"
git worktree prune
```

**If removal is refused** (`contains modified or untracked files`): never
`--force` on your own initiative. Show what is at stake and ask:

```bash
git -C "$WORKTREE_PATH" status --porcelain -uall
```

**Otherwise:** the host environment owns this workspace — leave it in place.

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "Tests passed earlier this session" | The gate runs on the tree you are about to push. A green run only proves the tree it ran on. |
| "They obviously want it merged" | Integration is your human partner's decision, through a PR. Present the menu and wait. |
| "No one will read the check-by-hand list" | It is the only proof the untested parts work. It goes in the PR. |
| "I'll commit the design so reviewers see it" | With `docs: pr`, the design goes in the PR description and never into the repo. |
| "'Yeah, get rid of it' counts as confirmation" | Only the typed word `discard` authorizes deletion. |
| "Removal refused — `--force` is just finishing the cleanup" | The refusal means files exist only in that worktree. Show your human partner and ask. |
| "The push was rejected — force-push will fix it" | A rejected push means the remote moved. Investigate; force-push only on explicit request. |
