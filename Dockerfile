FROM node:8

# install yarn
RUN apt-get update && apt-get install -y apt-transport-https \
 && curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add - \
 && echo "deb https://dl.yarnpkg.com/debian/ stable main" | tee /etc/apt/sources.list.d/yarn.list \
 && apt-get update && apt-get install -y yarn \
 && rm /var/lib/apt/lists/* -fR

# install ffmpeg
RUN echo "deb http://ftp.uk.debian.org/debian jessie-backports main" >/etc/apt/sources.list.d/jessie-backports.list \
 && apt-get update \
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
VOLUME ["/data"]
EXPOSE 9000
