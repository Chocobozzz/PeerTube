import { clearCacheRoute } from "@server/middlewares";

function getPodcastFeedCacheKey(videoChannelId: number): string {
  return `/feeds/podcast/videos.xml?videoChannelId=${videoChannelId}`;
}

function clearPodcastFeedCache(videoChannelId: number) {
  return clearCacheRoute(getPodcastFeedCacheKey(videoChannelId));
}

// ---------------------------------------------------------------------------

export {
  getPodcastFeedCacheKey,
  clearPodcastFeedCache
}
