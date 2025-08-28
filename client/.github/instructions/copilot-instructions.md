# PeerTube Client Development Instructions for Coding Agents

## Client Overview

This is the Angular frontend for PeerTube, a decentralized video hosting platform. The client is built with Angular 20+, TypeScript, and SCSS. It communicates with the PeerTube server API and provides the web interface for users, administrators, and content creators.

**Key Technologies:**
- Angular 20+ with standalone components
- TypeScript 5+
- SCSS for styling
- RxJS for reactive programming
- PrimeNg and Bootstrap for UI components
- WebdriverIO for E2E testing
- Angular CLI

## Client Build and Development Commands

### Prerequisites (for client development)
- Node.js 20+
- yarn 1
- Running PeerTube server (see ../server instructions)

### Essential Client Commands

```bash
# From the client directory:
cd /client

# 1. Install dependencies (ALWAYS first)
yarn install --pure-lockfile

# 2. Development server with hot reload
npm run dev

# 3. Build for production
npm run build
```

### Client Testing Commands
```bash
# From client directory:
npm run lint                # ESLint for client code
```

### Common Client Issues and Solutions

**Angular Build Failures:**
- Always run `yarn install --pure-lockfile` after pulling changes
- Clear `node_modules` and reinstall if dependency errors occur
- Build may fail on memory issues: `NODE_OPTIONS="--max-old-space-size=4096" npm run build`
- Check TypeScript errors carefully - Angular is strict about types

**Development Server Issues:**
- Default port is 3000, ensure it's not in use
- Hot reload may fail on file permission issues
- Clear browser cache if changes don't appear

## Client Architecture and File Structure

### Client Directory Structure
```
/src/
  /app/
    +admin/           # Admin interface components
    +my-account/      # User account management pages
    +my-library/      # User's videos, playlists, subscriptions
    +search/          # Search functionality and results
    +shared/          # Shared Angular components, services, pipes
    +standalone/      # Standalone Angular components
    +videos/          # Video-related components (watch, upload, etc.)
    /core/            # Core services (auth, server, notifications)
    /helpers/         # Utility functions and helpers
    /menu/            # Navigation menu components
  /assets/            # Static assets (images, icons, etc.)
  /environments/      # Environment configurations
  /locale/            # Internationalization files
  /sass/              # Global SCSS styles
```

### Key Client Configuration Files

- `angular.json` - Angular CLI workspace configuration
- `tsconfig.json` - TypeScript configuration for client
- `e2e/wdio*.conf.js` - WebdriverIO E2E test configurations
- `src/environments/` - Environment-specific configurations

### Shared Code with Server (`../shared/`)

The client imports TypeScript models and utilities from the shared directory:
- `../shared/models/` - Data models (Video, User, Channel, etc.). Import these in client code: `import { Video } from '@peertube/peertube-models'`
- `../shared/core-utils/` - Utility functions shared between client/server. Import these in client code: `import { ... } from '@peertube/peertube-core-utils'`
-

## Client Development Workflow

### Making Client Changes

1. **Angular Components:** Create/modify in `/src/app/` following existing patterns
2. **Shared Components:** Reusable components go in `/src/app/shared/`
3. **Services:** Core services in `/src/app/core/`, feature services with components
4. **Styles:** Component styles in `.scss` files, global styles in `/src/sass/`
5. **Assets:** Images, icons in `/src/assets/`
6. **Routing:** Routes defined in feature modules or `app-routing.module.ts`

## Trust These Instructions

These instructions are comprehensive and tested specifically for client development. Only search for additional information if:
1. Commands fail despite following instructions exactly
2. New error messages appear that aren't documented here
3. You need specific Angular implementation details not covered above

For server-side questions, refer to the server instructions in `../.github/copilot-instructions.md`.
