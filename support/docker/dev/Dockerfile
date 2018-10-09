FROM ubuntu:bionic

# Avoid tzdata interactive dialog
ENV DEBIAN_FRONTEND=noninteractive

# Install PeerTube's dependencies.
# Packages are from https://github.com/Chocobozzz/PeerTube#dependencies
RUN apt-get update -q && apt-get install -qy \
 curl \
 nano \
 ffmpeg \
 postgresql \
 postgresql-contrib \
 openssl \
 g++ \
 make \
 redis-server \
 git \
 gnupg

# Install NodeJS 8.x
RUN curl -sL https://deb.nodesource.com/setup_8.x | bash - && \
 apt-get install -y nodejs

# Install Yarn
RUN curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add - && \
 echo "deb https://dl.yarnpkg.com/debian/ stable main" | tee /etc/apt/sources.list.d/yarn.list && \
 apt-get update && apt-get install yarn

# Download PeerTube's source code.
RUN git clone -b develop https://github.com/Chocobozzz/PeerTube /home/user/PeerTube
WORKDIR /home/user/PeerTube

# Install dependencies.
RUN yarn install --pure-lockfile

# Configure and run PeerTube.
COPY setup_postgres.sql /tmp/
RUN service postgresql start \
 && su postgres -c "psql --file=/tmp/setup_postgres.sql"

# Expose PeerTube sources as a volume
VOLUME /home/user/PeerTube

EXPOSE 3000 9000

# Start PostgreSQL and Redis
CMD service postgresql start && redis-server
