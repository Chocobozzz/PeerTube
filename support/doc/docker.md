# Docker guide

* [Part 1](#part-1---local-instance) - Local Instance
* [Part 2](#part-2---public-instance) - Public Instance with Let's Encrypt


## Pre-requisites

This guide requires [docker](https://www.docker.com/community-edition) and
[docker-compose](https://docs.docker.com/compose/install/).


# Part 1 - Local Instance

## Constraints

You will need a way to configure a domain name to resolve to an IP - e.g. `/etc/hosts` or a `DNS` entry.


#### Create a new, empty workdir


```shell
cd /your/peertube/directory
```

#### Get the latest Compose file

```shell
curl https://raw.githubusercontent.com/chocobozzz/PeerTube/develop/support/docker/local/docker-compose.yml > docker-compose.yml
```

Source: [docker-compose.yml](../docker/local/docker-compose.yml)

No changes are necessary to this file; use it as-is.


#### Get the `.env` file template

```shell
curl https://raw.githubusercontent.com/Chocobozzz/PeerTube/develop/support/docker/local/.env > .env
```

Source: [.env](../docker/local/.env)

It's not likely you'll need to modify this unless you want to change the
domain name used in this guide, or there is a Docker network conflict on
subnets.


#### Review the `.env` file

```shell
cat .env
```

Note the IP address. You need a domain name that will resolve to this address. 
The `.env` file uses `peertube.local` as a domain name; you can change it to a
name of your choice, provided that it has at least one period `.` in it. The
name `localhost` will not work.


#### Configure domain name

For local-only testing, you can add an entry to your `/etc/hosts` file. Add one
line using the host name and IP address from the `.env` file:

```
172.18.0.42 peertube.local
```

Alternatively, you could configure an entry in a DNS server if you have one.


#### Test your setup

Run your containers:

```shell
docker-compose up
```

_First Startup_

It is normal to see connection errors since the web site will startup faster than Postgres.

The expected sequence is:

1. `peertube_1 error: Unable to connect to PostgreSQL database.`
2. `postgres_1 database system is ready to accept connections`
3. `peertube_1 info: Database peertube is ready`

...and this should not take more than 10-15 seconds.


#### Obtaining your automatically-generated admin credentials

Now that you've installed your PeerTube instance you'll want to grep your peertube container's logs for the `root` password. You're going to want to run `docker-compose logs peertube | grep -A1 root` to search the log output for your new PeerTube's instance admin credentials which will look something like this.

```bash
$ docker-compose logs peertube | grep -A1 root

peertube_1  | [peertube.local:9000] 2019-11-16 04:26:06.082 info: Username: root
peertube_1  | [peertube.local:9000] 2019-11-16 04:26:06.083 info: User password: abcdefghijklmnop
```

Now browse to `http://peertube.local:9000` and login as `root`.


## Differences in Part 1 vs. Production Configuration in Part 2

To simplify _Part 1_ of this guide, some configuration was omitted, which limits some features.

_Omitted configuration_

* Nginx reverse proxy
* SSL private key and certificate
* Let's Encrypt and certbot

_Unavailable features_

* Following other instances, and being followed - requires SSL/HTTPS
* Seeing content from other instances
* Sending automated email - likely blocked by your ISP or cloud provider

_DNS_

If you used `/etc/hosts` your local instance isn't useable elsewhere in your network.
OAuth will complain if you try to use an IP address.

Your local instance should be usable if you configure its name in a local DNS server.


# Part 2 - Public Instance


## Constraints

**PeerTube does not support webserver host change**. Keep in mind your domain
name is definitive after your first PeerTube start.

Your server will need to be reachable from the public internet on port 80 and 
have a resolvable dns name.


## Configure

#### Create a new, empty workdir

```shell
cd /your/peertube/directory
```

#### Get the latest Compose file

```shell
curl https://raw.githubusercontent.com/chocobozzz/PeerTube/develop/support/docker/production/docker-compose.yml > docker-compose.yml
```

View the source of the file you're about to download: [docker-compose.yml](https://github.com/Chocobozzz/PeerTube/blob/develop/support/docker/production/docker-compose.yml)

#### Get the latest env_file

```shell
curl https://raw.githubusercontent.com/Chocobozzz/PeerTube/develop/support/docker/production/.env > .env
```

View the source of the file you're about to download: [.env](https://github.com/Chocobozzz/PeerTube/blob/develop/support/docker/production/.env)

#### Tweak the `docker-compose.yml` file there according to your needs

```shell
$EDITOR ./docker-compose.yml
```

#### Then tweak the `.env` file to change the environment variables settings

```shell
$EDITOR ./.env
```

In the downloaded example [.env](https://github.com/Chocobozzz/PeerTube/blob/develop/support/docker/production/.env), you must replace:
- `<MY POSTGRES USERNAME>`
- `<MY POSTGRES PASSWORD>`
- `<MY DOMAIN>` without 'https://'
- `<MY EMAIL ADDRESS>`

Other environment variables are used in
[/support/docker/production/config/custom-environment-variables.yaml](https://github.com/Chocobozzz/PeerTube/blob/develop/support/docker/production/config/custom-environment-variables.yaml) and can be
intuited from usage.

#### Reverse Proxy

*The docker compose file includes a configured `nginx` reverse proxy. You can skip this part and comment the appropriate section in the docker compose if you use another reverse proxy.*

Install the template that the nginx container will use.
The container will generate the configuration by replacing `${WEBSERVER_HOST}` and `${PEERTUBE_HOST}` using your docker compose env file.

```shell
mkdir -p docker-volume/nginx
curl https://raw.githubusercontent.com/Chocobozzz/PeerTube/develop/support/nginx/peertube > docker-volume/nginx/peertube
```

You need to manually generate the first SSL/TLS certificate using Let's Encrypt:

```shell
mkdir -p docker-volume/certbot
docker run -it --rm --name certbot -p 80:80 -v "$(pwd)/docker-volume/certbot/conf:/etc/letsencrypt" certbot/certbot certonly --standalone
```

A dedicated container in the docker-compose will automatically renew this certificate and reload nginx.


#### Test your setup

Run your containers:

```shell
docker-compose up
```

#### Obtaining your automatically-generated admin credentials

Now that you've installed your PeerTube instance you'll want to grep your peertube container's logs for the `root` password. You're going to want to run `docker-compose logs peertube | grep -A1 root` to search the log output for your new PeerTube's instance admin credentials which will look something like this.

```bash
$ docker-compose logs peertube | grep -A1 root

peertube_1  | [example.com:443] 2019-11-16 04:26:06.082 info: Username: root
peertube_1  | [example.com:443] 2019-11-16 04:26:06.083 info: User password: abcdefghijklmnop
```

#### Obtaining Your Automatically Generated DKIM DNS TXT Record

[DKIM](https://en.wikipedia.org/wiki/DomainKeys_Identified_Mail) signature sending and RSA keys generation are enabled by the default Postfix image `mwader/postfix-relay` with [OpenDKIM](http://www.opendkim.org/).

Run `cat ./docker-volume/opendkim/keys/*/*.txt` to display your DKIM DNS TXT Record containing the public key to configure to your domain :

```bash
$ cat ./docker-volume/opendkim/keys/*/*.txt

peertube._domainkey.mydomain.tld.	IN	TXT	( "v=DKIM1; h=sha256; k=rsa; "
	  "p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0Dx7wLGPFVaxVQ4TGym/eF89aQ8oMxS9v5BCc26Hij91t2Ci8Fl12DHNVqZoIPGm+9tTIoDVDFEFrlPhMOZl8i4jU9pcFjjaIISaV2+qTa8uV1j3MyByogG8pu4o5Ill7zaySYFsYB++cHJ9pjbFSC42dddCYMfuVgrBsLNrvEi3dLDMjJF5l92Uu8YeswFe26PuHX3Avr261n"
	  "j5joTnYwat4387VEUyGUnZ0aZxCERi+ndXv2/wMJ0tizq+a9+EgqIb+7lkUc2XciQPNuTujM25GhrQBEKznvHyPA6fHsFheymOuB763QpkmnQQLCxyLygAY9mE/5RY+5Q6J9oDOQIDAQAB" )  ; ----- DKIM key peertube for mydomain.tld
```

#### Administrator password

See the production guide ["Administrator" section](https://docs.joinpeertube.org/install-any-os?id=administrator)

#### What now?

See the production guide ["What now" section](https://docs.joinpeertube.org/install-any-os?id=what-now).

## Troubleshooting

If you see either of these errors:

1. `Cannot retrieve OAuth Client credentials: undefined` (a pop-up in the lower right)
2. `Invalid client: client is invalid` (an error after logging in that leaves you logged out)

...it is likely there's a mismatch between what host name and port number you are using from
your browser, and the host name and port number that PeerTube thinks you are using.

_In `.env` double check:_

* `PEERTUBE_WEBSERVER_HOSTNAME` - must be the DNS name of your server
* `PEERTUBE_WEBSERVER_PORT` - must be the port number the `nginx` reverse-proxy is listening on (likely 443)
* `PEERTUBE_WEBSERVER_HTTPS` - must be `true` when using `Let's Encrypt` or your own certificates


## Running from a git clone

The Part 1 local demo can be run by cloning the git repository, making `peertube.local` resolve to the expected IP, and using `docker-compose up` from the `support/docker/local` folder.

The Part 2 demo requires extensive modification to the `docker-compose.yml` and `.env` files - you can clone the git repo and then modify them, but it may not be worth it. Be sure not to commit your local-only changes.


## Upgrade

**Important:** Before upgrading, check you have all the `storage` fields in your [production.yaml file](https://github.com/Chocobozzz/PeerTube/blob/develop/support/docker/production/config/production.yaml).

Pull the latest images:

```shell
$ cd /your/peertube/directory
$ docker-compose pull
```

Stop, delete the containers and internal volumes (to invalidate static client files shared by `peertube` and `webserver` containers):

```shell
$ docker-compose down -v
```

Rerun PeerTube:

```shell
$ docker-compose up -d
```

## Build

### Production

```shell
$ git clone https://github.com/chocobozzz/PeerTube /tmp/peertube
$ cd /tmp/peertube
$ docker build . -f ./support/docker/production/Dockerfile.buster
```

### Development

We don't have a Docker image for development. See [the CONTRIBUTING guide](https://github.com/Chocobozzz/PeerTube/blob/develop/.github/CONTRIBUTING.md#develop) for more information on how you can hack PeerTube!
