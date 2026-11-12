APP_DIR := .
EXTRA_TAGS ?=

.DEFAULT_GOAL := help
.PHONY: help dev test build build-windows

help:
	@printf '%s\n' \
		'make dev           Start the Wails development app' \
		'make test          Run Go and frontend checks' \
		'make build         Build for the host platform' \
		'make build-windows Cross-build the Windows/amd64 app' \
		'make build EXTRA_TAGS=gtk3  Use the legacy GTK 3 build path'

dev:
	@cd "$(APP_DIR)" && wails3 task dev

# Prefer system binutils so cgo does not resolve a Linuxbrew `ld` first.
test:
	@cd "$(APP_DIR)" && PATH="/usr/bin:/bin:$$PATH" go test ./...
	@cd "$(APP_DIR)/frontend" && npm run test:production-board && npm run test:hooks && npm run test:print-time && npm run test:theme && npm run build

build:
	@cd "$(APP_DIR)" && wails3 task build $(if $(EXTRA_TAGS),EXTRA_TAGS=$(EXTRA_TAGS))

build-windows:
	@cd "$(APP_DIR)" && wails3 build GOOS=windows
