# CLI tools guide

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
**Table of Contents**  

- [CLI wrapper](#cli-wrapper)
- [Remote Tools](#remote-tools)
  - [Dependencies](#dependencies)
  - [Installation](#installation)
  - [peertube-import-videos.js](#peertube-import-videosjs)
  - [peertube-upload.js](#peertube-uploadjs)
  - [peertube-watch.js](#peertube-watchjs)
- [Server tools](#server-tools)
  - [parse-log](#parse-log)
  - [create-transcoding-job.js](#create-transcoding-jobjs)
  - [create-import-video-file-job.js](#create-import-video-file-jobjs)
  - [prune-storage.js](#prune-storagejs)
  - [optimize-old-videos.js](#optimize-old-videosjs)
  - [update-host.js](#update-hostjs)
  - [REPL (Read Eval Print Loop)](#repl-read-eval-print-loop)
    - [.help](#help)
    - [Lodash example](#lodash-example)
    - [YoutubeDL example](#youtubedl-example)
    - [Models examples](#models-examples)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## CLI wrapper

The wrapper provides a convenient interface to most scripts, and requires the [same dependencies](#dependencies). You can access it as `peertube` via an alias in your `.bashrc` like `alias peertube="node ${PEERTUBE_PATH}/dist/server/tools/peertube.js"`:

```
  Usage: peertube [command] [options]

  Options:

    -v, --version         output the version number
    -h, --help            output usage information

  Commands:

    auth [action]         register your accounts on remote instances to use them with other commands
    upload|up             upload a video
    import-videos|import  import a video from a streaming platform
    watch|w               watch a video in the terminal ✩°｡⋆
    repl                  initiate a REPL to access internals
    help [cmd]            display help for [cmd]
```

The wrapper can keep track of instances you have an account on. We limit to one account per instance for now.

```bash
$ peertube auth add -u "PEERTUBE_URL" -U "PEERTUBE_USER" --password "PEERTUBE_PASSWORD"
$ peertube auth list
┌──────────────────────────────┬──────────────────────────────┐
│ instance                     │ login                        │
├──────────────────────────────┼──────────────────────────────┤
│ "PEERTUBE_URL"               │ "PEERTUBE_USER"              │
└──────────────────────────────┴──────────────────────────────┘
```

You can now use that account to upload videos without feeding the same parameters again.

```bash
$ peertube up <videoFile>
```

And now that your video is online, you can watch it from the confort of your terminal (use `peertube watch --help` to see the supported players):

```bash
$ peertube watch https://peertube.cpy.re/videos/watch/e8a1af4e-414a-4d58-bfe6-2146eed06d10
```

## Remote Tools

You need at least 512MB RAM to run the script.
Scripts can be launched directly from a PeerTube server, or from a separate server, even a desktop PC.
You need to follow all the following steps even if you are on a PeerTube server (including cloning the git repository in a different directory than your production installation because the scripts utilize non-production dependencies).

### Dependencies

Install the [PeerTube dependencies](dependencies.md).

### Installation

Clone the PeerTube repo to get the latest version (even if you are on your PeerTube server):

```
$ git clone https://github.com/Chocobozzz/PeerTube.git
$ CLONE="$(pwd)/PeerTube"
```

Run ``yarn install``
```
$ cd ${CLONE}
$ yarn install
```

Build server tools:
```
$ cd ${CLONE}
$ npm run build:server
```

### peertube-import-videos.js

You can use this script to import videos from all [supported sites of youtube-dl](https://rg3.github.io/youtube-dl/supportedsites.html) into PeerTube.  
Be sure you own the videos or have the author's authorization to do so.

```sh
$ node dist/server/tools/peertube-import-videos.js \
    -u "PEERTUBE_URL" \
    -U "PEERTUBE_USER" \
    --password "PEERTUBE_PASSWORD" \
    -t "TARGET_URL"
```

* `PEERTUBE_URL` : the full URL of your PeerTube server where you want to import, eg: https://peertube.cpy.re
* `PEERTUBE_USER` : your PeerTube account where videos will be uploaded
* `PEERTUBE_PASSWORD` : password of your PeerTube account (if omitted, you will be prompted for it)
* `TARGET_URL` : the target url you want to import. Examples:
  * YouTube:
    * Channel: https://www.youtube.com/channel/ChannelId
    * User https://www.youtube.com/c/UserName or https://www.youtube.com/user/UserName
    * Video https://www.youtube.com/watch?v=blabla
  * Vimeo: https://vimeo.com/xxxxxx
  * Dailymotion: https://www.dailymotion.com/xxxxx

The script will get all public videos from Youtube, download them and upload to PeerTube.
Already downloaded videos will not be uploaded twice, so you can run and re-run the script in case of crash, disconnection...

Videos will be publicly available after transcoding (you can see them before that in your account on the web interface).


### peertube-upload.js

You can use this script to import videos directly from the CLI.

Videos will be publicly available after transcoding (you can see them before that in your account on the web interface).

```
$ cd ${CLONE}
$ node dist/server/tools/peertube-upload.js --help
```

### peertube-watch.js

You can use this script to play videos directly from the CLI.

It provides support for different players:

- ascii (default ; plays in ascii art in your terminal!)
- mpv
- mplayer
- vlc
- stdout
- xbmc
- airplay
- chromecast


## Server tools

These scripts should be run on the server, in `peertube-latest` directory.

### parse-log

To parse PeerTube last log file:

```
$ sudo -u peertube NODE_CONFIG_DIR=/var/www/peertube/config NODE_ENV=production npm run parse-log -- --level info
```

`--level` is optional and could be `info`/`warn`/`error`

### create-transcoding-job.js

You can use this script to force transcoding of an existing video. PeerTube needs to be running.

```
$ sudo -u peertube NODE_CONFIG_DIR=/var/www/peertube/config NODE_ENV=production npm run create-transcoding-job -- -v [videoUUID]
```

Or to transcode to a specific resolution:
```
$ sudo -u peertube NODE_CONFIG_DIR=/var/www/peertube/config NODE_ENV=production npm run create-transcoding-job -- -v [videoUUID] -r [resolution]
```
   
### create-import-video-file-job.js

You can use this script to import a video file to replace an already uploaded file or to add a new resolution to a video. PeerTube needs to be running.

```
$ sudo -u peertube NODE_CONFIG_DIR=/var/www/peertube/config NODE_ENV=production npm run create-import-video-file-job -- -v [videoUUID] -i [videoFile]
```

### prune-storage.js

Some transcoded videos or shutdown at a bad time can leave some unused files on your storage.
To delete them (a confirmation will be demanded first):

```
$ sudo -u peertube NODE_CONFIG_DIR=/var/www/peertube/config NODE_ENV=production npm run prune-storage
```

### optimize-old-videos.js

Before version v1.0.0-beta.16, Peertube did not specify a bitrate for the
transcoding of uploaded videos. This means that videos might be encoded into
very large files that are too large for streaming. This script re-transcodes
these videos so that they can be watched properly, even on slow connections.

```
$ sudo -u peertube NODE_CONFIG_DIR=/var/www/peertube/config NODE_ENV=production npm run optimize-old-videos
```


### update-host.js

If you started PeerTube with a domain, and then changed it you will have
invalid torrent files and invalid URLs in your database. To fix this, you have
to run:

```
$ sudo -u peertube NODE_CONFIG_DIR=/var/www/peertube/config NODE_ENV=production npm run update-host
```

### REPL ([Read Eval Print Loop](https://nodejs.org/docs/latest-v8.x/api/repl.html))

If you want to interact with the application libraries and objects even when PeerTube is not running, there is a REPL for that.

usage: `node ./dist/server/tools/peertube-repl.js`

"The default evaluator will, by default, assign the result of the most recently evaluated expression to the special variable `_` (underscore). Explicitly setting `_` to a value will disable this behavior."

- type `.help` to list commands available in the repl, notice it starts with a dot
- type `.exit` to exit, note that you still have to press CTRL-C to actually exit, or press CTRL-C (3 times) without typing `.exit` to exit
- type `context` to list all available objects and libraries in the context, note: `Promise` is also available but it's not listed in the context, in case you need promises for something
- type `env` to see the loaded environment variables
- type `path` to access path library
- type `lodash` to access lodash library
- type `uuidv1` to access uuid/v1 library
- type `uuidv3` to access uuid/v3 library
- type `uuidv4` to access uuid/v4 library
- type `uuidv5` to access uuid/v5 library
- type `YoutubeDL` to access youtube-dl library
- type `cli` to access the cli helpers object
- type `logger` to access the logger; if you log to it, it will write to stdout and to the peertube.log file
- type `constants` to access the constants loaded by the server
- type `coreUtils` to access the core-utils helpers object
- type `ffmpegUtils` to access the ffmpeg-utils helpers object
- type `peertubeCryptoUtils` to access the peertube-crypto helpers object
- type `signupUtils` to access the signup helpers object
- type `utils` to access the utils helpers object
- type `YoutubeDLUtils` to access the youtube-dl helpers object
- type `sequelizeTypescript` to access sequelizeTypescript
- type `modelsUtils` to access the models/utils
- type `models` to access the shortcut to sequelizeTypescript.models
- type `transaction` to access the shortcut to sequelizeTypescript.transaction
- type `query` to access the shortcut to sequelizeTypescript.query
- type `queryInterface` to access the shortcut to sequelizeTypescript.queryInterface

#### .help

```
PeerTube [1.0.0] (b10eb595)> .help
.break    Sometimes you get stuck, this gets you out
.clear    Break, and also clear the local context
.editor   Enter editor mode
.exit     Exit the repl
.help     Print this help message
.load     Load JS from a file into the REPL session
.r        Reset REPL
.reset    Reset REPL
.save     Save all evaluated commands in this REPL session to a file
PeerTube [1.0.0] (b10eb595)>
```

#### Lodash example

```
PeerTube [1.0.0] (b10eb595)> lodash.keys(context)
[ 'global',
  'console',
  'DTRACE_NET_SERVER_CONNECTION',
  'DTRACE_NET_STREAM_END',
  'DTRACE_HTTP_SERVER_REQUEST',
  'DTRACE_HTTP_SERVER_RESPONSE',
  'DTRACE_HTTP_CLIENT_REQUEST',
  'DTRACE_HTTP_CLIENT_RESPONSE',
  'process',
  'Buffer',
  'clearImmediate',
  'clearInterval',
  'clearTimeout',
  'setImmediate',
  'setInterval',
  'setTimeout',
  'XMLHttpRequest',
  'compact2string',
  'module',
  'require',
  'path',
  'repl',
  'context',
  'env',
  'lodash',
  'uuidv1',
  'uuidv3',
  'uuidv4',
  'uuidv5',
  'cli',
  'logger',
  'constants',
  'Sequelize',
  'sequelizeTypescript',
  'modelsUtils',
  'models',
  'transaction',
  'query',
  'queryInterface',
  'YoutubeDL',
  'coreUtils',
  'ffmpegUtils',
  'peertubeCryptoUtils',
  'signupUtils',
  'utils',
  'YoutubeDLUtils' ]
PeerTube [1.0.0] (b10eb595)>
```

#### YoutubeDL example
```
YoutubeDL.getInfo('https://www.youtube.com/watch?v=I5ZN289jjDo', function(err, data) {console.log(err, data)})
```

#### Models examples
```
PeerTube [1.0.0] (b10eb595)> new models.ActorModel({id: 3}).getVideoChannel().then(function(data){console.log(data.dataValues.name)})
Promise {
  _bitField: 0,
  _fulfillmentHandler0: undefined,
  _rejectionHandler0: undefined,
  _promise0: undefined,
  _receiver0: undefined }
PeerTube [1.0.0] (b10eb595)> Main root channel
PeerTube [1.0.0] (b10eb595)> let out; new models.UserModel({id: 1}).getAccount().then(function (data) {out = data.dataValues.id})
Promise {
  _bitField: 0,
  _fulfillmentHandler0: undefined,
  _rejectionHandler0: undefined,
  _promise0: undefined,
  _receiver0: undefined }
PeerTube [1.0.0] (b10eb595)> out
2
PeerTube [1.0.0] (b10eb595)>
```
