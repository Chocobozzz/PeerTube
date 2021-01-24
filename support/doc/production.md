# Production guide

  * [Installation](#installation)
  * [Upgrade](#upgrade)

## Installation

Please don't install PeerTube for production on a device behind a low bandwidth connection (example: your ADSL link).
If you want information about the appropriate hardware to run PeerTube, please see the [FAQ](https://github.com/Chocobozzz/PeerTube/blob/develop/FAQ.md#should-i-have-a-big-server-to-run-peertube).

### Dependencies

**Follow the steps of the [dependencies guide](dependencies.md).**

### PeerTube user

Create a `peertube` user with `/var/www/peertube` home:

```
$ sudo useradd -m -d /var/www/peertube -s /bin/bash -p peertube peertube
```

Set its password:
```
$ sudo passwd peertube
```

**On FreeBSD**

```
$ sudo pw useradd -n peertube -d /var/www/peertube -s /usr/local/bin/bash -m
$ sudo passwd peertube
```
or use `adduser` to create it interactively.

### Database

Create the production database and a peertube user inside PostgreSQL:

```
$ sudo -u postgres createuser -P peertube
$ sudo -u postgres createdb -O peertube -E UTF8 -T template0 peertube_prod
```

Then enable extensions PeerTube needs:

```
$ sudo -u postgres psql -c "CREATE EXTENSION pg_trgm;" peertube_prod
$ sudo -u postgres psql -c "CREATE EXTENSION unaccent;" peertube_prod
```

### Prepare PeerTube directory

Fetch the latest tagged version of Peertube
```
$ VERSION=$(curl -s https://api.github.com/repos/chocobozzz/peertube/releases/latest | grep tag_name | cut -d '"' -f 4) && echo "Latest Peertube version is $VERSION"
```

Open the peertube directory, create a few required directories
```
$ cd /var/www/peertube
$ sudo -u peertube mkdir config storage versions
```

Download the latest version of the Peertube client, unzip it and remove the zip
```
$ cd /var/www/peertube/versions
$ sudo -u peertube wget -q "https://github.com/Chocobozzz/PeerTube/releases/download/${VERSION}/peertube-${VERSION}.zip"
$ sudo -u peertube unzip peertube-${VERSION}.zip && sudo -u peertube rm peertube-${VERSION}.zip
```

Install Peertube:
```
$ cd /var/www/peertube
$ sudo -u peertube ln -s versions/peertube-${VERSION} ./peertube-latest
$ cd ./peertube-latest && sudo -H -u peertube yarn install --production --pure-lockfile
```

### PeerTube configuration

Copy the default configuration file that contains the default configuration provided by PeerTube.
You **must not** update this file.

```
$ cd /var/www/peertube
$ sudo -u peertube cp peertube-latest/config/default.yaml config/default.yaml
```

Now copy the production example configuration:

```
$ cd /var/www/peertube
$ sudo -u peertube cp peertube-latest/config/production.yaml.example config/production.yaml
```

Then edit the `config/production.yaml` file according to your webserver
and database configuration (`webserver`, `database`, `redis`, `smtp` and `admin.email` sections in particular).
Keys defined in `config/production.yaml` will override keys defined in `config/default.yaml`.

**PeerTube does not support webserver host change**. Even though [PeerTube CLI can help you to switch hostname](https://docs.joinpeertube.org/maintain-tools?id=update-hostjs) there's no official support for that since it is a risky operation that might result in unforeseen errors.

### Webserver

We only provide official configuration files for Nginx.

Copy the nginx configuration template:

```
$ sudo cp /var/www/peertube/peertube-latest/support/nginx/peertube /etc/nginx/sites-available/peertube
```

Then set the domain for the webserver configuration file.
Replace `[peertube-domain]` with the domain for the peertube server.

```
$ sudo sed -i 's/${WEBSERVER_HOST}/[peertube-domain]/g' /etc/nginx/sites-available/peertube
$ sudo sed -i 's/${PEERTUBE_HOST}/127.0.0.1:9000/g' /etc/nginx/sites-available/peertube
```

Then modify the webserver configuration file. Please pay attention to the `alias` keys of the static locations.
It should correspond to the paths of your storage directories (set in the configuration file inside the `storage` key).

```
$ sudo vim /etc/nginx/sites-available/peertube
```

Activate the configuration file:

```
$ sudo ln -s /etc/nginx/sites-available/peertube /etc/nginx/sites-enabled/peertube
```

To generate the certificate for your domain as required to make https work you can use [Let's Encrypt](https://letsencrypt.org/):

```
$ sudo systemctl stop nginx
$ sudo certbot certonly --standalone --post-hook "systemctl start nginx"
$ sudo systemctl reload nginx
```

Now you have the certificates you can reload nginx:

```
$ sudo systemctl reload nginx
```

Certbot should have installed a cron to automatically renew your certificate.
Since our nginx template supports webroot renewal, we suggest you to update the renewal config file to use the `webroot` authenticator:

```
$ # Replace authenticator = standalone by authenticator = webroot
$ sudo vim /etc/letsencrypt/renewal/your-domain.com.conf
```

**FreeBSD**
On FreeBSD you can use [Dehydrated](https://dehydrated.io/) `security/dehydrated` for [Let's Encrypt](https://letsencrypt.org/)

```
$ sudo pkg install dehydrated
```

### TCP/IP Tuning

A lot of your instance's raw performance is dependent on a properly tuned machine and more specifically, reverse-proxy. We provide support for Nginx and spent a lot of time putting sane defaults in it, but we strongly advise you to follow up with instructions in https://github.com/denji/nginx-tuning as needed.

**On Linux**

```
$ sudo cp /var/www/peertube/peertube-latest/support/sysctl.d/30-peertube-tcp.conf /etc/sysctl.d/
$ sudo sysctl -p /etc/sysctl.d/30-peertube-tcp.conf
```

Your distro may enable this by default, but at least Debian 9 does not, and the default FIFO
scheduler is quite prone to "Buffer Bloat" and extreme latency when dealing with slower client
links as we often encounter in a video server.

### systemd

If your OS uses systemd, copy the configuration template:

```
$ sudo cp /var/www/peertube/peertube-latest/support/systemd/peertube.service /etc/systemd/system/
```

Check the service file (PeerTube paths and security directives):

```
$ sudo vim /etc/systemd/system/peertube.service
```


Tell systemd to reload its config:

```
$ sudo systemctl daemon-reload
```

If you want to start PeerTube on boot:

```
$ sudo systemctl enable peertube
```

Run:

```
$ sudo systemctl start peertube
$ sudo journalctl -feu peertube
```

**FreeBSD**
On FreeBSD, copy the startup script and update rc.conf:

```
$ sudo install -m 0555 /var/www/peertube/peertube-latest/support/freebsd/peertube /usr/local/etc/rc.d/
$ sudo sysrc peertube_enable="YES"
```

Run:

```
$ sudo service peertube start
```

### OpenRC

If your OS uses OpenRC, copy the service script:

```
$ sudo cp /var/www/peertube/peertube-latest/support/init.d/peertube /etc/init.d/
```

If you want to start PeerTube on boot:

```
$ sudo rc-update add peertube default
```

Run and print last logs:

```
$ sudo /etc/init.d/peertube start
$ tail -f /var/log/peertube/peertube.log
```

### Administrator

The administrator password is automatically generated and can be found in the PeerTube
logs (path defined in `production.yaml`). You can also set another password with:

```
$ cd /var/www/peertube/peertube-latest && NODE_CONFIG_DIR=/var/www/peertube/config NODE_ENV=production npm run reset-password -- -u root
```

Alternatively you can set the environment variable `PT_INITIAL_ROOT_PASSWORD`,
to your own administrator password, although it must be 6 characters or more.

### What now?

Now your instance is up you can:

 * Add your instance to the public PeerTube instances index if you want to: https://instances.joinpeertube.org/
 * Check [available CLI tools](/support/doc/tools.md)

## Upgrade

### PeerTube instance

**Check the changelog (in particular BREAKING CHANGES!):** https://github.com/Chocobozzz/PeerTube/blob/develop/CHANGELOG.md

#### Auto

The password it asks is PeerTube's database user password.

```
$ cd /var/www/peertube/peertube-latest/scripts && sudo -H -u peertube ./upgrade.sh
```

#### Manually

Make a SQL backup

```
$ SQL_BACKUP_PATH="backup/sql-peertube_prod-$(date -Im).bak" && \
    cd /var/www/peertube && sudo -u peertube mkdir -p backup && \
    sudo -u postgres pg_dump -F c peertube_prod | sudo -u peertube tee "$SQL_BACKUP_PATH" >/dev/null
```

Fetch the latest tagged version of Peertube:

```
$ VERSION=$(curl -s https://api.github.com/repos/chocobozzz/peertube/releases/latest | grep tag_name | cut -d '"' -f 4) && echo "Latest Peertube version is $VERSION"
```

Download the new version and unzip it:

```
$ cd /var/www/peertube/versions && \
    sudo -u peertube wget -q "https://github.com/Chocobozzz/PeerTube/releases/download/${VERSION}/peertube-${VERSION}.zip" && \
    sudo -u peertube unzip -o peertube-${VERSION}.zip && \
    sudo -u peertube rm peertube-${VERSION}.zip
```

Install node dependencies:

```
$ cd /var/www/peertube/versions/peertube-${VERSION} && \
    sudo -H -u peertube yarn install --production --pure-lockfile
```

Copy new configuration defaults values and update your configuration file:

```
$ sudo -u peertube cp /var/www/peertube/versions/peertube-${VERSION}/config/default.yaml /var/www/peertube/config/default.yaml
$ diff /var/www/peertube/versions/peertube-${VERSION}/config/production.yaml.example /var/www/peertube/config/production.yaml
```

Change the link to point to the latest version:

```
$ cd /var/www/peertube && \
    sudo unlink ./peertube-latest && \
    sudo -u peertube ln -s versions/peertube-${VERSION} ./peertube-latest
```

### nginx

Check changes in nginx configuration:

```
$ cd /var/www/peertube/versions
$ diff "$(ls --sort=t | head -2 | tail -1)/support/nginx/peertube" "$(ls --sort=t | head -1)/support/nginx/peertube"
```

### systemd

Check changes in systemd configuration:

```
$ cd /var/www/peertube/versions
$ diff "$(ls --sort=t | head -2 | tail -1)/support/systemd/peertube.service" "$(ls --sort=t | head -1)/support/systemd/peertube.service"
```

### Restart PeerTube

If you changed your nginx configuration:

```
$ sudo systemctl reload nginx
```

If you changed your systemd configuration:

```
$ sudo systemctl daemon-reload
```

Restart PeerTube and check the logs:

```
$ sudo systemctl restart peertube && sudo journalctl -fu peertube
```

### Things went wrong?

Change `peertube-latest` destination to the previous version and restore your SQL backup:

```
$ OLD_VERSION="v0.42.42" && SQL_BACKUP_PATH="backup/sql-peertube_prod-2018-01-19T10:18+01:00.bak" && \
    cd /var/www/peertube && sudo -u peertube unlink ./peertube-latest && \
    sudo -u peertube ln -s "versions/peertube-$OLD_VERSION" peertube-latest && \
    sudo -u postgres pg_restore -c -C -d postgres "$SQL_BACKUP_PATH" && \
    sudo systemctl restart peertube
```
