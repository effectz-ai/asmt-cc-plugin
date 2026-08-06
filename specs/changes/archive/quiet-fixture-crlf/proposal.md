# Quiet CRLF warnings in test fixture repos

## Why

`tests/run-all` passes, but on any machine with `core.autocrlf=true` set
globally (confirmed: this machine, via the system-level gitconfig at
`C:/Users/Sano/scoop/apps/git/2.54.0/etc/gitconfig`), every fixture repo the
suite creates prints git's line-ending warning several times per run:

    warning: in the working copy of '.asmt/config.yml', LF will be replaced
    by CRLF the next time Git touches it

A full `tests/run-all` run currently prints this warning 24 times. Noisy
output that is expected to be noisy trains a reader to stop reading it, which
is exactly when a real warning (a flaky test, a genuine git problem) gets
missed.

## Root cause

Every fixture repo the suite creates traces back to one function:
`tests/fixtures.sh`'s `new_repo()`. It runs `git init`, then writes
`.asmt/config.yml` and `.gitignore` via heredoc (LF endings, since bash
heredocs are LF) and commits them. On a host with `core.autocrlf=true`, git
compares the LF-ending file already in the index/tree against what a future
checkout would materialize (CRLF) and warns about the mismatch on every `git
add` that touches the file — which is also why later commits against the
same fixture repo (`test-asmt-gate`'s `new.txt`, `uncommitted.txt`, and its
re-written `.asmt/config.yml` fixtures) reprint the warning: they're all
committing into a repo that inherited the host's global `core.autocrlf=true`
at `git init` time, and every one of them routes through `new_repo()`.

That is one call site, not several: the fix belongs in `new_repo()`, not in
each test file that happens to call it.

## What changes

`new_repo()` sets `core.autocrlf false` on the fixture repo immediately after
`git init`, before any file is written or committed. This is a per-repo git
config value — it does not read or write the developer's global
`~/.gitconfig` or the system-level gitconfig, and it does not affect this
project's own repo (the one running the tests) or any other repo on the
machine.

## What this explicitly does not do

- Does not change the developer's global or system `core.autocrlf` setting.
  The card is about test output noise, not about how this developer's git is
  configured for their other work.
- Does not add a `.gitattributes` file to this project's own repository. The
  warnings originate inside the ephemeral fixture repos `new_repo()` creates
  under `mktemp -d`, not in this project's working tree — a `.gitattributes`
  here would not reach them.
- Does not suppress or filter any other category of git or test output.
  Only the specific "LF will be replaced by CRLF" warning is in scope; if
  some other warning starts firing later, that is a separate card.
- Does not change fixture repos' committed file contents, only the git
  config of the repo they live in.
- Does not attempt to make the fix conditional on the host's
  `core.autocrlf` value (e.g. "only disable it if the global is true").
  Setting `core.autocrlf false` in a throwaway fixture repo is a no-op on a
  host where the global is already `false` or unset, so unconditional is
  simpler and has no downside.
