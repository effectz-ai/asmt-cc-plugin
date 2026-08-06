# Changelog

## Unreleased

- Initial plugin skeleton: marketplace + plugin manifests.
- PreToolUse guard (`hooks/pretooluse-guard`) blocks `gh pr create` on `Bash`
  without a passing gate receipt for HEAD. **Blocking convention: structured
  JSON on stdout** (`{"hookSpecificOutput":{"hookEventName":"PreToolUse",
  "permissionDecision":"deny","permissionDecisionReason":"..."}}`, exit 0) —
  confirmed empirically against a live Claude Code session (CLI build
  2.1.223). The documented exit-2-blocks convention was tried first and does
  **not** block in this build: the guard printed its message and returned
  exit 2 correctly, but the `gh pr create` call still ran. Only the JSON
  `permissionDecision:"deny"` form actually denies the tool call (verified
  via `permission_denials` in the session's stream-json output). If you're
  porting this hook to another Claude Code build, re-verify this before
  assuming either convention.
