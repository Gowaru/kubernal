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
	docker compose -f infra/docker-compose.yml down
	@echo "$(GREEN)✓ Services arrêtés$(RESET)"

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
	kubectl apply -f infra/kubernetes/namespaces/
	@echo "$(GREEN)✓ Namespaces créés$(RESET)"

.PHONY: kind-setup
kind-setup: kind-up kind-ingress kind-namespaces ## Setup complet du cluster Kind

# ─── Développement local ───────────────────────────────────────────────────
.PHONY: dev-api
dev-api: ## Lance l'API en mode développement
	@echo "$(BLUE)→ Démarrage de l'API...$(RESET)"
	npm run dev -w apps/api

.PHONY: dev-backstage
dev-backstage: ## Lance Backstage en mode développement
	@echo "$(BLUE)→ Démarrage de Backstage...$(RESET)"
	cd apps/backstage && yarn dev

.PHONY: dev
dev: up dev-api ## Lance la stack de développement (Docker + API)

# ─── Migration Prisma ──────────────────────────────────────────────────────
.PHONY: prisma-generate
prisma-generate: ## Génère le client Prisma
	@echo "$(BLUE)→ Génération du client Prisma...$(RESET)"
	npm run prisma:generate -w apps/api

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
