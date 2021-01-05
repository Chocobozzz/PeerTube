<h1 align="center">
  <a href="https://joinpeertube.org">
    <img src="https://joinpeertube.org/img/brand.png" alt="PeerTube">
  </a>
</h1>

<p align=center>
  <strong><a href="https://joinpeertube.org">Website</a></strong>
  | <strong><a href="https://instances.joinpeertube.org">Join an instance</a></strong>
  | <strong><a href="#package-create-your-own-instance">Create an instance</a></strong>
  | <strong><a href="#contact">Chat with us</a></strong>
  | <strong><a href="https://framasoft.org/en/#soutenir">Donate</a></strong>
</p>

<p align="center">
Be part of a network of multiple small federated, interoperable video hosting providers. Follow video creators and create videos. No vendor lock-in. All on a platform that is community-owned and ad-free.
</p>

<p align="center">
  <strong>Developed with &#10084; by <a href="https://framasoft.org">Framasoft</a></strong>
</p>

<p align="center">
  <a href="https://framasoft.org">
    <img width="150px" src="https://lutim.cpy.re/FeRgHH8r.png" alt="Framasoft logo"/>
  </a>
</p>

<p align="center">
  <strong>Client</strong>

  <br />

  <a href="https://automate.browserstack.com/public-build/VHUxYy9zYnZqWnkxTTcyNEpPRVdzY2VzN1VhY3hBQUIrYTk2NGFtMnMvTT0tLWxuMk1vVnBzeDJ4cFpFY1JEK2xjSUE9PQ==--cf445693d1fc03efd86a3a5030d079a0de3ece7a">
    <img src="https://automate.browserstack.com/badge.svg?badge_key=VHUxYy9zYnZqWnkxTTcyNEpPRVdzY2VzN1VhY3hBQUIrYTk2NGFtMnMvTT0tLWxuMk1vVnBzeDJ4cFpFY1JEK2xjSUE9PQ==--cf445693d1fc03efd86a3a5030d079a0de3ece7a"/>
  </a>

  <a href="https://weblate.framasoft.org/projects/peertube/angular/">
    <img src="https://weblate.framasoft.org/widgets/peertube/-/angular/svg-badge.svg"/>
  </a>
</p>

<p align="center">
  <strong>Server</strong>

  <br />

  <a href="https://github.com/Chocobozzz/PeerTube/actions?query=workflow%3A%22Test+Suite%22+branch%3Adevelop">
    <img alt="test suite status" src="https://github.com/Chocobozzz/PeerTube/workflows/Test%20Suite/badge.svg" />
  </a>

  <a href="http://standardjs.com/">
    <img src="https://img.shields.io/badge/code%20style-standard-brightgreen.svg" alt="JavaScript Style Guide" />
  </a>
</p>

<br />

<p align="center">
  <a href="https://framatube.org/videos/watch/217eefeb-883d-45be-b7fc-a788ad8507d3">
    <img src="http://lutim.cpy.re/9CLXh0Ys.png" alt="screenshot" />
  </a>
</p>

Introduction
----------------------------------------------------------------

PeerTube is a free, decentralized and federated video platform developed as an alternative to other platforms that centralize our data and attention, such as YouTube, Dailymotion or Vimeo. :clapper:

But one organization hosting PeerTube alone may not have enough money to pay for bandwidth and video storage of its servers,
all servers of PeerTube are interoperable as a federated network, and non-PeerTube servers can be part of the larger Vidiverse
(federated video network) by talking our implementation of ActivityPub.
Video load is reduced thanks to P2P in the web browser using <a href="https://github.com/webtorrent/webtorrent">WebTorrent</a> or <a href="https://github.com/novage/p2p-media-loader">p2p-media-loader</a>.

To learn more, see:
* This [two-minute video](https://framatube.org/videos/watch/217eefeb-883d-45be-b7fc-a788ad8507d3) (hosted on PeerTube) explaining what PeerTube is and how it works
* PeerTube's project homepage, [joinpeertube.org](https://joinpeertube.org)
* Demonstration instances:
  * [peertube.cpy.re](https://peertube.cpy.re)
  * [peertube2.cpy.re](https://peertube2.cpy.re)
  * [peertube3.cpy.re](https://peertube3.cpy.re)
* This [video](https://peertube.cpy.re/videos/watch/da2b08d4-a242-4170-b32a-4ec8cbdca701) demonstrating the communication between PeerTube and [Mastodon](https://github.com/tootsuite/mastodon) (a decentralized Twitter alternative)

:sparkles: Features
----------------------------------------------------------------

<img src="https://lutim.cpy.re/AHbctLjn.png" align="left" height="300px"/>
<h3 align="left">Video streaming</h3>
<p align="left">
Just upload your videos, and be sure they will stream anywhere. Add a description, some tags and your video will be discoverable by the entire video fediverse, not just your instance. You can even embed a player on your favorite website!
</p>

---

<img src="https://lutim.cpy.re/cxWccUK7.png" align="right" height="200px"/>

<h3 align="right">Keep in touch with video creators</h3>
<p align="right">
Follow your favorite channels from PeerTube or really any other place. No need to have an account on the instance you watched a video to follow its author, you can do all of that from the Fediverse (Mastodon, Pleroma, and plenty others), or just with good ol' RSS.
</p>

---

<img src="https://lutim.cpy.re/K07EhFbt.png" align="left" height="200px"/>

<h3 align="left">An interface to call home</h3>
<p align="left">
Be it as a user or an instance administrator, you can decide what your experience will be like. Don't like the colors? They are easy to change. Don't want to list videos of an instance but let your users subscribe to them? Don't like the regular web client? All of that can be changed, and much more. No UX dark pattern, no mining your data, no video recommendation bullshit™.
</p>

---

<h3 align="right">Communities that help each other</h3>
<p align="right">
In addition to visitors using WebTorrent to share the load among them, instances can help each other by caching one another's videos. This way even small instances have a way to show content to a wider audience, as they will be shouldered by friend instances (more about that in our <a href="https://docs.joinpeertube.org/contribute-architecture?id=redundancy-between-instances">redundancy guide</a>).
</p>
<p align="right">
Content creators can get help from their viewers in the simplest way possible: a support button showing a message linking to their donation accounts or really anything else. No more pay-per-view and advertisements that hurt visitors and <strike>incentivize</strike> alter creativity (more about that in our <a href="https://github.com/Chocobozzz/PeerTube/blob/develop/FAQ.md">FAQ</a>).
</p>

:raised_hands: Contributing
----------------------------------------------------------------

You don't need to be a coder to help!

You can give us your feedback, report bugs, help us translate PeerTube, write documentation, and more. Check out the [contributing
guide](https://github.com/Chocobozzz/PeerTube/blob/develop/.github/CONTRIBUTING.md) to know how, it takes less than 2 minutes to get started. :wink:

You can also join the cheerful bunch that makes our community:

* Chat<a name="contact"></a>:
  * IRC : **[#peertube on chat.freenode.net:6697](https://kiwiirc.com/client/irc.freenode.net/#peertube)**
  * Matrix (bridged on IRC and [Discord](https://discord.gg/wj8DDUT)) : **[#peertube:matrix.org](https://matrix.to/#/#peertube:matrix.org)**
* Forum:
  * Framacolibri: [https://framacolibri.org/c/peertube](https://framacolibri.org/c/peertube)

Feel free to reach out if you have any questions or ideas! :speech_balloon:

:package: Create your own instance
----------------------------------------------------------------

See the [production guide](https://github.com/Chocobozzz/PeerTube/blob/develop/support/doc/production.md), which is the recommended way to install or upgrade PeerTube. For hardware requirements, see [Should I have a big server to run PeerTube?](https://github.com/Chocobozzz/PeerTube/blob/develop/FAQ.md#should-i-have-a-big-server-to-run-peertube) in the FAQ.

See the [community packages](https://docs.joinpeertube.org/install-unofficial), which cover various platforms (including [YunoHost](https://install-app.yunohost.org/?app=peertube) and [Docker](https://github.com/Chocobozzz/PeerTube/blob/develop/support/doc/docker.md)).

:book: Documentation
----------------------------------------------------------------

If you have a question, please try to find the answer in the [FAQ](https://github.com/Chocobozzz/PeerTube/blob/develop/FAQ.md) first.

### User documentation

See the [user documentation](https://docs.joinpeertube.org/use-setup-account).

### Admin documentation

See [how to create your own instance](https://github.com/Chocobozzz/PeerTube/blob/develop/README.md#package-create-your-own-instance).

See the more general [admin documentation](https://docs.joinpeertube.org/admin-following-instances).

### Tools documentation

Learn how to import/upload videos from CLI or admin your PeerTube instance with the [tools documentation](https://docs.joinpeertube.org/maintain-tools).

### Technical documentation

See the [architecture blueprint](https://docs.joinpeertube.org/contribute-architecture) for a more detailed explanation of the architectural choices.

See our REST API documentation:
  * OpenAPI 3.0.0 schema: [/support/doc/api/openapi.yaml](https://github.com/Chocobozzz/PeerTube/blob/develop/support/doc/api/openapi.yaml)
  * Spec explorer: [docs.joinpeertube.org/api-rest-reference.html](https://docs.joinpeertube.org/api-rest-reference.html)

See our [ActivityPub documentation](https://docs.joinpeertube.org/api-activitypub).

## License

Copyright (C) 2015-2020 PeerTube Contributors (see [CREDITS.md](CREDITS.md))

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published
by the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
