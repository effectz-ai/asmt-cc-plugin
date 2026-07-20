<!-- asmt:start -->
## AI-Dev workflow

This project uses the **ASMT workflow** (OpenSpec + Codex). Read
`docs/process/ai-dev-workflow-standard.md` before opening a card, branch, or PR.

Essentials:

- **Spec before code.** Non-trivial changes start with `$openspec-propose` (proposal + design +
  delta spec + tasks) and a human review before implementation.
- **Size the change into a lane** - Fast / Standard / Deep. Do not over-process a small fix or
  under-process a subsystem. Use `$asmt:lanes` to apply the lane discipline.
- **Hard gate before PR:** `{{GATE_CMD}}` must be green, and the change must be shown to work
  at runtime where applicable. **No PR merges red** - CI runs the same gate.
- **Archive on merge:** `$openspec-archive-change` or `openspec archive <change-id>` folds the
  delta into the living specs under `openspec/specs/`.
- **Never send client/production data through an agent** - source code only. Secrets are
  referenced by environment-variable name and resolved server-side, never inlined. The optional
  `asmt-workspace` profile in `.codex/config.toml` protects sensitive workspace files only when
  Codex has successfully loaded and selected it.
<!-- asmt:end -->
