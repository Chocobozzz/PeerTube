# CLI tools guide

[[toc]]

## Remote PeerTube CLI

You need at least 512MB RAM to run the script.
Scripts can be launched directly from a PeerTube server, or from a separate server, even a desktop PC.
You need to follow all the following steps even if you are on a PeerTube server (including cloning the git repository in a different directory than your production installation because the scripts utilize non-production dependencies).

### Dependencies

Install the [PeerTube dependencies](/support/doc/dependencies.md) except PostgreSQL and Redis.

### Installation

Clone the PeerTube repo to get the latest version (even if you are on your PeerTube server):

```bash
git clone https://github.com/Chocobozzz/PeerTube.git
CLONE="$(pwd)/PeerTube"
cd ${CLONE}
```

Install dependencies and build CLI tools:

```bash
NOCLIENT=1 yarn install --pure-lockfile
npm run setup:cli
```

### CLI wrapper

The wrapper provides a convenient interface to the following scripts.
You can access it as `peertube` via an alias in your `.bashrc` like `alias peertube="cd /your/peertube/directory/ && node ./dist/server/tools/peertube.js"` (you have to keep the `cd` command):

```
  Usage: peertube [command] [options]

  Options:

    -v, --version         output the version number
    -h, --help            output usage information

  Commands:

    auth [action]         register your accounts on remote instances to use them with other commands
    upload|up             upload a video
    import-videos|import  import a video from a streaming platform
    plugins|p [action]    manage instance plugins
    redundancy|r [action] manage video redundancies
    help [cmd]            display help for [cmd]
```

The wrapper can keep track of instances you have an account on. We limit to one account per instance for now.

```bash
peertube auth add -u 'PEERTUBE_URL' -U 'PEERTUBE_USER' --password 'PEERTUBE_PASSWORD'
peertube auth list
┌──────────────────────────────┬──────────────────────────────┐
│ instance                     │ login                        │
├──────────────────────────────┼──────────────────────────────┤
│ 'PEERTUBE_URL'               │ 'PEERTUBE_USER'              │
└──────────────────────────────┴──────────────────────────────┘
```

You can now use that account to upload videos without feeding the same parameters again.

```bash
peertube up <videoFile>
```

To list, install, uninstall dynamically plugins/themes of an instance:

```bash
peertube plugins list
peertube plugins install --path /local/plugin/path
peertube plugins install --npm-name peertube-plugin-myplugin
peertube plugins uninstall --npm-name peertube-plugin-myplugin
```

#### peertube-import-videos.js

You can use this script to import videos from all [supported sites of youtube-dl](https://rg3.github.io/youtube-dl/supportedsites.html) into PeerTube.
Be sure you own the videos or have the author's authorization to do so.

```sh
node dist/server/tools/peertube-import-videos.js \
    -u 'PEERTUBE_URL' \
    -U 'PEERTUBE_USER' \
    --password 'PEERTUBE_PASSWORD' \
    --target-url 'TARGET_URL'
```

* `PEERTUBE_URL` : the full URL of your PeerTube server where you want to import, eg: https://peertube.cpy.re
* `PEERTUBE_USER` : your PeerTube account where videos will be uploaded
* `PEERTUBE_PASSWORD` : password of your PeerTube account (if `--password PEERTUBE_PASSWORD` is omitted, you will be prompted for it)
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

**NB**: If you want to synchronize a Youtube channel to your PeerTube instance (ensure you have the agreement from the author),
you can add a [crontab rule](https://help.ubuntu.com/community/CronHowto) (or an equivalent of your OS) and insert
these rules (ensure to customize them to your needs):

```
# Update youtube-dl every day at midnight
0 0 * * * /usr/bin/npm rebuild youtube-dl --prefix /PATH/TO/PEERTUBE/

# Synchronize the YT channel every sunday at 22:00 all the videos published since last monday included
0 22 * * 0 /usr/bin/node /PATH/TO/PEERTUBE/dist/server/tools/peertube-import-videos.js -u '__PEERTUBE_URL__' -U '__USER__' --password '__PASSWORD__' --target-url 'https://www.youtube.com/channel/___CHANNEL__' --since $(date --date="-6 days" +\%Y-\%m-\%d)
```

Also you may want to subscribe to the PeerTube channel in order to manually check the synchronization is successful.

#### peertube-upload.js

You can use this script to import videos directly from the CLI.

Videos will be publicly available after transcoding (you can see them before that in your account on the web interface).

```bash
cd ${CLONE}
node dist/server/tools/peertube-upload.js --help
```

#### peertube-plugins.js

Install/update/uninstall or list local or NPM PeerTube plugins:

```bash
cd ${CLONE}
node dist/server/tools/peertube-plugins.js --help
node dist/server/tools/peertube-plugins.js list --help
node dist/server/tools/peertube-plugins.js install --help
node dist/server/tools/peertube-plugins.js update --help
node dist/server/tools/peertube-plugins.js uninstall --help

node dist/server/tools/peertube-plugins.js install --path /my/plugin/path
node dist/server/tools/peertube-plugins.js install --npm-name peertube-theme-example
```

#### peertube-redundancy.js

Manage (list/add/remove) video redundancies:

To list your videos that are duplicated by remote instances:

```bash
node dist/server/tools/peertube.js redundancy list-remote-redundancies
```

To list remote videos that your instance duplicated:

```bash
node dist/server/tools/peertube.js redundancy list-my-redundancies
```

To duplicate a specific video in your redundancy system:

```bash
node dist/server/tools/peertube.js redundancy add --video 823
```

To remove a video redundancy:

```bash
node dist/server/tools/peertube.js redundancy remove --video 823
```

## Server tools

These scripts should be run on the server, in `peertube-latest` directory.

### parse-log

To parse PeerTube last log file:

```bash
# Basic installation
cd /var/www/peertube/peertube-latest
sudo -u peertube NODE_CONFIG_DIR=/var/www/peertube/config NODE_ENV=production npm run parse-log -- --level info

# Docker installation
cd /var/www/peertube-docker
docker-compose exec -u peertube peertube npm run parse-log -- --level info
```

`--level` is optional and could be `info`/`warn`/`error`

You can also remove SQL or HTTP logs using `--not-tags` (PeerTube >= 3.2):

```bash
# Basic installation
cd /var/www/peertube/peertube-latest
sudo -u peertube NODE_CONFIG_DIR=/var/www/peertube/config NODE_ENV=production npm run parse-log -- --level debug --not-tags http sql

# Docker installation
cd /var/www/peertube-docker
docker-compose exec -u peertube peertube npm run parse-log -- --level debug --not-tags http sql
```

### regenerate-thumbnails.js

**PeerTube >= 3.2**

Regenerating local video thumbnails could be useful because new PeerTube releases may increase thumbnail sizes:

```bash
# Basic installation
cd /var/www/peertube/peertube-latest
sudo -u peertube NODE_CONFIG_DIR=/var/www/peertube/config NODE_ENV=production npm run regenerate-thumbnails

# Docker installation
cd /var/www/peertube-docker
docker-compose exec -u peertube peertube npm run regenerate-thumbnails
```

### create-import-video-file-job.js

You can use this script to import a video file to replace an already uploaded file or to add a new webtorrent resolution to a video. PeerTube needs to be running.
You can then create a transcoding job using the web interface if you need to optimize your file or create an HLS version of it.

```bash
# Basic installation
cd /var/www/peertube/peertube-latest
sudo -u peertube NODE_CONFIG_DIR=/var/www/peertube/config NODE_ENV=production npm run create-import-video-file-job -- -v [videoUUID] -i [videoFile]

# Docker installation
cd /var/www/peertube-docker
docker-compose exec -u peertube peertube npm run create-import-video-file-job -- -v [videoUUID] -i [videoFile]
```

### create-move-video-storage-job.js

**PeerTube >= 4.0**

Use this script to move all video files or a specific video file to object storage.

```bash
# Basic installation
cd /var/www/peertube/peertube-latest
sudo -u peertube NODE_CONFIG_DIR=/var/www/peertube/config NODE_ENV=production npm run create-move-video-storage-job -- --to-object-storage -v [videoUUID]

# Docker installation
cd /var/www/peertube-docker
docker-compose exec -u peertube peertube npm run create-move-video-storage-job -- --to-object-storage -v [videoUUID]
```

The script can also move all video files that are not already in object storage:

```bash
# Basic installation
cd /var/www/peertube/peertube-latest
sudo -u peertube NODE_CONFIG_DIR=/var/www/peertube/config NODE_ENV=production npm run create-move-video-storage-job -- --to-object-storage --all-videos

# Docker installation
cd /var/www/peertube-docker
docker-compose exec -u peertube peertube npm run create-move-video-storage-job -- --to-object-storage --all-videos
```

<!-- TODO: uncomment when PeerTube 6 is released
### create-generate-storyboard-job

**PeerTube >= 6.0**

Use this script to generate storyboard of a specific video:

```bash
# Basic installation
cd /var/www/peertube/peertube-latest
sudo -u peertube NODE_CONFIG_DIR=/var/www/peertube/config NODE_ENV=production npm run create-generate-storyboard-job -- -v [videoUUID]

# Docker installation
cd /var/www/peertube-docker
docker-compose exec -u peertube peertube npm run create-generate-storyboard-job -- -v [videoUUID]
```

The script can also generate all missing storyboards of local videos:

```bash
# Basic installation
cd /var/www/peertube/peertube-latest
sudo -u peertube NODE_CONFIG_DIR=/var/www/peertube/config NODE_ENV=production npm run create-generate-storyboard-job -- --all-videos

# Docker installation
cd /var/www/peertube-docker
docker-compose exec -u peertube peertube npm run create-generate-storyboard-job -- --all-videos
```
-->

### prune-storage.js

Some transcoded videos or shutdown at a bad time can leave some unused files on your storage.
Stop PeerTube and delete these files (a confirmation will be demanded first):

```bash
cd /var/www/peertube/peertube-latest
sudo systemctl stop peertube && sudo -u peertube NODE_CONFIG_DIR=/var/www/peertube/config NODE_ENV=production npm run prune-storage
```


### update-host.js

**Changing the hostname is unsupported and may be a risky operation, especially if you have already federated.**
If you started PeerTube with a domain, and then changed it you will have
invalid torrent files and invalid URLs in your database. To fix this, you have
to run the command below (keep in mind your follower instances will NOT update their URLs).

```bash
# Basic installation
cd /var/www/peertube/peertube-latest
sudo -u peertube NODE_CONFIG_DIR=/var/www/peertube/config NODE_ENV=production npm run update-host

# Docker installation
cd /var/www/peertube-docker
docker-compose exec -u peertube peertube npm run update-host
```

### reset-password.js

To reset a user password from CLI, run:

```bash
# Basic installation
cd /var/www/peertube/peertube-latest
sudo -u peertube NODE_CONFIG_DIR=/var/www/peertube/config NODE_ENV=production npm run reset-password -- -u target_username

# Docker installation
cd /var/www/peertube-docker
docker-compose exec -u peertube peertube npm run reset-password -- -u target_username
```


### plugin install/uninstall

The difference with `peertube plugins` CLI is that these scripts can be used even if PeerTube is not running.
If PeerTube is running, you need to restart it for the changes to take effect (whereas with `peertube plugins` CLI, plugins/themes are dynamically loaded on the server).

To install/update a plugin or a theme from the disk:

```bash
cd /var/www/peertube/peertube-latest
sudo -u peertube NODE_CONFIG_DIR=/var/www/peertube/config NODE_ENV=production npm run plugin:install -- --plugin-path /local/plugin/path

# Docker installation
cd /var/www/peertube-docker
docker-compose exec -u peertube peertube npm run plugin:install -- --plugin-path /local/plugin/path
```

From NPM:

```bash
cd /var/www/peertube/peertube-latest
sudo -u peertube NODE_CONFIG_DIR=/var/www/peertube/config NODE_ENV=production npm run plugin:install -- --npm-name peertube-plugin-myplugin

# Docker installation
cd /var/www/peertube-docker
docker-compose exec -u peertube peertube npm run plugin:install -- --npm-name peertube-plugin-myplugin
```

To uninstall a plugin or a theme:

```bash
cd /var/www/peertube/peertube-latest
sudo -u peertube NODE_CONFIG_DIR=/var/www/peertube/config NODE_ENV=production npm run plugin:uninstall -- --npm-name peertube-plugin-myplugin

# Docker installation
cd /var/www/peertube-docker
docker-compose exec -u peertube peertube npm run plugin:uninstall -- --npm-name peertube-plugin-myplugin
```

## PeerTube runner

PeerTube >= 5.2 supports VOD or Live transcoding by a remote PeerTube runner.


### Installation

```bash
sudo npm install -g @peertube/peertube-runner
```

### Configuration

The runner uses env paths like `~/.config`, `~/.cache` and `~/.local/share` directories to store runner configuration or temporary files.

Multiple PeerTube runners can run on the same OS by using the `--id` CLI option (each runner uses its own config/tmp directories):

```bash
peertube-runner [commands] --id instance-1
peertube-runner [commands] --id instance-2
peertube-runner [commands] --id instance-3
```

You can change the runner configuration (jobs concurrency, ffmpeg threads/nice etc) by editing `~/.config/peertube-runner-nodejs/[id]/config.toml`.

### Run the server

You need to run the runner in server mode first so it can run transcoding jobs of registered PeerTube instances:

```bash
peertube-runner server
```

### Register

Then, you can register the runner on a new PeerTube instance so the runner can process its transcoding job:

```bash
peertube-runner register --url http://peertube.example.com --registration-token ptrrt-... --runner-name my-runner-name
```

The runner will then use a websocket connection with the PeerTube instance to be notified about new available transcoding jobs.

### Unregister

To unregister a PeerTube instance:

```bash
peertube-runner unregister --url http://peertube.example.com --runner-name my-runner-name
```

### List registered instances

```bash
peertube-runner list-registered
```
