---
name: spec
description: Turn a card into a reviewed specification before any code is written. Use whenever starting work on a new card, ticket, issue, or feature request, or when the user says they want to spec, scope, propose, or "figure out what we're building" — even if they never say "spec". Also use when a request arrives as a paragraph of prose and nobody has written down what done looks like.
---

# Spec a change

1. Read `.asmt/config.yml`. If it is missing, stop and tell the user to run
   `/asmt:start`.
2. Read the `spec-grammar` skill, then read whichever file in its
   `references/` matches `modes.artifacts`. If `modes.artifacts` is
   `ephemeral`, stop — that variant is not implemented yet.
3. Read the `house-rules` skill.
4. Confirm the size class with the user (`chore`, `standard`, `risky`;
   `default_size_class` is the default). If `chore`, write a lite spec — the
   requirements only, no proposal — and stop.
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
