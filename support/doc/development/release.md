# Release

 * Fix remaining important bugs
 * Update [/CHANGELOG.md](/CHANGELOG.md)
 * Check migrations:
```
npm run clean:server:test
git checkout master && rm -r ./node_modules && yarn install --pure-lockfile && npm run build:server
NODE_APP_INSTANCE=6 NODE_ENV=test npm run start
git checkout develop && rm -r ./node_modules && yarn install --pure-lockfile && npm run build:server
NODE_APP_INSTANCE=6 NODE_ENV=test npm run start
```
 * Run `rm -r node_modules && rm -r client/node_modules && yarn install --pure-lockfile && npm run build` to see if all the supported languages compile correctly
 * Update https://peertube2.cpy.re and check it works correctly
 * Check CI tests are green
 * Run E2E tests: `BROWSERSTACK_USER=my_user BROWSERSTACK_KEY=my_key npm run e2e`
 * Release: `GITHUB_TOKEN=my_token npm run release -- 1.x.x`
 * Create a dedicated branch: `git checkout -b release/1.x.x && git push origin release/1.x.x`
 * Check the release is okay: https://github.com/Chocobozzz/PeerTube/releases
 * Update https://peertube3.cpy.re and check it works correctly
 * Update all other instances and check it works correctly
 * Communicate on Mastodon & peertube-admin mailing list
