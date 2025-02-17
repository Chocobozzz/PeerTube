import { Feed } from '@peertube/feed'
import { buildDownloadFilesUrl } from '@peertube/peertube-core-utils'
import { VideoInclude, VideoResolution } from '@peertube/peertube-models'
import { getVideoFileMimeType } from '@server/lib/video-file.js'
import { cacheRouteFactory } from '@server/middlewares/index.js'
import { VideoModel } from '@server/models/video/video.js'
import express from 'express'
import { extname } from 'path'
import { buildNSFWFilter } from '../../helpers/express-utils.js'
import { ROUTE_CACHE_LIFETIME, WEBSERVER } from '../../initializers/constants.js'
import {
  asyncMiddleware,
  commonVideosFiltersValidator,
  feedsAccountOrChannelFiltersValidator,
  feedsFormatValidator,
  setDefaultVideosSort,
  setFeedFormatContentType,
  videosSortValidator,
  videoSubscriptionFeedsValidator
} from '../../middlewares/index.js'
import { buildFeedMetadata, getCommonVideoFeedAttributes, getVideosForFeeds, initFeed, sendFeed } from './shared/index.js'

const videoFeedsRouter = express.Router()

const { middleware: cacheRouteMiddleware } = cacheRouteFactory({
  headerBlacklist: [ 'Content-Type' ]
})

// ---------------------------------------------------------------------------

videoFeedsRouter.get('/videos.:format',
  videosSortValidator,
  setDefaultVideosSort,
  feedsFormatValidator,
  setFeedFormatContentType,
  cacheRouteMiddleware(ROUTE_CACHE_LIFETIME.FEEDS),
  commonVideosFiltersValidator,
  asyncMiddleware(feedsAccountOrChannelFiltersValidator),
  asyncMiddleware(generateVideoFeed)
)

videoFeedsRouter.get('/subscriptions.:format',
  videosSortValidator,
  setDefaultVideosSort,
  feedsFormatValidator,
  setFeedFormatContentType,
  cacheRouteMiddleware(ROUTE_CACHE_LIFETIME.FEEDS),
  commonVideosFiltersValidator,
  asyncMiddleware(videoSubscriptionFeedsValidator),
  asyncMiddleware(generateVideoFeedForSubscriptions)
)

// ---------------------------------------------------------------------------

export {
  videoFeedsRouter
}

// ---------------------------------------------------------------------------

async function generateVideoFeed (req: express.Request, res: express.Response) {
  const account = res.locals.account
  const videoChannel = res.locals.videoChannel

  const { name, description, imageUrl, ownerImageUrl, link, ownerLink } = await buildFeedMetadata({ videoChannel, account })

  const feed = initFeed({
    name,
    description,
    link,
    isPodcast: false,
    imageUrl: ownerImageUrl || imageUrl,
    author: { name, link: ownerLink },
    resourceType: 'videos',
    queryString: new URL(WEBSERVER.URL + req.url).search
  })

  const data = await getVideosForFeeds({
    sort: req.query.sort,
    nsfw: buildNSFWFilter(res, req.query.nsfw),
    isLocal: req.query.isLocal,
    include: req.query.include | VideoInclude.FILES,
    accountId: account?.id,
    videoChannelId: videoChannel?.id
  })

  addVideosToFeed(feed, data)

  // Now the feed generation is done, let's send it!
  return sendFeed(feed, req, res)
}

async function generateVideoFeedForSubscriptions (req: express.Request, res: express.Response) {
  const account = res.locals.account
  const { name, description, imageUrl, link } = await buildFeedMetadata({ account })

  const feed = initFeed({
    name,
    description,
    link,
    isPodcast: false,
    imageUrl,
    resourceType: 'videos',
    queryString: new URL(WEBSERVER.URL + req.url).search
  })

  const data = await getVideosForFeeds({
    sort: req.query.sort,
    nsfw: buildNSFWFilter(res, req.query.nsfw),
    isLocal: req.query.isLocal,
    include: req.query.include | VideoInclude.FILES,
    displayOnlyForFollower: {
      actorId: res.locals.user.Account.Actor.id,
      orLocalVideos: false
    },
    user: res.locals.user
  })

  addVideosToFeed(feed, data)

  // Now the feed generation is done, let's send it!
  return sendFeed(feed, req, res)
}

// ---------------------------------------------------------------------------

function addVideosToFeed (feed: Feed, videos: VideoModel[]) {
  /**
   * Adding video items to the feed object, one at a time
   */
  for (const video of videos) {
    const formattedVideoFiles = video.getFormattedAllVideoFilesJSON(false)

    const torrents = formattedVideoFiles.map(videoFile => ({
      title: video.name,
      url: videoFile.torrentUrl,
      size_in_bytes: videoFile.size
    }))

    const videoFiles = formattedVideoFiles.map(videoFile => {
      return {
        type: getVideoFileMimeType(extname(videoFile.fileUrl), videoFile.resolution.id === VideoResolution.H_NOVIDEO),
        medium: 'video',
        height: videoFile.resolution.id,
        fileSize: videoFile.size,
        url: videoFile.fileUrl,
        framerate: videoFile.fps,
        duration: video.duration,
        lang: video.language
      }
    })

    const { videoFile: bestFile, separatedAudioFile: bestAudioFile } = video.getMaxQualityAudioAndVideoFiles()
    const bestFiles = [ bestFile, bestAudioFile ].filter(f => !!f)

    feed.addItem({
      ...getCommonVideoFeedAttributes(video),

      id: WEBSERVER.URL + video.getWatchStaticPath(),
      author: [
        {
          name: video.VideoChannel.getDisplayName(),
          link: video.VideoChannel.getClientUrl()
        }
      ],
      torrents,

      // Enclosure
      video: bestFiles.length !== 0
        ? {
          url: buildDownloadFilesUrl({ baseUrl: WEBSERVER.URL, videoFiles: bestFiles.map(f => f.id), videoUUID: video.uuid }),
          length: bestFiles.reduce((p, f) => p + f.size, 0),
          type: getVideoFileMimeType('.mp4', bestFile.resolution === VideoResolution.H_NOVIDEO)
        }
        : undefined,

      // Media RSS
      videos: videoFiles,

      embed: {
        url: WEBSERVER.URL + video.getEmbedStaticPath(),
        allowFullscreen: true
      },
      player: {
        url: WEBSERVER.URL + video.getWatchStaticPath()
      },
      community: {
        statistics: {
          views: video.views
        }
      }
    })
  }
}
