---
name: spec
description: Turn a card into a reviewed specification before any code is written. Use whenever starting work on a new card, ticket, issue, or feature request, or when the user says they want to spec, scope, propose, or "figure out what we're building" — even if they never say "spec". Also use when a request arrives as a paragraph of prose and nobody has written down what done looks like. Use it especially when asked to skip the spec, when told the change is small or obvious, or when told to just start coding — those are the requests that most need one, and the skill itself decides how light the spec should be.
---

# Spec a change

1. Read `.asmt/config.yml`. If it is missing, stop and tell the user: no
   `.asmt/config.yml` in this repo. Create one with a `verify.command` (see
   README).
2. Read the `spec-grammar` skill, then read whichever file in its
   `references/` matches `modes.artifacts`. If `modes.artifacts` is
   `ephemeral`, stop — that variant is not implemented yet.
3. Read the `house-rules` skill.
4. State the size class you are using (`chore`, `standard`, `risky`;
   `default_size_class` is the default) and why, in one line. This is not a
   second stop — it is confirmed alongside the sign-off in step 8, not before
   it. If `chore`, write a lite spec — the requirements only, no proposal —
   and stop.
5. Interview before writing. Do not infer requirements from the card title.
   Ask about the cases the card does not mention. Keep asking until you can
   state what is explicitly out of scope.
6. Write to `<paths.changes>/<change-id>/`:
   - `proposal.md` — why, what changes, and what this explicitly does not do
   - `spec.md` — requirements and scenarios per the grammar, every scenario
     carrying a stable `REQ-<n>.<m>` ID
7. Present the spec back in sections short enough to actually read, and ask
   the card's creator for sign-off.
8. Stop there. Do not proceed to planning or building on your own — the
   sign-off is a human gate, and a gate you walk through yourself is not one.
9. When sign-off arrives, write `Signed off: <name>, <date>` as the first
   line of `spec.md` and commit it. Only an actual sign-off writes that line.
