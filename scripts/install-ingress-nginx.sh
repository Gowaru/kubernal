#!/usr/bin/env bash
# =============================================================================
# install-ingress-nginx.sh — Install ingress-nginx controller for kind
# =============================================================================
# Usage:
#   ./scripts/install-ingress-nginx.sh
#
# Requirements:
#   - kubectl installed and configured to talk to a kind cluster
# =============================================================================
set -euo pipefail

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
info()  { printf "\033[34mℹ\033[0m %s\n" "$*"; }
warn()  { printf "\033[33m⚠\033[0m %s\n" "$*" >&2; }
die()   { printf "\033[31m✖\033[0m %s\n" "$*" >&2; exit 1; }

# ---------------------------------------------------------------------------
# Check dependencies
# ---------------------------------------------------------------------------
command -v kubectl >/dev/null 2>&1 || die "kubectl not found in PATH. Install it: https://kubernetes.io/docs/tasks/tools/"

# ---------------------------------------------------------------------------
# Install ingress-nginx
# ---------------------------------------------------------------------------
info "Applying ingress-nginx manifest for kind..."
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml

# ---------------------------------------------------------------------------
# Wait for controller readiness
# ---------------------------------------------------------------------------
info "Waiting for ingress-nginx controller to be ready..."
kubectl wait \
  --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=90s

# ---------------------------------------------------------------------------
# Verify
# ---------------------------------------------------------------------------
info "Verifying ingress-nginx..."
kubectl get pods -n ingress-nginx

info "Done. ingress-nginx controller is running."
