# PeerTube Docker ([hub image](https://hub.docker.com/r/dryusdan/peertube/))

[![Build Status](https://drone.dryusdan.fr/api/badges/Dryusdan/docker-peertube/status.svg)](https://drone.dryusdan.fr/Dryusdan/docker-peertube)

#### What is this?

A docker image for [PeerTube](https://github.com/Chocobozzz/PeerTube/) the federated (ActivityPub) video streaming platform using P2P (BitTorrent) directly in the web browser with WebTorrent.

#### Features
- Based on a Debian Jessie (slim image base of 80MB)

#### Build-time variables
- **PEERTUBE_VER** : version of PeerTube.

#### Environment variables
- **GID** : peertube group id *(default : 991)*
- **UID** : peertube user id *(default : 991)*

#### Volumes
- **/PeerTube/avatars** : location of users avatars.
- **/PeerTube/certs** : location of certs.
- **/PeerTube/videos** : location of videos.
- **/PeerTube/logs** : location of logs.
- **/PeerTube/previews** : location of video preview image.
- **/PeerTube/thumbnails** : location of thumbnails.
- **/PeerTube/torrents** : location of torrents.

#### Example of simple configuration

Since PeerTube requires a database and for now only supports [PostgreSQL](https://github.com/Chocobozzz/PeerTube/#dependencies), here is an example (running docker-compose for convenience) that links to the official PostgreSQL docker image. You can of course adapt to use your favorite PostgreSQL image. Just be sure to follow the [production guide](https://github.com/Chocobozzz/PeerTube/blob/develop/support/doc/production.md) and properly configure your reverse proxy.

```yaml
version: "3"

services:
  peertube:
    image: index.docker.io/dryusdan/peertube:latest
    container_name: peertube
    restart: always
    environment:
      - HTTPS=true
      - HOSTNAME=peertube.tld
      - PORT=443
      - DATABASE_HOST=db
      - DATABASE_USERNAME=peertube
      - DATABASE_PASSWORD=
      - ADMIN_EMAIL=admin@peertube.tld
      - SIGNUP_ENABLE=true
      - TRANSCODING_THREADS=2
      - BODY_SIZE=1G
      - SIGNUP_LIMIT=-1
      - CACHE_SIZE=100
      - VIDEO_QUOTA=104857600
    external_links:
      - peertube-db:db
    volumes:
      - /home/docker/services/web/peertube/avatars:/PeerTube/avatars
      - /home/docker/services/web/peertube/certs:/PeerTube/certs
      - /home/docker/services/web/peertube/videos:/PeerTube/videos
      - /home/docker/services/web/peertube/logs:/PeerTube/logs
      - /home/docker/services/web/peertube/previews:/PeerTube/previews
      - /home/docker/services/web/peertube/thumbnails:/PeerTube/thumbnails
      - /home/docker/services/web/peertube/torrents:/PeerTube/torrents

  peertube-db:
    restart: always
    container_name: peertube-postgresql
    image: index.docker.io/postgres:9.6.5-alpine
    environment:
      - POSTGRES_USER=peertube
      - POSTGRES_PASSWORD=peertube
      - POSTGRES_DB=peertube_prod
    volumes:
      - /home/docker/db/peertube/postgresql/data:/var/lib/postgresql/data
```
