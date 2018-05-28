# Docker guide

You can quickly get a server running using Docker. You need to have
[docker](https://www.docker.com/community-edition) and
[docker-compose](https://docs.docker.com/compose/install/) installed.

## Production

### Install

PeerTube needs a PostgreSQL and a Redis instance to work correctly. If you want
to quickly set up a full environment, either for trying the service or in
production, you can use a `docker-compose` setup.

```bash
$ cd /your/peertube/directory
$ mkdir ./docker-volume && mkdir ./docker-volume/traefik
$ curl "https://raw.githubusercontent.com/chocobozzz/PeerTube/master/support/docker/production/config/traefik.toml" > ./docker-volume/traefik/traefik.toml
$ touch ./docker-volume/traefik/acme.json && chmod 600 ./docker-volume/traefik/acme.json
$ curl -s "https://raw.githubusercontent.com/chocobozzz/PeerTube/master/support/docker/production/docker-compose.yml" > ./docker-compose.yml
```

Update the reverse proxy configuration:

```
$ vim ./docker-volume/traefik/traefik.toml
```

Tweak the `docker-compose.yml` file there according to your needs:

```
$ vim ./docker-compose.yaml
```

You can use the regular `up` command to set it up, with possible overrides of
the environment variables:

```bash
$ PEERTUBE_WEBSERVER_HOSTNAME="domain.tld" docker-compose up
```

Other environment variables are used in
`support/docker/production/config/custom-environment-variables.yaml` and can be
intuited from usage.

**Important**: note that you'll get the initial `root` user password from the
program output, so check out your logs to find them.

### Upgrade

Pull the latest images and rerun PeerTube:

```
$ cd /your/peertube/directory
$ docker-compose down
$ docker-compose pull
$ PEERTUBE_WEBSERVER_HOSTNAME="domain.tld" docker-compose up -d
```


## Build your own Docker image

```bash
$ git clone https://github.com/chocobozzz/PeerTube /tmp/peertube
$ cd /tmp/peertube
$ docker build . -f ./support/docker/production/Dockerfile.stretch
```

## Development

We don't have a Docker image for development. See [the CONTRIBUTING guide](https://github.com/Chocobozzz/PeerTube/blob/develop/.github/CONTRIBUTING.md#develop)
for more information on how you can hack PeerTube!