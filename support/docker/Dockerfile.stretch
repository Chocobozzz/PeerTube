FROM node:8-stretch

# install ffmpeg
RUN apt-get update \
 && apt-get -y install ffmpeg \
 && rm /var/lib/apt/lists/* -fR

WORKDIR /usr/src/app

COPY package.json yarn.lock ./
COPY client/package.json client/yarn.lock client/
RUN yarn install --pure-lockfile

COPY . ./

RUN npm run build

ENV NODE_ENV production
ENV NODE_CONFIG_DIR ./docker

CMD ["npm", "start"]
VOLUME ["/usr/src/app/data"]
EXPOSE 9000
