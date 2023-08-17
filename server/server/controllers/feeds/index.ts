import express from 'express'
import { CONFIG } from '@server/initializers/config.js'
import { buildRateLimiter } from '@server/middlewares/index.js'
import { commentFeedsRouter } from './comment-feeds.js'
import { videoFeedsRouter } from './video-feeds.js'
import { videoPodcastFeedsRouter } from './video-podcast-feeds.js'

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
