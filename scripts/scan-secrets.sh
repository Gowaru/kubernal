#!/usr/bin/env bash
# =============================================================================
# scripts/scan-secrets.sh
# Run gitleaks manually against the working tree (entire repo + staged changes).
# Install gitleaks first: https://github.com/gitleaks/gitleaks#installation
#   - macOS:  brew install gitleaks
#   - Linux:  see https://github.com/gitleaks/gitleaks/releases
# =============================================================================
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if ! command -v gitleaks >/dev/null 2>&1; then
  echo "❌ gitleaks is not installed." >&2
  echo "   Install: brew install gitleaks  OR  see https://github.com/gitleaks/gitleaks#installation" >&2
  exit 1
fi

MODE="${1:-detect}"

case "$MODE" in
  staged)
    echo "🔍 Scanning staged changes only..."
    gitleaks protect --staged --redact --no-banner --config "$REPO_ROOT/.gitleaks.toml"
    ;;
  history)
    echo "🔍 Scanning full git history (may take a while)..."
    gitleaks detect --no-banner --redact --config "$REPO_ROOT/.gitleaks.toml" "$@"
    ;;
  detect|*)
    echo "🔍 Scanning working tree..."
    gitleaks detect --no-banner --redact --config "$REPO_ROOT/.gitleaks.toml" --source "$REPO_ROOT" --no-git
    ;;
esac
