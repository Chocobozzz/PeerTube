# Server code documentation

The server is a web server developed with [TypeScript](https://www.typescriptlang.org/)/[Express](http://expressjs.com).


## Technologies

  * [TypeScript](https://www.typescriptlang.org/) -> Language
  * [PostgreSQL](https://www.postgresql.org/) -> Database
  * [Express](http://expressjs.com) -> Web server framework
  * [Sequelize](http://docs.sequelizejs.com/en/v3/) -> SQL ORM
  * [WebTorrent](https://webtorrent.io/) -> BitTorrent tracker and torrent creation
  * [Mocha](https://mochajs.org/) -> Test framework


## Files

The server main file is [server.ts](https://github.com/Chocobozzz/PeerTube/blob/master/server.ts).
The server modules description are in the [package.json](https://github.com/Chocobozzz/PeerTube/blob/master/package.json) at the project root.
All other server files are in the [server](https://github.com/Chocobozzz/PeerTube/tree/master/server) directory:

    server.ts -> app initilization, main routes configuration (static routes...)
    config    -> server YAML configurations (for tests, production...)
    scripts   -> Scripts files for npm run
    server
    |__ controllers  -> API routes/controllers files
    |__ helpers      -> functions used by different part of the project (logger, utils...)
    |__ initializers -> functions used at the server startup (installer, database, constants...)
    |__ lib          -> library function (WebTorrent, OAuth2, friends logic...)
    |__ middlewares  -> middlewares for controllers (requests validators, requests pagination...)
    |__ models       -> Sequelize models for each SQL tables (videos, users, accounts...)
    |__ tests        -> API tests and real world simulations (to test the decentralized feature...)


## Conventions

Uses [JavaScript Standard Style](http://standardjs.com/).


## Developing

  * Install [the dependencies](https://github.com/Chocobozzz/PeerTube#dependencies)
  * Run `yarn install` at the root directory to install all the dependencies
  * Run PostgreSQL and create the database `peertube_dev`.
  * Run `npm run dev:server` to run the server, watch server files modifications and restart it automatically. The server (API + client) listen on `localhost:9000`.

The `NODE_ENV=test` is set to speed up communications between instances (see [constants.ts](https://github.com/Chocobozzz/PeerTube/blob/master/server/initializers/constants.ts)).

`npm run help` gives you all available commands.

If you want to test the decentralization feature, you can easily run 3 instances by running `npm run play`. The instances password are `test1`, `test2` and `test3`.


## Architecture

The server is composed by:

  * a REST API (Express framework)
  * a WebTorrent Tracker

A video is seeded by the server with the [WebSeed](http://www.bittorrent.org/beps/bep_0019.html) protocol (HTTP).

![Architecture scheme](https://github.com/Chocobozzz/PeerTube/blob/master/support/doc/server/upload-video.png)

When a user uploads a video, the rest API create the torrent file and then adds it to its database.

If a user wants to watch the video, the tracker will indicate all other users that are watching the video + the HTTP url for the WebSeed.

## Newcomers

The server entrypoint is [server.ts](https://github.com/Chocobozzz/PeerTube/blob/master/server.ts). You can begin to look at this file.
Then you can try to understand the [controllers](https://github.com/Chocobozzz/PeerTube/tree/master/server/controllers): they are the entrypoint of each API request.
