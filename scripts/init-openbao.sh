#!/usr/bin/env bash
# =============================================================================
# scripts/init-openbao.sh
# Initialize OpenBao for local dev: setup JWT auth, policies, KV secrets.
# Requires: docker-compose profile "secrets" running (bao in dev mode).
# Usage: bash scripts/init-openbao.sh [--ci]
#   --ci  : configure for CI pipeline instead of local dev
# =============================================================================
set -euo pipefail

BAO_ADDR="${BAO_ADDR:-http://localhost:8200}"
BAO_TOKEN="${BAO_TOKEN:-bao-root-token-dev}"
GITHUB_REPO="${GITHUB_REPO:-gowaru/kubernal}"
GITHUB_OWNER="${GITHUB_OWNER:-gowaru}"

if [[ "${1:-}" == "--ci" ]]; then
  echo "→ CI mode: binding to repo ${GITHUB_REPO}"
fi

echo "==> Waiting for OpenBao at ${BAO_ADDR}..."
for i in $(seq 1 30); do
  if curl -sf "${BAO_ADDR}/v1/sys/health" >/dev/null 2>&1; then
    echo "    OpenBao ready after ${i}s"
    break
  fi
  sleep 1
done

export BAO_ADDR BAO_TOKEN

# ---------------------------------------------------------------------------
# 1. Enable JWT auth
# ---------------------------------------------------------------------------
echo "==> Enabling JWT auth method..."
bao auth enable -path=jwt jwt 2>/dev/null || echo "    (already enabled)"

echo "==> Configuring JWT auth for GitHub OIDC..."
bao write auth/jwt/config \
  oidc_discovery_url="https://token.actions.githubusercontent.com" \
  bound_issuer="https://token.actions.githubusercontent.com" \
  oidc_response_mode=form_post

# ---------------------------------------------------------------------------
# 2. Create CI policy
# ---------------------------------------------------------------------------
echo "==> Writing CI policy..."
cat <<'POLICY' | bao policy write kubernal-ci -
# Allow reading CI secrets
path "secret/data/ci/*" {
  capabilities = ["read", "list"]
}
path "secret/metadata/ci/*" {
  capabilities = ["list"]
}
# Allow dynamic DB credentials
path "database/creds/ci-role" {
  capabilities = ["read"]
}
POLICY

# ---------------------------------------------------------------------------
# 3. Create JWT role for GitHub Actions
# ---------------------------------------------------------------------------
echo "==> Creating JWT role 'kubernal-ci'..."
if [[ "${1:-}" == "--ci" ]]; then
  bao write auth/jwt/role/kubernal-ci \
    role_type=jwt \
    bound_subject="repo:${GITHUB_REPO}:*" \
    bound_audiences="https://github.com/${GITHUB_OWNER}" \
    user_claim=sub \
    token_policies=kubernal-ci \
    token_ttl=15m
else
  # Dev: allow any branch in the repo
  bao write auth/jwt/role/kubernal-ci \
    role_type=jwt \
    bound_subject="repo:${GITHUB_REPO}:*" \
    bound_audiences="https://github.com/${GITHUB_OWNER}" \
    user_claim=sub \
    token_policies=kubernal-ci \
    token_ttl=15m
fi

# ---------------------------------------------------------------------------
# 4. Enable KV v2 secrets engine
# ---------------------------------------------------------------------------
echo "==> Enabling KV v2 secrets engine..."
bao secrets enable -path=secret kv-v2 2>/dev/null || echo "    (already enabled)"

# ---------------------------------------------------------------------------
# 5. Seed CI secrets (placeholders)
# ---------------------------------------------------------------------------
echo "==> Seeding CI secrets (placeholders)..."
bao kv put secret/ci/postgres-password \
  value="<PLACEHOLDER_CI_POSTGRES_PASSWORD>" \
  description="PostgreSQL password for CI test runner"

bao kv put secret/ci/dockerhub-token \
  value="<PLACEHOLDER_DOCKERHUB_TOKEN>" \
  description="Docker Hub token for pulling rate-limited images"

bao kv put secret/ci/slack-webhook \
  value="<PLACEHOLDER_SLACK_WEBHOOK_URL>" \
  description="Slack webhook URL for CI notifications"

# ---------------------------------------------------------------------------
# 6. (Optional) Enable Database secrets engine for dynamic PG creds
# ---------------------------------------------------------------------------
echo "==> Configuring Database secrets engine for PostgreSQL..."
# Try to configure; the postgres hostname resolves within Docker network.
bao secrets enable -path=database database 2>/dev/null || echo "    (already enabled)"

if bao write database/config/kubernal-pg \
  plugin_name=postgresql-database-plugin \
  allowed_roles="ci-role" \
  connection_url="postgresql://{{username}}:{{password}}@postgres:5432/kubernal_idp?sslmode=disable" \
  username="kubernal" \
  password="kubernal_dev" 2>/dev/null; then

  bao write database/roles/ci-role \
    db_name=kubernal-pg \
    creation_statements="CREATE USER \"{{name}}\" WITH PASSWORD '{{password}}' VALID UNTIL '{{expiration}}'; GRANT CONNECT ON DATABASE kubernal_idp TO \"{{name}}\"; GRANT USAGE ON SCHEMA public TO \"{{name}}\"; GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO \"{{name}}\";" \
    default_ttl=30m \
    max_ttl=1h && echo "    Database engine configured (dynamic credentials ready)"
else
  echo "    Skipping database engine (PostgreSQL not reachable from OpenBao)"
fi

echo ""
echo "✅ OpenBao initialized!"
echo "   Root token: ${BAO_TOKEN}"
echo "   JWT role:   kubernal-ci"
echo ""
echo "   ┌─────────────────────────────────────────────┐"
echo "   │  To test JWT auth locally, run:              │"
echo "   │  bao login -method=jwt role=kubernal-ci      │"
echo "   │  jwt=\$(your_github_oidc_token)               │"
echo "   └─────────────────────────────────────────────┘"
