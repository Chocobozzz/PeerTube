### Docker + Traefik

After following the [docker guide](/support/doc/docker.md), you can choose to run traefik
as your reverse-proxy.

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

#### Update the reverse proxy configuration

```shell
$EDITOR ./docker-volume/traefik/traefik.toml
```

~~You must replace `<MY EMAIL ADDRESS>` and `<MY DOMAIN>` to enable Let's Encrypt SSL Certificates creation.~~ Now included in `.env` file with `TRAEFIK_ACME_EMAIL` and `TRAEFIK_ACME_DOMAINS` variables used through traefik service command value of `docker-compose.yml` file.

More at: https://docs.traefik.io/v1.7

#### Run with traefik

```shell
docker-compose -f docker-compose.yml -f docker-compose.traefik.yml up -d
```
