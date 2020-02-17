FROM node:10-buster-slim

# Allow to pass extra options to the npm run build
# eg: --light --light-fr to not build all client languages
#     (speed up build time if i18n is not required)
ARG NPM_RUN_BUILD_OPTS

# Install dependencies
RUN apt update \
 && apt install -y --no-install-recommends openssl ffmpeg python ca-certificates gnupg gosu \
 && gosu nobody true \
 && rm /var/lib/apt/lists/* -fR

# Add peertube user
RUN groupadd -r peertube \
    && useradd -r -g peertube -m peertube

# Install PeerTube
COPY --chown=peertube:peertube . /app
WORKDIR /app

USER peertube

RUN yarn install --pure-lockfile \
    && npm run build -- $NPM_RUN_BUILD_OPTS \
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
