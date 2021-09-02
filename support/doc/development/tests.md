# Tests

## Preparation

Prepare PostgreSQL user so PeerTube can delete/create the test databases:

```
$ sudo -u postgres createuser you_username --createdb --superuser
```

Prepare databases:

```
$ npm run clean:server:test
```

Build PeerTube:

```
$ npm run build
```

## Server tests

### Dependencies

Run docker containers needed by some test files:

```
$ sudo docker run -p 9444:9000 chocobozzz/s3-ninja
$ sudo docker run -p 10389:10389 chocobozzz/docker-test-openldap
```

### Test

To run all test suites:

```
$ npm run test # See scripts/test.sh to run a particular suite
```

To run a particular test file:

```
TS_NODE_TRANSPILE_ONLY=true mocha -- --timeout 30000 --exit -r ts-node/register -r tsconfig-paths/register --bail server/tests/api/videos/video-transcoder.ts
```

### Configuration

Some env variables can be defined to disable/enable some tests:

 * `DISABLE_HTTP_IMPORT_TESTS`: disable import tests (because of youtube that could rate limit your IP)
 * `ENABLE_OBJECT_STORAGE_TESTS=true`: enable object storage tests (needs a docker container first)


## Client E2E tests

### Local tests

To run tests on local web browsers (comment web browsers you don't have in `client/e2e/wdio.local.conf.ts`):

```
$ npm run e2e:local
```

### Browserstack tests

To run tests on browser stack:

```
$ BROWSERSTACK_USER=your_user BROWSERSTACK_KEY=your_key npm run e2e:browserstack
```
