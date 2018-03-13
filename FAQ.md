# FAQ

<!-- Table of contents generated with DocToc: https://github.com/thlorenz/doctoc -->
<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->


- [If nobody watches a video, is it seeded?](#if-nobody-watches-a-video-is-it-seeded)
- [What is WebSeed?](#what-is-webseed)
- [If a client requests each chunk of a video through HTTP, will the server be overloaded?](#if-a-client-requests-each-chunk-of-a-video-through-http-will-the-server-be-overloaded)
- [Will an index of all the videos of servers you follow be too large for small servers?](#will-an-index-of-all-the-videos-of-servers-you-follow-be-too-large-for-small-servers)
- [What codecs can I use for the videos I want to upload?](#what-codecs-can-i-use-for-the-videos-i-want-to-upload)
- [I want to change my host, how can I do that?](#i-want-to-change-my-host-how-can-i-do-that)
- [Should I have a big server to run PeerTube?](#should-i-have-a-big-server-to-run-peertube)
- [Are you gonna use the Steem blockchain?](#are-you-gonna-use-the-steem-blockchain)
- [Are you gonna support adding ads?](#are-you-gonna-support-adding-ads)
- [What is "creation dynamic" and why not modify it?](#what-is-creation-dynamic-and-why-not-modify-it)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

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


## Are you gonna use the Steem blockchain?

Short answer: no, since like most appchains/votechains, it modifies the dynamic of creation, and as such cannot be integrated into mainline PeerTube. Read more about that in [the dedicated section](#what-is-creation-dynamic-and-why-not-modify-it).

Long answer is that the Steem blockchain goes astray of its promises of fairness and decentralization: the deliberate relaunching of the currency to ensure centralization, and the stake-based voting power, makes manipulation by wealthy users inevitable ([source here](https://decentralize.today/the-ugly-truth-behind-steemit-1a525f5e156)). Worse, money generated goes primarily to stake holders ([source here](https://steemit.com/steemit/@orly/how-the-steem-pyramid-scheme-really-works) ). For more information, read the complete whitepaper analysis done by [Tone Vays](https://twitter.com/ToneVays/status/761975587451928576).

## Are you gonna support adding ads?

Short answer: no, we don't want advertisers to dictate which content should be financed. That would modify the dynamic of creation ; as such it cannot be integrated into mainline PeerTube. Read more about that in [the dedicated section](#what-is-creation-dynamic-and-why-not-modify-it).

The long answer is probably more subtle. YouTube has shaped generations of video creators by making it easy to place ads ; but making big money with the platform can be a challenge. A typical video ad runs between $.10 and $.30 per 1000 view (as of march 2018). More than 70% of video creators have ads as their main way to make money on YouTube, yet less than 3% of video creators make a living out of their YouTube activity (with partnerships and commissions, otherwise counting only ad revenue it drops to 1%). Read more about it in the 2018 study by Mathias Bärtl, [*YouTube channels, uploads and views: A statistical analysis of the past 10 years*](https://www.dropbox.com/s/0cq4wtxm83s95t2/10.1177%401354856517736979.pdf?dl=0). To the best of our knowledge, small and medium-community creators are better off getting support from their community on platforms such as Liberapay, Tipeee or Patreon. Moreover, don't forget that advertisers already pay considering YouTube's large user base ; with PeerTube's way smaller user base and refusal of user profiling, a lower pay-per-view than on YouTube could only be expected.

## What is "creation dynamic" and why not modify it?

We define creation dynamic as the way any original content, regardless of its monetary value, is done and incentivized. We want to limit as much as possible the influence our platform could have on authors in order to stay neutral. We are not curators, and want to limit the scope of PeerTube's impact on videos to moderation tasks only.

If you still want to use a functionality potentially altering that state of things, then you could interface with our upcoming plug-in system, which will be the place to integrate such features in the near future.

With that being said, know that we are not against these features *per se*. We are always open to discussion about potential PRs bringing in features, even of that kind. But we certainly won't dedicate our limited resources to develop them ourselves when there is so much to be done elsewhere.
