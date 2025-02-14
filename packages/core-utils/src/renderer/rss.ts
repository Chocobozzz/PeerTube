import { VideoPrivacy, VideoPrivacyType } from '@peertube/peertube-models'

export function getDefaultRSSFeeds (url: string, instanceName: string) {
  return [
    {
      url: `${url}/feeds/videos.xml`,
      // TODO: translate
      title: `${instanceName} - Videos feed`
    }
  ]
}

export function getChannelRSSFeeds (url: string, instanceName: string, channel: { name: string, id: number }) {
  return [
    {
      url: `${url}/feeds/podcast/videos.xml?videoChannelId=${channel.id}`,
      // TODO: translate
      title: `${channel.name} feed`
    },

    ...getDefaultRSSFeeds(url, instanceName)
  ]
}

export function getVideoWatchRSSFeeds (
  url: string,
  instanceName: string,
  video: { name: string, uuid: string, privacy: VideoPrivacyType }
) {
  if (video.privacy !== VideoPrivacy.PUBLIC) return getDefaultRSSFeeds(url, instanceName)

  return [
    {
      url: `${url}/feeds/video-comments.xml?videoId=${video.uuid}`,
      // TODO: translate
      title: `${video.name} - Comments feed`
    },

    ...getDefaultRSSFeeds(url, instanceName)
  ]
}
