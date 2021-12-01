# Continuous integration

PeerTube uses Github Actions as a CI platform.
CI tasks are described in `.github/workflows`.

## benchmark.yml

*Scheduled*

Run various benchmarks (build, API etc) and upload results on https://builds.joinpeertube.org/peertube-stats/ to be publicly consumed.

## codeql.yml

*Scheduled, on push on develop and on pull request*

Run CodeQL task to throw code security issues in Github. https://lgtm.com/projects/g/Chocobozzz/PeerTube can also be used.

## docker.yml

*Scheduled and on push on master*

Build `chocobozzz/peertube-webserver:latest`, `chocobozzz/peertube:production-...`, `chocobozzz/peertube:v-...` (only latest PeerTube tag) and `chocobozzz/peertube:develop-...` Docker images. Scheduled to automatically upgrade image software (Debian security issues etc).

## nightly.yml

*Scheduled*

Build PeerTube nightly build (`develop` branch) and upload the release on https://builds.joinpeertube.org/nightly.

## stats.yml

*On push on develop*

Create various PeerTube stats (line of codes, build size, lighthouse report) and upload results on https://builds.joinpeertube.org/peertube-stats/ to be publicly consumed.

## test.yml

*Scheduled, on push and pull request*

Run PeerTube lint and tests.
