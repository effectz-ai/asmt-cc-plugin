# Sourced by tests/test-*. Not executable, not a test itself.

# new_repo [verify-command] -> prints path to a fresh single-commit git repo
# with .asmt/config.yml and .asmt/receipts/ gitignored.
new_repo() {
  local dir cmd
  cmd="${1:-true}"
  dir="$(mktemp -d)"
  git -C "$dir" init -q -b main
  git -C "$dir" config user.email "test@example.com"
  git -C "$dir" config user.name "test"
  mkdir -p "$dir/.asmt"
  cat > "$dir/.asmt/config.yml" <<EOF
version: 1

verify:
  command: "$cmd"
  timeout_seconds: 900
EOF
  printf '.asmt/receipts/\n' > "$dir/.gitignore"
  git -C "$dir" add -A
  git -C "$dir" commit -qm "init"
  printf '%s\n' "$dir"
}

# head_sha <repo>
head_sha() { git -C "$1" rev-parse HEAD; }
