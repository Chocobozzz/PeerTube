# FAQ

## If nobody watches a video, is it seeded?

Yes, the origin server always seeds videos uploaded on it through [Webseed](http://www.bittorrent.org/beps/bep_0019.html).


## What is WebSeed?

It is a BitTorrent extension that allow a server to seed a file through HTTP. It just need to serve statically a file, and then the clients will request chunks with a Content-Range HTTP header.


## If a client requests each chunk of a video through HTTP, the server be overloaded!

Not really. Reverse proxies like nginx handle very well requests of static files. In my tests it can send chunks at 10MB/s without consuming more than 5% of CPU on a very small VPS.


## An index of all videos of servers you follow won't be too large for small servers?

No, 1000000 videos will represent around 2GB on PostgreSQL. It is acceptable for a video platform.


## What kind of videos can I upload?

WEBM, MP4 or OGV videos.


## I want to change my host or move to HTTPS, how can I do that?

If you already have followers, you can't.

If you don't: update your configuration and run `NODE_ENV=production npm run update-host` to update the torrent files.
