
# PeerTube in Docker for Local Use

These files support the [guide on running a private local instance](../../doc/docker-local.md) with Docker.

# Pre-Requisites

This example uses peertube.local as the server name. 
That name (or another name of your choice) needs to
be resolvable, either through DNS or via an 
`/etc/hosts` entry - refer to the
[guide](../../doc/docker-local.md) for more info.

You should not need to modify `docker-compose.yml` as it references the .env file.
