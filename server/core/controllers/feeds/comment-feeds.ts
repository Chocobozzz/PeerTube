import { toSafeHtml } from '@server/helpers/markdown.js'
import { cacheRouteFactory } from '@server/middlewares/index.js'
import express from 'express'
import { CONFIG } from '../../initializers/config.js'
import { ROUTE_CACHE_LIFETIME, WEBSERVER } from '../../initializers/constants.js'
import {
  asyncMiddleware,
  feedsAccountOrChannelFiltersValidator,
  feedsFormatValidator,
  setFeedFormatContentType,
  videoCommentsFeedsValidator
} from '../../middlewares/index.js'
import { VideoCommentModel } from '../../models/video/video-comment.js'
import { buildFeedMetadata, initFeed, sendFeed } from './shared/index.js'

const commentFeedsRouter = express.Router()

// ---------------------------------------------------------------------------

const { middleware: cacheRouteMiddleware } = cacheRouteFactory({
  headerBlacklist: [ 'Content-Type' ]
})

// ---------------------------------------------------------------------------

commentFeedsRouter.get('/video-comments.:format',
  feedsFormatValidator,
  setFeedFormatContentType,
  cacheRouteMiddleware(ROUTE_CACHE_LIFETIME.FEEDS),
  asyncMiddleware(feedsAccountOrChannelFiltersValidator),
  asyncMiddleware(videoCommentsFeedsValidator),
  asyncMiddleware(generateVideoCommentsFeed)
)

// ---------------------------------------------------------------------------

export {
  commentFeedsRouter
}

// ---------------------------------------------------------------------------

async function generateVideoCommentsFeed (req: express.Request, res: express.Response) {
  const start = 0
  const video = res.locals.videoAll
  const account = res.locals.account
  const videoChannel = res.locals.videoChannel

  const comments = await VideoCommentModel.listForFeed({
    start,
    count: CONFIG.FEEDS.COMMENTS.COUNT,
    videoId: video?.id,
    videoAccountOwnerId: account?.id,
    videoChannelOwnerId: videoChannel?.id
  })

  const { name, description, imageUrl, link } = await buildFeedMetadata({ video, account, videoChannel })

  const feed = initFeed({
    name,
    description,
    imageUrl,
    isPodcast: false,
    link,
    resourceType: 'video-comments',
    queryString: new URL(WEBSERVER.URL + req.originalUrl).search
  })

  // Adding video items to the feed, one at a time
  for (const comment of comments) {
    const localLink = WEBSERVER.URL + comment.getCommentStaticPath()

    let title = comment.Video.name
    const author: { name: string, link: string }[] = []

    if (comment.Account) {
      title += ` - ${comment.Account.getDisplayName()}`
      author.push({
        name: comment.Account.getDisplayName(),
        link: comment.Account.Actor.url
      })
    }

    feed.addItem({
      title,
      id: localLink,
      link: localLink,
      content: toSafeHtml(comment.text),
      author,
      date: comment.createdAt
    })
  }

  // Now the feed generation is done, let's send it!
  return sendFeed(feed, req, res)
}
