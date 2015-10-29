# PeerTube

Prototype of a decentralized video streaming platform using P2P (bittorent) directly in the web browser with [webtorrent](https://github.com/feross/webtorrent).

[![js-standard-style](https://cdn.rawgit.com/feross/standard/master/badge.svg)](https://github.com/feross/standard)

## Features

- [ ] Join a network
  - [X] Generate a RSA key
  - [X] Ask for the friend list of other pods and make friend with them
  - [ ] Get the list of the videos owned by a pod when making friend with it
  - [ ] Post the list of its own videos when making friend with another pod
- [X] Upload a video
  - [X] Seed the video
  - [X] Send the meta data to all other friends
- [X] Remove the video
- [X] List the videos
- [X] Search a video name (local index)
- [X] View the video in an HTML5 page with webtorrent
- [ ]  Manage user accounts
  - [ ] Inscription
  - [ ] Connection
  - [ ] Account rights (upload...)
- [ ] Make the network auto sufficient (eject bad pods etc)
- [ ] Manage API breaks
- [ ] Add "DDOS" security (check if a pod don't send too many requests for example)

## Front compatibility

  * Chromium
  * Firefox (>= 42 for MediaSource support)


## Usage

### Dependencies

  * NodeJS >= 0.12
  * Grunt-cli (npm install -g grunt-cli)
  * OpenSSL (cli)
  * MongoDB
  * xvfb-run (for electron)

### Test It!

    $ git clone https://github.com/Chocobozzz/PeerTube
    $ cd PeerTube
    # npm install -g electron-prebuilt
    $ npm install
    $ npm start

### Test with 3 fresh nodes
    $ scripts/clean_test.sh
    $ scripts/run_servers.sh

Then you will can access to the three nodes at http://localhost:900{1,2,3}. If you call "make friends" on http://localhost:9002, the pod 2 and 3 will become friends. Then if you call "make friends" on http://localhost:9001 it will become friend with the pod 2 and 3 (check the configuration files). Then the pod will communicate with each others. If you add a video on the pod 3 you'll can see it on the pod 1 and 2 :)

## Why

We can't build a FOSS video streaming alternatives to YouTube, Dailymotion, Vimeo... with a centralized software.
One organization alone cannot have enought money to pay bandwith and video storage of its server.
So we need to have a decentralized network (as [Diaspora](https://github.com/diaspora/diaspora) for example).
But it's not enought because one video could become famous and overload the server.
It's the reason why we need to use a P2P protocol to limit the server load.
Thanks to [webtorrent](https://github.com/feross/webtorrent), we can make P2P (thus bittorrent) inside the web browser right now.

## Architecture

See [ARCHITECTURE.md](https://github.com/Chocobozzz/PeerTube/blob/master/ARCHITECTURE.md) for a more detailed explication.

### Backend

  * The backend whould be a REST API
  * Servers would communicate with each others with it
    * Each server of a network has a list of all other servers of the network
    * When a new installed server wants to join a network, it just has to get the list of the servers via one server and tell them "Hi I'm new in the network, communicate with me too please"
    * Each server has its own users who query it (search videos, where the torrent URI of this specific video is...)
    * Server begins to seed and sends to the other servers of the network the video information (name, short description, torrent URI) of a new uploaded video
    * Each server has a RSA key to encrypt and sign communications with other servers
  * A server is a tracker responsible for all the videos uploaded in it
  * Even if nobody watches a video, it is seeded by the server where the video was uploaded
  * A server would run webtorrent-hybrid to be a bridge with webrtc/standard bittorrent protocol
  * A network can live and evolve by expelling bad pod (with too many downtimes for example)

See the ARCHITECTURE.md for more informations. Do not hesitate to give your opinion :)

Here are some simple schemes:

![Decentralized](http://lutim.cpy.re/aV2pawRz)

![Watch a video](http://lutim.cpy.re/AlOeoVPi)

![Watch a video P2P](http://lutim.cpy.re/fb0JH6C3)

![Join a network](http://lutim.cpy.re/ijuCgmpI)

![Many networks](http://lutim.cpy.re/iz8mXHug)

### Frontend

There would be a simple frontend (Bootstrap, AngularJS) but since the backend is a REST API anybody could build a frontend (Web application, desktop application...).
The backend uses bittorent protocol, so users could use their favorite bittorent client to download/play the video after having its torrent URI.
