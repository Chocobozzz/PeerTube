# Project Overview

PeerTube is an open-source, ActivityPub-federated video streaming platform
that uses P2P technology directly in web browsers. Developed by Framasoft
under the AGPL-3.0 license, it provides a decentralized alternative to
centralized video platforms. The server is a Node.js/Express API with a
Sequelize ORM (PostgreSQL), background job processing (BullMQ/Redis),
ActivityPub federation, and an Angular SPA client. Video transcoding is
handled via FFmpeg, with optional distributed runners.

## Repository Structure

- **apps/** — Standalone CLI applications (`peertube-cli`, `peertube-runner`)
- **client/** — Angular frontend SPA (separate build system; ignore for
  backend work)
- **config/** — YAML configuration files for dev, test, and production
- **packages/** — Shared workspace packages (monorepo):
  - `core-utils/` — Shared pure-JS utilities
  - `ffmpeg/` — FFmpeg wrapper library
  - `models/` — Shared TypeScript interfaces and API types
  - `node-utils/` — Node.js-specific helpers
  - `server-commands/` — HTTP client helpers used by tests
  - `tests/` — Full test suite (API, CLI, plugins, feeds, etc.)
  - `transcription/` — Speech-to-text engine integration
  - `transcription-devtools/` — Transcription benchmarking tools
  - `types-generator/` — Generates the public `@peertube/peertube-types`
    package
  - `typescript-utils/` — Generic TypeScript helpers
- **scripts/** — Build, CI, dev, release, and i18n shell scripts
- **server/** — Backend entry point and core application code
  - `server.ts` — Process entry point
  - `core/controllers/` — Express route handlers (API, ActivityPub,
    feeds, tracker)
  - `core/models/` — Sequelize database models (14 categories)
  - `core/lib/` — Business logic (transcoding, live, job queue,
    ActivityPub, plugins, runners, notifications, etc.)
  - `core/middlewares/` — Auth, rate-limiting, validation, caching, CSP
  - `core/helpers/` — Utility functions and custom validators
  - `core/initializers/` — App bootstrap, constants, DB migrations,
    config loading
  - `core/types/` — Internal TypeScript type augmentations
- **support/** — Documentation, Docker, Nginx configs, OpenAPI spec

## Build & Development Commands

### Prerequisites

- Node.js >= 22.x
- pnpm >= 10.9 (do **not** use npm or yarn for install)
- PostgreSQL >= 10 with `pg_trgm` and `unaccent` extensions
- Redis >= 6.x
- FFmpeg >= 4.3
- Python >= 3.8 (for some test tooling)

### Install dependencies

```bash
pnpm install --frozen-lockfile
```

### Build

```bash
# Build server only (backend work)
npm run build:server

# Build full application (server + client)
npm run build

# Build tests
npm run build:tests

# Build individual apps
npm run build:peertube-cli
npm run build:peertube-runner
```

### Development

```bash
# Server-only with hot reload (recommended for backend work)
npm run dev:server        # http://localhost:9000

# Full stack (server + Angular client)
npm run dev               # server :9000, client :3000

# Dev credentials: root / test
```

### Lint & type-check

```bash
# Full lint (oxlint + OpenAPI validation)
npm run lint

# Oxlint only
npm run oxlint

# Validate OpenAPI spec
npm run swagger-cli -- validate support/doc/api/openapi.yaml

# TypeScript compilation check
npm run tsc -b server/tsconfig.json
```

### Run in production

```bash
npm run start              # server + client
npm run start:server       # server only (--no-client)
```

## Code Style & Conventions

### Formatting (enforced by Oxlint)

| Rule                | Value                                 |
|---------------------|---------------------------------------|
| Semicolons          | **never** (`@stylistic/semi`)         |
| Max line length     | 140 characters                        |
| Quotes              | Single quotes (TypeScript default)    |
| Array brackets      | Spaces inside `[ 'a', 'b' ]`         |
| Trailing newline    | Required (`eol-last`)                 |
| Indentation         | 2 spaces (TypeScript convention)      |

### Naming patterns

- Database models: `VideoModel`, `UserModel` — PascalCase + `Model` suffix
- Internal type aliases: `MVideo`, `MVideoWithChannel` — `M` prefix for
  Sequelize model types with specific association requirements
- Controllers: one file per resource, registered in parent `index.ts`
- Validators: mirror controller structure under
  `server/core/middlewares/validators/`

### Controller pattern

```typescript
import express from 'express'
import { apiRateLimiter, asyncMiddleware } from '../../middlewares/index.js'

const router = express.Router()
router.use(apiRateLimiter)  // always include rate limiting

router.get('/:id',
  validationMiddleware,     // always validate inputs
  asyncMiddleware(handler)  // always wrap async handlers
)
```

### Commit messages

No formal commit-message template.

### Oxlint config

Defined in `oxlint.config.mjs`. Applies to `server/**/*.ts`,
`scripts/**/*.ts`, `packages/**/*.ts`, `apps/**/*.ts`. The `client/`
directory has its own lint config.

## Architecture Notes

```
                  ┌──────────────────────────────────────────┐
                  │            Reverse Proxy (Nginx)         │
                  └──────────────┬───────────────────────────┘
                                 │
              ┌──────────────────▼──────────────────────┐
              │          Express.js API Server           │
              │  (server/server.ts → core/controllers/)  │
              │                                          │
              │  ┌─────────┐ ┌──────────┐ ┌──────────┐  │
              │  │  REST   │ │Activity- │ │  Feeds/  │  │
              │  │  API    │ │  Pub     │ │  oEmbed  │  │
              │  │  /api/* │ │  /inbox  │ │  /feeds  │  │
              │  └────┬────┘ └────┬─────┘ └────┬─────┘  │
              │       │           │             │        │
              │  ┌────▼───────────▼─────────────▼────┐  │
              │  │       Middleware Pipeline          │  │
              │  │  (auth, validators, rate-limit)    │  │
              │  └────────────────┬───────────────────┘  │
              │                   │                      │
              │  ┌────────────────▼───────────────────┐  │
              │  │        Business Logic (lib/)       │  │
              │  │  videos, live, transcoding,        │  │
              │  │  federation, notifications,        │  │
              │  │  plugins, runners                  │  │
              │  └──┬──────────┬──────────────┬───┘   │
              └─────┼──────────┼──────────────┼───────┘
                    │          │              │
          ┌────────▼──┐ ┌─────▼─────┐ ┌──────▼──────┐
          │PostgreSQL │ │   Redis   │ │  FFmpeg /   │
          │(Sequelize)│ │ (BullMQ   │ │  Runners    │
          │           │ │  + cache) │ │             │
          └───────────┘ └───────────┘ └─────────────┘
```

**Startup sequence** (`server/server.ts`):

1. Register OpenTelemetry tracing
2. Pre-init checks (config, FFmpeg, Node.js version)
3. Connect to PostgreSQL, run migrations
4. Initialize Sequelize models and load i18n
5. Configure Express middleware stack (proxy trust, CSP, CORS,
   rate-limiting, OAuth2 auth, express-validator)
6. Mount route controllers and start listening

**Key data flows**:

- **Video upload**: REST API → validator middleware → `lib/video.ts` →
  job queue → FFmpeg transcoding → HLS/web-video files → object
  storage or local filesystem
- **Federation**: Incoming ActivityPub requests → signature
  verification → `lib/activitypub/` processors → local DB updates +
  outgoing fan-out
- **Live streaming**: RTMP ingest → FFmpeg segmenter → HLS manifest →
  P2P delivery via WebSocket tracker

## Testing Strategy

### Test framework

- **Mocha** for all server/API tests
- **GNU Parallel** for running test files concurrently in CI
- Tests live in `packages/tests/src/` (TypeScript source) and are
  compiled to `packages/tests/dist/`

### Preparation

```bash
# Create PostgreSQL superuser for test DB management
sudo -u postgres createuser $(whoami) --createdb --superuser

# Clean test databases
npm run clean:server:test

# Build server + tests
npm run build:server
npm run build:tests
```

### Running tests

```bash
# Full suite (slow, ~45-60 min)
npm run test

# Run a specific CI suite
npm run ci -- api-1       # check-params, notifications, search
npm run ci -- api-2       # live, server plugins, users
npm run ci -- api-3       # videos, stats
npm run ci -- api-4       # moderation, redundancy, object-storage,
                          # activitypub
npm run ci -- api-5       # transcoding, runners
npm run ci -- client      # feeds, client, misc-endpoints, plugins
npm run ci -- cli-plugin  # CLI and plugin tests
npm run ci -- lint        # OXlint + OpenAPI validation + client lint
npm run ci -- transcription
npm run ci -- external-plugins

# Run a single test file
npm run mocha -- --timeout 30000 --exit --bail \
  packages/tests/src/api/videos/single-server.ts
```

### External test dependencies (Docker)

Some tests require these containers:

```bash
docker run -p 9444:9000 chocobozzz/s3-ninja
docker run -p 10389:10389 chocobozzz/docker-test-openldap
docker run -p 8082:8080 \
  -e KC_BOOTSTRAP_ADMIN_USERNAME=admin \
  -e KC_BOOTSTRAP_ADMIN_PASSWORD=admin \
  chocobozzz/peertube-tests-keycloak
```

### CI pipeline

GitHub Actions (`.github/workflows/test.yml`), Ubuntu 22.04, Node.js
22.x. Matrix strategy runs suites in parallel: `types-package`,
`client`, `api-1`–`api-5`, `cli-plugin`, `lint`, `transcription`,
`external-plugins`.

Services provisioned per job: PostgreSQL 10, Redis, LDAP, S3 Ninja,
Keycloak.

### Environment variables for tests

| Variable                                   | Purpose                     |
|--------------------------------------------|-----------------------------|
| `DISABLE_HTTP_IMPORT_TESTS=true`           | Skip flaky HTTP import tests|
| `DISABLE_HTTP_YOUTUBE_IMPORT_TESTS=true`   | Skip YouTube import tests   |
| `ENABLE_OBJECT_STORAGE_TESTS=true`         | Enable S3 tests             |

## Security & Compliance

- **License**: AGPL-3.0 — all network-facing modifications must be
  published under the same license.
- **Secrets**: The `secrets.peertube` key in `config/*.yaml` must be
  generated via `openssl rand -hex 32`. Never commit secrets; use
  `config/local-*.json` overrides (gitignored) or environment variables.
- **OAuth2**: Access tokens expire in 1 day; refresh tokens in 2 weeks
  (configurable in `config/default.yaml`).
- **Rate limiting**: All API endpoints are rate-limited by default
  (`apiRateLimiter` middleware). Specific limits per category (login,
  signup, ActivityPub, etc.) are configured in `config/default.yaml`.
- **CSP**: Content-Security-Policy headers are configurable and applied
  via `server/core/middlewares/csp.ts`.
- **Input validation**: Every controller uses express-validator
  middleware defined in `server/core/middlewares/validators/`.
- **Vulnerability reporting**: `peertube-security@framasoft.org` —
  see `SECURITY.md`.
- **Dependency scanning**: No automated scanner configuration found in
  the repo.

## Agent Guardrails

### Files and directories agents must NOT modify

- `config/local-*.json` — User-local config overrides (gitignored)
- `config/production.yaml.example` — Template; changes need release
  coordination
- `server/core/initializers/migrations/` — Existing migration files are
  immutable once released; only append new ones
- `pnpm-lock.yaml` — Regenerated by `pnpm install`; never edit manually
- `support/doc/api/openapi.yaml` — Must stay in sync with controllers;
  validate with `npm run swagger-cli -- validate`

### Required checks before pushing

1. `npm run build:server` must succeed
2. `npm run lint` must pass
3. If API surface changed: `npm run swagger-cli -- validate
   support/doc/api/openapi.yaml`
4. If database schema changed: create a new migration file **and**
   increment `LAST_MIGRATION_VERSION` in
   `server/core/initializers/constants.ts`

### Boundaries

- Do not run `pnpm install` without `--frozen-lockfile`
- Do not use `npm install` or `yarn` — this project uses **pnpm**
- Do not add dependencies without explicit approval
- Do not modify test Docker images or CI service definitions without
  review
- Maximum concurrency for background jobs is configured in constants;
  do not change without benchmarking

## Extensibility Hooks

### Plugin system

PeerTube supports server and client plugins via a hook-based
architecture. Plugins register `filter`, `action`, and `static`
hooks—see `support/doc/plugins/guide.md`.

- Plugin names follow `peertube-plugin-*` (themes: `peertube-theme-*`)
- Server hooks are registered in `server/core/lib/plugins/`
- Plugin management API: `/api/v1/plugins`
- Install/uninstall scripts: `npm run plugin:install`,
  `npm run plugin:uninstall`

### Configuration

All runtime configuration is in YAML under `config/`. Local overrides
use `config/local-*.json` files (gitignored). Key env vars:

| Variable              | Purpose                              |
|-----------------------|--------------------------------------|
| `NODE_ENV`            | `production`, `development`, `test`  |
| `NODE_CONFIG_DIR`     | Override config directory             |
| `LOGGER_LEVEL`        | `debug`, `info`, `warn`, `error`     |
| `PT_INITIAL_ROOT_PASSWORD` | Set root password on first run  |

### Runners (distributed transcoding)

External `peertube-runner` processes poll the API for transcoding jobs.
Configured in `server/core/lib/runners/` and managed through the
`/api/v1/runners` endpoints.

### OpenTelemetry

Tracing and metrics are instrumented via `@opentelemetry/*` packages.
Export to Jaeger (tracing) or Prometheus (metrics) is configurable in
`config/default.yaml` under the `open_telemetry` key.

## Further Reading

- [support/doc/development/server.md](support/doc/development/server.md)
  — Server code conventions and new-feature walkthrough
- [support/doc/development/tests.md](support/doc/development/tests.md)
  — Test setup and execution guide
- [support/doc/plugins/guide.md](support/doc/plugins/guide.md)
  — Plugin & theme development guide
- [support/doc/api/openapi.yaml](support/doc/api/openapi.yaml)
  — OpenAPI 3.0 specification
- [support/doc/production.md](support/doc/production.md)
  — Production deployment guide
- [support/doc/docker.md](support/doc/docker.md)
  — Docker deployment guide
- [support/doc/development/lib.md](support/doc/development/lib.md)
  — Library / business-logic documentation
- [SECURITY.md](SECURITY.md) — Vulnerability disclosure policy
- [FAQ.md](FAQ.md) — Frequently asked questions
