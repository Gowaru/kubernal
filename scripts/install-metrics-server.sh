#!/usr/bin/env bash
# =============================================================================
# install-metrics-server.sh — Install metrics-server on a kind cluster
# =============================================================================
# Usage:
#   ./scripts/install-metrics-server.sh
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
# Install metrics-server
# ---------------------------------------------------------------------------
info "Applying metrics-server manifest..."
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

# ---------------------------------------------------------------------------
# Patch for kind (kubelet self-signed certs)
# ---------------------------------------------------------------------------
info "Patching metrics-server with --kubelet-insecure-tls (required for kind)..."
kubectl patch deployment metrics-server \
  -n kube-system \
  --type='json' \
  -p='[{"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--kubelet-insecure-tls"}]'

# ---------------------------------------------------------------------------
# Wait for availability
# ---------------------------------------------------------------------------
info "Waiting for metrics-server to be available..."
kubectl wait deployment/metrics-server \
  -n kube-system \
  --for condition=Available \
  --timeout 60s

# ---------------------------------------------------------------------------
# Verify
# ---------------------------------------------------------------------------
info "Verifying metrics-server..."
kubectl top nodes
kubectl top pods -A

info "Done. metrics-server is running."
