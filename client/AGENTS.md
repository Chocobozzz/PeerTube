# Client — Angular Frontend SPA

PeerTube's web client is an Angular single-page application served
under `/client/`. It communicates with the backend exclusively through
the REST API (`/api/v1/`). A separate Vite-built embed player lives
in `src/standalone/` for third-party iframe embedding.

## Directory Structure

- **src/app/** — Main Angular application
  - `+about/`, `+admin/`, `+home/`, `+login/`, `+signup/`, etc. —
    Lazy-loaded route modules (prefixed with `+`)
  - `core/` — Singleton services: auth, routing, plugins, theme,
    server config, notifications, screen-size helpers
  - `shared/` — Reusable components & directives organized by domain
    (`shared-video/`, `shared-forms/`, `shared-moderation/`, etc.)
  - `header/`, `menu/`, `modal/` — App shell layout components
  - `helpers/` — Client-side utility functions
  - `hotkeys/` — Keyboard shortcut definitions
  - `app.routes.ts` — Top-level route definitions (lazy-loaded)
  - `app.component.ts` — Root component
- **src/root-helpers/** — Framework-agnostic helpers (logger, storage,
  theme manager, translations, plugin manager) shared between the
  main app and standalone builds
- **src/standalone/** — Independently built artifacts:
  - `player/` — PeerTube video player (Vite build, HLS.js + P2P)
  - `embed-player-api/` — Public npm package for programmatic
    embed control (`@peertube/embed-api`)
  - `videos/` — Embed page (`embed.html`) and test harness
- **src/sass/** — Global SCSS: Bootstrap overrides, PrimeNG theme,
  utility classes, z-index scale, fonts
- **src/locale/** — Angular XLIFF translation files
- **src/assets/** — Static images and assets
- **src/environments/** — Angular environment configs
- **e2e/** — End-to-end tests (WebdriverIO + Mocha)
- **proxy.config.json** — Dev-server proxy to backend (:9000)

## Build & Development Commands

All commands run from the **repository root** unless noted.

### Development

```bash
# Full stack: server (:9000) + Angular dev server (:3000)
npm run dev

# Client only (requires a running backend on :9000)
npm run dev:client

# Embed player only
npm run dev:embed
```

The Angular dev server proxies `/api`, `/plugins`, `/themes`,
`/static`, `/lazy-static`, `/socket.io`, and `/client/assets` to the
backend at `http://127.0.0.1:9000` (see `proxy.config.json`).

### Build

```bash
# Full client build (production)
npm run build:client

# Embed player build
npm run build:embed
```

Output goes to `client/dist/` with per-locale sub-directories
(e.g. `client/dist/en-US/`, `client/dist/fr-FR/`).

### Lint

```bash
# From repository root
cd client

# TypeScript + Angular templates (ESLint)
npm run lint-ts

# SCSS (Stylelint)
npm run lint-scss

# Both
npm run lint
```

### E2E tests

```bash
# Local browser (from repo root)
npm run e2e:local

# BrowserStack
npm run e2e:browserstack
```

E2E uses **WebdriverIO** with a **Mocha** framework. Config files are
in `e2e/` (`wdio.local.conf.ts`, `wdio.browserstack.conf.ts`).

## Code Style & Conventions

### TypeScript / ESLint

The client has its own `eslint.config.mjs` extending
`eslint-config-love` and `angular-eslint`. Key rules match the
server:

| Rule                | Value                             |
|---------------------|-----------------------------------|
| Semicolons          | **never** (`@stylistic/semi`)     |
| Max line length     | 140 characters                    |
| Array brackets      | Spaces inside `[ 'a', 'b' ]`     |
| Trailing newline    | Required (`eol-last`)             |
| Indentation         | 2 spaces                          |

### Angular-specific rules

| Rule                                     | Value                    |
|------------------------------------------|--------------------------|
| Component selector prefix               | `my-` (kebab-case)       |
| Directive selector prefix               | `my` (camelCase)         |
| View encapsulation                       | Required (enforced)      |

### SCSS / Stylelint

Configured in `.stylelintrc.json`, extends
`stylelint-config-sass-guidelines` with `stylelint-order`. Key rules:

- Declaration order: custom properties → declarations → `@include`
- Max nesting depth: 8
- Max compound selectors: 9
- `::ng-deep` pseudo-element allowed

### Naming patterns

- Lazy-loaded route folders: `+feature-name/` (e.g. `+admin/`,
  `+video-watch/`)
- Shared modules: `shared-domain/` (e.g. `shared-video/`,
  `shared-forms/`)
- Services: PascalCase with `Service` suffix
  (`AuthService`, `ServerService`)
- Components: PascalCase with `Component` suffix, selector prefixed
  `my-` (`my-video-miniature`)
- Path aliases: `@app/*` → `src/app/*`,
  `@root-helpers/*` → `src/root-helpers/*`

### Internationalization

- Source locale: `en` (base href `/client/en-US/`)
- Translation files: XLIFF format in `src/locale/`
- Merge tool: `@peertube/xliffmerge` (config: `.xliffmerge.json`)
- Use Angular `$localize` / `i18n` attributes; do NOT use raw strings
  for user-visible text

## Architecture Notes

```
┌────────────────────────────────────────────────────────┐
│                 Angular SPA (client/)                   │
│                                                         │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  Routes   │  │  Core        │  │  Shared          │  │
│  │ (+about,  │  │ (auth, REST, │  │ (forms, video    │  │
│  │  +admin,  │──│  plugins,    │──│  miniature,      │  │
│  │  +videos) │  │  server,     │  │  moderation...)  │  │
│  │           │  │  theme)      │  │                  │  │
│  └──────────┘  └──────┬───────┘  └──────────────────┘  │
│                        │                                │
│  ┌─────────────────────▼────────────────────────────┐   │
│  │           root-helpers (no Angular dep)           │   │
│  │  logger, storage, plugins-manager, theme, i18n   │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │         standalone/ (Vite builds)               │    │
│  │  player/ │ embed-player-api/ │ videos/embed     │    │
│  └─────────────────────────────────────────────────┘    │
└────────────────────────┬────────────────────────────────┘
                         │ HTTP (REST API)
                         ▼
              ┌──────────────────────┐
              │  Express Backend     │
              │  (:9000 /api/v1/*)   │
              └──────────────────────┘
```

- **Lazy loading**: Each `+feature/` folder exports route configs
  loaded via `loadChildren` in `app.routes.ts`
- **Core services**: Singletons bootstrapped in `main.ts` via
  `getCoreProviders()` — auth, REST client, server config polling,
  plugin hooks, theme manager
- **Plugin hooks**: Client-side plugins register via
  `HooksService` / `PluginService` in `core/plugins/`
- **State management**: No dedicated store library; services hold
  state, components subscribe via RxJS observables
- **UI framework**: Bootstrap 5 + PrimeNG + ng-bootstrap;
  global SCSS in `src/sass/`
- **Video player**: Custom build in `standalone/player/` using
  Video.js + HLS.js + P2P Media Loader; embedded via
  `standalone/videos/embed.html`

## Agent Guardrails

### Files agents must NOT modify

- `src/locale/*.xlf` — Generated translation files; updated via
  `npm run i18n:update` only
- `dist/` — Build output; never edit manually
- `node_modules/` — Managed by pnpm
- `.angular/` — Angular build cache

### Required checks before pushing

1. `cd client && npm run lint` must pass (TS + SCSS)
2. Production build must succeed: `npm run build:client`
   (from repo root)
3. If new user-visible strings added: extract with
   `npm run i18n:create-custom-files` and verify XLIFF

### Boundaries

- Do not import from `server/` — the client communicates with the
  backend exclusively via the REST API
- Do not import Angular-specific code in `root-helpers/` or
  `standalone/` — these must remain framework-agnostic
- Shared API types come from `@peertube/peertube-models` and
  `@peertube/peertube-core-utils` (workspace packages)
- Do not add new npm dependencies without explicit approval

## Further Reading

- [../support/doc/plugins/guide.md](../support/doc/plugins/guide.md)
  — Plugin & theme development (client hooks)
- [src/standalone/embed-player-api/README.md](src/standalone/embed-player-api/README.md)
  — Embed player API documentation
- [../support/doc/api/embeds.md](../support/doc/api/embeds.md)
  — Embed integration guide
- [../AGENTS.md](../AGENTS.md)
  — Root project AGENTS.md (server, build, CI, testing)
