FROM janitortechnology/ubuntu-dev

# Install PeerTube's dependencies.
# Packages are from https://github.com/Chocobozzz/PeerTube#dependencies
RUN sudo apt-get update -q && sudo apt-get install -qy \
 ffmpeg \
 postgresql \
 openssl

# Download PeerTube's source code.
RUN git clone -b develop https://github.com/Chocobozzz/PeerTube /home/user/PeerTube
WORKDIR /home/user/PeerTube

# Configure the IDEs to use Janitor's source directory as workspace.
ENV WORKSPACE /home/user/PeerTube/

# Install dependencies.
RUN yarn install --pure-lockfile

# Configure Janitor for PeerTube.
COPY --chown=user:user janitor.json /home/user/

# Configure and build PeerTube.
COPY create_user.sql /tmp/
RUN sudo service postgresql start \
 && sudo -u postgres psql --file=/tmp/create_user.sql \
 && npm run build

COPY --chown=user:user supervisord.conf /tmp/supervisord-extra.conf
RUN cat /tmp/supervisord-extra.conf | sudo tee -a /etc/supervisord.conf

EXPOSE 3000 9000
