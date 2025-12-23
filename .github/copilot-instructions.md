# PeerTube Copilot Instructions

## Repository Overview

PeerTube is an open-source, ActivityPub-federated video streaming platform using P2P technology directly in web browsers. It's developed by Framasoft and provides a decentralized alternative to centralized video platforms like YouTube.

**Repository Stats:**
- **Size**: Large monorepo (~350MB, ~15k files)
- **Type**: Full-stack web application
- **Languages**: TypeScript (backend), Angular (frontend), Shell scripts
- **Target Runtime**: Node.js >=20.x, PostgreSQL >=10.x, Redis >=6.x
- **Package Manager**: Yarn 1.x (NOT >=2.x)
- **Architecture**: Express.js API server + Angular SPA client + P2P video delivery

## Critical: Client Directory Exclusion

**🚫 ALWAYS IGNORE `client/` directory** - it contains a separate Angular frontend project with its own build system, dependencies, and development workflow. Focus only on the server-side backend code.

## Build & Development Commands

### Prerequisites (Required)
1. **Dependencies**: Node.js >=20.x, Yarn 1.x, PostgreSQL >=10.x, Redis >=6.x, FFmpeg >=4.3, Python >=3.8
2. **PostgreSQL Setup**:
   ```bash
   sudo -u postgres createuser -P peertube
   sudo -u postgres createdb -O peertube peertube_dev
   sudo -u postgres psql -c "CREATE EXTENSION pg_trgm;" peertube_dev
   sudo -u postgres psql -c "CREATE EXTENSION unaccent;" peertube_dev
   ```
3. **Services**: Start PostgreSQL and Redis before development

### Installation & Build (Execute in Order)
```bash
# 1. ALWAYS install dependencies first (takes ~2-3 minutes)
yarn install --frozen-lockfile

# 2. Build server (required for most operations, takes ~3-5 minutes)
npm run build:server

# 3. Optional: Build full application (takes ~10-15 minutes)
npm run build
```

**⚠️ Critical Notes:**
- Always run `yarn install --frozen-lockfile` before any build operation
- Server build is prerequisite for testing and development
- Never use `npm install` - always use `yarn`
- Build failures often indicate missing PostgreSQL extensions or wrong Node.js version

### Development Commands
```bash
# Server-only development (recommended for backend work)
npm run dev:server  # Starts server on localhost:9000 with hot reload

# Full stack development (NOT recommended if only working on server)
npm run dev         # Starts both server (9000) and client (3000)

# Development credentials:
# Username: root
# Password: test
```

### Testing Commands (Execute in Order)
```bash
# 1. Prepare test environment (required before first test run)
sudo -u postgres createuser $(whoami) --createdb --superuser
npm run clean:server:test

# 2. Build (required before testing)
npm run build

# 3. Run specific test suites (recommended over full test)
npm run ci -- api-1     # API tests part 1
npm run ci -- api-2     # API tests part 2
npm run ci -- lint      # Linting only
npm run ci -- client    # Client tests

# 4. Run single test file
npm run mocha -- --exit --bail packages/tests/src/api/videos/single-server.ts

# 5. Full test suite (takes ~45-60 minutes, avoid unless necessary)
npm run test
```

**⚠️ Test Environment Notes:**
- Tests require PostgreSQL user with createdb/superuser privileges
- Some tests need Docker containers for S3/LDAP simulation
- Test failures often indicate missing system dependencies or DB permissions
- Set `DISABLE_HTTP_IMPORT_TESTS=true` to skip flaky import tests

### Validation Commands
```bash
# Lint code (runs ESLint + OpenAPI validation)
npm run lint

# Validate OpenAPI spec
npm run swagger-cli -- validate support/doc/api/openapi.yaml

# Build server
npm run build:server
```

## Project Architecture & Layout

### Server-Side Structure (Primary Focus)
```
server/core/
├── controllers/api/     # Express route handlers (add new endpoints here)
│   ├── index.ts        # Main API router registration
│   ├── videos/         # Video-related endpoints
│   └── users/          # User-related endpoints
├── models/             # Sequelize database models
│   ├── video/          # Video, channel, playlist models
│   └── user/           # User, account models
├── lib/                # Business logic services
│   ├── job-queue/      # Background job processing
│   └── emailer.ts      # Email service
├── middlewares/        # Express middleware
│   ├── validators/     # Input validation (always required)
│   └── auth.ts         # Authentication middleware
├── helpers/            # Utility functions
└── initializers/       # App startup and constants
```

### Key Configuration Files
- `package.json` - Main dependencies and scripts
- `server/package.json` - Server-specific config
- `eslint.config.mjs` - Linting rules
- `tsconfig.base.json` - TypeScript base config
- `config/default.yaml` - Default app configuration
- `.mocharc.cjs` - Test runner configuration

### Shared Packages (`packages/`)
```
packages/
├── models/             # Shared TypeScript interfaces (modify for API changes)
├── core-utils/         # Common utilities
├── ffmpeg/             # Video processing
├── server-commands/    # Test helpers
└── tests/             # Test files
```

### Scripts Directory (`scripts/`)
- `scripts/build/` - Build automation
- `scripts/dev/` - Development helpers
- `scripts/ci.sh` - Continuous integration runner
- `scripts/test.sh` - Test runner

## Continuous Integration Pipeline

**GitHub Actions** (`.github/workflows/test.yml`):
1. **Matrix Strategy**: Tests run in parallel across different suites
2. **Required Services**: PostgreSQL, Redis, LDAP, S3, Keycloak containers
3. **Test Suites**: `types-package`, `client`, `api-1` through `api-5`, `transcription`, `cli-plugin`, `lint`, `external-plugins`
4. **Environment**: Ubuntu 22.04, Node.js 20.x
5. **Typical Runtime**: 15-30 minutes per suite

**Pre-commit Checks**: ESLint, TypeScript compilation, OpenAPI validation

## Making Code Changes

### Adding New API Endpoint
1. Create controller in `server/core/controllers/api/`
2. Add validation middleware in `server/core/middlewares/validators/`
3. Register route in `server/core/controllers/api/index.ts`
4. Update shared types in `packages/models/`
5. Add OpenAPI documentation tags
6. Write tests in `packages/tests/src/api/`

### Common Patterns to Follow
```typescript
// Controller pattern
import express from 'express'
import { apiRateLimiter, asyncMiddleware } from '../../middlewares/index.js'

const router = express.Router()
router.use(apiRateLimiter)  // ALWAYS include rate limiting

router.get('/:id',
  validationMiddleware,     // ALWAYS validate inputs
  asyncMiddleware(handler)  // ALWAYS wrap async handlers
)
```

### Database Changes
1. Create/modify Sequelize model in `server/core/models/`
2. Generate migration in `server/core/initializers/migrations/`
3. Update shared types in `packages/models/`
4. Run `npm run build:server` to compile

## Validation Steps Before PR

1. **Build**: `npm run build` (must succeed)
2. **Lint**: `npm run lint` (must pass without errors)
5. **OpenAPI**: Validate if API changes made

## Common Error Solutions

**Build Errors:**
- "Cannot find module": Run `yarn install --frozen-lockfile`
- "PostgreSQL connection": Check PostgreSQL is running and extensions installed
- TypeScript errors: Check Node.js version (must be >=20.x)

**Test Errors:**
- Permission denied: Ensure PostgreSQL user has createdb/superuser rights
- Port conflicts: Stop other PeerTube instances
- Import test failures: Set `DISABLE_HTTP_IMPORT_TESTS=true`

**Development Issues:**
- "Client dist not found": Run `npm run build:client` (only if working on client features)
- Redis connection: Ensure Redis server is running
- Hot reload not working: Kill all Node processes and restart

## Trust These Instructions

These instructions have been validated against the current codebase. Only search for additional information if:
- Commands fail with updated error messages
- New dependencies are added to package.json
- Build system changes are detected
- You need specific implementation details not covered here

Focus on server-side TypeScript development in `server/core/` and ignore the `client/` directory unless explicitly working on frontend integration.
