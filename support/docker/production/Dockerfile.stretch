FROM node:8-stretch

RUN set -ex; \
    if ! command -v gpg > /dev/null; then \
      apt-get update; \
      apt-get install -y --no-install-recommends \
        gnupg \
        dirmngr \
      ; \
      rm -rf /var/lib/apt/lists/*; \
fi

# Install dependencies
RUN apt-get update \
    && apt-get -y install ffmpeg \
    && rm /var/lib/apt/lists/* -fR

# Add peertube user
RUN groupadd -r peertube \
    && useradd -r -g peertube -m peertube

# grab gosu for easy step-down from root
RUN set -eux; \
	apt-get update; \
	apt-get install -y gosu; \
	rm -rf /var/lib/apt/lists/*; \
	gosu nobody true

# Install PeerTube
WORKDIR /app
COPY . ./
RUN chown -R peertube:peertube /app

USER peertube

RUN yarn install --pure-lockfile \
    && npm run build \
    && rm -r ./node_modules ./client/node_modules \
    && yarn install --pure-lockfile --production \
    && yarn cache clean

USER root

RUN mkdir /data /config
RUN chown -R peertube:peertube /data /config

ENV NODE_ENV production
ENV NODE_CONFIG_DIR /config

VOLUME /data
VOLUME /config

COPY ./support/docker/production/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]

# Run the application
CMD ["npm", "start"]
EXPOSE 9000
