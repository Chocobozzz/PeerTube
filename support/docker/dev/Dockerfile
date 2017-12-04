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

# Configure and build PeerTube.
RUN yarn install \
 && npm run build
