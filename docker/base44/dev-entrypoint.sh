#!/bin/sh
# Starts PeerTube's development stack (Express API on :9000 + Angular client on :3000)
# against the compose PostgreSQL/Redis services, from the bind-mounted source tree.
set -eu

cd "$(dirname "$0")/../.."

# Base44 sandbox preview: the dev client (host port 3000) is the only public entry point
# and proxies /api, /static, /client... to the local server. Tell PeerTube that its public
# origin is that preview URL so the absolute URLs it generates (thumbnails, avatars, HLS
# playlists...) go through the same proxy. Keep PeerTube's own default behaviour (localhost:9000)
# when the preview flag is unset, e.g. in a normal local `npm run dev` session.
if [ "${BASE44_PREVIEW_MODE:-}" = "1" ] && [ -n "${BASE44_PUBLIC_HOST_SUFFIX:-}" ]; then
  PEERTUBE_PUBLIC_HOST="3000-${BASE44_PUBLIC_HOST_SUFFIX}"
else
  PEERTUBE_PUBLIC_HOST=""
fi

# The API serves /client/* from client/dist, and the dev client fetches /client/assets (mascots,
# default avatars...) through it. `npm run dev` only copies the locales there, so publish the
# source assets too (skipped once a real client build has produced client/dist/assets).
mkdir -p client/dist
[ -d client/dist/assets ] || cp -r client/src/assets client/dist/assets

# node-config overrides shared with the dev tooling, merged on top of config/default.yaml + config/dev.yaml
NODE_CONFIG="$(node -e '
process.stdout.write(JSON.stringify({
  database: { hostname: process.env.PEERTUBE_DB_HOST || "127.0.0.1" },
  redis: { hostname: process.env.PEERTUBE_REDIS_HOST || "127.0.0.1" }
}))
')"

# node-config also loads config/local-$NODE_ENV.json (gitignored): the API reads the public
# webserver hostname from there. It is not put in $NODE_CONFIG because
# client/src/standalone/videos/vite.config.mjs uses $NODE_CONFIG.webserver.hostname as the
# address its dev server *binds* to, which makes `npm run dev` crash-loop
if [ -n "$PEERTUBE_PUBLIC_HOST" ]; then
  printf '{\n  "webserver": { "hostname": "%s", "port": 443, "https": true }\n}\n' \
    "$PEERTUBE_PUBLIC_HOST" > config/local-dev.json
fi

export NODE_CONFIG
export NODE_ENV=dev

exec npm run dev
