# Kubernal — Security & Secrets Policy

> **TL;DR — NEVER commit a real secret.** Use the `*.example` template files and fill real values only in `.gitignore`d locations.

---

## 1. Threat model

Kubernal (this monorepo) is an Internal Developer Portal. It manages **deployments** to a Kubernetes cluster and pulls/pushes **container images** to a container registry. The blast radius of a leaked secret is:

| Secret           | Blast radius                                          | Rotation cost |
|------------------|-------------------------------------------------------|---------------|
| `GITHUB_TOKEN`   | Read private repos, push to GHCR as the user          | Low (regen)   |
| `GITHUB_CLIENT_SECRET` | Impersonate OAuth app, login to Backstage        | Medium        |
| `POSTGRES_PASSWORD` | Read/write IDP database (apps, deployments, webhooks) | High         |
| TLS private key  | MITM `*.kubernal.local` traffic                       | High          |
| Webhook secret   | Forge "git push" events → trigger rogue deployments   | Medium        |

We assume **defense in depth**: even if one secret leaks, the others stay locked. So every secret is rotated independently.

---

## 2. Allowed storage locations

| Secret type             | Where it lives                                                       | Backed up? |
|-------------------------|----------------------------------------------------------------------|------------|
| Local dev secrets       | `apps/api/.env`, `infra/.env`, `infra/k8s/*/secret.yaml` (local)     | NO         |
| CI / GitHub Actions     | Repository **Secrets** (Settings → Secrets → Actions)                | Encrypted  |
| Cluster runtime         | K8s `Secret` resource (applied by hand or via Sealed Secrets)        | Backed up with cluster |
| Operator password store | `pass`, 1Password, Bitwarden, or OS keyring (your call)              | User       |

> **Forbidden locations** (will be caught by gitleaks):
> - Commit history (including `git rm` without history rewrite)
> - Slack / Discord / email / issue tracker
> - Docker images baked with `ENV SECRET=...`
> - Any file matching `*.example*` (these are templates and committed)

---

## 3. Standard secret rotation procedure

1. **Generate a new value** in the source system (GitHub, vault, `openssl rand -base64 32`, etc.)
2. **Update the live location** (cluster / vault / repo Secrets) — verify the new value works
3. **Invalidate the old value** in the source system
4. **Update local copies** (`.env`, `secret.yaml` on your machine) to match
5. **Document the rotation** in `docs/SECURITY.md § Changelog` with the date + reason

---

## 4. Per-secret recipes

### 4.1 GitHub Personal Access Token (`GITHUB_TOKEN`)

- **Source**: <https://github.com/settings/tokens> (fine-grained, expiry ≤ 90 days)
- **Scopes**: `repo`, `read:org`, `write:packages`, `read:packages`
- **Storage**:
  - CI: `Settings → Secrets and variables → Actions → GITHUB_TOKEN`
  - Local: `apps/api/.env` (`GITHUB_TOKEN=...`) **and** `~/.docker/config.json` (base64 of `user:token`)
- **Rotation cadence**: every 90 days **or** on offboarding / suspected leak
- **Test after rotation**: `npx tsx apps/api/src/scripts/demo-ghcr-trivy.ts` (E2E login + push + scan)

### 4.2 GitHub OAuth App (`GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`)

- **Source**: <https://github.com/settings/developers> → OAuth Apps → Kubernal Backstage
- **Storage**:
  - Backstage cluster: `infra/k8s/backstage/secret.yaml` (gitignored, local) — applies to cluster
  - Local: `apps/api/.env` for any helper scripts
- **Rotation cadence**: every 180 days **or** on contributor offboarding
- **Test after rotation**: log in to Backstage via GitHub OAuth flow

### 4.3 Database credentials (`POSTGRES_PASSWORD`, `DATABASE_URL`)

- **Generate**: `openssl rand -base64 24` (32 chars, URL-safe)
- **Storage**:
  - K8s: `infra/k8s/postgres/secret.yaml` (gitignored) — applied via `kubectl apply -f`
  - K8s: `infra/k8s/api/secret.yaml` (gitignored) — consumed by API pod
  - Local: `apps/api/.env` (`DATABASE_URL=...`)
- **Rotation cadence**: every 180 days, or on any suspected leak
- **Test after rotation**: `psql $DATABASE_URL -c 'select 1'`

### 4.4 TLS private key (`infra/k8s/tls/secret.yaml`)

- **Source**: generated locally with `openssl req -x509 -nodes -newkey rsa:2048 -keyout tls.key -out tls.crt ...`
- **Storage**:
  - K8s: `infra/k8s/tls/secret.yaml` (gitignored, base64-encoded in `data:`)
  - For **production**: use **cert-manager + Let's Encrypt** (no manual key)
- **Rotation cadence**: every 365 days for self-signed, automatic with cert-manager
- **Test after rotation**: `openssl s_client -connect kubernal.local:443 -servername kubernal.local < /dev/null`

### 4.5 Webhook signing secret (`Application.webhookSecret`)

- **Generated at runtime** by `regenerateSecret` (API endpoint), format `whsec_<48-char hex>`
- **Storage**:
  - DB column `Application.webhookSecret String?` (Prisma) — committed to DB, not to git
  - GitHub webhook UI: paste after creating the app
- **Rotation cadence**: on suspected leak, or when a contributor leaves
- **Test after rotation**: `bash scripts/demo-webhook.sh` (E2E: valid sig → 201, invalid sig → 401)

---

## 5. Incident Response — "a secret leaked"

If a secret is committed, pushed, or shared externally:

1. **STOP. Do not amend/rebase** — preserve the evidence in history
2. **Rotate immediately** (see § 3). Assume the old value is public.
3. **Notify the team** (private channel, NOT the public issue tracker)
4. **Purge from history** with `git filter-repo` (NOT `git filter-branch`):
   ```bash
   pip install git-filter-repo
   git filter-repo --path infra/k8s/backstage/secret.yaml --invert-paths
   git push origin --force --all
   git push origin --force --tags
   ```
5. **Notify GitHub Support** if the secret was indexed in their public events
6. **Re-deploy** with the new value, verify the rotation works (§ 4 recipes)
7. **File an incident report** (date, secret, scope, response time, lessons)

---

## 6. Detection

### 6.1 Pre-commit (local)

`gitleaks protect --staged` runs automatically on `git commit` if you have pre-commit installed:

```bash
pip install pre-commit
pre-commit install
```

### 6.2 CI (push / PR)

`.github/workflows/secret-scan.yml` runs `gitleaks` against the full git history on every push and PR. It **fails the build** on any leak (allowlist in `.gitleaks.toml`).

### 6.3 Manual

```bash
bash scripts/scan-secrets.sh           # working tree
bash scripts/scan-secrets.sh staged    # staged changes only
bash scripts/scan-secrets.sh history   # full git history
```

---

## 7. Allowlist (intentional non-secrets)

Some strings LOOK like secrets but are not — and live in committed files:

| Pattern           | Where                                            | Why it's safe                          |
|-------------------|--------------------------------------------------|----------------------------------------|
| `<PLACEHOLDER_*>` | All `*.example*` templates                       | Linter-recognised placeholder          |
| `ghp_xxx`         | Error messages, docs, code comments              | Linter-recognised example              |
| `kubernal_dev`    | `secret.yaml.example` for dev cluster            | Documented dev-only default            |
| `admin@local`     | `infra/.env.example`                             | Documented dev-only pgAdmin login     |
| Test webhook body | `apps/api/test/fixtures/*.json`                  | Synthetic fixture                      |

These are allowlisted in `.gitleaks.toml`. To add a new pattern, edit that file and document the reason.

---

## 8. Changelog (rotation log)

| Date       | Secret rotated               | Reason                  | Rotated by |
|------------|------------------------------|-------------------------|------------|
| (template) | e.g. `GITHUB_TOKEN`          | e.g. 90-day schedule    | name       |

---

## 9. Future improvements (Standard Phase 14+)

- **Sealed Secrets** (`bitnami-labs/sealed-secrets`) — encrypt secrets in git, decrypt on the cluster
- **External Secrets Operator (ESO)** — sync from AWS/GCP/Vault secrets managers
- **SOPS + age** — file-level encryption for `kustomize`-built overlays
- **HashiCorp Vault** — dynamic DB credentials with auto-rotation
- **Workload Identity** — replace static `dockerconfigjson` with cloud IAM

See [Phase 14+ roadmap in the main project memory] for timeline.

---

## 10. Known false positives (GitHub Secret Scanning)

GitHub's [secret scanner](https://docs.github.com/en/code-security/secret-scanning/about-secret-scanning)
may flag values that match well-known third-party formats but are actually our own internal secrets.
When closing such an alert, link this section in the comment.

| Pattern                  | GitHub flags as                | Why it's a false positive                                                                                                                                                  |
|--------------------------|--------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `whsec_[a-f0-9]{48}`     | Stripe Webhook Signing Secret  | Our own webhook signing format, generated at runtime by [`generateSecret()`](../apps/api/src/shared/webhook-verify.ts#L62): HMAC-SHA256 of `kubernal-webhook` truncated to 48 hex chars. Used for HMAC signature verification on incoming GitHub / GitLab / Bitbucket push events. |

**Do NOT** add these patterns to `.gitleaks.toml` allowlist — we still want to detect accidental
commits of real values so we can redact them. The false positive only applies to GitHub's
public-facing scanner (and to our internal scanner on PRs from forks).

**When closing a false-positive alert**, use this template:

> False positive: this is our own webhook signing format (`apps/api/src/shared/webhook-verify.ts:62`), not a Stripe secret. The leaked value has been rotated via `POST /api/v1/applications/{id}/webhook/regenerate` and masked in the documentation. See `docs/SECURITY.md` § 10.

