FROM ubuntu:bionic

# Avoid tzdata interactive dialog
ENV DEBIAN_FRONTEND=noninteractive

# Install PeerTube's dependencies.
# Packages are from https://github.com/Chocobozzz/PeerTube#dependencies
RUN apt-get update -q && apt-get install -qy \
      curl \
      ffmpeg \
      g++ \
      git \
      gnupg \
      make \
      nano \
      openssl \
      postgresql \
      postgresql-contrib \
      redis-server \
    && curl -sL https://deb.nodesource.com/setup_10.x | bash - \
    && curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add - \
    && echo "deb https://dl.yarnpkg.com/debian/ stable main" | tee /etc/apt/sources.list.d/yarn.list \
    && apt-get update \
    && apt-get install -qy nodejs yarn \
    && rm -rf /var/lib/apt/lists/*

# Download PeerTube's source code.
RUN git clone -b develop https://github.com/Chocobozzz/PeerTube /home/user/PeerTube
WORKDIR /home/user/PeerTube

# Copy postgresql setup script
COPY setup_postgres.sql /tmp/

# Install Node.js dependencies and setup PostgreSQL
RUN yarn install --pure-lockfile \
    && service postgresql start \
    && su postgres -c "psql --file=/tmp/setup_postgres.sql"

# Expose PeerTube sources as a volume
VOLUME /home/user/PeerTube

# Expose API and frontend
EXPOSE 3000 9000

# Start PostgreSQL and Redis
CMD ["service postgresql start && redis-server"]
