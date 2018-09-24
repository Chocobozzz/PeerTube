# Redundancy

A PeerTube instance can cache other PeerTube videos to improve bandwidth of popular videos or small instances.

## How it works

The instance administrator can choose between multiple redundancy strategies (cache trending videos or recently uploaded videos etc), set their maximum size and the minimum duplication lifetime.
Then, they choose the instances they want to cache in `Manage follows -> Following` admin table.

Videos are kept in the cache for at least `min_lifetime`, and then evicted when the cache is full.

When PeerTube chooses a video to duplicate, it imports all the resolution files (to avoid consistency issues) using their magnet URI and put them in the `storage.videos` directory.
Then it sends a `Create -> CacheFile` ActivityPub message to other federated instances. This new instance is injected as [WebSeed](https://github.com/Chocobozzz/PeerTube/blob/develop/FAQ.md#what-is-webseed) in the magnet URI by instances that received this ActivityPub message.

## Stats
 
See the `/api/v1/server/stats` endpoint. For example:

```
{
  ...
  "videosRedundancy": [
    {
      "totalUsed": 0,
      "totalVideos": 0,
      "totalVideoFiles": 0,
      "strategy": "most-views",
      "totalSize": 104857600
    },
    {
      "totalUsed": 0,
      "totalVideos": 0,
      "totalVideoFiles": 0,
      "strategy": "trending",
      "totalSize": 104857600
    },
    {
      "totalUsed": 0,
      "totalVideos": 0,
      "totalVideoFiles": 0,
      "strategy": "recently-added",
      "totalSize": 104857600
    }
  ]
}
```