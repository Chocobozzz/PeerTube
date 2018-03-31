# PeerTube

Federated (ActivityPub) video streaming platform using P2P (BitTorrent)
directly in the web browser with <a href="https://github.com/feross/webtorrent">WebTorrent</a>.

**PeerTube is sponsored by [Framasoft](https://framatube.org/#en), a non-profit
that promotes, spreads and develops free culture in general, and free-libre
software in particular. If you want to support this project, please [consider
donating to them](https://soutenir.framasoft.org/en/).**

### Client

[![Dependency Status](https://david-dm.org/Chocobozzz/PeerTube.svg?path=client)](https://david-dm.org/Chocobozzz/PeerTube?path=client)
[![devDependency Status](https://david-dm.org/Chocobozzz/PeerTube/dev-status.svg?path=client)](https://david-dm.org/Chocobozzz/PeerTube?path=client&type=dev)

### Server

[![Build Status](https://travis-ci.org/Chocobozzz/PeerTube.svg?branch=develop)](https://travis-ci.org/Chocobozzz/PeerTube)
[![Dependencies Status](https://david-dm.org/Chocobozzz/PeerTube.svg)](https://david-dm.org/Chocobozzz/PeerTube)
[![devDependency Status](https://david-dm.org/Chocobozzz/PeerTube/dev-status.svg)](https://david-dm.org/Chocobozzz/PeerTube?type=dev)
[![JavaScript Style Guide](https://img.shields.io/badge/code%20style-standard-brightgreen.svg)](http://standardjs.com/)
[![PeerTube Freenode IRC](https://img.shields.io/badge/%23peertube-on%20freenode-brightgreen.svg)](https://kiwiirc.com/client/irc.freenode.net/#peertube)

### Screenshot

[![Screenshot](https://lutim.cpy.re/mRdBAdeD.png)](https://peertube.cpy.re)

### Join
[**Website**](https://joinpeertube.org) | [**Instances list**](https://instances.joinpeertube.org)

## Demonstration

Want to see it in action?

   * Demonstration servers:
     * [peertube.cpy.re](http://peertube.cpy.re)
     * [peertube2.cpy.re](http://peertube2.cpy.re)
     * [peertube3.cpy.re](http://peertube3.cpy.re)
   * [Video](https://peertube.cpy.re/videos/watch/f78a97f8-a142-4ce1-a5bd-154bf9386504)
     to see what the "decentralization feature" looks like
   * [Video](https://peertube.cpy.re/videos/watch/da2b08d4-a242-4170-b32a-4ec8cbdca701) to see
   the communication between PeerTube and [Mastodon](https://github.com/tootsuite/mastodon)

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

## Dependencies

  * nginx
  * PostgreSQL
  * Redis
  * **NodeJS >= 8.x**
  * yarn
  * OpenSSL (cli)
  * **FFmpeg >= 3.x**

## Run using Docker

See the [docker guide](/support/doc/docker.md)

## Production

See the [production guide](/support/doc/production.md).

## Contributing/Test

See the [contributing
guide](/.github/CONTRIBUTING.md)
to see how to test or contribute to PeerTube. Spoiler alert: you don't need to be a
coder to help!

## API REST documentation

For now only on Github:

 * HTML version: [/support/doc/api/html/index.html](https://htmlpreview.github.io/?https://github.com/Chocobozzz/PeerTube/blob/develop/support/doc/api/html/index.html)
 * Swagger/OpenAPI schema: [/support/doc/api/openapi.yaml](/support/doc/api/openapi.yaml)

## Tools

 * [Import videos (YouTube, Dailymotion, Vimeo...)](/support/doc/tools.md)
 * [Upload videos from the CLI](/support/doc/tools.md)

## FAQ

If you have a question, please try to find the answer in the [FAQ](/FAQ.md) first.

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

![Decentralized](https://lutim.cpy.re/6Qut3ure.png)

![Watch a video](https://lutim.cpy.re/NvRAcv6U.png)

![Watch a P2P video](https://lutim.cpy.re/pqKm3Q5S.png)


## License

Copyright (C) 2018 PeerTube Contributors

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published
by the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
