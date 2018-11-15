# Server code documentation

The server is a web server developed with [TypeScript](https://www.typescriptlang.org/)/[Express](http://expressjs.com).


## Technologies

  * [TypeScript](https://www.typescriptlang.org/) -> Language
  * [PostgreSQL](https://www.postgresql.org/) -> Database
  * [Redis](https://redis.io/) -> Job queue/cache
  * [Express](http://expressjs.com) -> Web server framework
  * [Sequelize](http://docs.sequelizejs.com/en/v3/) -> SQL ORM
  * [WebTorrent](https://webtorrent.io/) -> BitTorrent tracker and torrent creation
  * [Mocha](https://mochajs.org/) -> Test framework


## Files

The server main file is [server.ts](/server.ts).
The server modules description are in the [package.json](/package.json) at the project root.
All other server files are in the [server](/server) directory:

    server.ts -> app initialization, main routes configuration (static routes...)
    config    -> server YAML configurations (for tests, production...)
    scripts   -> Scripts files for npm run
    server
    |__ controllers  -> API routes/controllers files
    |__ helpers      -> functions used by different part of the project (logger, utils...)
    |__ initializers -> functions used at the server startup (installer, database, constants...)
    |__ lib          -> library function (WebTorrent, OAuth2, ActivityPub...)
    |__ middlewares  -> middlewares for controllers (requests validators, requests pagination...)
    |__ models       -> Sequelize models for each SQL tables (videos, users, accounts...)
    |__ tests        -> API tests and real world simulations (to test the decentralized feature...)


## Conventions

Uses [JavaScript Standard Style](http://standardjs.com/).

## Architecture

The server is composed by:

  * a REST API (relying on the Express framework) documented on http://docs.joinpeertube.org/api.html
  * a WebTorrent Tracker (slightly custom version of [webtorrent/bittorrent-tracker](https://github.com/webtorrent/bittorrent-tracker#server))

A video is seeded by the server with the [WebSeed](http://www.bittorrent.org/beps/bep_0019.html) protocol (HTTP).

![Architecture scheme](/support/doc/development/server/upload-video.png)

When a user uploads a video, the REST API creates the torrent file and then adds it to its database.

If a user wants to watch the video, the tracker will indicate all other users that are watching the video + the HTTP url for the WebSeed.

## Newcomers

The server entrypoint is [server.ts](/server.ts). Looking at this file is a good start.
Then you can try to understand the [controllers](/server/controllers): they are the entrypoints of each API request.
