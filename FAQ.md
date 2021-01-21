# FAQ

<!-- Table of contents generated with DocToc: https://github.com/thlorenz/doctoc -->
<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->


- [Why did you create PeerTube?](#why-did-you-create-peertube)
- [I don't like the name "PeerTube"](#i-dont-like-the-name-peertube)
- [If nobody watches a video, is it seeded?](#if-nobody-watches-a-video-is-it-seeded)
- [Which container formats can I use for the videos I want to upload?](#which-container-formats-can-i-use-for-the-videos-i-want-to-upload)
- [I want to change my domain name, how can I do that?](#i-want-to-change-my-domain-name-how-can-i-do-that)
- [Why do we have to put our Twitter username in the PeerTube configuration?](#why-do-we-have-to-put-our-twitter-username-in-the-peertube-configuration)
- [How are video views counted?](#how-are-video-views-counted)
- [Should I have a big server to run PeerTube?](#should-i-have-a-big-server-to-run-peertube)
  - [CPU](#cpu)
  - [RAM](#ram)
  - [Storage](#storage)
  - [Network](#network)
- [Can I seed videos with my classic BitTorrent client (Transmission, rTorrent...)?](#can-i-seed-videos-with-my-classic-bittorrent-client-transmission-rtorrent)
- [Why host on GitHub and Framagit?](#why-host-on-github-and-framagit)
- [Are you going to use a blockchain (like Steem)?](#are-you-going-to-use-a-blockchain-like-steem)
- [Are you going to support advertisements?](#are-you-going-to-support-advertisements)
- [What is "creation dynamic" and why not modify it?](#what-is-creation-dynamic-and-why-not-modify-it)
- [I have found a security vulnerability in PeerTube. Where and how should I report it?](#i-have-found-a-security-vulnerability-in-peertube-where-and-how-should-i-report-it)
- [Does PeerTube ensure federation compatibility with previous version?](#does-peertube-ensure-federation-compatibility-with-previous-version)
- [Are specific versions of PeerTube long term supported?](#are-specific-versions-of-peertube-long-term-supported)
- [When approximately can I expect the next version of PeerTube to arrive?](#when-approximately-can-i-expect-the-next-version-of-peertube-to-arrive)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Why did you create PeerTube?

We can't build a FOSS video streaming alternative to YouTube, Dailymotion,
Vimeo... with centralized software. One organization alone may not have
enough money to pay for bandwidth and video storage of its servers.

Our stance is that only a decentralized network of servers can provide an
acceptable answer to technical issues (bandwidth, transcoding expenses, etc.)
and social answers (need for a particular moderation policy, preserving
content, etc.).

While a paragraph is not enough to answer all these problems, PeerTube has
very early prided itself on using a contributory design, both for creating
communities as federated nodes (as [Mastodon](https://joinmastodon.org/) for
example), and for seeding videos (instances can seed each other's videos). But that's not
enough because one video could become popular and overload the server. That is
why we need to use P2P in the web browser using WebRTC to limit the server load.


## I don't like the name "PeerTube"

PeerTube is just the name of the software. You can install it on your
server, and choose a name you want. For example, [this instance](https://framatube.org/)
is named "Framatube".


## If nobody watches a video, is it seeded?

Yes, the player also downloads the video from the server using HTTP.
It can also be helped by other servers using [redundancy](https://docs.joinpeertube.org/contribute-architecture?id=redundancy-between-instances).


## Which container formats can I use for the videos I want to upload?

WEBM, MP4 or OGV videos are supported by default (they are streamable formats),
but instance administrators can additionally enable support for additional formats
when transcoding is enabled on their instance.


## I want to change my domain name, how can I do that?

It's not officially supported, but you can try the `update-host` script: https://docs.joinpeertube.org/maintain-tools?id=update-hostjs


## Why do we have to put our Twitter username in the PeerTube configuration?

You don't have to: we set a default value if you don't have a Twitter account.
We need this information because Twitter requires an account for links share/videos embed on their platform.


## How are video views counted?

Your web browser sends a view to the server after 30 seconds of playback.
If a video is less than 30 seconds in length, a view is sent after 75% of the video duration.
After giving a view, that IP address cannot add another view in the next hour.
Views are buffered, so don't panic if the view counter stays the same after you watched a video.


## Should I have a big server to run PeerTube?

PeerTube should run happily on a virtual machine with 2 threads/vCPUs, at least 1 Gb of RAM and enough storage for videos. In terms of bandwidth, a lot will depend on which PeerTube instances you federate with and what your relation with them is (more about that below).

As a real life example, the PeerTube demonstration server [https://peertube.cpy.re](https://peertube.cpy.re) runs on 2 vCores and 2GB of RAM. Average consumption is:
 * **CPU**: nginx ~ 2%, peertube ~ 10%,   postgres ~ 1%, redis ~ 1%
 * **RAM**: nginx ~ 1MB, peertube ~ 150MB, postgres ~ 30MB, redis ~ 20MB
 * **Network**: ~200GB sent per month (https://framatube.org: ~1.5TB sent per month)

### CPU

Except for video transcoding, a PeerTube instance is not CPU bound. Neither Nginx, PeerTube itself, PostgreSQL nor Redis require a lot of computing power. If it were only for those, one could easily get by with just one thread/vCPU.

You will hugely benefit from at least a second thread though, because of transcoding. Transcoding _is_ very cpu intensive. It serves two purposes on a PeerTube instance: it ensures all videos can be played optimally in the web interface, and it generates different resolutions for the same video. PeerTube support for offloading transcoding to other machines is being discussed, but not yet implemented. See https://github.com/Chocobozzz/PeerTube/issues/947 .

### RAM

1/2 GB of RAM should be plenty for a basic PeerTube instance, which usually takes at most 150 MB in RAM. The only reason you might want more would be if you colocate your Redis or PostgreSQL services on a non-SSD system.

### Storage

There are two important angles to storage: disk space usage and sustained read speed.

To make a rough estimate of your disk space usage requirements, you want to know the answer to three questions:
- What is the total size of the videos you wish to stream?
- Do you want to enable transcoding? If so, do you want to provide multiple resolutions per video? Try this out with a few videos and you will get an idea of how much extra space is required per video and estimate a multiplication factor for future space allocation.
- Which sharing mechanisms do you want to enable? Just WebTorrent, or also HLS with p2p? If you want both, this will double your storage needs.

In terms of read speed, you want to make sure that you can saturate your network uplink serving PeerTube videos. This should not be a problem with SSD disks, whereas traditional HDD should be accounted for: typical sustained read rates for [a well tuned system](support/doc/production.md#tcpip-tuning) with a 7200rpm hard disk should hover around 120 MB/s or 960 Mbit/s. The latter should be enough for a typical 1 Gbit/s network uplink.

### Network

A rough estimate of a traditional server's video streaming network capacity is usually quite straightforward. You simply divide your server's available bandwidth by the average bandwidth per stream, and you have an upper bound.

Take a server for example with a 1 Gbit/s uplink for example pushing out 1080p60 streams at 5 Mbit/s per stream. That means the absolute theoretical upper capacity bound is 200 simultaneous viewers if your server's disk i/o can keep up. Expect a bit less in practice.

But what if you need to serve more users? That's where PeerTube's federation feature shines. If other PeerTube instances following yours, chances are they have decided to mirror part of your instance! The feature is called "server redundancy" and caches your most popular videos to help serve additional viewers. While viewers themselves contribute a little additional bandwidth while watching the video in their browsers (mostly during surges), mirroring servers have a much greater uplink and will help your instance with sustained higher concurrent streaming.

If all your preparations and friends' bandwidth is not enough, you might prefer serving files from a CDN ; see our [remote storage guide](https://docs.joinpeertube.org/admin-remote-storage).


## Can I seed videos with my classic BitTorrent client (Transmission, rTorrent...)?

Yes you can, but you won't be able to send data to users that watch the video in their web browser.


## Why host on GitHub and Framagit?

Historical reason.


## Are you going to use a blockchain (like Steem)?

Short answer: no, since like most appchains/votechains, it modifies the dynamic of creation, and as such cannot be integrated into mainline PeerTube. Read more about that in [the dedicated section](#what-is-creation-dynamic-and-why-not-modify-it).


## Are you going to support advertisements?

Short answer: no, we don't want advertisers to dictate which content should be financed.
That would modify the dynamic of creation; as such it cannot be integrated into mainline PeerTube.
Read more about that in [the dedicated section](#what-is-creation-dynamic-and-why-not-modify-it).

The long answer is probably more subtle. YouTube has shaped generations of video creators by making it easy to place ads;
but making big money with the platform can be a challenge.
A typical video ad runs between $.10 and $.30 per 1000 views (as of March 2018).
More than 70% of video creators use ads as the main way to make money on YouTube, yet less than 3% of video creators make a living out of their YouTube activity (with partnerships and commissions, otherwise counting only ad revenue it drops to 1%).
Read more about it in the 2018 study by Mathias Bärtl, [*YouTube channels, uploads and views: A statistical analysis of the past 10 years*](https://www.dropbox.com/s/0cq4wtxm83s95t2/10.1177%401354856517736979.pdf?dl=0).
To the best of our knowledge, small and medium-community creators are better off getting support from their community on platforms such as Liberapay, Tipeee or Patreon.
Moreover, don't forget that advertisers already pay considering YouTube's large user base; with PeerTube's way smaller user base and refusal of user profiling, a pay-per-view that's lower than YouTube's could only be expected.


## What is "creation dynamic" and why not modify it?

We define creation dynamic as the way any original content, regardless of its monetary value, is created and incentivized.
We want to stay neutral by limiting the influence of our platform on authors as much as possible. We are not curators, and want to limit the scope of PeerTube instance owners and administrators' responsibilities to moderation tasks only.

If you still want to use a functionality potentially altering that state of things, then you could interface with our upcoming plug-in system, which will be the place to integrate such features in the near future.

With that being said, know that we are not against these features *per se*.
We are always open to discussion about potential PRs bringing in features, even of that kind. But we certainly won't dedicate our limited resources to develop them ourselves when there is so much to be done elsewhere.


## I have found a security vulnerability in PeerTube. Where and how should I report it?

We have a policy for contributions related to security. Please refer to [SECURITY.md](./SECURITY.md)


## Does PeerTube ensure federation compatibility with previous version?

We **try** to keep compatibility with the latest minor version (2.3.1 with 2.2 for example).
We don't have resources to keep compatibility with other versions.


## Are specific versions of PeerTube long term supported?

We don't have enough resource to maintain a PeerTube LTS version.
Please always upgrade to the latest version.


## When approximately can I expect the next version of PeerTube to arrive?

Anything from 2 to 6 months, with no promises.
