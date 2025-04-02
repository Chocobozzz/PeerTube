# PeerTube Contributing Guide

Welcome to the contributing guide for PeerTube! Interested in contributing? Awesome!

**This guide will present you the following contribution topics:**

[[toc]]

## Translate

You can help us to translate the PeerTube interface to many languages! See [the documentation](/support/doc/translation.md) to know how.


## Give your feedback

You don't need to know how to code to start contributing to PeerTube! Other
contributions are very valuable too, among which: you can test the software and
report bugs, you can give feedback on potential bugs, features that you are
interested in, user interface, design, decentralized architecture...


## Write documentation

You can help to write the documentation of the REST API, code, architecture,
demonstrations.

### User documentation

The official user documentation is available on https://docs.joinpeertube.org/

You can update it by writing markdown files in the following repository: https://framagit.org/framasoft/peertube/documentation/

### REST API documentation

The [REST API documentation](https://docs.joinpeertube.org/api-rest-reference.html) is generated from `support/doc/api/openapi.yaml` file.
To quickly get a preview of your changes, you can generate the documentation *on the fly* using the following command:

```sh
npx @redocly/cli preview-docs ./support/doc/api/openapi.yaml
```

Some hints:
 * Routes are defined in [/server/core/controllers/](https://github.com/Chocobozzz/PeerTube/tree/develop/server/core/controllers) directory
 * Parameters validators are defined in [/server/core/middlewares/validators](https://github.com/Chocobozzz/PeerTube/tree/develop/server/core/middlewares/validators) directory
 * Models sent/received by the controllers are defined in [/packages/models](https://github.com/Chocobozzz/PeerTube/tree/develop/packages/models) directory


## Improve the website

PeerTube's website is [joinpeertube.org](https://joinpeertube.org), where people can learn about the project and how it works – note that it is not a PeerTube instance, but rather the project's homepage.

You can help us improve it too!

It is not hosted on GitHub but on [Framasoft](https://framasoft.org/)'s own [GitLab](https://about.gitlab.com/) instance, [FramaGit](https://framagit.org): https://framagit.org/framasoft/peertube/joinpeertube


## Develop

> [!TIP]
> In dev mode, administrator username is **root** and password is **test**

Always talk about features you want to develop by creating/finding and commenting the issue tackling your problem
before you start working on it, and inform the community that you begin coding by claiming the issue.

Once you are ready to show your code to ask for feedback, submit a *draft* Pull Request.
Once you are ready for a code review before merge, submit a Pull Request. In any case, please
link your PR to the issues it solves by using the GitHub syntax: "fixes #issue_number".

### Prerequisites

First, you should use a server or PC with at least 4GB of RAM. Less RAM may lead to crashes.

1) Make sure that you have followed [the steps](/support/doc/dependencies.md) to install the dependencies.
1) Install [parallel](https://www.gnu.org/software/parallel/) to be able to run tests.
1) Fork the GitHub repository.
1) Run the following commands.

```sh
git clone https://github.com/Chocobozzz/PeerTube
cd PeerTube
git remote add me git@github.com:YOUR_GITHUB_USERNAME/PeerTube.git
yarn install --pure-lockfile
```

Note that development is done on the `develop` branch. If you want to hack on
PeerTube, you should switch to that branch. Also note that you have to repeat
the `npm run install-node-dependencies` command.

When you create a new branch you should also tell to use your repo for upload
not default one. To do just do:

```sh
git push --set-upstream me <your branch name>
```

Then, create a postgres database and user with the values set in the
`config/default.yaml` file. For instance, if you do not change the values
there, the following commands would create a new database called `peertube_dev`
and a postgres user called `peertube` with password `peertube`:

```sh
# sudo -u postgres createuser -P peertube
Enter password for new role: peertube
# sudo -u postgres createdb -O peertube peertube_dev
```

Then enable extensions PeerTube needs:

```sh
sudo -u postgres psql -c "CREATE EXTENSION pg_trgm;" peertube_dev
sudo -u postgres psql -c "CREATE EXTENSION unaccent;" peertube_dev
```

PeerTube also requires a running redis server, no special setup is needed for
this.

### Online development

You can get a complete PeerTube development setup with Gitpod, a free one-click online IDE for GitHub:

[![Open in Gitpod](https://gitpod.io/button/open-in-gitpod.svg)](https://gitpod.io/#https://github.com/Chocobozzz/PeerTube)

### Server side

To develop on the server-side:

```sh
npm run dev:server
```

Then, the server will listen on `localhost:9000`. When server source files
change, these are automatically recompiled and the server will automatically
restart.

More detailed documentation is available:
  * [Server code/architecture](https://docs.joinpeertube.org/contribute/architecture#server)
  * [Server development (adding a new feature...)](/support/doc/development/server.md)

### Client side

To develop on the client side:

```sh
npm run dev:client
```

The API will listen on `localhost:9000` and the frontend on `localhost:3000`.
Client files are automatically compiled on change, and the web browser will
reload them automatically thanks to hot module replacement.

More detailed documentation is available:
  * [Client code/architecture](https://docs.joinpeertube.org/contribute/architecture#client)


### Client and server side

The API will listen on `localhost:9000` and the frontend on `localhost:3000`.
File changes are automatically recompiled, injected in the web browser (no need to refresh manually)
and the web server is automatically restarted.

```sh
npm run dev
```

### Embed

The embed is a standalone application built using Vite.
The generated files (HTML entrypoint and multiple JS and CSS files) are served by the Vite server (behind `localhost:5173/videos/embed/:videoUUID` or `localhost:5173/video-playlists/embed/:playlistUUID`).
The following command will compile embed files and run the PeerTube server:

```sh
npm run dev:embed
```

### RTL layout

To test RTL (right-to-left) layout using `ar` locale:

```sh
npm run dev -- --ar-locale
```

### Testing

#### Unit/integration tests

Your code contributions must pass the tests before they can be merged. Tests ensure most of the application behaves
as expected and respect the syntax conventions. They will run upon PR submission as part of our CI, but running them beforehand yourself will get you faster feedback and save CI runner time for others.

See the [dedicated documentation](/support/doc/development/tests.md) to run tests locally.

#### Play with a federation of PeerTube servers

Create a PostgreSQL user **with the same name as your username** in order to avoid using the *postgres* user.
Then, we can create the databases (if they don't already exist):

```sh
sudo -u postgres createuser you_username --createdb --superuser
createdb -O peertube peertube_test{1,2,3}
```

Build the application and flush the old tests data:

```sh
npm run build
npm run clean:server:test
```

To run 3 nodes:

```sh
NODE_APP_INSTANCE=1 NODE_ENV=test npm start
NODE_APP_INSTANCE=2 NODE_ENV=test npm start
NODE_APP_INSTANCE=3 NODE_ENV=test npm start
```

Then you will get access to the three nodes at `http://127.0.0.1:900{1,2,3}`
with the `root` as username and `test{1,2,3}` for the password.

Instance configurations are in `config/test-{1,2,3}.yaml`.

### Emails

To test emails with PeerTube:

 * Run [mailslurper](http://mailslurper.com/)
 * Run PeerTube using mailslurper SMTP port: `NODE_CONFIG='{ "smtp": { "hostname": "localhost", "port": 2500, "tls": false } }' NODE_ENV=dev node dist/server`

### Environment variables

PeerTube can be configured using environment variables.
See the list on https://docs.joinpeertube.org/maintain/configuration#environment-variables

Additionally to these ones, we provide some environment for dev/test purpose:

 * `PRODUCTION_CONSTANTS=true`: in `NODE_ENV=dev` or `NODE_ENV=test` PeerTube customizes some constants. To prevent this behaviour, you can set `PRODUCTION_CONSTANTS` env to
 `true`
 * `PEERTUBE_LOCAL_CONFIG`: directory to find the local configuration file (used by web admin)
 * `NODE_DB_LOG=false`: disable SQL request logging

### Generate/pull translations

See the [dedicated documentation](/support/doc/development/localization.md) to update PeerTube translations from Weblate or to support a new locale.

### Release PeerTube

See the [dedicated documentation](/support/doc/development/release.md) to release a new version of PeerTube.

### PeerTube packages

This repository also contains other packages/libraries than PeerTube (embed API, PeerTube types...).
You can see the list on the [dedicated documentation](/support/doc/development/lib.md).

### CI

PeerTube uses GitHub actions to run tests every time a commit is pushed or a PR is opened.
You can find more information about these tasks on the [dedicated documentation](/support/doc/development/ci.md).

### Monitoring

You can check the content of the client bundle or benchmark the REST API.
To do so, see the [dedicated documentation](/support/doc/development/monitoring.md).

### Test live stream

To easily test a live stream on PeerTube:
 * Enable live support in web admin configuration
 * Create a permanent live on the PeerTube instance
 * Get the **RTMP URL** and the **Live stream key**
 * Send the live stream to PeerTube using `ffmpeg` using a local video:

```
ffmpeg -stream_loop -1 -re -i any-video.mp4 -c copy -f flv rtmp://{RTMP URL}/live/{STREAM KEY}
```

## Plugins & Themes

See the dedicated documentation: https://docs.joinpeertube.org/contribute/plugins
