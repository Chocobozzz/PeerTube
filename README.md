<h1 align="center">
  PeerTube
</h1>

<h4 align="center">
Federated (ActivityPub) video streaming platform using P2P (BitTorrent)
directly in the web browser with <a href="https://github.com/feross/webtorrent">WebTorrent</a>.
</h4>

**PeerTube is sponsored by [Framasoft](https://framatube.org/#en), a non-profit
that promotes, spreads and develops free culture in general, and free-libre
software in particular. If you want to support this project, please [consider
donating them](https://soutenir.framasoft.org/en/).**

<p align="center">
  <strong>Client</strong>

  <br />

  <a href="https://david-dm.org/Chocobozzz/PeerTube?path=client">
    <img src="https://david-dm.org/Chocobozzz/PeerTube.svg?path=client" alt="Dependency Status" />
  </a>

  <a href="https://david-dm.org/Chocobozzz/PeerTube?path=client#info=dev">
    <img src="https://david-dm.org/Chocobozzz/PeerTube/dev-status.svg?path=client" alt="devDependency Status" />
  </a>
</p>

<p align="center">
  <strong>Server</strong>

  <br />

  <a href="https://travis-ci.org/Chocobozzz/PeerTube">
    <img src="https://travis-ci.org/Chocobozzz/PeerTube.svg?branch=develop" alt="Build Status" />
  </a>

  <a href="https://david-dm.org/Chocobozzz/PeerTube">
    <img src="https://david-dm.org/Chocobozzz/PeerTube.svg" alt="Dependencies Status" />
  </a>

  <a href="https://david-dm.org/Chocobozzz/PeerTube#info=dev">
    <img src="https://david-dm.org/Chocobozzz/PeerTube/dev-status.svg" alt="devDependency Status" />
  </a>

  <a href="http://standardjs.com/">
    <img src="https://img.shields.io/badge/code%20style-standard-brightgreen.svg" alt="JavaScript Style Guide" />
  </a>

  <a href="https://kiwiirc.com/client/irc.freenode.net/#peertube">
    <img src="https://img.shields.io/badge/%23peertube-on%20freenode-brightgreen.svg" alt="PeerTube Freenode IRC" />
  </a>
</p>

<br />

<p align="center">
  <a href="https://peertube.cpy.re">
    <img src="https://lutim.cpy.re/mRdBAdeD.png" alt="screenshot" />
  </a>
</p>

## Demonstration

Want to see it in action?

   * Demonstration servers:
     * [peertube.cpy.re](http://peertube.cpy.re) 
     * [peertube2.cpy.re](http://peertube2.cpy.re) 
     * [peertube3.cpy.re](http://peertube3.cpy.re)
   * [Video](https://peertube.cpy.re/videos/watch/f78a97f8-a142-4ce1-a5bd-154bf9386504)
     to see how the "decentralization feature" looks like

## Why

We can't build a FOSS video streaming alternatives to YouTube, Dailymotion,
Vimeo... with a centralized software. One organization alone may not have
enough money to pay for bandwidth and video storage of its servers.

So we need to have a decentralized network of servers seeding videos (as
[Diaspora](https://github.com/diaspora/diaspora) for example).  But it's not
enough because one video could become famous and overload the server.  It's the
reason why we need to use a P2P protocol to limit the server load.  Thanks to
[WebTorrent](https://github.com/feross/webtorrent), we can make P2P (thus
BitTorrent) inside the web browser, as of today.

## Features

- [X] Angular frontend
- [X] Join the fediverse
  - [X] Follow other instances
  - [X] Unfollow an instance
  - [X] Get for the followers/following list
- [X] Upload a video
  - [X] Seed the video
  - [X] Send the meta data with ActivityPub to followers
- [X] Remove the video
- [X] List the videos
- [X] View the video in an HTML5 player with WebTorrent
- [X] Admin panel
- [X] OpenGraph tags
- [X] OEmbed
- [X] Update video
- [X] Federated videos view counter
- [X] Federated videos likes/dislikes
- [X] Transcoding to different definitions
- [X] Download file/torrent
- [X] User video bytes quota
- [X] User video channels
- [X] NSFW warnings/settings
- [X] Video description in markdown
- [X] User roles (administrator, moderator)
- [X] User registration
- [X] Video privacy settings (public, unlisted or private)
- [X] Signaling a video to the admin origin PeerTube instance
- [X] Federated videos comments
- [ ] Video imports (URL, Torrent, YouTube...)
- [ ] Advanced search
- [ ] Subtitles
- [ ] User playlist
- [ ] User subscriptions (by tags, author...)
- [ ] Add "DDOS" security


## Front compatibility

  * Firefox
  * Chrome/Chromium

## Dependencies

  * nginx
  * PostgreSQL
  * **NodeJS >= 8.x**
  * yarn
  * OpenSSL (cli)
  * FFmpeg

## Run using Docker

You can quickly get a server running using Docker. You need to have [docker](https://www.docker.com/community-edition) and [docker-compose](https://docs.docker.com/compose/install/) installed.

For this example configuration, you also need to run a Traefik loadbalancer using Docker Compose. You can start one locally with this [example compose config](https://gist.github.com/djmaze/72f0565715c59712ce191b41d3c377da).

Example for running a peertube server locally:

```bash
sudo \
  PEERTUBE_HOSTNAME=peertube.lvh.me \
  PEERTUBE_ADMIN_EMAIL=test@example.com \
  PEERTUBE_TRANSCODING_ENABLED=true \
  docker-compose up app
```

(Get the initial root user password from the program output.)

## Production

See the [production guide](support/doc/production.md).

## Contributing

See the [contributing
guide](/.github/CONTRIBUTING.md)
to see how to contribute to PeerTube. Spoiler alert: you don't need to be a
coder to help!

## Architecture

See [ARCHITECTURE.md](/ARCHITECTURE.md) for a more detailed explanation.

### Backend

  * The backend is a REST API.
  * Servers communicate with each others with [Activity
    Pub](https://www.w3.org/TR/activitypub/).
  * Each server has its own users who query it (search videos, query where the
    torrent URI of this specific video is...).
  * If a user uploads a video, the server seeds it and sends its followers some
    metadata (name, short description, torrent URI...).
  * A server is a tracker responsible for all the videos uploaded in it.
  * Even if nobody watches a video, it is seeded by the server (through
    [WebSeed protocol](http://www.bittorrent.org/beps/bep_0019.html)) where the
    video was uploaded.

Here are some simple schemes:

<p align="center">

<img src="https://lutim.cpy.re/6Qut3ure.png" alt="Decentralized" />

<img src="https://lutim.cpy.re/NvRAcv6U.png" alt="Watch a video" />

<img src="https://lutim.cpy.re/pqKm3Q5S.png" alt="Watch a P2P video" />

</p>
