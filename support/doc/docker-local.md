# Docker Guide - Private Local Instance

This guide requires [docker](https://www.docker.com/community-edition) and
[docker-compose](https://docs.docker.com/compose/install/).


## Install


#### Go to your workdir

_note_: the guide that follows assumes an empty workdir.

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


#### Configure Domain Name

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


#### Differences vs. Production Configuration

To simplify this guide, some configuration was omitted, which limits some features.

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


## Further Reading

[Advanced guide with SSL, Nginx, and Let's Encrypt](docker.md)

