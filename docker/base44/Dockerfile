# Development image for running PeerTube's dev stack (server + Angular client)
# from the bind-mounted source tree. Never used to bake application code.
FROM node:22

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg python3 make g++ curl \
  && rm -rf /var/lib/apt/lists/*

# Same pnpm version as the "packageManager" field of package.json.
# The store lives outside the bind-mounted source tree (see the compose volume).
RUN npm install -g pnpm@10.15.1 \
  && pnpm config set --global store-dir /pnpm-store

WORKDIR /app
