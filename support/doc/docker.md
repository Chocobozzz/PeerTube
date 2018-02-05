# Docker guide

## Test/Development 

You can quickly get a server running using Docker. You need to have [docker](https://www.docker.com/community-edition) and [docker-compose](https://docs.docker.com/compose/install/) installed.

For this example configuration, you should also run a reverse proxy. The example
Docker Compose file provides example labels for the Traefik load balancer,
though any HTTP reverse proxy is compatible.

Example for running a peertube server locally:

```bash
sudo \
  PEERTUBE_HOSTNAME=peertube.lvh.me \
  PEERTUBE_ADMIN_EMAIL=test@example.com \
  PEERTUBE_TRANSCODING_ENABLED=true \
  docker-compose up app
```

(Get the initial root user password from the program output.)

## Production

PR welcome!
