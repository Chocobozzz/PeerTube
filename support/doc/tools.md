# CLI tools guide

 - [Remote tools](#remote-tools)
   - [import-videos.js](#import-videosjs)
   - [upload.js](#uploadjs)
 - [Server tools](#server-tools)
   - [parse-log](#parse-log)
   - [create-transcoding-job.js](#create-transcoding-jobjs)
   - [create-import-video-file-job.js](#create-import-video-file-jobjs)
   - [prune-storage.js](#prune-storagejs)

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

### import-videos.js

You can use this script to import videos from all [supported sites of youtube-dl](https://rg3.github.io/youtube-dl/supportedsites.html) into PeerTube.  
Be sure you own the videos or have the author's authorization to do so.

```sh
$ node dist/server/tools/import-videos.js \
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


### upload.js

You can use this script to import videos directly from the CLI.

Videos will be publicly available after transcoding (you can see them before that in your account on the web interface).

```
$ cd ${CLONE}
$ node dist/server/tools/upload.js --help
```


## Server tools

These scripts should be run on the server, in `peertube-latest` directory.

### parse-log

To parse PeerTube last log file:

```
$ sudo -u peertube NODE_CONFIG_DIR=/var/www/peertube/config NODE_ENV=production npm run parse-log -- --level info
```

`--level` is optional and could be `info`/`warn`/`error`

### create-transcoding-job.js

You can use this script to force transcoding of an existing video.

```
$ sudo -u peertube NODE_CONFIG_DIR=/var/www/peertube/config NODE_ENV=production npm run create-transcoding-job -- -v [videoUUID]
```

Or to transcode to a specific resolution:
```
$ sudo -u peertube NODE_CONFIG_DIR=/var/www/peertube/config NODE_ENV=production npm run create-transcoding-job -- -v [videoUUID] -r [resolution]
```
   
### create-import-video-file-job.js

You can use this script to import a video file to replace an already uploaded file or to add a new resolution to a video.

```
$ sudo -u peertube NODE_CONFIG_DIR=/var/www/peertube/config NODE_ENV=production npm run create-import-video-file-job -- -v [videoUUID] -i [videoFile]
```

### prune-storage.js

Some transcoded videos or shutdown at a bad time can leave some unused files on your storage.
To delete them (a confirmation will be demanded first):

```
$ sudo -u peertube NODE_CONFIG_DIR=/var/www/peertube/config NODE_ENV=production npm run prune-storage
```

### update-host.js

If you started PeerTube with a domain, and then changed it you will have invalid torrent files and invalid URLs in your database.
To fix this, you have to run:

```
$ sudo -u peertube NODE_CONFIG_DIR=/var/www/peertube/config NODE_ENV=production npm run update-host
```
