# PeerTube CLI

## Usage

See https://docs.joinpeertube.org/maintain/tools#remote-tools

## Dev

## Install dependencies

```bash
cd peertube-root
yarn install --pure-lockfile
cd apps/peertube-cli && yarn install --pure-lockfile
```

## Develop

```bash
cd peertube-root
npm run dev:peertube-cli
```

## Build

```bash
cd peertube-root
npm run build:peertube-cli
```

## Run

```bash
cd peertube-root
node apps/peertube-cli/dist/peertube-cli.js --help
```

## Publish on NPM

```bash
cd peertube-root
(cd apps/peertube-cli && npm version patch) && npm run build:peertube-cli && (cd apps/peertube-cli && npm publish --access=public)
```
