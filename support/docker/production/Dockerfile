FROM node:8-stretch

# Install dependencies
RUN apt-get update \
    && apt-get -y install ffmpeg \
    && rm /var/lib/apt/lists/* -fR

# Configure the application
RUN groupadd -g 991 peertube \
 && useradd -u 991 -g peertube -d /data -m peertube \
 && mkdir /config \
 && cp /app/support/docker/production/config/* /config/ \
 && cp /app/config/default.yaml /config/

USER peertube
WORKDIR /app

RUN yarn install --pure-lockfile \
    && npm run build

# Configure PeerTube
RUN cp /app/config/default.yaml /app/support/docker/production/config/default.yaml
ENV NODE_ENV production
ENV NODE_CONFIG_DIR /config

# Run the application
CMD ["npm", "start"]
VOLUME ["/data"]
EXPOSE 9000
