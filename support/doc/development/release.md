# Release

## PeerTube

 * Fix remaining important bugs
 * Ensure French translation is 100% (for the screens in the JoinPeerTube blog post)
 * Update [/CHANGELOG.md](/CHANGELOG.md)
 * Check migrations:
```
npm run clean:server:test
git checkout master && rm -r ./node_modules && yarn install --pure-lockfile && npm run build:server
NODE_APP_INSTANCE=6 NODE_ENV=test node dist/server --benchmark-startup
git checkout develop && rm -r ./node_modules && yarn install --pure-lockfile && npm run build:server
NODE_APP_INSTANCE=6 NODE_ENV=test node dist/server --benchmark-startup
```
 * Run `rm -rf node_modules && rm -rf client/node_modules && yarn install --pure-lockfile && npm run build` to see if all the supported languages compile correctly
 * Update https://peertube2.cpy.re and check it works correctly
 * Check CI tests are green
 * Run BrowserStack **and** local E2E tests
 * Release: `GITHUB_TOKEN=my_token npm run release -- 1.x.x`
 * Upload `tar.xz` on https://builds.joinpeertube.org/release
 * Create a dedicated branch: `git checkout -b release/1.x.x && git push origin release/1.x.x`
 * Check the release is okay: https://github.com/Chocobozzz/PeerTube/releases
 * Update https://peertube3.cpy.re and check it works correctly
 * Update all other instances and check it works correctly
 * After a couple of days, update https://joinpeertube.org/api/v1/versions.json


## @peertube/embed-api

```
cd client/src/standalone/player
npm version patch
npm run build
npm publish --access=public
```
