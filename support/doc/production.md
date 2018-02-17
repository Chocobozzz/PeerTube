# Production guide

  * [Installation](#installation)
  * [Upgrade](#upgrade) 

## Installation

**Please don't install PeerTube for production on a small device behind a low bandwidth connection because it could slow down the fediverse.**

### Dependencies

Follow the steps of the [dependencies guide](dependencies.md).

### PeerTube user

Create a `peertube` user with `/var/www/peertube` home:

```
$ sudo useradd -m -d /var/www/peertube -s /bin/bash -p peertube peertube
```

Set its password:
```
$ sudo passwd peertube
```

### Database

Create the production database and a peertube user inside PostgreSQL:

```
$ sudo -u postgres createuser -P peertube
$ sudo -u postgres createdb -O peertube peertube_prod
```

### Prepare PeerTube directory

Fetch the latest tagged version of Peertube
```
$ VERSION=$(curl -s https://api.github.com/repos/chocobozzz/peertube/releases/latest | grep tag_name | cut -d '"' -f 4) && echo "Latest Peertube version is $VERSION"
```

Open the peertube directory, create a few required directories
```
$ cd /var/www/peertube && sudo -u peertube mkdir config storage versions && cd versions
```

Download the latest version of the Peertube client, unzip it and remove the zip
```
$ sudo -u peertube wget -q "https://github.com/Chocobozzz/PeerTube/releases/download/${VERSION}/peertube-${VERSION}.zip"
$ sudo -u peertube unzip peertube-${VERSION}.zip && sudo -u peertube rm peertube-${VERSION}.zip
```

Install Peertube
```
$ cd ../ && sudo -u peertube ln -s versions/peertube-${VERSION} ./peertube-latest
$ cd ./peertube-latest && sudo -H -u peertube yarn install --production --pure-lockfile
```

### PeerTube configuration

Copy example configuration:

```
$ cd /var/www/peertube && sudo -u peertube cp peertube-latest/config/production.yaml.example config/production.yaml
```

Then edit the `config/production.yaml` file according to your webserver
configuration.

### Webserver

We only provide official configuration files for Nginx.

Copy the nginx configuration template:

```
$ sudo cp /var/www/peertube/peertube-latest/support/nginx/peertube /etc/nginx/sites-available/peertube
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
$ sudo certbot --authenticator standalone --installer nginx --post-hook "systemctl start nginx"
```

Remember your certificate will expire in 90 days, and thus needs renewal.

Now you have the certificates you can reload nginx:

```
$ sudo systemctl reload nginx
```

### Systemd

Copy the SystemD configuration template:

```
$ sudo cp /var/www/peertube/peertube-latest/support/systemd/peertube.service /etc/systemd/system/
```

Update the service file:

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

### Run

```
$ sudo systemctl start peertube
$ sudo journalctl -feu peertube
```

### Administrator

The administrator password is automatically generated and can be found in the
logs. You can set another password with:

```
$ cd /var/www/peertube/peertube-latest && NODE_CONFIG_DIR=/var/www/peertube/config NODE_ENV=production npm run reset-password -- -u root
```

## Upgrade

#### Auto (minor versions only)

```
$ cd /var/www/peertube/peertube-latest/scripts && sudo -u peertube ./upgrade.sh
$ diff /var/www/peertube/versions/peertube-${VERSION}/config/production.yaml.example /var/www/peertube/config/production.yaml
$ sudo systemctl restart peertube && sudo journalctl -fu peertube
```

#### Manually

Make a SQL backup

```
$ SQL_BACKUP_PATH="backup/sql-peertube_prod-$(date -Im).bak" && \
    cd /var/www/peertube && sudo -u peertube mkdir -p backup && \
    sudo pg_dump -U peertube -W -h localhost -F c peertube_prod -f "$SQL_BACKUP_PATH"
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
    sudo -u peertube yarn install --production --pure-lockfile
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


Restart PeerTube:
```
$ sudo systemctl restart peertube
```

### Things went wrong? 

Change `peertube-latest` destination to the previous version and restore your SQL backup:

```
$ OLD_VERSION="v0.42.42" && SQL_BACKUP_PATH="backup/sql-peertube_prod-2018-01-19T10:18+01:00.bak" && \
    cd /var/www/peertube && unlink ./peertube-latest && \
    sudo -u peertube ln -s "versions/peertube-$OLD_VERSION" peertube-latest && \
    pg_restore -U peertube -W -h localhost -c -d peertube_prod "$SQL_BACKUP_PATH"
    sudo systemctl restart peertube
```
