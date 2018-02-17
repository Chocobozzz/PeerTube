# Import viddeos from Youtube guide

If you already own a Youtube channel, you can use a Peertube scripts to import all your videos inside Peertube.

 - [Installation](#installation)
 - [Usage](#usage)

## Installation

## Prerequisites

You need at least 512MB RAM to run the script.  
Importation can be launched directly from a peertube server (in this case you already have dependencies installed :+1:) or from a separate server, even a dekstop PC.  
It is also advised to have maximum bandwith possible as you will download and upload video massively :-)

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

 - PEERTUBE_URL : the full URL of your peertube server where you want to import, eg: https://videos.lecygnenoir.info
 - PEERTUBE_USER : your peertube account where videos will be uploaded
 - PEERTUBE_PASSWORD : password of your peertube account
 - YOUTUBE_USER_URL : the youtube channel you want to import. Support Youtube channel (eg https://www.youtube.com/channel/UCu07SkvzNoU4oiIZpIXCExw) or Youtube user (eg: https://www.youtube.com/c/LecygneNoir or https://www.youtube.com/user/LecygneNoir)

 The script will get all public videos from Youtube, download them, then upload to Peertube.  
 Already downloaded videos will not be uploaded twice, so you can run and re-run the script in case of crash, deconnexion, ... without problem.