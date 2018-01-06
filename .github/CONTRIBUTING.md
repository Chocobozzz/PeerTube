# Welcome to the contributing guide for PeerTube

Interesting in contributing? Awesome :)

**Quick Links:**

  * [Give your feedback](#give-your-feedback)
  * [Develop on the Server side](#develop-on-the-server-side)
  * [Develop on the Client side](#develop-on-the-client-side)
  * [Get started with development](#get-started-with-development)
  * [Write documentation](#write-documentation)


## Give your feedback

You don't need to know how to code to start contributing to PeerTube! Other
contributions are very valuable too, among which: you can test the software and
report bugs, you can give feedback on potential bugs, features that you are
interested in, user interace, design, decentralized architecture...


## Development

## Develop on the Server side

The server is a web server developed with
[NodeJS](https://nodejs.org)/[Express](http://expressjs.com).

Newcomer? You can find a documentation of the server code/architecture
[here](https://github.com/Chocobozzz/PeerTube/blob/master/support/doc/server/code.md).

Don't hesitate to talk about features you want to develop by creating an issue
before you start working on them :).


## Develop on the Client side

The client is a web application developed with
[TypeScript](https://www.typescriptlang.org/)/[Angular2](https://angular.io/).

Newcomer? You can find a documentation of the server code/architecture
[here](https://github.com/Chocobozzz/PeerTube/blob/master/support/doc/client/code.md).


## Get started with development

In this mode, the server will run requests between instances more quickly, the
video durations are limited to a few seconds.

To develop on the server-side:

```bash
    $ npm run dev:server
```

Then, the server will listen on `localhost:9000`. When server source files
change, these are automatically recompiled and the server will automatically
restart.

To develop on the client side:

```bash
    $ npm run dev:client
```

The API will listen on `localhost:9000` and the frontend on `localhost:3000`.
Client files are automatically compiled on change, and the web browser will
reload them automatically thanks to hot module replacement.

**Username**: *root* <br/>
**Password**: *test*


## Write documentation

You can help to write the documentation of the REST API, code, architecture,
demonstrations...
