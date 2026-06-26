#!/usr/bin/env bash
# =============================================================================
# seal-secret.sh — Encrypt a K8s Secret with kubeseal (Sealed Secrets)
# =============================================================================
# Usage:
#   ./scripts/seal-secret.sh --env <dev|staging|prod> --service <api|postgres>
#
# Examples:
#   ./scripts/seal-secret.sh --env dev --service api
#   ./scripts/seal-secret.sh --env dev --service postgres
#   ./scripts/seal-secret.sh --env staging --service api
#
# This reads from overlays/<env>/secret-<service>.yaml and writes to
#   overlays/<env>/sealed-<service>-secret.yaml
#
# Requirements:
#   - kubeseal CLI (~/bin/kubeseal or in PATH)
#   - scripts/sealed-secrets-cert.pem (exported from cluster)
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OVERLAYS_DIR="$PROJECT_ROOT/infra/k8s/overlays"

info()  { printf "\033[34mℹ\033[0m %s\n" "$*"; }
warn()  { printf "\033[33m⚠\033[0m %s\n" "$*" >&2; }
die()   { printf "\033[31m✖\033[0m %s\n" "$*" >&2; exit 1; }

ENV=""
SERVICE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env)      ENV="${2:-}"; shift 2 ;;
    --service)  SERVICE="${2:-}"; shift 2 ;;
    -h|--help)
      echo "Usage: $0 --env <dev|staging|prod> --service <api|postgres>"
      exit 0
      ;;
    *) die "Unknown option: $1" ;;
  esac
done

[[ -z "$ENV" ]] && die "Missing --env (dev, staging, prod)"
[[ -z "$SERVICE" ]] && die "Missing --service (api, postgres)"

case "$ENV" in
  dev|staging|prod) ;;
  *) die "Invalid env: $ENV (expected: dev, staging, prod)" ;;
esac

case "$SERVICE" in
  api|postgres) ;;
  *) die "Invalid service: $SERVICE (expected: api, postgres)" ;;
esac

OVERLAY_DIR="$OVERLAYS_DIR/$ENV"
INPUT="$OVERLAY_DIR/secret-${SERVICE}.yaml"
OUTPUT="$OVERLAY_DIR/sealed-${SERVICE}-secret.yaml"

[[ ! -f "$INPUT" ]] && die "Input file not found: $INPUT"

# Resolve kubeseal binary
KUBESEAL=""
if command -v kubeseal >/dev/null 2>&1; then
  KUBESEAL="$(command -v kubeseal)"
elif [[ -x "$HOME/bin/kubeseal" ]]; then
  KUBESEAL="$HOME/bin/kubeseal"
else
  die "kubeseal not found. Install: https://github.com/bitnami/sealed-secrets"
fi

# Resolve namespace
NAMESPACE="kubernal-${ENV}"

# Resolve cert
CERT="$SCRIPT_DIR/sealed-secrets-cert.pem"
if [[ ! -f "$CERT" ]]; then
  CERT="/tmp/sealed-secrets-cert.pem"
  if command -v kubectl >/dev/null 2>&1; then
    info "Fetching sealing cert from cluster..."
    $KUBESEAL --fetch-cert \
      --controller-namespace kube-system \
      --controller-name sealed-secrets \
      > "$CERT" 2>/dev/null \
      || die "Could not fetch sealing cert from cluster."
    info "Cluster cert cached at $CERT"
  else
    die "No local cert and kubectl not found."
  fi
fi

info "Sealing $INPUT → $OUTPUT (namespace: $NAMESPACE)"

$KUBESEAL --format yaml \
  --scope namespace-wide \
  --namespace "$NAMESPACE" \
  --secret-file "$INPUT" \
  --cert "$CERT" \
  -w "$OUTPUT"

info "Done. Sealed secret written to: $OUTPUT"
info "Safe to commit. Keep $INPUT in .gitignore."
