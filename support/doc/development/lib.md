# Lib development documentation

## @peertube/embed-api

### Build & Publish

```
$ cd client/src/standalone/player/
$ npm run build
$ npm publish --access=public
```

## @peertube/peertube-types

Typescript definition files generation is controlled by the various `tsconfig.types.json` files.

The complete types package is generated via:

```
$ npm run generate-types-package
$ cd dist
$ npm publish --access=public
```

> See [scripts/generate-types-package.ts](scripts/generate-types-package.ts) for details.
