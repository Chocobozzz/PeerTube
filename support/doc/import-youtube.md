# Import videos from Youtube guide

You can use this script to import videos from Youtube channel to Peertube.  
Be sure you own the videos or have the author's authorization to do so.

 - [Installation](#installation)
 - [Usage](#usage)

## Installation

## Prerequisites

You need at least 512MB RAM to run the script.  
Importation can be launched directly from a peertube server (in this case you already have dependencies installed :+1:) or from a separate server, even a dekstop PC.  

### Dependencies

If you do not run the script from a Peertube server, you need to follow the steps of the [dependencies guide](dependencies.md).

### Installation

Clone the Peertube repo to get the latest version inside your server:

```
git clone https://github.com/Chocobozzz/PeerTube.git
CLONE="$(pwd)/Peertube"
```

Run ``yarn install``
```
cd ${CLONE}
yarn install
```

Build server tools:
```
cd ${CLONE}
npm run build:server
```


## Usage

You are now ready to run the script : 

```
cd ${CLONE}
node dist/server/tools/import-youtube.js -u "PEERTUBE_URL" -U "PEERTUBE_USER" --password "PEERTUBE_PASSWORD" -y "YOUTUBE_URL"
```

 - PEERTUBE_URL : the full URL of your peertube server where you want to import, eg: https://peertube.cpy.re/
 - PEERTUBE_USER : your peertube account where videos will be uploaded
 - PEERTUBE_PASSWORD : password of your peertube account
 - YOUTUBE_USER_URL : the youtube channel you want to import. Supports Youtube channel (eg https://www.youtube.com/channel/channel_id) or Youtube user (eg: https://www.youtube.com/c/UserName or https://www.youtube.com/user/UserName)

 The script will get all public videos from Youtube, download them, then upload to Peertube.  
 Already downloaded videos will not be uploaded twice, so you can run and re-run the script in case of crash, disconnection, ... without problem.