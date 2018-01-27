FROM janx/ubuntu-dev
MAINTAINER Jan Keromnes <janx@linux.com>

# Install PeerTube's dependencies.
# Packages are from https://github.com/Chocobozzz/PeerTube#dependencies
RUN sudo apt-get update -q && sudo apt-get install -qy \
 ffmpeg \
 postgresql \
 openssl

# Download PeerTube's source code.
RUN git clone -b develop https://github.com/Chocobozzz/PeerTube /home/user/PeerTube
WORKDIR /home/user/PeerTube

# Configure Cloud9 IDE to use PeerTube's source directory as workspace (-w).
RUN sudo sed -i "s/-w \/home\/user/-w \/home\/user\/PeerTube/" /etc/supervisord.conf

# Install dependencies.
RUN yarn install --pure-lockfile

# Configure Janitor for PeerTube.
ADD janitor.json /home/user/
RUN sudo chown user:user /home/user/janitor.json

# Configure and build PeerTube.
ADD create_user.sql /tmp/
RUN sudo service postgresql start \
 && sudo -u postgres psql --file=/tmp/create_user.sql \
 && npm run build

ADD supervisord.conf /tmp/supervisord-extra.conf
RUN cat /tmp/supervisord-extra.conf | sudo tee -a /etc/supervisord.conf

EXPOSE 3000 9000
