# PeerTube runner

Runner program to execute jobs (transcoding...) of remote PeerTube instances.

Commands below has to be run at the root of PeerTube git repository.

## Dev

### Install dependencies

```bash
cd peertube-root
npm run install-node-dependencies
```

### Develop

```bash
cd peertube-root
npm run dev:peertube-runner
```

### Build

```bash
cd peertube-root
npm run build:peertube-runner
```

### Run

```bash
cd peertube-root
node apps/peertube-runner/dist/peertube-runner.js --help
```

### Publish on NPM

```bash
cd peertube-root
(cd apps/peertube-runner && npm version patch) && npm run build:peertube-runner && (cd apps/peertube-runner && npm publish --access=public)
```
