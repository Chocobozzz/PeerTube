# Protocol (WIP, help welcome)

## Vocabulary

  - **Network:** several servers communicating each others with this software compose a network
  - **Pod:** a server of the network (inspired from Diaspora, no really signification)
  - **Friend:** a pod that communicates with yours
  - **Origin pod:** the pod on which the video was uploaded and which is seeding the video
  - **Make friend:** the action of a server which will join a network (and so become friend with all pods that compose this network)

## Base

### The first run: join a network and make friends
  * The server generates a RSA key
  * If the server administrator wants to join a network, he just has to make an http request to the API
  * The server joins a network by checking entrypoints (server urls of the targeted network) in the configuration file
  * If the config file doesn't specify other pods, the network will be composed by this only pod
  * If the config file specifies one or more pods, the server will ask them the list of the pods in the network.
  The server will add in its friends list all pods that are in > 50% of all other pods friends list + the pods that are asked for the list. For example if there are the following pods in a network with their following friends list:

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
  * When the friends list is added, the server will present itself to all these friends ("make friend" operation) with the following informations: its **public RSA key** and its **URL**
  * Then, the pods will slowly share their videos database
  * All the friends have the initial score of x points which represents the reliability of this friend
  * If the score reaches 0 the friend is revoked (blacklisted for the future?) and its videos are deleted

### Communications
  * All the communications between pods are signed, encrypted with a RSA key and a symetric encryption in a POST request (body)
  * All the requests are retried if they failed
  * The requests are made at regular intervals to all pods of the network with a limit of parallel requests: if there are 1000 pods in the networks, the server won't make more than 10 requests in parallel
  * If there are no informations to send (no video addition/removal), no requests are made
  * The requests are grouped: for example if the interval is 1 hour and a user$ upload 2 videos there will be only 1 request that contains the 2 videos informations
  * The requests in the group are ordered: if a user add a video and remove it, we need to transmit these informations to the other pods in the same order
  * The requests are grouped with a limit: if a user uploads 100 videos at a time, the information could be propagated in a few hours to do not make too big requests
  * If a grouped request fails the score is decreased by x points
  * If a grouped request is a success the score is increased by x points
  * The maximum of points would be defined
  * A pod which receives a request checks if the signature corresponds to the pod it has in its database. Then, it decrypts the body (or ignores it if the signature is not valid) and process the requests in the same order

### Actions on a pod
  * A pod is a websocket tracker which is responsible for all the video uploaded in it
  * A pod has an administrator that can add/remove users, make friends and quit friends
  * A pod has different user accounts that can upload videos
  * All pods have an index of all videos of the network (name, origin pod url, small description, uploader username, magnet Uri, thumbnail name, created date and the thumbnail file). For example, a test with 1000000 videos with alphanum characters and the following lengths: name = 50, author = 50, url = 25, description = 250, magnerUri = 200, thumbnail name = 50 has a mongodb size of ~ 4GB. To this, we add 1 000 000 thumbnails of 5-15 KB so 15GB maximum
  * After having uploaded a video, the server seeds it, adds the meta data in its database and makes a secure request to all of its friends
  * If a user wants to watch a video, he asks its pod the magnetUri and the frontend adds the torrent (with WebTorrent), creates the HTML5 video tag and streams the file into it
  * A user watching a video seeds it too (bittorent) so another user who is watching the same video can get the data from the origin server and the user 1 (etc)

## Ideas

  * A video could have more information (detailed description etc) that are not sent on other pods. The user who wants to see these informations has to ask its pod:
   user asks its pod -> user pod asks origin video pod -> origin video pod responds with the informations -> user pod responds to the user (and puts in cache the informations ?). We could extend this scheme with other informations
  * Redondance: if the origin pod is down, the video is not accessible anymore (no tracker/seeds). We could imagine a redondance between pods that keep seeding the video
  * Server could transcode the video to lower qualities (cost in CPU and disk space)
  * Server could seed at the demand: for now the server seeds all the videos but it has two drawbacks:
    - Seeding has a cost (if a pod has 1000 videos it could be an issue)
    - After a restart the server has to reseed all the videos (with 1000 videos it could long)
  If this solution is choosen, the frontend has to notify the origin pod that it has to seed the video
  * Add subtitles to videos
  * Avoid stocking friends URL schemes (http/https)

## Debate

  * Is an ex-friend should be blacklisted for the future?
  * Handle API breaks in a network. If a major update breaks the API: we need the entire network update to the same major version. We could specify a limit date (2, 3 weeks after the release?) after which all the updated pod would switch to the new version of the API. The non updated pod will then be ejected of the network because would not implement the new API
