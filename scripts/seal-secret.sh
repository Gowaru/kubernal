#!/usr/bin/env bash
# =============================================================================
# seal-secret.sh — Encrypt a K8s Secret with kubeseal (Sealed Secrets)
# =============================================================================
# Usage:
#   ./scripts/seal-secret.sh <input-secret.yaml> [output-sealed-secret.yaml]
#
# If output is omitted, writes to same directory as input, prefixed with "sealed-".
# Example:
#   ./scripts/seal-secret.sh infra/k8s/api/secret.yaml
#   # → infra/k8s/api/sealed-secret.yaml
#
# Requirements:
#   - kubeseal CLI installed (https://github.com/bitnami-labs/sealed-secrets#kubeseal)
#   - Access to the cluster's sealing cert (auto-fetched via kubectl if available)
# =============================================================================
set -euo pipefail

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
info()  { printf "\033[34mℹ\033[0m %s\n" "$*"; }
warn()  { printf "\033[33m⚠\033[0m %s\n" "$*" >&2; }
die()   { printf "\033[31m✖\033[0m %s\n" "$*" >&2; exit 1; }

# ---------------------------------------------------------------------------
# Args
# ---------------------------------------------------------------------------
INPUT="${1:-}"
OUTPUT="${2:-}"

[[ -z "$INPUT" ]] && die "Usage: $0 <input-secret.yaml> [output-sealed-secret.yaml]"
[[ ! -f "$INPUT" ]] && die "Input file not found: $INPUT"

# Derive output path if not provided
if [[ -z "$OUTPUT" ]]; then
  DIR="$(dirname "$INPUT")"
  BASE="$(basename "$INPUT")"
  OUTPUT="${DIR}/sealed-${BASE}"
fi

# ---------------------------------------------------------------------------
# Check dependencies
# ---------------------------------------------------------------------------
command -v kubeseal >/dev/null 2>&1 || die "kubeseal not found in PATH. Install it: https://github.com/bitnami-labs/sealed-secrets#kubeseal"

# ---------------------------------------------------------------------------
# Resolve sealing certificate
# Priority: 1) scripts/sealed-secrets-cert.pem  2) kubectl fetch from cluster
# ---------------------------------------------------------------------------
CERT_SCRIPT="$(dirname "$0")/sealed-secrets-cert.pem"
CERT=""

if [[ -f "$CERT_SCRIPT" ]]; then
  CERT="$CERT_SCRIPT"
  info "Using local cert: $CERT"
elif command -v kubectl >/dev/null 2>&1; then
  info "Fetching sealing cert from cluster..."
  CERT="/tmp/sealed-secrets-cert.pem"
  kubectl get secret \
    -n kube-system \
    -l sealedsecrets.bitnami.com/sealed-secrets-key \
    -o jsonpath='{.items[0].data.tls\.crt}' \
    | base64 -d > "$CERT" 2>/dev/null \
    || die "Could not fetch sealing cert from cluster. Is sealed-secrets installed?"
  info "Cluster cert saved to $CERT (cached)"
else
  die "No local cert and kubectl not available. Provide --cert flag or install kubectl."
fi

# ---------------------------------------------------------------------------
# Seal
# ---------------------------------------------------------------------------
info "Sealing $INPUT → $OUTPUT"

kubeseal --format yaml \
  --secret-file "$INPUT" \
  --cert "$CERT" \
  --output "$OUTPUT"

info "Done. Sealed secret written to: $OUTPUT"
info "Safe to commit. Keep the original $INPUT in .gitignore."
