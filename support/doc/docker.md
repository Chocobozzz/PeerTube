# Docker guide

This guide requires [docker](https://www.docker.com/community-edition) and
[docker-compose](https://docs.docker.com/compose/install/).

## Install

**PeerTube does not support webserver host change**. Keep in mind your domain
name is definitive after your first PeerTube start.

#### Go to your workdir

_note_: the guide that follows assumes an empty workdir, but you can also clone the repository, use the master branch and `cd support/docker/production`.

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

#### Webserver

*The docker compose file includes a configured web server. You can skip this part and comment the appropriate section in the docker compose if you use another webserver/proxy.*

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
