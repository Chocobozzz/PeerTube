# Production guide

  * [Installation](#installation)
  * [Upgrade](#upgrade)

## Installation

Please don't install PeerTube for production on a device behind a low bandwidth connection (example: your ADSL link).
If you want information about the appropriate hardware to run PeerTube, please see the [FAQ](https://joinpeertube.org/en_US/faq#should-i-have-a-big-server-to-run-peertube).

### :hammer: Dependencies

Follow the steps of the [dependencies guide](/support/doc/dependencies.md).

### :construction_worker: PeerTube user

Create a `peertube` user with `/var/www/peertube` home:

```bash
sudo useradd -m -d /var/www/peertube -s /usr/sbin/nologin -p peertube peertube
```

Set its password:
```bash
sudo passwd peertube
```

Ensure the peertube root directory is traversable by nginx:

```bash
ls -ld /var/www/peertube # Should be drwxr-xr-x
```

**On FreeBSD**

```bash
sudo pw useradd -n peertube -d /var/www/peertube -s /usr/local/bin/bash -m
sudo passwd peertube
```
or use `adduser` to create it interactively.

### :card_file_box: Database

Create the production database and a peertube user inside PostgreSQL:

```bash
cd /var/www/peertube
sudo -u postgres createuser -P peertube
```

Here you should enter a password for PostgreSQL `peertube` user, that should be copied in `production.yaml` file.
Don't just hit enter else it will be empty.

```bash
sudo -u postgres createdb -O peertube -E UTF8 -T template0 peertube_prod
```

Then enable extensions PeerTube needs:

```bash
sudo -u postgres psql -c "CREATE EXTENSION pg_trgm;" peertube_prod
sudo -u postgres psql -c "CREATE EXTENSION unaccent;" peertube_prod
```

### :page_facing_up: Prepare PeerTube directory

Fetch the latest tagged version of Peertube:

```bash
VERSION=$(curl -s https://api.github.com/repos/chocobozzz/peertube/releases/latest | grep tag_name | cut -d '"' -f 4) && echo "Latest Peertube version is $VERSION"
```


Open the peertube directory, create a few required directories:

```bash
cd /var/www/peertube
sudo -u peertube mkdir config storage versions
sudo -u peertube chmod 750 config/
```


Download the latest version of the Peertube client, unzip it and remove the zip:

```bash
cd /var/www/peertube/versions
# Releases are also available on https://builds.joinpeertube.org/release
sudo -u peertube wget -q "https://github.com/Chocobozzz/PeerTube/releases/download/${VERSION}/peertube-${VERSION}.zip"
sudo -u peertube unzip -q peertube-${VERSION}.zip && sudo -u peertube rm peertube-${VERSION}.zip
```


Install Peertube:

```bash
cd /var/www/peertube
sudo -u peertube ln -s versions/peertube-${VERSION} ./peertube-latest
cd ./peertube-latest && sudo -H -u peertube yarn install --production --pure-lockfile
```

### :wrench: PeerTube configuration

Copy the default configuration file that contains the default configuration provided by PeerTube.
You **must not** update this file.

```bash
cd /var/www/peertube
sudo -u peertube cp peertube-latest/config/default.yaml config/default.yaml
```

Now copy the production example configuration:

```bash
cd /var/www/peertube
sudo -u peertube cp peertube-latest/config/production.yaml.example config/production.yaml
```

Then edit the `config/production.yaml` file according to your webserver and database configuration. In particular:
 * `webserver`: Reverse proxy public information
 * `secrets`: Secret strings you must generate manually (PeerTube version >= 5.0)
 * `database`: PostgreSQL settings
 * `redis`: Redis settings
 * `smtp`: If you want to use emails
 * `admin.email`: To correctly fill `root` user email

Keys defined in `config/production.yaml` will override keys defined in `config/default.yaml`.

**PeerTube does not support webserver host change**. Even though [PeerTube CLI can help you to switch hostname](https://docs.joinpeertube.org/maintain/tools#update-host-js) there's no official support for that since it is a risky operation that might result in unforeseen errors.

### :truck: Webserver

We only provide official configuration files for Nginx.

Copy the nginx configuration template:

```bash
sudo cp /var/www/peertube/peertube-latest/support/nginx/peertube /etc/nginx/sites-available/peertube
```

Set the domain for the webserver configuration file by replacing `[peertube-domain]` with the domain for the peertube server:

```bash
sudo sed -i 's/${WEBSERVER_HOST}/[peertube-domain]/g' /etc/nginx/sites-available/peertube
sudo sed -i 's/${PEERTUBE_HOST}/127.0.0.1:9000/g' /etc/nginx/sites-available/peertube
```

Then modify the webserver configuration file. Please pay attention to:
 * the `alias`, `root` and `rewrite` directives paths, the paths must correspond to your PeerTube filesystem location
 * the `proxy_limit_rate` and `limit_rate` directives if you plan to stream high bitrate videos (like 4K at 60FPS)

```bash
sudo vim /etc/nginx/sites-available/peertube
```

Activate the configuration file:

```bash
sudo ln -s /etc/nginx/sites-available/peertube /etc/nginx/sites-enabled/peertube
```

To generate the certificate for your domain as required to make https work you can use [Let's Encrypt](https://letsencrypt.org/):

```bash
sudo systemctl stop nginx
sudo certbot certonly --standalone --post-hook "systemctl restart nginx"
sudo systemctl restart nginx
```

Certbot should have installed a cron to automatically renew your certificate.
Since our nginx template supports webroot renewal, we suggest you to update the renewal config file to use the `webroot` authenticator:

```bash
# Replace authenticator = standalone by authenticator = webroot
# Add webroot_path = /var/www/certbot
sudo vim /etc/letsencrypt/renewal/your-domain.com.conf
```

If you plan to have many concurrent viewers on your PeerTube instance, consider increasing `worker_connections` value: https://nginx.org/en/docs/ngx_core_module.html#worker_connections.

<details>
<summary><strong>If using FreeBSD</strong></summary>

On FreeBSD you can use [Dehydrated](https://dehydrated.io/) `security/dehydrated` for [Let's Encrypt](https://letsencrypt.org/)

```bash
sudo pkg install dehydrated
```
</details>

### :alembic: Linux TCP/IP Tuning

```bash
sudo cp /var/www/peertube/peertube-latest/support/sysctl.d/30-peertube-tcp.conf /etc/sysctl.d/
sudo sysctl -p /etc/sysctl.d/30-peertube-tcp.conf
```

Your distro may enable this by default, but at least Debian 9 does not, and the default FIFO
scheduler is quite prone to "Buffer Bloat" and extreme latency when dealing with slower client
links as we often encounter in a video server.

### :bricks: systemd

If your OS uses systemd, copy the configuration template:

```bash
sudo cp /var/www/peertube/peertube-latest/support/systemd/peertube.service /etc/systemd/system/
```

Check the service file (PeerTube paths and security directives):

```bash
sudo vim /etc/systemd/system/peertube.service
```


Tell systemd to reload its config:

```bash
sudo systemctl daemon-reload
```

If you want to start PeerTube on boot:

```bash
sudo systemctl enable peertube
```

Run:

```bash
sudo systemctl start peertube
sudo journalctl -feu peertube
```

<details>
<summary><strong>If using FreeBSD</strong></summary>

On FreeBSD, copy the startup script and update rc.conf:

```bash
sudo install -m 0555 /var/www/peertube/peertube-latest/support/freebsd/peertube /usr/local/etc/rc.d/
sudo sysrc peertube_enable="YES"
```

Run:

```bash
sudo service peertube start
```
</details>

<details>
<summary><strong>If using OpenRC</strong></summary>

If your OS uses OpenRC, copy the service script:

```bash
sudo cp /var/www/peertube/peertube-latest/support/init.d/peertube /etc/init.d/
```

If you want to start PeerTube on boot:

```bash
sudo rc-update add peertube default
```

Run and print last logs:

```bash
sudo /etc/init.d/peertube start
tail -f /var/log/peertube/peertube.log
```
</details>

### :technologist: Administrator

The administrator username is `root` and the password is automatically generated. It can be found in PeerTube
logs (path defined in `production.yaml`). You can also set another password with:

```bash
cd /var/www/peertube/peertube-latest && NODE_CONFIG_DIR=/var/www/peertube/config NODE_ENV=production npm run reset-password -- -u root
```

Alternatively you can set the environment variable `PT_INITIAL_ROOT_PASSWORD`,
to your own administrator password, although it must be 6 characters or more.

### :tada: What now?

Now your instance is up you can:

 * Add your instance to the public PeerTube instances index if you want to: https://instances.joinpeertube.org/
 * Check [available CLI tools](/support/doc/tools.md)

## Upgrade

### PeerTube instance

**Check the changelog (in particular the *IMPORTANT NOTES* section):** https://github.com/Chocobozzz/PeerTube/blob/develop/CHANGELOG.md

Run the upgrade script (the password it asks is PeerTube's database user password):

```bash
cd /var/www/peertube/peertube-latest/scripts && sudo -H -u peertube ./upgrade.sh
sudo systemctl restart peertube # Or use your OS command to restart PeerTube if you don't use systemd
```

You may want to run `sudo -u peertube yarn cache clean` after several upgrades to free up disk space.

<details>
<summary><strong>Prefer manual upgrade?</strong></summary>

Make a SQL backup

```bash
SQL_BACKUP_PATH="backup/sql-peertube_prod-$(date -Im).bak" && \
    cd /var/www/peertube && sudo -u peertube mkdir -p backup && \
    sudo -u postgres pg_dump -F c peertube_prod | sudo -u peertube tee "$SQL_BACKUP_PATH" >/dev/null
```

Fetch the latest tagged version of Peertube:

```bash
VERSION=$(curl -s https://api.github.com/repos/chocobozzz/peertube/releases/latest | grep tag_name | cut -d '"' -f 4) && echo "Latest Peertube version is $VERSION"
```

Download the new version and unzip it:

```bash
cd /var/www/peertube/versions && \
    sudo -u peertube wget -q "https://github.com/Chocobozzz/PeerTube/releases/download/${VERSION}/peertube-${VERSION}.zip" && \
    sudo -u peertube unzip -o peertube-${VERSION}.zip && \
    sudo -u peertube rm peertube-${VERSION}.zip
```

Install node dependencies:

```bash
cd /var/www/peertube/versions/peertube-${VERSION} && \
    sudo -H -u peertube yarn install --production --pure-lockfile
```

Copy new configuration defaults values and update your configuration file:

```bash
sudo -u peertube cp /var/www/peertube/versions/peertube-${VERSION}/config/default.yaml /var/www/peertube/config/default.yaml
diff -u /var/www/peertube/versions/peertube-${VERSION}/config/production.yaml.example /var/www/peertube/config/production.yaml
```

Change the link to point to the latest version:

```bash
cd /var/www/peertube && \
    sudo unlink ./peertube-latest && \
    sudo -u peertube ln -s versions/peertube-${VERSION} ./peertube-latest
```
</details>

### Update PeerTube configuration

Check for configuration changes, and report them in your `config/production.yaml` file:

```bash
cd /var/www/peertube/versions
diff -u "$(ls -t | head -2 | tail -1)/config/production.yaml.example" "$(ls -t | head -1)/config/production.yaml.example"
```

### Update nginx configuration

Check changes in nginx configuration:

```bash
cd /var/www/peertube/versions
diff -u "$(ls -t | head -2 | tail -1)/support/nginx/peertube" "$(ls -t | head -1)/support/nginx/peertube"
```

### Update systemd service

Check changes in systemd configuration:

```bash
cd /var/www/peertube/versions
diff -u "$(ls -t | head -2 | tail -1)/support/systemd/peertube.service" "$(ls -t | head -1)/support/systemd/peertube.service"
```

### Restart PeerTube

If you changed your nginx configuration:

```bash
sudo systemctl reload nginx
```

If you changed your systemd configuration:

```bash
sudo systemctl daemon-reload
```

Restart PeerTube and check the logs:

```bash
sudo systemctl restart peertube && sudo journalctl -fu peertube
```

### Things went wrong?

Change `peertube-latest` destination to the previous version and restore your SQL backup:

```bash
OLD_VERSION="v0.42.42" && SQL_BACKUP_PATH="backup/sql-peertube_prod-2018-01-19T10:18+01:00.bak" && \
  cd /var/www/peertube && sudo -u peertube unlink ./peertube-latest && \
  sudo -u peertube ln -s "versions/peertube-$OLD_VERSION" peertube-latest && \
  sudo -u postgres pg_restore -c -C -d postgres "$SQL_BACKUP_PATH" && \
  sudo systemctl restart peertube
```
