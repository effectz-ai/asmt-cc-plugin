: << 'CMDBLOCK'
@echo off
REM Cross-platform wrapper for hook scripts.
REM Windows: cmd.exe runs this batch portion, which locates bash.
REM Unix: the shell treats `:` as a no-op and reaches the exec below.
REM
REM Hook scripts are extensionless on purpose — Claude Code on Windows
REM prepends "bash" to any command containing .sh, double-invoking it.
REM
REM Usage: run-hook.cmd <script-name> [args...]

if "%~1"=="" (
    echo run-hook.cmd: missing script name >&2
    exit /b 1
)

set "HOOK_DIR=%~dp0"

if exist "C:\Program Files\Git\bin\bash.exe" (
    "C:\Program Files\Git\bin\bash.exe" "%HOOK_DIR%%~1" %2 %3 %4 %5 %6 %7 %8 %9
    exit /b %ERRORLEVEL%
)
if exist "C:\Program Files (x86)\Git\bin\bash.exe" (
    "C:\Program Files (x86)\Git\bin\bash.exe" "%HOOK_DIR%%~1" %2 %3 %4 %5 %6 %7 %8 %9
    exit /b %ERRORLEVEL%
)
REM Scoop's Git package (`scoop install git`) — a common per-user install
REM that never touches Program Files. "current" is the version-independent
REM junction Scoop maintains, so this survives Git version bumps.
if exist "%USERPROFILE%\scoop\apps\git\current\bin\bash.exe" (
    "%USERPROFILE%\scoop\apps\git\current\bin\bash.exe" "%HOOK_DIR%%~1" %2 %3 %4 %5 %6 %7 %8 %9
    exit /b %ERRORLEVEL%
)
REM Cygwin's own bash, independent of any Git-for-Windows install.
if exist "C:\cygwin64\bin\bash.exe" (
    "C:\cygwin64\bin\bash.exe" "%HOOK_DIR%%~1" %2 %3 %4 %5 %6 %7 %8 %9
    exit /b %ERRORLEVEL%
)
if exist "C:\cygwin\bin\bash.exe" (
    "C:\cygwin\bin\bash.exe" "%HOOK_DIR%%~1" %2 %3 %4 %5 %6 %7 %8 %9
    exit /b %ERRORLEVEL%
)
REM winget's default Git package installs to the same Program Files path
REM already checked above, so it needs no separate branch here.

REM Last resort: PATH search. On a machine with WSL installed but no real
REM bash, this finds C:\Windows\System32\bash.exe (the WSL launcher) ahead
REM of anything else — it "succeeds" per ERRORLEVEL but cannot open a
REM Windows path (it parses backslashes as escapes) and exits 127. That
REM still lands on the "no bash found" outcome below, just one step later
REM and by the fail-open path (see CHANGELOG.md).
where bash >nul 2>nul
if %ERRORLEVEL% equ 0 (
    bash "%HOOK_DIR%%~1" %2 %3 %4 %5 %6 %7 %8 %9
    exit /b %ERRORLEVEL%
)

REM No bash found. Fail open rather than wedging every Bash tool call.
exit /b 0
CMDBLOCK

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SCRIPT_NAME="$1"
shift
exec bash "${SCRIPT_DIR}/${SCRIPT_NAME}" "$@"
