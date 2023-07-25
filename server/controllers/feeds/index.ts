import express from 'express'
import { CONFIG } from '@server/initializers/config'
import { buildRateLimiter } from '@server/middlewares'
import { commentFeedsRouter } from './comment-feeds'
import { videoFeedsRouter } from './video-feeds'
import { videoPodcastFeedsRouter } from './video-podcast-feeds'

const feedsRouter = express.Router()

const feedsRateLimiter = buildRateLimiter({
  windowMs: CONFIG.RATES_LIMIT.FEEDS.WINDOW_MS,
  max: CONFIG.RATES_LIMIT.FEEDS.MAX
})

feedsRouter.use('/feeds', feedsRateLimiter)

feedsRouter.use('/feeds', commentFeedsRouter)
feedsRouter.use('/feeds', videoFeedsRouter)
feedsRouter.use('/feeds', videoPodcastFeedsRouter)

// ---------------------------------------------------------------------------

export {
  feedsRouter
}
