# Architecture

## Vocabulary

  - **Fediverse:** several servers following each others.
  - **Instance:** a server which runs PeerTube in the fediverse.
  - **Origin instance:** the instance on which the video was uploaded and which is seeding (through the WebSeed protocol) the video.
  - **Following:** the action of a PeerTube instance which will follow another instance (subscribe to its videos).

## Base

### Communications
  * All the communication between the instances are signed with [Linked Data Signatures](https://w3c-dvcg.github.io/ld-signatures/) with the private key of the account that authored the action.
  * We use the [ActivityPub](https://www.w3.org/TR/activitypub/) protocol (only server-server for now). Object models could be found in [shared/models/activitypub directory](https://github.com/Chocobozzz/PeerTube/tree/develop/shared/models/activitypub).
  * All the requests are retried several times if they fail.
  * The maximum of points would be defined.

### Instance
  * An instance has a websocket tracker which is responsible for all the video uploaded in it.
  * An instance has an administrator that can follow other instances.
  * An instance can be configured to follow back automatically.
  * An instance can blacklist other instances (only used in "follow back" mode).
  * An instance cannot choose which other instances follow it, but it can decide to **reject all** followers.
  * After having uploaded a video, the instance seeds it (WebSeed protocol).
  * If a user wants to watch a video, they ask its instance the magnet URI and the frontend adds the torrent (with WebTorrent), creates the HTML5 video player and streams the file into it.
  * A user watching a video seeds it too (BitTorrent). Thus another user who is watching the same video can get the data from the origin server and other users watching it.
