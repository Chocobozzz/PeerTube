# Server code documentation

The server is a web server developed with [NodeJS](https://nodejs.org)/[Express](http://expressjs.com).


## Technologies

  * [NodeJS](https://nodejs.org) -> Language
  * [MongoDB](https://www.mongodb.com/) -> Database
  * [Express](http://expressjs.com) -> Web server framework
  * [Mongoose](http://mongoosejs.com/) -> MongoDB object modeling
  * [WebTorrent](https://webtorrent.io/) -> BitTorrent tracker and torrent creation
  * [Mocha](https://mochajs.org/) -> Test framework


## Files

The server main file is [server.js](https://github.com/Chocobozzz/PeerTube/blob/master/server.js).
The server modules description are in the [package.json](https://github.com/Chocobozzz/PeerTube/blob/master/package.json) at the project root.
All other server files are in the [server](https://github.com/Chocobozzz/PeerTube/tree/master/server) directory:

    server.js -> app initilization, main routes configuration (static routes...)
    config    -> server YAML configurations (for tests, production...)
    scripts   -> Scripts files for npm run
    server
    |__ controllers  -> API routes/controllers files
    |__ helpers      -> functions used by different part of the project (logger, utils...)
    |__ initializers -> functions used at the server startup (installer, database, constants...)
    |__ lib          -> library function (WebTorrent, OAuth2, friends logic...)
    |__ middlewares  -> middlewares for controllers (requests validators, requests pagination...)
    |__ models       -> Mongoose models for each MongoDB collection (videos, users, pods...)
    |__ tests        -> API tests and real world simulations (to test the decentralized feature...)


## Conventions

Uses [JavaScript Standard Style](http://standardjs.com/).


## Developing

  * Install [the dependencies](https://github.com/Chocobozzz/PeerTube#dependencies)
  * Run `npm install` at the root directory to install all the dependencies
  * Run MongoDB
  * Run `npm run dev` to compile the client and automatically run the server. If the client files are already compiled you can simply run `NODE_ENV=test node server`

The `NODE_ENV=test` is set to speed up communications between pods (see [constants.js](https://github.com/Chocobozzz/PeerTube/blob/master/server/initializers/constants.js)).

`npm run help` gives you all available commands.

If you want to test the decentralization feature, you can easily run 3 pods by running `npm run play`. The pods password are `test1`, `test2` and `test3`.


## Architecture

The server is composed by:

  * a REST API (throught Express framework)
  * a WebTorrent Tracker

A video is seeded by the server throught the [WebSeed](http://www.bittorrent.org/beps/bep_0019.html) protocol (HTTP).

![Architecture scheme](https://github.com/Chocobozzz/PeerTube/blob/master/support/doc/server/upload-video.png)

When a user uploads a video, the rest API create the torrent file and then adds it to its Mongo database.

If a user wants to watch the video, the tracker will indicate all other users that are watching the video + the HTTP url for the WebSeed.

## Newcomers

The server entrypoint is [server.js](https://github.com/Chocobozzz/PeerTube/blob/master/server.js). You can begin to look at this file.
Then you can try to understand the [controllers](https://github.com/Chocobozzz/PeerTube/tree/master/server/controllers): they are the entrypoint of each API request.
