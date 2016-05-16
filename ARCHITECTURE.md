# Protocol (WIP, help wanted)

## Vocabulary

  - Network: several servers communicating each others with this software compose a network
  - Pod: a server of the network (inspired from Diaspora, no really signification)
  - Friend: a pod that communicates with yours
  - Origin pod: the pod on which the video was uploaded and which is seeding the video
  - Make friend: the action of a server which will join a network (and so become friend with all pods that compose this network)

## Base

### The first run: join a network and make friends
  * It will generate a RSA key
  * It will join other networks by checking the configuration file
  * If the config file doesn't specify other pods, the network will be composed by this only pod
  * If the config file specifies one or many pods, the server will ask them the list of the pods in the network.
  The server will add in its friends list all pods that are in > 50% of all other pods friends list and the pods that are asked for the list. For example if there are the following pods in a network with their following friends list:

        http://pod1.com
          - http://pod2.com
          - http://pod3.com
          - http://pod4.com
          - http://pod5.com

        http://pod2.com
          - http://pod3.com
          - http://pod5.com

        http://pod3.com
          - http://pod5.com

  It will add: `http://pod1.com`, `http://pod2.com` and `http://pod3.com` because it asks to them the list of their friends. Then, it will add all pods that are in >= 50% of pods friends list so: `http://pod5.com`.
  * The friend-making operation is mandatory and irreversible (we can't change the network for example, even if you are the only one pod in it)
  * When the friends list is added, the server will present itself to all these friends with the following informations: its **public RSA key** and its **URL**
  * In returns, it will receive the list of the videos owned by the pod
  * All the friends have the initial score of 100 points (can be increased to 1000) which represents the reliability of this friend
  * If the score reaches 0 the friend is revoked (and blacklisted for the future ?) and the video deleted

### Communications
  * All the communications between pods are signed, encrypted with a RSA key and a symetric encryption
  * All the requests are retried if they failed 10 times with a factor of 3 (so it will finally fail in ~ 16h)
  * If a request fails the score is decreased by 10 points
  * If a request is a success the score is increased by 10 points
  * The maximum of points would be 1000 (maybe more or less, depending of the server activity)
  * A pod which receives a request checks if the signature corresponds to the pod it has in its database. Then, it decrypts the body (or ignores it if the signature is not valid)

### Actions on a pod
  * A pod is a tracker (websocket) which is responsible for all the video uploaded in it
  * A pod has different user accounts that can upload videos
  * All pods have an index of all videos of the network (name, origin pod url, small description, uploader username, magnet Uri, thumbnail name, created date and the thumbnail file). For example, a test with 1000000 of videos with only alphanum characters and the following lengths: name = 50, author = 50, url = 25, description = 250, magnerUri = 200, thumbnail name = 50 has a mongodb size of ~ 4GB. To this, we add 1 000 000 thumbnails of 5-15 KB so 15GB maximum
  * After having uploaded a video, the server seeds it, adds the meta data in its database and makes a secure request to all of its friends
  * If an user wants to watch a video, he asks its pod the magnetUri and the frontend adds the torrent (with webtorrent), creates the video tag and streams the file into it
  * An user watching a video seeds it too (bittorent) so another user who is watching the same video can get the data from the origin server and the user 1 (etc)

## Ideas

  * A video could have more information (detailed description etc) that are not sent on other pods. The user who wants to see these informations has to ask its pod:
   user asks its pod -> user pod asks origin video pod -> origin video pod responds with the informations -> user pod responds to the user (and puts in cache the informations ?). We could extend this scheme with other informations (user profile etc)
  * Redondance: if the origin pod is down, the video is not accessible anymore. We could imagine a redondance between pods that keep seeding the video
  * Server could transcode the video to lower qualities (cost in CPU and disk space)
  * Server could seed at the demand: for now the server seeds all the videos but it has two drawbacks:
    - Seeding has a cost and is a long process
    - After a restart the server has to reseed all the videos (if it has 100 videos it could be very long!)
  If this solution is choosen, the frontend has to notify the origin pod that it has to seed the video it has not been seeded already
  * Avoid friend-making being an irreversible operation and a mandatory action at the first startup

## Wanted but no idea how to implement

  * Avoid URL scheme (http or https): if a server wants to implement TLS (and force it), it will break all the communication links

## Debate

  * Any user can view a video of a pod or he should have an account?
  * Is an ex-friend should be blacklisted for the future?
  * Handle API breaks in a network. Major update always breaks the API: we need the entire network update to the same major version. Specify a limit date (2, 3 weeks after the release ?) after which all the updated pod switch to the new version of the API? The non updated pod will be ejected of the network because of they would implement the new API
