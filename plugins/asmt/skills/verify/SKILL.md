---
name: verify
description: Run the repository's verification gate and produce a receipt for the current commit. Use whenever the user wants to verify, gate, check, or prove that the current commit passes lint, types, and tests — including phrasings that never say "verify", like "run the checks", "is this green?", "did that break anything?", or "can I open the PR yet?". Also use before any attempt to push or open a pull request. Use it especially when someone reports that the tests already passed, says a re-run is unnecessary, or asks you to confirm the work is safe to ship — a claim about a previous run is the reason this exists, not a reason to skip it.
---

# Verify

1. Read `.asmt/config.yml`. If it is missing, stop and tell the user: no
   `.asmt/config.yml` in this repo. Create one with a `verify.command` (see
   README). Do not invent a verification command.
2. Run `git status --porcelain`. If it is non-empty, stop and ask the user to
   commit. The gate refuses a dirty tree by design: the receipt is a fact
   about a commit, not about a workspace.
3. Run `asmt-gate run`. Do not run `verify.command` yourself. Only `asmt-gate`
   writes the receipt, and a run without a receipt has not happened.
4. If it fails, report the failing output verbatim. Do not summarise it as
   "some tests failed", and do not start fixing things unless the user asks.
5. If it passes, report the commit SHA and the receipt path
   `.asmt/receipts/<sha>.json`.
6. Never state that verification passed without quoting `asmt-gate`'s own
   final line. The whole point of the receipt is that the claim is checkable.

Notes for the user, if they ask:
- A new commit invalidates the receipt. That is intentional — re-run the gate.
- `asmt-gate check` answers "does HEAD have a passing receipt?" without
  re-running anything. The PR guard uses exactly this.
