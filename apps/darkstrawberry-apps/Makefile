.PHONY: help dev build preview deploy deploy-hosting firebase

# Default version from package.json
VERSION ?= $(shell node -p "require('./package.json').version")

help: ## Show this help message
	@echo 'Usage: make [target] [VERSION=x.y.z]'
	@echo ''
	@echo 'Available targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-15s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

dev: ## Start development server
	npm run dev

build: ## Build for production
	VITE_APP_VERSION=$(VERSION) npm run build

preview: ## Preview production build
	npm run preview

deploy: build ## Deploy to Firebase (all services)
	@echo "🚀 Deploying version $(VERSION)..."
	npx firebase deploy

deploy-hosting: build ## Deploy to Firebase (hosting only)
	@echo "🚀 Deploying version $(VERSION) to hosting..."
	npx firebase deploy --only hosting

firebase: ## Run Firebase CLI
	npx firebase $(ARGS)

# Pattern rule for versioned deployments: make deploy-v1.0.1
deploy-v%:
	@$(MAKE) deploy VERSION=$(patsubst deploy-v%,%,$@)

# Pattern rule for versioned hosting deployments: make deploy-hosting-v1.0.1
deploy-hosting-v%:
	@$(MAKE) deploy-hosting VERSION=$(patsubst deploy-hosting-v%,%,$@)
