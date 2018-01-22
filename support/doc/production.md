# Production guide

## Installation

### Dependencies

Follow the steps of the [dependencies guide](dependencies.md).

### PeerTube user

Create a `peertube` user with `/home/peertube` home:

```
$ sudo useradd -m -d /home/peertube -s /bin/bash -p peertube peertube
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
    cd /home/peertube && sudo -u peertube mkdir config storage versions && cd versions
```
Download the latest version of the Peertube client, unzip it and remove the zip
```
    sudo -u peertube wget -q "https://github.com/Chocobozzz/PeerTube/releases/download/${VERSION}/peertube-${VERSION}.zip" && \
    sudo -u peertube unzip peertube-${VERSION}.zip && sudo -u peertube rm peertube-${VERSION}.zip
```
Install Peertube
```
    cd ../ && sudo -u peertube ln -s versions/peertube-${VERSION} ./peertube-latest && \
    cd ./peertube-latest && sudo -u peertube yarn install --production --pure-lockfile
```

### PeerTube configuration

Copy example configuration:

```
$ cd /home/peertube && sudo -u peertube cp peertube-latest/config/production.yaml.example config/production.yaml
```

Then edit the `config/production.yaml` file according to your webserver
configuration.

### Webserver

Copy the nginx configuration template:

```
$ sudo cp /home/peertube/peertube-latest/support/nginx/peertube /etc/nginx/sites-available/peertube
```

Then modify the webserver configuration file. Please pay attention to the `alias` keys of the static locations.
It should correspond to the paths of your storage directories (set in the configuration file inside the `storage` key).

```
$ sudo vim /etc/nginx/sites-available/peertube
```

If you want to set https with Let's Encrypt please follow the steps of [this guide](https://www.digitalocean.com/community/tutorials/how-to-secure-nginx-with-let-s-encrypt-on-ubuntu-16-04).

An example of the nginx configuration could be:

```
server {
  listen 80;
  listen [::]:80;
  server_name peertube.example.com;

  access_log /var/log/nginx/peertube.example.com.access.log;
  error_log /var/log/nginx/peertube.example.com.error.log;

  rewrite ^ https://$server_name$request_uri? permanent;
}

server {
  listen 443 ssl http2;
  listen [::]:443 ssl http2;
  server_name peertube.example.com;

  # For example with Let's Encrypt
  ssl_certificate      /etc/letsencrypt/live/peertube.example.com/fullchain.pem;
  ssl_certificate_key  /etc/letsencrypt/live/peertube.example.com/privkey.pem;
  ssl_trusted_certificate /etc/letsencrypt/live/peertube.example.com/chain.pem;

  access_log /var/log/nginx/peertube.example.com.access.log;
  error_log /var/log/nginx/peertube.example.com.error.log;

  location ^~ '/.well-known/acme-challenge' {
    default_type "text/plain";
    root /var/www/certbot;
  }

  location ~ ^/client/(.*\.(js|css|woff2|otf|ttf|woff|eot))$ {
    add_header Cache-Control "public, max-age=31536000, immutable";

    alias /home/peertube/peertube-latest/client/dist/$1;
  }

  location ~ ^/static/(thumbnails|avatars)/(.*)$ {
    add_header Cache-Control "public, max-age=31536000, immutable";

    alias /home/peertube/storage/$1/$2;
  }

  location / {
    proxy_pass http://localhost:9000;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

    # For the video upload
    client_max_body_size 8G;
    proxy_connect_timeout       600;
    proxy_send_timeout          600;
    proxy_read_timeout          600;
    send_timeout                600;
  }

  # Bypass PeerTube webseed route for better performances
  location /static/webseed {
    if ($request_method = 'OPTIONS') {
      add_header 'Access-Control-Allow-Origin' '*';
      add_header 'Access-Control-Allow-Methods' 'GET, OPTIONS';
      add_header 'Access-Control-Allow-Headers' 'Range,DNT,X-CustomHeader,Keep-Alive,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type';
      add_header 'Access-Control-Max-Age' 1728000;
      add_header 'Content-Type' 'text/plain charset=UTF-8';
      add_header 'Content-Length' 0;
      return 204;
    }

    if ($request_method = 'GET') {
      add_header 'Access-Control-Allow-Origin' '*';
      add_header 'Access-Control-Allow-Methods' 'GET, OPTIONS';
      add_header 'Access-Control-Allow-Headers' 'Range,DNT,X-CustomHeader,Keep-Alive,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type';

      # Don't spam access log file with byte range requests
      access_log off;
    }

    alias /home/peertube/storage/videos;
  }

  # Websocket tracker
  location /tracker/socket {
    # Peers send a message to the tracker every 15 minutes
    # Don't close the websocket before this time
    proxy_read_timeout 1200s;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_http_version 1.1;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header Host $host;
    proxy_pass http://localhost:9000;
  }
}
```


Activate the configuration file:

```
$ sudo ln -s /etc/nginx/sites-available/peertube /etc/nginx/sites-enabled/peertube
$ sudo systemctl reload nginx
```

### Systemd

Copy the nginx configuration template:

```
$ sudo cp /home/peertube/peertube-latest/support/systemd/peertube.service /etc/systemd/system/
```

Update the service file:

```
$ sudo vim /etc/systemd/system/peertube.service
```

It should look like this:

```
[Unit]
Description=PeerTube daemon
After=network.target

[Service]
Type=simple
Environment=NODE_ENV=production
Environment=NODE_CONFIG_DIR=/home/peertube/config
User=peertube
Group=peertube
ExecStart=/usr/bin/npm start
WorkingDirectory=/home/peertube/peertube-latest
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=peertube
Restart=always

[Install]
WantedBy=multi-user.target
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
$ cd /home/peertube/peertube-latest && NODE_CONFIG_DIR=/home/peertube/config NODE_ENV=production npm run reset-password -- -u root
```

## Upgrade

Make a SQL backup:

```
$ SQL_BACKUP_PATH="backup/sql-peertube_prod-$(date -Im).bak" && \
    cd /home/peertube && sudo -u peertube mkdir -p backup && \
    sudo pg_dump -U peertube -W -h localhost -F c peertube_prod -f "$SQL_BACKUP_PATH"
```

Update your configuration file. **If some keys are missing, your upgraded PeerTube won't start!**

```
$ diff <(curl -s https://raw.githubusercontent.com/Chocobozzz/PeerTube/develop/config/production.yaml.example) /home/peertube/config/production.yaml
```

Upgrade PeerTube:

```
$ VERSION=$(curl -s https://api.github.com/repos/chocobozzz/peertube/releases/latest | grep tag_name | cut -d '"' -f 4) && \
    cd /home/peertube/versions && \
    sudo -u peertube wget -q "https://github.com/Chocobozzz/PeerTube/releases/download/${VERSION}/peertube-${VERSION}.zip" && \
    sudo -u peertube unzip -o peertube-${VERSION}.zip && sudo -u peertube rm peertube-${VERSION}.zip && \
    cd ../ && sudo rm ./peertube-latest && sudo -u peertube ln -s versions/peertube-${VERSION} ./peertube-latest && \
    cd ./peertube-latest && sudo -u peertube yarn install --production --pure-lockfile && \
    sudo systemctl restart peertube
```

Things went wrong? Change `peertube-latest` destination to the previous version and restore your SQL backup:

```
$ OLD_VERSION="v0.42.42" && SQL_BACKUP_PATH="backup/sql-peertube_prod-2018-01-19T10:18+01:00.bak" && \
    cd /home/peertube && rm ./peertube-latest && \
    sudo -u peertube ln -s "versions/peertube-$OLD_VERSION" peertube-latest && \
    pg_restore -U peertube -c -d peertube_prod "$SQL_BACKUP_PATH"
    sudo systemctl restart peertube
```
