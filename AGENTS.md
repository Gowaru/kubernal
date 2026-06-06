# CRITICAL RULES - MUST FOLLOW

## RESPONSES

- Keep responses concise and to the point in french - unless the user asks otherwise

## PLANNING MODE

- Always ask clarifying questions
- Never assume design, tech stack or features
- Use deep-dive sub-agents to assist with research
- Use deep-dive sub-agents to review the different aspects of your plan before presenting to the user

## CHANGE / EDIT MODE

- Never implement features yourself when possible - use sub-agents!
- Identify changes from the plan that can be implemented in parallel, and use sub-agents to implement the features efficiently
- When using sub-agents to implement features, act as a coordinator only
- Use the best model for the task - premium models for complex tasks (like coding) and mid-tier models for simpler tasks, like documentation
- After completing features (large or small), always run commands like lint, type check and next build to check code quality

## DATABASE SCHEMA CHANGES

- Whenever you make changes to the database schema, ALWAYS run the prisma generate and migrate commands
- NEVER run prisma push!

## TESTING

- Use any testing tools, libraries available to the project for testing your changes
- Never assume your changes simply work, always test!
- If the project does not have any testing tools, scripts, MCP tools, skills, etc. available for testing, ask the user whether testing should be skipped.

## SECRETS MANAGEMENT

- **NEVER** commit real secrets, tokens, passwords, private keys, or cert material
- Real manifests follow `secret.yaml` pattern → already in `.gitignore` (use `secret.yaml.example` for templates)
- Real env files (`.env`) → already in `.gitignore` (use `.env.example` for templates)
- Placeholder format inside committed templates: `<PLACEHOLDER_NAME_IN_SNAKE_CASE>`
- Pre-commit hook `.pre-commit-config.yaml` runs gitleaks on staged changes
- CI workflow `.github/workflows/secret-scan.yml` runs gitleaks on full git history
- Manual scan: `bash scripts/scan-secrets.sh` (working tree) or `bash scripts/scan-secrets.sh history`
- Allowlist config: `.gitleaks.toml` (placeholders, `*.example*` paths)
- Rotation procedure + allowed storage: see `docs/SECURITY.md`
- If a secret leaks: see `docs/SECURITY.md § Incident Response` (rotate → purge history → re-deploy)

