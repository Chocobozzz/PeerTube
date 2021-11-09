# Lib development documentation

## @peertube/embed-api

### Build

```
$ cd client/src/standalone/player/
$ npm run build
```

## @peertube/peertube-types

Typescript definition files generation is controlled by the various `tsconfig.types.json` files, see:
```
yarn tsc -b --verbose tsconfig.types.json
```

But the complete types package is generated via:
```
yarn generate-types-package
```
> See [scripts/generate-types-package.ts](scripts/generate-types-package.ts) for details.
