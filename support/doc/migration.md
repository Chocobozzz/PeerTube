# Peertube migration guide

Sometimes, for various reasons, you may want to migrate your Peertube instance from one server to another. Fortunately this is not too difficult of a process, although it may result in some downtime.

Do not modify anything on the old server until you have successfully migrated the instance.
This will allow you to restart the old server while you fix what's wrong.

## Basic steps

1. Setup a new Peertube server using the [Production Guide](https://github.com/Chocobozzz/PeerTube/blob/develop/support/doc/production.md)
2. Stop Peertube on the old server
3. Dump and load the Postgres database using the instructions below.
4. Copy the `storage/` files using the instructions below.
5. Start Peertube on the new server.
6. Update your DNS settings to point to the new server.
7. Update or copy your Nginx configuration, re-run LetsEncrypt as necessary.
8. Enjoy your new Peertube server!

## Detailed steps

### What data needs to be migrated

At a high level, you'll need to copy over the following:
* The `/var/www/peertube/storage`, which contains videos, thumbnails, previews…
* The Postgres database (using [pg_dump](https://www.postgresql.org/docs/9.1/static/backup-dump.html))
* The `/var/www/peertube/config` file, which contains server config

Less crucially, you'll proably also want to copy the following for convenience:

* The nginx configuration (under `/etc/nginx/sites-available/peertube`)
* The systemd config files or startup scripts, which may contain your server tweaks and customizations

### Dump and load Postgres

Run this as the `peertube` user on the old server

```
sudo -u peertube  pg_dump -Fc peertube_prod > /tmp/peertube_prod-dump.db
```

Copy the `/tmp/peertube_prod-dump.db` file over, using `scp` or `rsync` as you prefer.

```
scp /tmp/peertube_prod-dump.db user@new.server:/tmp
```

Then on the new system, run:

```
sudo -u postgres pg_restore -c -C -d postgres /tmp/peertube_prod-dump.db
````

You may have some warnings that you can [safely ignore](https://confluence.atlassian.com/bamkb/errors-or-warnings-appear-when-importing-postgres-database-dump-829036698.html).

### Copy `storage/` files

This will probably take some time, and certainely a long time! And you'll want to avoid re-copying unnecessarily, so using `rsync` is recommended. But you can use `scp` too.

On your old machine, as the `peertube` user, run:

```
rsync -avz ~/storage/ peertube@example.com:~/storage/
```

You'll need to re-run this if any of the files on the old server change. That's why it's better to use `rsync`.

If you still want to use `scp`:

```
scp -r ~/storage peertube@example.com:~/storage
```


You can also copy over any other important files, such as `config/` and the nginx, systemd configuration or startup script.

### During migration

You may want to configure nginx to send a 503 (_service unavailable_) reply instead of a 501 (_bad gateaway_), and edit a `500.html` personalized.

You'll probably also want to set the DNS TTL to something small (30-60 minutes) about a day in advance, so that DNS can propagate quickly once you point it to the new IP address.

### After migrating

You can check [whatsmydns.net](https://www.whatsmydns.net/) to see the progress of DNS propagation.
To jumpstart the process, you can always edit your own `/etc/hosts` file to point to your new server so you can start playing around with it early and check if all is all right.

If everything is right, you can safely shut down the old server.

## Acknowledgements

Thanks to the [Mastodon](https://joinmastodon.org/) team for their migration guide on which this one is very inspired.
