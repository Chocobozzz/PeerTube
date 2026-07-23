import { FeedEnclosurePreference, VideoPrivacy, VideoPrivacyType } from '@peertube/peertube-models'

export function getInstanceRSSFeed (options: {
  url: string
  title: string
}) {
  const { url, title } = options

  return { url: `${url}/feeds/videos.xml`, title }
}

// ---------------------------------------------------------------------------


export function getChannelRSSFeeds (options: {
  url: string
  channel: { name: string, id: number }
  titles: {
    instanceVideosFeed: string
    channelVideosFeed: string
    channelPodcastFeed: string
    channelPodcastAudioFeed: string
    channelPodcastVideoFeed: string
  }
}) {
  const { url, titles, channel } = options

  return [
    {
      url: getChannelPodcastFeed(url, channel),
      title: titles.channelPodcastFeed
    },

    {
      url: getChannelPodcastFeed(url, channel, 'audio'),
      title: titles.channelPodcastAudioFeed
    },

    {
      url: getChannelPodcastFeed(url, channel, 'video'),
      title: titles.channelPodcastVideoFeed
    },

    {
      url: `${url}/feeds/videos.xml?videoChannelId=${channel.id}`,
      title: titles.channelVideosFeed
    },

    getInstanceRSSFeed({ url, title: titles.instanceVideosFeed })
  ]
}

export function getChannelPodcastFeed (url: string, channel: { id: number }, enclosurePreference?: FeedEnclosurePreference) {
  const enclosurePreferenceQuery = enclosurePreference
    ? `&enclosurePreference=${enclosurePreference}`
    : ''

  return `${url}/feeds/podcast/videos.xml?videoChannelId=${channel.id}${enclosurePreferenceQuery}`
}

// ---------------------------------------------------------------------------

export function getVideoRSSFeeds (options: {
  url: string
  video: { name: string, uuid: string, privacy: VideoPrivacyType }
  titles: {
    instanceVideosFeed: string
    videoCommentsFeed: string
  }
}) {
  const { url, titles, video } = options

  if (video.privacy !== VideoPrivacy.PUBLIC) {
    return [ getInstanceRSSFeed({ url, title: titles.instanceVideosFeed }) ]
  }

  return [
    {
      url: `${url}/feeds/video-comments.xml?videoId=${video.uuid}`,
      title: titles.videoCommentsFeed
    },

    getInstanceRSSFeed({ url, title: titles.instanceVideosFeed })
  ]
}

// ---------------------------------------------------------------------------


export function getPlaylistRSSFeeds (options: {
  url: string
  playlist: { displayName: string, id: number }
  titles: {
    instanceVideosFeed: string
    playlistPodcastFeed: string
    playlistPodcastAudioFeed: string
    playlistPodcastVideoFeed: string
  }
}) {
  const { url, titles, playlist } = options

  return [
    {
      url: getPlaylistPodcastFeed(url, playlist),
      title: titles.playlistPodcastFeed
    },

    {
      url: getPlaylistPodcastFeed(url, playlist, 'audio'),
      title: titles.playlistPodcastAudioFeed
    },

    {
      url: getPlaylistPodcastFeed(url, playlist, 'video'),
      title: titles.playlistPodcastVideoFeed
    },

    getInstanceRSSFeed({ url, title: titles.instanceVideosFeed })
  ]
}

export function getPlaylistPodcastFeed (url: string, playlist: { id: number }, enclosurePreference?: FeedEnclosurePreference) {
  const enclosurePreferenceQuery = enclosurePreference
    ? `&enclosurePreference=${enclosurePreference}`
    : ''

  return `${url}/feeds/podcast/videos.xml?playlistId=${playlist.id}${enclosurePreferenceQuery}`
}
