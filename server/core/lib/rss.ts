import {
  getChannelRSSFeeds as getChannelRSSFeedsCore,
  getInstanceRSSFeed as getDefaultRSSFeedCore,
  getVideoRSSFeeds as getVideoWatchRSSFeedsCore
} from '@peertube/peertube-core-utils'
import { CONFIG } from '@server/initializers/config.js'
import { WEBSERVER } from '@server/initializers/constants.js'
import { MChannel, MVideo } from '@server/types/models/index.js'
import express from 'express'

export function getDefaultRSSFeeds (req: express.Request) {
  return [
    getDefaultRSSFeedCore({
      url: WEBSERVER.URL,
      title: req.t('{instanceName} - Videos feed', { instanceName: CONFIG.INSTANCE.NAME })
    })
  ]
}

export function getChannelRSSFeeds (channel: MChannel, req: express.Request) {
  return getChannelRSSFeedsCore({
    url: WEBSERVER.URL,
    channel,
    titles: {
      instanceVideosFeed: req.t('{instanceName} - Videos feed', { instanceName: CONFIG.INSTANCE.NAME }),
      channelVideosFeed: req.t('{name} - Videos feed', { name: channel.getDisplayName() }),
      channelPodcastFeed: req.t('{name} - Podcast feed', { name: channel.getDisplayName() })
    }
  })
}

export function getVideoRSSFeeds (video: MVideo, req: express.Request) {
  return getVideoWatchRSSFeedsCore({
    url: WEBSERVER.URL,
    video,
    titles: {
      instanceVideosFeed: req.t('{instanceName} - Videos feed', { instanceName: CONFIG.INSTANCE.NAME }),
      videoCommentsFeed: req.t('{videoName} - Comments feed', { videoName: video.name })
    }
  })
}
