# CLI tools guide

 - [Installation](#installation)
 - [Usage](#usage)
   - [import-videos.js](#import-videosjs)
   - [upload.js](#uploadjs)

## Installation

## Prerequisites

You need at least 512MB RAM to run the script.
Scripts can be launched directly from a PeerTube server, or from a separate server, even a desktop PC.
You need to follow all the following steps even if you are on a PeerTube server.

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

## Tools 

### import-videos.js

You can use this script to import videos from all [supported sites of youtube-dl](https://rg3.github.io/youtube-dl/supportedsites.html) into PeerTube.  
Be sure you own the videos or have the author's authorization to do so.


```
$ cd ${CLONE}
$ node dist/server/tools/import-videos.js -u "PEERTUBE_URL" -U "PEERTUBE_USER" --password "PEERTUBE_PASSWORD" -t "TARGET_URL"
```

 * PEERTUBE_URL : the full URL of your PeerTube server where you want to import, eg: https://peertube.cpy.re/
 * PEERTUBE_USER : your PeerTube account where videos will be uploaded
 * PEERTUBE_PASSWORD : password of your PeerTube account (if ommited, you will be prompted for)
 * TARGET_URL : the target url you want to import. Examples:
   * YouTube:
     * Channel: https://www.youtube.com/channel/ChannelId
     * User https://www.youtube.com/c/UserName or https://www.youtube.com/user/UserName
     * Video https://www.youtube.com/watch?v=blabla
   * Vimeo: https://vimeo.com/xxxxxx
   * Dailymotion: https://www.dailymotion.com/xxxxx

 The script will get all public videos from Youtube, download them and upload to PeerTube.  
 Already downloaded videos will not be uploaded twice, so you can run and re-run the script in case of crash, disconnection...

### upload.js

You can use this script to import videos directly from the CLI.

```
$ cd ${CLONE}
$ node dist/server/tools/upload.js --help
```
