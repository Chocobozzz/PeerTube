# Production guide

## Installation

### Dependencies

Follow the steps of the [dependencies guide](dependencies.md).

### PeerTube user

Create a `peertube` user with `/home/peertube` home:

```
sudo useradd -m -d /home/peertube -s /bin/bash -p peertube peertube
sudo passwd peertube
```

### Database

Create production database and peertube user:

```
sudo -u postgres createuser -P peertube
sudo -u postgres createdb -O peertube peertube_prod
```

### Sources

Clone, install node dependencies and build application:

```
$ cd /home/peertube
$ sudo -u peertube git clone -b master https://github.com/Chocobozzz/PeerTube
$ cd PeerTube
$ sudo -u peertube yarn install --pure-lockfile
$ sudo -u peertube npm run build
```

### PeerTube configuration

Copy example configuration:

```
$ sudo -u peertube cp config/production.yaml.example config/production.yaml
```

Then edit the `config/production.yaml` file according to your webserver
configuration. Keys set in this file will override those of
`config/default.yml`.

### Webserver

Copy the nginx configuration template:

```
$ sudo cp /home/peertube/PeerTube/support/nginx/peertube-https /etc/nginx/sites-available/peertube
```

Then modify the webserver configuration file. Please pay attention to the `alias` key of `/static/webseed` location. 
It should correspond to the path of your videos directory (set in the configuration file as `storage->videos` key).

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
    }

    alias /var/www/PeerTube/videos;
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
sudo cp /home/peertube/PeerTube/support/systemd/peertube.service /etc/systemd/system/
```

Update the service file:

```
sudo vim /etc/systemd/system/peertube.service
```

It should look like this:

```
[Unit]
Description=PeerTube daemon
After=network.target

[Service]
Type=simple
Environment=NODE_ENV=production
User=peertube
Group=peertube
ExecStart=/usr/bin/npm start
WorkingDirectory=/home/peertube/PeerTube
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=peertube
Restart=always

[Install]
WantedBy=multi-user.target
```


Tell systemd to reload its config:

```
sudo systemctl daemon-reload
```

### Run

```
sudo systemctl start peertube
sudo journalctl -feu peertube
```

### Administrator

The administrator password is automatically generated and can be found in the
logs. You can set another password with:

```
$ NODE_ENV=production npm run reset-password -- -u root
```

## Upgrade

The following commands will upgrade the source (according to your current
branch), upgrade node modules and rebuild client application:

```
# systemctl stop peertube
$ npm run upgrade-peertube
# systemctl start peertube
```

## Installation on Docker Swarm

There is an example configuration for deploying peertube and a postgres database as a Docker swarm stack. It works like this:

(_Note_: You need to make sure to set `traefik` and `peertube` labels on the target node(s) for this configuration to work.)

1. Install a traefik loadbalancer stack (including Let's Encrypt) on your docker swarm. [Here](https://gist.github.com/djmaze/2684fbf147d775c8ee441b4302554823) is an example configuration.

2. Copy the [example stack file](docker/docker-stack.example.yml) for peertube:

        scp docker/docker-stack.example.yml root@your-server:/path/to/your/swarm-config/peertube.yml

2. Have a look at the file and adjust the variables to your need.

3. Deploy the stack:

        docker stack deploy -c peertube.yml peertube
