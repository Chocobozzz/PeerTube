# Docker guide

You can quickly get a server running using Docker. You need to have
[docker](https://www.docker.com/community-edition) and
[docker-compose](https://docs.docker.com/compose/install/) installed.

## Production

### Build your own Docker image

```bash
$ git clone https://github.com/chocobozzz/PeerTube /tmp/peertube
$ cd /tmp/peertube
$ docker build . -f ./support/docker/production/Dockerfile.stretch
```

### Run a preconfigured setup with all dependencies

PeerTube needs a PostgreSQL and a Redis instance to work correctly. If you want
to quickly set up a full environment, either for trying the service or in
production, you can use a `docker-compose` setup.

```bash
$ git clone https://github.com/chocobozzz/PeerTube /tmp/peertube
$ cd /tmp/peertube
```

Then tweak the `docker-compose.yml` file there according to your needs. Then
you can use the regular `up` command to set it up, with possible overrides of
the environment variables:

```bash
$ PEERTUBE_WEBSERVER_HOSTNAME=peertube.lvh.me \
  PEERTUBE_ADMIN_EMAIL=test@example.com \
  PEERTUBE_TRANSCODING_ENABLED=true \
  PEERTUBE_SIGNUP_ENABLED=true \
  PEERTUBE_SMTP_HOST=mail.lvh.me \
  PEERTUBE_SMTP_PORT=1025 \
  PEERTUBE_SMTP_FROM=noreply@peertube.lvh.me \
    docker-compose -f support/docker/production/docker-compose.yml --project-directory . up
```

Other environment variables are used in
`support/docker/production/config/custom-environment-variables.yaml` and can be
intuited from usage.

For this example configuration, a reverse proxy is quite recommended. The
example Docker Compose file provides example labels for a Traefik load
balancer, although any HTTP reverse proxy will work fine. See the example
Nginx configuration `support/nginx/peertube` file to get an idea of
recommendations and requirements to run PeerTube the most efficiently.

**Important**: note that you'll get the initial `root` user password from the
program output, so check out your logs to find them.

## Development

The Docker image that's preconfigured in `support/docker/dev` contains all the
services embedded in one image, so as to work correctly on
[Janitor](https://janitor.technology). It is much not advised to use it in
production.
