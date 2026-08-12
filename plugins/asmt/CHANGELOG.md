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
- **Correction to the paragraph above:** the `Bash|PowerShell` matcher
  widening covers which *tool call* triggers the hook. It says nothing about
  whether `run-hook.cmd`'s own cmd.exe-detection branch ever runs, and it
  does not cover the population it was assumed to. `hooks.json` sets
  `"shell": "bash"` on this hook's command, and per Claude Code's hooks
  documentation that field means Claude Code invokes the command directly
  through bash (Git Bash on Windows; it falls back to the PowerShell
  *interpreter*, not to cmd.exe, when Git Bash isn't found) — so
  `run-hook.cmd`'s `@echo off` / cmd.exe polyglot half is very likely dead
  code under Claude Code's own normal hook execution for this config. It
  remains only as a defensive fallback for other invocation paths (a manual
  or test invocation via `cmd.exe` directly, or a build that does not honour
  `"shell"`). Measured on a real machine (Scoop-installed Git, no install at
  either of the two hardcoded `Program Files` paths, Git Bash discoverable
  only under `%USERPROFILE%\scoop\apps\git\current\`): if that cmd.exe
  branch *is* reached, its old fallback — bare `where bash` — resolves to
  `C:\Windows\System32\bash.exe`, the WSL launcher stub, before it ever
  finds a real bash. That stub cannot open a Windows path (it treats
  backslashes as escapes) and exits 127; a non-2, non-JSON exit does not
  block per the convention above, so the guard fails **open**, silently.
  `run-hook.cmd` now probes the Scoop and Cygwin install locations before
  falling back to `where bash`, closing that specific gap for the cmd.exe
  branch — but the honest summary is: **a machine with no usable bash has no
  guard at all**, on either invocation path. Neither this fix nor the
  matcher widening changes that; nothing in this plugin can block a tool
  call that never reaches a shell capable of running the guard script.
