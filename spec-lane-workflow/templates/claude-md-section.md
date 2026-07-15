## AI-Dev workflow

This project uses the **spec-lane workflow** (OpenSpec + Claude Code). Read
`docs/process/ai-dev-workflow-standard.md` before opening a card, branch, or PR.

Essentials:

- **Spec before code.** Non-trivial changes start with `/opsx:propose` (proposal + design +
  delta spec + tasks) and a human review before implementation.
- **Size the change into a lane** — Fast / Standard / Deep. Don't over-process a small fix;
  don't under-process a subsystem. (The `lanes` skill enforces this.)
- **Hard gate before PR:** `{{GATE_CMD}}` must be green, and the change must be shown to work
  at runtime where applicable. **No PR merges red** — CI runs the same gate.
- **Archive on merge:** `openspec archive <change-id>` folds the delta into the living specs
  under `openspec/specs/`.
- **Never send client/production data through an agent** — source code only. Secrets are
  referenced by env-var name and resolved server-side, never inlined; sensitive files are
  blocked at the tool level in `.claude/settings.json`.