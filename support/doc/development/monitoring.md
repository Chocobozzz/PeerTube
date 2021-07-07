# Monitoring

## Client modules

To open a report of client build:

```
$ npm run build -- --analyze-bundle && npm run client-report
```

## API benchmark

To benchmark the REST API and save result in `benchmark.json`:

```
$ node dist/scripts/benchmark.js benchmark.json
```
