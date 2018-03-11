# FAQ

## If nobody watches a video, is it seeded?

Yes, the origin server always seeds videos uploaded on it thanks to
[Webseed](http://www.bittorrent.org/beps/bep_0019.html).


## What is WebSeed?

It is a BitTorrent extension that allows a server to seed a file through HTTP.
It just needs to statically serve a file, then the clients will request chunks
with a `Content-Range` HTTP header.


## If a client requests each chunk of a video through HTTP, will the server be overloaded?

Not really. Reverse proxies like Nginx handle very well requests of static
files. In my tests, it can send chunks at 10MB/s without consuming more than 5%
of CPU on a very small VPS.


## Will an index of all the videos of servers you follow be too large for small servers?

In our benchmarks, 1,000,000 videos takes around 2GB of storage on PostgreSQL.
We think it is acceptable for a video platform.


## What codecs can I use for the videos I want to upload?

WEBM, MP4 or OGV videos.


## I want to change my host, how can I do that?

If you already have followers, you can't.

If you don't have any followers, update your configuration and run
`NODE_ENV=production npm run update-host` to update the torrent files (they contain your domain name).


## Should I have a big server to run PeerTube?

Not really. For instance, the demonstration server [https://peertube.cpy.re](https://peertube.cpy.re) has 2 vCore and 2GB of RAM and consumes on average:
 * **CPU** -> nginx ~ 20%, peertube ~ 10%,   postgres ~ 1%, redis ~ 3%
 * **RAM** -> nginx ~ 6MB, peertube ~ 120MB, postgres ~ 10MB, redis ~ 5MB
 
So you would need:
 * **CPU** 1 core if you don't enable transcoding, 2 at least if you enable it
 * **RAM** 1GB
 * **Storage** Completely depends on how many videos your users will upload

