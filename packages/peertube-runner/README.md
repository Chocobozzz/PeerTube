# PeerTube runner

Runner program to execute jobs (transcoding...) of remote PeerTube instances.

Commands below has to be run at the root of PeerTube git repository.

## Develop

```bash
npm run dev:peertube-runner
```

## Build

```bash
npm run build:peertube-runner
```

## Run

```bash
node packages/peertube-runner/dist/peertube-runner.js --help
```

## Publish on NPM

```bash
(cd packages/peertube-runner && npm version patch) && npm run build:peertube-runner && (cd packages/peertube-runner && npm publish --access=public)
```
