# Changelog

## Unreleased

- Initial plugin skeleton: marketplace + plugin manifests.
- PreToolUse guard (`hooks/pretooluse-guard`) blocks `gh pr create` on
  `Bash|PowerShell` without a passing gate receipt for HEAD. Matcher covers
  both shell tools deliberately: on Windows machines where Git Bash isn't
  discoverable at the two hardcoded install paths Claude Code checks, real
  sessions run with `CLAUDE_CODE_USE_POWERSHELL_TOOL=1` and have **no `Bash`
  tool at all** — a `Bash`-only matcher would never fire for those users. The
  guard script itself needed no change: it reads the whole hook-input JSON
  as text and regex-matches for the command, and the `PowerShell` tool's
  `tool_input` uses the same `"command"` field as `Bash` (confirmed via live
  session transcripts, not assumed). **Blocking convention: structured
  JSON on stdout** (`{"hookSpecificOutput":{"hookEventName":"PreToolUse",
  "permissionDecision":"deny","permissionDecisionReason":"..."}}`, exit 0) —
  confirmed empirically against a live Claude Code session (CLI build
  2.1.223), for both the `Bash` and `PowerShell` tool paths. The documented
  exit-2-blocks convention was tried first and does **not** block in this
  build: the guard printed its message and returned exit 2 correctly, but
  the `gh pr create` call still ran. Only the JSON `permissionDecision:"deny"`
  form actually denies the tool call (verified via `permission_denials` in
  the session's stream-json output, for both tools). If you're porting this
  hook to another Claude Code build, re-verify this before assuming either
  convention.
