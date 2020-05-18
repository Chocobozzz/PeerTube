# Docker guide

You can quickly get a server running using Docker. You need to have
[docker](https://www.docker.com/community-edition) and
[docker-compose](https://docs.docker.com/compose/install/) installed.

## Production

### Install

**PeerTube does not support webserver host change**. Keep in mind your domain name is definitive after your first PeerTube start.

PeerTube needs a PostgreSQL and a Redis instance to work correctly. If you want
to quickly set up a full environment, either for trying the service or in
production, you can use a `docker-compose` setup.

#### Go to your peertube workdir
```shell
cd /your/peertube/directory
```

#### Create the reverse proxy configuration directory

```shell
mkdir -p ./docker-volume/traefik
```

#### Get the latest reverse proxy configuration

```shell
curl https://raw.githubusercontent.com/chocobozzz/PeerTube/master/support/docker/production/config/traefik.toml > ./docker-volume/traefik/traefik.toml
```

View the source of the file you're about to download: [traefik.toml](https://github.com/Chocobozzz/PeerTube/blob/master/support/docker/production/config/traefik.toml)

#### Create Let's Encrypt ACME certificates as JSON file

```shell
touch ./docker-volume/traefik/acme.json
```
Needs to have file mode 600:
```shell
chmod 600 ./docker-volume/traefik/acme.json 
```

#### Get the latest Compose file

```shell
curl https://raw.githubusercontent.com/chocobozzz/PeerTube/master/support/docker/production/docker-compose.yml > docker-compose.yml 
```

View the source of the file you're about to download: [docker-compose.yml](https://github.com/Chocobozzz/PeerTube/blob/master/support/docker/production/docker-compose.yml)


#### Get the latest env_file

```shell
curl https://raw.githubusercontent.com/Chocobozzz/PeerTube/master/support/docker/production/.env > .env
```

View the source of the file you're about to download: [.env](https://github.com/Chocobozzz/PeerTube/blob/master/support/docker/production/.env)

#### Update the reverse proxy configuration

```shell
vim ./docker-volume/traefik/traefik.toml
```

~~You must replace `<MY EMAIL ADDRESS>` and `<MY DOMAIN>` to enable Let's Encrypt SSL Certificates creation.~~ Now included in `.env` file with `TRAEFIK_ACME_EMAIL` and `TRAEFIK_ACME_DOMAINS` variables used through traefik service command value of `docker-compose.yml` file.

More at: https://docs.traefik.io/v1.7

#### Tweak the `docker-compose.yml` file there according to your needs

```shell
vim ./docker-compose.yml
```

#### Then tweak the `.env` file to change the environment variables

```shell
vim ./.env
```
In the downloaded example [.env](https://github.com/Chocobozzz/PeerTube/blob/master/support/docker/production/.env), you must replace:
- `<MY POSTGRES USERNAME>`
- `<MY POSTGRES PASSWORD>`
- `<MY DOMAIN>` without 'https://'
- `<MY EMAIL ADDRESS>`

Other environment variables are used in
[/support/docker/production/config/custom-environment-variables.yaml](https://github.com/Chocobozzz/PeerTube/blob/master/support/docker/production/config/custom-environment-variables.yaml) and can be
intuited from usage.

#### Testing local Docker setup

To test locally your Docker setup, you must add your domain (`<MY DOMAIN>`) in `/etc/hosts`: 
```
127.0.0.1       localhost   mydomain.tld
```

#### You can use the regular `up` command to set it up

```shell
docker-compose up
```
### Obtaining Your Automatically Generated Admin Credentials
Now that you've installed your PeerTube instance you'll want to grep your peertube container's logs for the `root` password.
You're going to want to run `docker-compose logs peertube | grep -A1 root` to search the log output for your new PeerTube's instance admin credentials which will look something like this.
```BASH
user@s:~/peertube|master⚡ ⇒  docker-compose logs peertube | grep -A1 root

peertube_1  | [example.com:443] 2019-11-16 04:26:06.082 info: Username: root
peertube_1  | [example.com:443] 2019-11-16 04:26:06.083 info: User password: abcdefghijklmnop
```

### Obtaining Your Automatically Generated DKIM DNS TXT Record
[DKIM](https://en.wikipedia.org/wiki/DomainKeys_Identified_Mail) signature sending and RSA keys generation are enabled by the default Postfix image `mwader/postfix-relay` with [OpenDKIM](http://www.opendkim.org/).
Run `cat ./docker-volume/opendkim/keys/*/*.txt` to display your DKIM DNS TXT Record containing the public key to configure to your domain : 
```BASH
user@s:~/peertube|master⚡ ⇒  cat ./docker-volume/opendkim/keys/*/*.txt

peertube._domainkey.mydomain.tld.	IN	TXT	( "v=DKIM1; h=sha256; k=rsa; "
	  "p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0Dx7wLGPFVaxVQ4TGym/eF89aQ8oMxS9v5BCc26Hij91t2Ci8Fl12DHNVqZoIPGm+9tTIoDVDFEFrlPhMOZl8i4jU9pcFjjaIISaV2+qTa8uV1j3MyByogG8pu4o5Ill7zaySYFsYB++cHJ9pjbFSC42dddCYMfuVgrBsLNrvEi3dLDMjJF5l92Uu8YeswFe26PuHX3Avr261n"
	  "j5joTnYwat4387VEUyGUnZ0aZxCERi+ndXv2/wMJ0tizq+a9+EgqIb+7lkUc2XciQPNuTujM25GhrQBEKznvHyPA6fHsFheymOuB763QpkmnQQLCxyLygAY9mE/5RY+5Q6J9oDOQIDAQAB" )  ; ----- DKIM key peertube for mydomain.tld
```

### What now?

See the production guide ["What now" section](/support/doc/production.md#what-now). 

### Upgrade

**Important:** Before upgrading, check you have all the `storage` fields in your [production.yaml file](/support/docker/production/config/production.yaml). 

Pull the latest images and rerun PeerTube:

```shell
$ cd /your/peertube/directory
$ docker-compose pull
$ docker-compose up -d
```

## Build your own Docker image

```shell
$ git clone https://github.com/chocobozzz/PeerTube /tmp/peertube
$ cd /tmp/peertube
$ docker build . -f ./support/docker/production/Dockerfile.buster
```

## Development

We don't have a Docker image for development. See [the CONTRIBUTING guide](https://github.com/Chocobozzz/PeerTube/blob/master/.github/CONTRIBUTING.md#develop)
for more information on how you can hack PeerTube!
