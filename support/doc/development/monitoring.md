# Monitoring

## Client modules

To open a report of client build:

```
npm run build -- --analyze-bundle && npm run client-report
```

## API benchmark

To benchmark the REST API and save result in `benchmark.json`:

```
npm run benchmark-server -- -o benchmark.json
```

You can also grep on a specific test:

```
npm run benchmark-server -- --grep homepage
```
