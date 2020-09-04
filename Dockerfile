FROM node:12.18.3-buster-slim

# Install dependencies
RUN apt update \
 && apt install -y --no-install-recommends openssl ffmpeg python ca-certificates gnupg gosu \
 && gosu nobody true \
 && rm /var/lib/apt/lists/* -fR

# Install PeerTube
COPY . /app
WORKDIR /app

ARG SERVICE_PORT
ARG NODE_ENV
ARG NOCLIENT
ARG SERVICE_PORT

RUN yarn install

EXPOSE ${SERVICE_PORT}
