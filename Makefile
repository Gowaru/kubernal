# =============================================================================
# Kubernal IDP – Makefile
# =============================================================================
# Commandes centralisées pour le développement local
# =============================================================================

SHELL := /bin/bash
.NOTPARALLEL:

# ─── Couleurs ────────────────────────────────────────────────────────────────
BLUE   := \033[1;34m
GREEN  := \033[1;32m
YELLOW := \033[1;33m
RED    := \033[1;31m
RESET  := \033[0m

# ─── Utilitaires ─────────────────────────────────────────────────────────────
.PHONY: help
help: ## Affiche cette aide
	@echo "$(BLUE)Kubernal IDP – Commandes disponibles$(RESET)"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "$(GREEN)%-20s$(RESET) %s\n", $$1, $$2}'

# ─── Installation ────────────────────────────────────────────────────────────
.PHONY: install
install: ## Installe toutes les dépendances du monorepo
	@echo "$(BLUE)→ Installation des dépendances...$(RESET)"
	npm install
	@echo "$(GREEN)✓ Dépendances installées$(RESET)"

.PHONY: clean
clean: ## Nettoie node_modules, dist, et cache
	@echo "$(YELLOW)→ Nettoyage...$(RESET)"
	rm -rf node_modules apps/*/node_modules packages/*/node_modules
	rm -rf apps/*/dist packages/*/dist
	@echo "$(GREEN)✓ Nettoyage terminé$(RESET)"

.PHONY: reinstall
reinstall: clean install ## Réinstalle toutes les dépendances

# ─── Qualité du code ────────────────────────────────────────────────────────
.PHONY: lint
lint: ## Vérifie le lint (ESLint)
	@echo "$(BLUE)→ Lint...$(RESET)"
	npm run lint

.PHONY: lint-fix
lint-fix: ## Corrige automatiquement le lint
	@echo "$(BLUE)→ Lint fix...$(RESET)"
	npm run lint:fix

.PHONY: format
format: ## Vérifie le formatage (Prettier)
	@echo "$(BLUE)→ Format...$(RESET)"
	npm run format

.PHONY: format-fix
format-fix: ## Formate automatiquement
	@echo "$(BLUE)→ Format fix...$(RESET)"
	npm run format:fix

.PHONY: typecheck
typecheck: ## Vérifie les types TypeScript
	@echo "$(BLUE)→ Typecheck...$(RESET)"
	npm run typecheck

.PHONY: test
test: ## Exécute tous les tests
	@echo "$(BLUE)→ Tests...$(RESET)"
	npm run test

.PHONY: check
check: lint format typecheck test ## Exécute toutes les vérifications (lint + format + typecheck + test)

# ─── Build ──────────────────────────────────────────────────────────────────
.PHONY: build
build: ## Build tous les packages et apps
	@echo "$(BLUE)→ Build...$(RESET)"
	npm run build

# ─── Infrastructure locale (Docker) ─────────────────────────────────────────
.PHONY: up
up: ## Démarre PostgreSQL et les services locaux (Docker Compose)
	@echo "$(BLUE)→ Démarrage des services Docker...$(RESET)"
	docker compose -f infra/docker-compose.yml up -d
	@echo "$(GREEN)✓ Services démarrés$(RESET)"

.PHONY: down
down: ## Arrête les services Docker
	@echo "$(YELLOW)→ Arrêt des services Docker...$(RESET)"
	docker compose -f infra/docker-compose.yml --profile ui down
	@echo "$(GREEN)✓ Services arrêtés$(RESET)"

.PHONY: up-ui
up-ui: ## Démarre tous les services (PostgreSQL + pgAdmin UI + exporter)
	@echo "$(BLUE)→ Démarrage de tous les services (incl. pgAdmin)...$(RESET)"
	docker compose -f infra/docker-compose.yml --profile ui up -d
	@echo "$(GREEN)✓ Tous les services démarrés — pgAdmin: http://localhost:5050$(RESET)"

.PHONY: logs
logs: ## Affiche les logs des services Docker
	docker compose -f infra/docker-compose.yml logs -f

.PHONY: db-reset
db-reset: ## Réinitialise la base de données (⚠️ supprime toutes les données)
	@echo "$(RED)⚠  Réinitialisation de la base de données...$(RESET)"
	docker compose -f infra/docker-compose.yml down -v
	docker compose -f infra/docker-compose.yml up -d
	@echo "$(GREEN)✓ Base de données réinitialisée$(RESET)"

# ─── Cluster Kubernetes local (Kind) ───────────────────────────────────────
.PHONY: kind-up
kind-up: ## Crée le cluster Kind local
	@echo "$(BLUE)→ Création du cluster Kind 'kubernal'...$(RESET)"
	kind create cluster --config infra/kind-config.yaml
	@echo "$(GREEN)✓ Cluster Kind créé$(RESET)"

.PHONY: kind-down
kind-down: ## Supprime le cluster Kind
	@echo "$(YELLOW)→ Suppression du cluster Kind...$(RESET)"
	kind delete cluster --name kubernal
	@echo "$(GREEN)✓ Cluster Kind supprimé$(RESET)"

.PHONY: kind-ingress
kind-ingress: ## Installe NGINX Ingress Controller dans Kind
	@echo "$(BLUE)→ Installation de NGINX Ingress...$(RESET)"
	kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml
	@echo "$(GREEN)✓ Ingress NGINX installé (attendez quelques secondes)$(RESET)"

.PHONY: kind-namespaces
kind-namespaces: ## Crée les namespaces K8s
	@echo "$(BLUE)→ Création des namespaces...$(RESET)"
	kubectl apply -f infra/k8s/namespaces/
	@echo "$(GREEN)✓ Namespaces créés$(RESET)"

.PHONY: kind-setup
kind-setup: kind-up kind-ingress kind-namespaces ## Setup complet du cluster Kind (cluster + ingress + namespaces)

# ─── Déploiement K8s local ─────────────────────────────────────────────────
.PHONY: k8s-deploy-dev
k8s-deploy-dev: ## Déploie l'API + Backstage + PostgreSQL dans kubernal-dev
	@echo "$(BLUE)→ Déploiement sur kubernal-dev...$(RESET)"
	kubectl apply -k infra/overlays/dev
	@echo "$(GREEN)✓ Déploiement effectué sur kubernal-dev$(RESET)"

.PHONY: k8s-deploy-staging
k8s-deploy-staging: ## Déploie l'API + Backstage + PostgreSQL dans kubernal-staging
	@echo "$(BLUE)→ Déploiement sur kubernal-staging...$(RESET)"
	kubectl apply -k infra/overlays/staging
	@echo "$(GREEN)✓ Déploiement effectué sur kubernal-staging$(RESET)"

.PHONY: k8s-deploy-prod
k8s-deploy-prod: ## Déploie l'API + Backstage + PostgreSQL dans kubernal-prod
	@echo "$(BLUE)→ Déploiement sur kubernal-prod...$(RESET)"
	kubectl apply -k infra/overlays/prod
	@echo "$(GREEN)✓ Déploiement effectué sur kubernal-prod$(RESET)"

.PHONY: k8s-deploy
k8s-deploy: k8s-deploy-dev ## Déploie tout sur l'environnement dev (par défaut)

.PHONY: k8s-deploy-all
k8s-deploy-all: k8s-deploy-dev k8s-deploy-staging k8s-deploy-prod ## Déploie sur tous les environnements

.PHONY: k8s-status
k8s-status: ## Affiche l'état des déploiements K8s
	@echo "$(BLUE)→ Pods:$(RESET)"
	kubectl get pods --all-namespaces | grep -E "kubernal|postgres"
	@echo "$(BLUE)→ Services:$(RESET)"
	kubectl get services --all-namespaces | grep -E "kubernal|postgres"
	@echo "$(BLUE)→ Ingress:$(RESET)"
	kubectl get ingress --all-namespaces | grep -E "kubernal"

# ─── ArgoCD ─────────────────────────────────────────────────────────────────
.PHONY: argocd-install
argocd-install: ## Installe ArgoCD dans le cluster Kind
	@echo "$(BLUE)→ Installation d'ArgoCD...$(RESET)"
	kubectl create namespace argocd --dry-run=client -o yaml | kubectl apply -f -
	kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
	@echo "$(GREEN)✓ ArgoCD installé$(RESET)"

.PHONY: argocd-password
argocd-password: ## Récupère le mot de passe admin ArgoCD
	@echo "$(BLUE)→ Mot de passe admin ArgoCD:$(RESET)"
	kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d
	@echo ""

.PHONY: argocd-port-forward
argocd-port-forward: ## Expose ArgoCD sur http://localhost:8080
	@echo "$(BLUE)→ ArgoCD UI: http://localhost:8080$(RESET)"
	kubectl port-forward -n argocd svc/argocd-server 8080:443

.PHONY: argocd-login
argocd-login: ## Login à ArgoCD via CLI
	@echo "$(BLUE)→ Connexion à ArgoCD...$(RESET)"
	argocd login localhost:8080 --insecure --username admin --password $$(kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d)

.PHONY: argocd-apply-project
argocd-apply-project: ## Apply l'AppProject Kubernal
	@echo "$(BLUE)→ Application du projet ArgoCD...$(RESET)"
	kubectl apply -f infra/argocd/projects/
	@echo "$(GREEN)✓ Projet ArgoCD appliqué$(RESET)"

.PHONY: argocd-apply-apps
argocd-apply-apps: ## Apply les Applications ArgoCD
	@echo "$(BLUE)→ Application des Applications ArgoCD...$(RESET)"
	kubectl apply -f infra/argocd/applications/
	@echo "$(GREEN)✓ Applications ArgoCD appliquées$(RESET)"

.PHONY: argocd-setup
argocd-setup: argocd-install argocd-apply-project argocd-apply-apps ## Setup complet ArgoCD (install + project + apps)

# ─── Développement local ───────────────────────────────────────────────────
.PHONY: dev-api
dev-api: ## Lance l'API en mode développement
	@echo "$(BLUE)→ Démarrage de l'API...$(RESET)"
	npm run dev -w apps/api

.PHONY: dev-backstage
dev-backstage: ## Lance Backstage en mode développement
	@echo "$(BLUE)→ Démarrage de Backstage...$(RESET)"
	cd apps/backstage && yarn start

.PHONY: backstage-install
backstage-install: ## Installe les dépendances Backstage (yarn install)
	@echo "$(BLUE)→ Installation des dépendances Backstage...$(RESET)"
	cd apps/backstage && yarn install --frozen-lockfile
	@echo "$(GREEN)✓ Backstage prêt$(RESET)"

.PHONY: backstage-migrate
backstage-migrate: ## Applique les migrations Backstage (création tables)
	@echo "$(BLUE)→ Migration Backstage...$(RESET)"
	cd apps/backstage && yarn backstage-cli package migrate
	@echo "$(GREEN)✓ Migration Backstage effectuée$(RESET)"

.PHONY: dev
dev: up dev-api ## Lance la stack de développement (Docker + API)

# ─── Docker Build ───────────────────────────────────────────────────────────
.PHONY: docker-build-api
docker-build-api: ## Build l'image Docker de l'API (tag: kubernal/api:latest)
	@echo "$(BLUE)→ Build de l'image API...$(RESET)"
	docker build -t kubernal/api:latest -f apps/api/Dockerfile .
	@echo "$(GREEN)✓ Image kubernal/api:latest créée$(RESET)"

.PHONY: docker-build-backstage
docker-build-backstage: ## Build l'image Docker de Backstage (tag: kubernal/backstage:latest)
	@echo "$(BLUE)→ Build de l'image Backstage...$(RESET)"
	docker build -t kubernal/backstage:latest -f apps/backstage/packages/backend/Dockerfile .
	@echo "$(GREEN)✓ Image kubernal/backstage:latest créée$(RESET)"

# ─── Migration Prisma ──────────────────────────────────────────────────────
.PHONY: prisma-generate
prisma-generate: ## Génère le client Prisma
	@echo "$(BLUE)→ Génération du client Prisma...$(RESET)"
	npx prisma generate --schema=apps/api/prisma/schema.prisma

.PHONY: prisma-migrate
prisma-migrate: ## Applique les migrations Prisma
	@echo "$(BLUE)→ Migration Prisma...$(RESET)"
	npm run prisma:migrate -w apps/api

# ─── Healthcheck ────────────────────────────────────────────────────────────
.PHONY: health
health: ## Vérifie l'état des services
	@echo "$(BLUE)→ Vérification des services...$(RESET)"
	@echo "PostgreSQL : $$(docker compose -f infra/docker-compose.yml exec -T postgres pg_isready -U kubernal 2>/dev/null && echo '$(GREEN)✓ OK$(RESET)' || echo '$(RED)✗ DOWN$(RESET)')"
	@echo "API        : $$(curl -sf http://localhost:4000/health 2>/dev/null && echo '$(GREEN)✓ OK$(RESET)' || echo '$(RED)✗ DOWN$(RESET)')"
