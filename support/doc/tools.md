# CLI tools guide

[[toc]]

## Remote PeerTube CLI

`peertube-cli` is a tool that communicates with a PeerTube instance using its [REST API](https://docs.joinpeertube.org/api-rest-reference.html).
It can be launched from a remote server/computer to easily upload videos, manage plugins, redundancies etc.

### Installation

Ensure you have `node` installed on your system:

```bash
node --version # Should be >= 16.x
```

Then install the CLI:

```bash
sudo npm install -g @peertube/peertube-cli
```

### CLI wrapper

The wrapper provides a convenient interface to the following sub-commands.

```
Usage: peertube-cli [command] [options]

Options:
  -v, --version                     output the version number
  -h, --help                        display help for command

Commands:
  auth                              Register your accounts on remote instances to use them with other commands
  upload|up [options]               Upload a video on a PeerTube instance
  redundancy|r                      Manage instance redundancies
  plugins|p                         Manage instance plugins/themes
  get-access-token|token [options]  Get a peertube access token
  help [command]                    display help for command
```

The wrapper can keep track of instances you have an account on. We limit to one account per instance for now.

```bash
peertube-cli auth add -u 'PEERTUBE_URL' -U 'PEERTUBE_USER' --password 'PEERTUBE_PASSWORD'
peertube-cli auth list
┌──────────────────────────────┬──────────────────────────────┐
│ instance                     │ login                        │
├──────────────────────────────┼──────────────────────────────┤
│ 'PEERTUBE_URL'               │ 'PEERTUBE_USER'              │
└──────────────────────────────┴──────────────────────────────┘
```

You can now use that account to execute sub-commands without feeding the `--url`, `--username` and `--password` parameters:

```bash
peertube-cli upload <videoFile>
peertube-cli plugins list
...
```

#### peertube-cli upload

You can use this script to upload videos directly from the CLI.

Videos will be publicly available after transcoding (you can see them before that in your account on the web interface).

```bash
cd ${CLONE}
peertube-cli upload --help
```

#### peertube-cli plugins

Install/update/uninstall or list local or NPM PeerTube plugins:

```bash
cd ${CLONE}
peertube-cli plugins --help
peertube-cli plugins list --help
peertube-cli plugins install --help
peertube-cli plugins update --help
peertube-cli plugins uninstall --help

peertube-cli plugins install --path /my/plugin/path
peertube-cli plugins install --npm-name peertube-theme-example
```

#### peertube-cli redundancy

Manage (list/add/remove) video redundancies:

To list your videos that are duplicated by remote instances:

```bash
peertube-cli redundancy list-remote-redundancies
```

To list remote videos that your instance duplicated:

```bash
peertube-cli redundancy list-my-redundancies
```

To duplicate a specific video in your redundancy system:

```bash
peertube-cli redundancy add --video 823
```

To remove a video redundancy:

```bash
peertube-cli redundancy remove --video 823
```


## PeerTube runner

PeerTube >= 5.2 supports VOD or Live transcoding by a remote PeerTube runner.

### Runner installation

Ensure you have `node`, `ffmpeg` and `ffprobe` installed on your system:

```bash
node --version # Should be >= 16.x
ffprobe -version # Should be >= 4.3
ffmpeg -version # Should be >= 4.3
```

Then install the CLI:

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

#### In a shell

You need to run the runner in server mode first so it can run transcoding jobs of registered PeerTube instances:

```bash
peertube-runner server
```

#### As a Systemd service

If your OS uses systemd, you can also configure a service so that the runner starts automatically.

To do so, first create a dedicated user. Here, we are calling it `prunner`, but you can choose whatever name you want.
We are using `/srv/prunner` as his home dir, but you can choose any other path.

```bash
useradd -m -d /srv/prunner -s /bin/bash -p prunner prunner
```

::: info Note
If you want to use `/home/prunner`, you have to set `ProtectHome=false` in the systemd configuration (see below).
:::

Now, you can create the `/etc/systemd/system/prunner.service` file (don't forget to adapt path and user/group names if you changed it):

```Systemd
[Unit]
Description=PeerTube runner daemon
After=network.target

[Service]
Type=simple
Environment=NODE_ENV=production
User=prunner
Group=prunner
ExecStart=peertube-runner server
WorkingDirectory=/srv/prunner
SyslogIdentifier=prunner
Restart=always

; Some security directives.
; Mount /usr, /boot, and /etc as read-only for processes invoked by this service.
ProtectSystem=full
; Sets up a new /dev mount for the process and only adds API pseudo devices
; like /dev/null, /dev/zero or /dev/random but not physical devices. Disabled
; by default because it may not work on devices like the Raspberry Pi.
PrivateDevices=false
; Ensures that the service process and all its children can never gain new
; privileges through execve().
NoNewPrivileges=true
; This makes /home, /root, and /run/user inaccessible and empty for processes invoked
; by this unit. Make sure that you do not depend on data inside these folders.
ProtectHome=true
; Drops the sys admin capability from the daemon.
CapabilityBoundingSet=~CAP_SYS_ADMIN

[Install]
WantedBy=multi-user.target
```

:::info Note
You can add the parameter `--id instance-1` on the `ExecStart` line, if you want to have multiple instances.
You can then create multiple separate services. They can use the same user and path.
:::

Finally, to enable the service for the first time:

```bash
systemctl daemon-reload
systemctl enable prunner.service
systemctl restart prunner.service
```

Next time, if you need to start/stop/restart the service:

```bash
systemctl stop prunner.service
systemctl start prunner.service
systemctl restart prunner.service
```

You can also check the status (and last logs):

```bash
systemctl status prunner.service
```

To edit the runner configuration: juste edit the `/srv/prunner/.config/peertube-runner-nodejs/default/config.toml` file,
and restart the service (this file will be created when the runner starts for the first time).

If you are using the `--id` parameter, you can change specific configuration by editing the file `/srv/prunner/.config/peertube-runner-nodejs/[id]/config.toml`.

::: info
For every peertube-runner commands described below, you have to run them as the `prunner` user.
So for example, to call the `list-registered` command: `sudo -u prunner peertube-runner list-registered`.
Otherwise the script will read the wrong configuration and cache files, and won't work as expected.
:::

### Register

Then, you can register the runner to process transcoding job of a remote PeerTube instance:

::: code-group

```bash [Shell]
peertube-runner register --url http://peertube.example.com --registration-token ptrrt-... --runner-name my-runner-name
```

```bash [Systemd]
sudo -u prunner peertube-runner register --url http://peertube.example.com --registration-token ptrrt-... --runner-name my-runner-name
```

:::

The runner will then use a websocket connection with the PeerTube instance to be notified about new available transcoding jobs.

### Unregister

To unregister a PeerTube instance:

::: code-group


```bash [Shell]
peertube-runner unregister --url http://peertube.example.com --runner-name my-runner-name
```

```bash [Systemd]
sudo -u prunner peertube-runner unregister --url http://peertube.example.com --runner-name my-runner-name
```

:::

### List registered instances

::: code-group

```bash [Shell]
peertube-runner list-registered
```

```bash [Systemd]
sudo -u prunner peertube-runner list-registered
```

:::

### Update the runner package

You can check if there is a new runner version using:

```bash
sudo npm outdated -g @peertube/peertube-runner
```

```
Package                    Current  Wanted  Latest  Location                                Depended by
@peertube/peertube-runner    0.0.6   0.0.7   0.0.7  node_modules/@peertube/peertube-runner  lib
```

To update the runner:

```bash
# Update the package
sudo npm update -g @peertube/peertube-runner
# Check that the version changed (optional)
sudo npm list -g @peertube/peertube-runner
# Restart the service (if you are using systemd)
sudo systemctl restart prunner.service
```

## Server tools

Server tools are scripts that interact directly with the code of your PeerTube instance.
They must be run on the server, in `peertube-latest` directory.

### Parse logs

To parse PeerTube last log file:

::: code-group

```bash [Classic installation]
cd /var/www/peertube/peertube-latest
sudo -u peertube NODE_CONFIG_DIR=/var/www/peertube/config NODE_ENV=production npm run parse-log -- --level info
```

```bash [Docker]
cd /var/www/peertube-docker
docker compose exec -u peertube peertube npm run parse-log -- --level info
```

:::

`--level` is optional and could be `info`/`warn`/`error`

You can also remove SQL or HTTP logs using `--not-tags` (PeerTube >= 3.2):

::: code-group

```bash [Classic installation]
cd /var/www/peertube/peertube-latest
sudo -u peertube NODE_CONFIG_DIR=/var/www/peertube/config NODE_ENV=production npm run parse-log -- --level debug --not-tags http sql
```

```bash [Docker]
cd /var/www/peertube-docker
docker compose exec -u peertube peertube npm run parse-log -- --level debug --not-tags http sql
```

:::

### Regenerate video thumbnails

Regenerating local video thumbnails could be useful because new PeerTube releases may increase thumbnail sizes:

::: code-group

```bash [Classic installation]
cd /var/www/peertube/peertube-latest
sudo -u peertube NODE_CONFIG_DIR=/var/www/peertube/config NODE_ENV=production npm run regenerate-thumbnails
```

```bash [Docker]
cd /var/www/peertube-docker
docker compose exec -u peertube peertube npm run regenerate-thumbnails
```

:::

### Add or replace specific video file

You can use this script to import a video file to replace an already uploaded file or to add a new web compatible resolution to a video. PeerTube needs to be running.
You can then create a transcoding job using the web interface if you need to optimize your file or create an HLS version of it.

::: code-group

```bash [Classic installation]
cd /var/www/peertube/peertube-latest
sudo -u peertube NODE_CONFIG_DIR=/var/www/peertube/config NODE_ENV=production npm run create-import-video-file-job -- -v [videoUUID] -i [videoFile]
```

```bash [Docker]
cd /var/www/peertube-docker
docker compose exec -u peertube peertube npm run create-import-video-file-job -- -v [videoUUID] -i [videoFile]
```

:::

### Move video files from filesystem to object storage

Use this script to move all video files or a specific video file to object storage.

::: code-group

```bash [Classic installation]
cd /var/www/peertube/peertube-latest
sudo -u peertube NODE_CONFIG_DIR=/var/www/peertube/config NODE_ENV=production npm run create-move-video-storage-job -- --to-object-storage -v [videoUUID]
```

```bash [Docker]
cd /var/www/peertube-docker
docker compose exec -u peertube peertube npm run create-move-video-storage-job -- --to-object-storage -v [videoUUID]
```

:::

The script can also move all video files that are not already in object storage:

::: code-group

```bash [Classic installation]
cd /var/www/peertube/peertube-latest
sudo -u peertube NODE_CONFIG_DIR=/var/www/peertube/config NODE_ENV=production npm run create-move-video-storage-job -- --to-object-storage --all-videos
```

```bash [Docker]
cd /var/www/peertube-docker
docker compose exec -u peertube peertube npm run create-move-video-storage-job -- --to-object-storage --all-videos
```

:::

### Move video files from object storage to filesystem

**PeerTube >= 6.0**

Use this script to move all video files or a specific video file from object storage to the PeerTube instance filesystem.

::: code-group

```bash [Classic installation]
cd /var/www/peertube/peertube-latest
sudo -u peertube NODE_CONFIG_DIR=/var/www/peertube/config NODE_ENV=production npm run create-move-video-storage-job -- --to-file-system -v [videoUUID]
```

```bash [Docker]
cd /var/www/peertube-docker
docker compose exec -u peertube peertube npm run create-move-video-storage-job -- --to-file-system -v [videoUUID]
```

:::

The script can also move all video files that are not already on the filesystem:

::: code-group

```bash [Classic installation]
cd /var/www/peertube/peertube-latest
sudo -u peertube NODE_CONFIG_DIR=/var/www/peertube/config NODE_ENV=production npm run create-move-video-storage-job -- --to-file-system --all-videos
```

```bash [Docker]
cd /var/www/peertube-docker
docker compose exec -u peertube peertube npm run create-move-video-storage-job -- --to-file-system --all-videos
```

:::

### Update object storage URLs

**PeerTube >= 6.2**

Use this script after you migrated to another object storage provider so PeerTube updates its internal object URLs (a confirmation will be demanded first).

PeerTube must be stopped.

::: code-group

```bash [Classic installation]
cd /var/www/peertube/peertube-latest
sudo -u peertube NODE_CONFIG_DIR=/var/www/peertube/config NODE_ENV=production npm run update-object-storage-url -- --from 'https://region.old-s3-provider.example.com' --to 'https://region.new-s3-provider.example.com'
```

```bash [Docker]
cd /var/www/peertube-docker
docker compose exec -u peertube peertube npm run update-object-storage-url -- --from 'https://region.old-s3-provider.example.com' --to 'https://region.new-s3-provider.example.com'
```

:::

### Cleanup remote files

**PeerTube >= 6.2**

Use this script to recover disk space by removing remote files (thumbnails, avatars...) that can be re-fetched later by your PeerTube instance on-demand:

```bash [Classic installation]
cd /var/www/peertube/peertube-latest
sudo -u peertube NODE_CONFIG_DIR=/var/www/peertube/config NODE_ENV=production npm run house-keeping -- --delete-remote-files
```

```bash [Docker]
cd /var/www/peertube-docker
docker compose exec -u peertube peertube npm run house-keeping -- --delete-remote-files
```

:::


### Generate storyboard

**PeerTube >= 6.0**

Use this script to generate storyboard of a specific video:

::: code-group

```bash [Classic installation]
cd /var/www/peertube/peertube-latest
sudo -u peertube NODE_CONFIG_DIR=/var/www/peertube/config NODE_ENV=production npm run create-generate-storyboard-job -- -v [videoUUID]
```

```bash [Docker]
cd /var/www/peertube-docker
docker compose exec -u peertube peertube npm run create-generate-storyboard-job -- -v [videoUUID]
```

:::

The script can also generate all missing storyboards of local videos:

::: code-group

```bash [Classic installation]
cd /var/www/peertube/peertube-latest
sudo -u peertube NODE_CONFIG_DIR=/var/www/peertube/config NODE_ENV=production npm run create-generate-storyboard-job -- --all-videos
```

```bash [Docker]
cd /var/www/peertube-docker
docker compose exec -u peertube peertube npm run create-generate-storyboard-job -- --all-videos
```

:::

### Prune filesystem storage

Some transcoded videos or shutdown at a bad time can leave some unused files on your storage.
To delete these files (a confirmation will be demanded first):

```bash
cd /var/www/peertube/peertube-latest
sudo -u peertube NODE_CONFIG_DIR=/var/www/peertube/config NODE_ENV=production npm run prune-storage
```

### Update PeerTube instance domain name

**Changing the hostname is unsupported and may be a risky operation, especially if you have already federated.**
If you started PeerTube with a domain, and then changed it you will have
invalid torrent files and invalid URLs in your database. To fix this, you have
to run the command below (keep in mind your follower instances will NOT update their URLs).

::: code-group

```bash [Classic installation]
cd /var/www/peertube/peertube-latest
sudo -u peertube NODE_CONFIG_DIR=/var/www/peertube/config NODE_ENV=production npm run update-host
```

```bash [Docker]
cd /var/www/peertube-docker
docker compose exec -u peertube peertube npm run update-host
```

:::

### Reset user password

To reset a user password from CLI, run:

::: code-group

```bash [Classic installation]
cd /var/www/peertube/peertube-latest
sudo -u peertube NODE_CONFIG_DIR=/var/www/peertube/config NODE_ENV=production npm run reset-password -- -u target_username
```

```bash [Docker]
cd /var/www/peertube-docker
docker compose exec -u peertube peertube npm run reset-password -- -u target_username
```

:::


### Install or uninstall plugins

The difference with `peertube plugins` CLI is that these scripts can be used even if PeerTube is not running.
If PeerTube is running, you need to restart it for the changes to take effect (whereas with `peertube plugins` CLI, plugins/themes are dynamically loaded on the server).

To install/update a plugin or a theme from the disk:

::: code-group

```bash [Classic installation]
cd /var/www/peertube/peertube-latest
sudo -u peertube NODE_CONFIG_DIR=/var/www/peertube/config NODE_ENV=production npm run plugin:install -- --plugin-path /local/plugin/path
```

```bash [Docker]
cd /var/www/peertube-docker
docker compose exec -u peertube peertube npm run plugin:install -- --plugin-path /local/plugin/path
```

:::

From NPM:

::: code-group

```bash
cd /var/www/peertube/peertube-latest
sudo -u peertube NODE_CONFIG_DIR=/var/www/peertube/config NODE_ENV=production npm run plugin:install -- --npm-name peertube-plugin-myplugin
```

```bash [Docker]
cd /var/www/peertube-docker
docker compose exec -u peertube peertube npm run plugin:install -- --npm-name peertube-plugin-myplugin
```

:::

To uninstall a plugin or a theme:

::: code-group

```bash [Classic installation]
cd /var/www/peertube/peertube-latest
sudo -u peertube NODE_CONFIG_DIR=/var/www/peertube/config NODE_ENV=production npm run plugin:uninstall -- --npm-name peertube-plugin-myplugin
```

```bash [Docker]
cd /var/www/peertube-docker
docker compose exec -u peertube peertube npm run plugin:uninstall -- --npm-name peertube-plugin-myplugin
```

:::
